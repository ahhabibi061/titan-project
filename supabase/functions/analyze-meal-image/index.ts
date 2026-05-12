import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scan limits per tier
const SCAN_LIMITS: Record<string, number> = {
  basic: 0,
  pro: 10,
  elite: 999,
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    // User-scoped client (for auth)
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Tier check ──────────────────────────────────────────────────────────
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await adminClient
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier  = profile?.subscription_tier ?? 'basic';
    const limit = SCAN_LIMITS[tier] ?? 0;

    if (limit === 0) {
      return new Response(
        JSON.stringify({
          error: 'upgrade_required',
          message: 'AI Meal Scanner is a Pro feature. Upgrade to unlock up to 10 scans per day.',
          tier,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Rate limit ──────────────────────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: scansToday } = await adminClient
      .from('nutrition_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('source', 'vision_api')
      .gte('logged_at', todayStart.toISOString());

    const used = scansToday ?? 0;

    if (limit !== 999 && used >= limit) {
      const tomorrow = new Date(todayStart);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: `You've used all ${limit} scans for today. Resets at midnight.`,
          scans_used: used,
          scans_limit: limit,
          resets_at: tomorrow.toISOString(),
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Parse request body ──────────────────────────────────────────────────
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'bad_request', message: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Call Claude vision ──────────────────────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: imageBase64 },
              },
              {
                type: 'text',
                text: `Analyze this meal image and return ONLY a valid JSON object (no markdown, no commentary) with this exact shape:
{
  "meal_name": "string — short descriptive name",
  "confidence": number — 0 to 100,
  "items": [
    {
      "name": "string",
      "quantity": "string — e.g. '1 cup', '200g'",
      "kcal": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ],
  "totals": {
    "kcal": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number
  },
  "notes": "string — optional short note about the estimate"
}

Estimate nutritional values as accurately as possible based on visible portion sizes. If you cannot identify the food clearly, set confidence below 50. Return only the JSON object.`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', errText);
      return new Response(
        JSON.stringify({ error: 'ai_error', message: 'Vision analysis failed. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text ?? '';

    // Parse the JSON from Claude's response
    let mealData: {
      meal_name: string;
      confidence: number;
      items: Array<{ name: string; quantity: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }>;
      totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
      notes?: string;
    };

    try {
      // Strip any accidental markdown fences
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      mealData = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse Claude response:', rawText);
      return new Response(
        JSON.stringify({ error: 'parse_error', message: 'Could not parse meal analysis. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Return result ───────────────────────────────────────────────────────
    const remaining = limit === 999 ? 999 : limit - used - 1;

    return new Response(
      JSON.stringify({
        ...mealData,
        scans_used: used + 1,
        scans_remaining: remaining,
        scans_limit: limit,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'general', message: 'An unexpected error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
