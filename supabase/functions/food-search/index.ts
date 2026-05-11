import { corsHeaders } from '../_shared/cors.ts';

/* =========================================================================
 * food-search — Supabase Edge Function
 * Proxies FatSecret food search so the client_secret never leaves the server.
 * Also optionally passes USDA results from a client-side parallel call.
 *
 * POST /functions/v1/food-search
 * Body: { query: string }
 * Returns: { results: NormalizedFood[] }
 * ========================================================================= */

// Module-level token cache — survives warm invocations (not across cold starts)
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    console.log('[FS] using cached token')
    return cachedToken
  }

  console.log('[FS] fetching new token...')
  const FATSECRET_CLIENT_ID     = Deno.env.get('FATSECRET_CLIENT_ID')!;
  const FATSECRET_CLIENT_SECRET = Deno.env.get('FATSECRET_CLIENT_SECRET')!;
  const credentials = btoa(`${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`)
  console.log('[FS] client_id present:', !!FATSECRET_CLIENT_ID)
  console.log('[FS] client_secret present:', !!FATSECRET_CLIENT_SECRET)

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: 'grant_type=client_credentials&scope=basic'
  })

  console.log('[FS] token response status:', res.status)
  const data = await res.json()
  console.log('[FS] token response:', JSON.stringify(data))

  if (!data.access_token) {
    throw new Error('No access token returned: ' + JSON.stringify(data))
  }

  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
  return cachedToken
}

function parseFsDesc(desc: string) {
  return {
    kcal:    parseInt(desc.match(/Calories:\s*([\d.]+)/)?.[1]  ?? '0'),
    fat:     parseFloat(desc.match(/Fat:\s*([\d.]+)/)?.[1]     ?? '0'),
    carbs:   parseFloat(desc.match(/Carbs:\s*([\d.]+)/)?.[1]   ?? '0'),
    protein: parseFloat(desc.match(/Protein:\s*([\d.]+)/)?.[1] ?? '0'),
  };
}

interface FatSecretFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
}

function normalizeFatSecret(food: FatSecretFood) {
  const { kcal, fat, carbs, protein } = parseFsDesc(food.food_description ?? '');
  return {
    id:               'fs_' + food.food_id,
    source:           'FatSecret',
    name:             food.food_name || 'Unknown Food',
    brand:            food.brand_name || '',
    servingSize:      100,
    servingSizeUnit:  'g',
    kcalPerServing:   Math.round(kcal),
    proteinPerServing: Math.round(protein * 10) / 10,
    carbsPerServing:  Math.round(carbs   * 10) / 10,
    fatPerServing:    Math.round(fat     * 10) / 10,
  };
}

async function searchFatSecret(query: string) {
  const token = await getToken();
  const url   = 'https://platform.fatsecret.com/rest/server.api' +
    `?method=foods.search&search_expression=${encodeURIComponent(query)}&format=json&max_results=10&page_number=0`;

  const res  = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error(`FatSecret search error: ${res.status}`);

  const data = await res.json();
  const raw  = data?.foods?.food;
  if (!raw) return [];

  const arr: FatSecretFood[] = Array.isArray(raw) ? raw : [raw];
  return arr.map(normalizeFatSecret);
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return new Response(JSON.stringify({ foods: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const foods = await searchFatSecret(query.trim());

    return new Response(JSON.stringify({ foods }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[food-search]', err);
    return new Response(JSON.stringify({ error: 'Search failed', foods: [] }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
