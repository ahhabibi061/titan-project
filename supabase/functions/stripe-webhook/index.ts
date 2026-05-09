import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

// Maps Stripe priceIds → IronLab subscription tiers
// Fill these in once you have real priceIds from Stripe Dashboard
const PRICE_TIER_MAP: Record<string, 'pro' | 'elite'> = {
  [Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')   ?? '']: 'pro',
  [Deno.env.get('STRIPE_PRICE_PRO_ANNUAL')    ?? '']: 'pro',
  [Deno.env.get('STRIPE_PRICE_ELITE_MONTHLY') ?? '']: 'elite',
  [Deno.env.get('STRIPE_PRICE_ELITE_ANNUAL')  ?? '']: 'elite',
};

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const body = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-04-10',
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role needed to bypass RLS
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error('checkout.session.completed: no userId in metadata');
      return new Response('Missing userId in metadata', { status: 400 });
    }

    // Retrieve the subscription to get the priceId
    let tier: 'pro' | 'elite' | null = null;
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0]?.price.id ?? '';
      tier = PRICE_TIER_MAP[priceId] ?? null;
    }

    if (!tier) {
      console.error('checkout.session.completed: could not resolve tier from priceId');
      return new Response('Unknown priceId', { status: 400 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ subscription_tier: tier })
      .eq('id', userId);

    if (error) {
      console.error('Failed to update subscription_tier:', error.message);
      return new Response('DB update failed', { status: 500 });
    }

    console.log(`User ${userId} upgraded to ${tier}`);
  }

  if (event.type === 'customer.subscription.deleted') {
    // Subscription cancelled / expired — downgrade back to basic
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;
    if (userId) {
      await supabase
        .from('profiles')
        .update({ subscription_tier: 'basic' })
        .eq('id', userId);
      console.log(`User ${userId} downgraded to basic`);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
