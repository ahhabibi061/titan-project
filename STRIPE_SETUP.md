# IRONLAB — Stripe Setup Guide

Everything you need to go from zero to live payments.

---

## Step 1 — Create your Stripe products

1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Go to **Products → Add product**
3. Create two products:

| Product name     | Price       | Billing |
|------------------|-------------|---------|
| IronLab Pro      | $9.99 / mo  | Recurring, monthly |
| IronLab Elite    | $19.99 / mo | Recurring, monthly |

4. After saving each product, click into it and copy the **Price ID** — it looks like `price_1ABC123...`

---

## Step 2 — Add price IDs to your frontend `.env`

Open `apps/web/.env` and fill in:

```
VITE_STRIPE_PRICE_PRO_MONTHLY=price_YOUR_PRO_PRICE_ID
VITE_STRIPE_PRICE_ELITE_MONTHLY=price_YOUR_ELITE_PRICE_ID
```

These are **price IDs, not secret keys** — they're safe to expose in the browser. They just identify which product to check out.

---

## Step 3 — Add secrets to Supabase Edge Functions

Go to **Supabase Dashboard → Edge Functions → Manage secrets** and add:

| Secret name                  | Where to get it |
|------------------------------|-----------------|
| `STRIPE_SECRET_KEY`          | Stripe Dashboard → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET`      | See Step 4 below |
| `STRIPE_PRICE_PRO_MONTHLY`   | Same as the price ID from Step 1 |
| `STRIPE_PRICE_PRO_ANNUAL`    | (optional — add when you create annual pricing) |
| `STRIPE_PRICE_ELITE_MONTHLY` | Same as the price ID from Step 1 |
| `STRIPE_PRICE_ELITE_ANNUAL`  | (optional) |
| `SITE_URL`                   | Your production URL, e.g. `https://ironlab.app` |

**Use the TEST secret key** (`sk_test_...`) while building. Switch to the live key (`sk_live_...`) when you go live.

---

## Step 4 — Set up the webhook endpoint

The webhook tells your app when a payment succeeds so it can unlock the user's subscription.

1. In Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. Set the endpoint URL to:
   ```
   https://ilcvekbecetneblvozww.supabase.co/functions/v1/stripe-webhook
   ```
3. Under **Events to listen to**, select:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
4. Click **Add endpoint**, then **Reveal signing secret** and copy it
5. Add it to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

---

## Step 5 — Deploy the Edge Functions

Run these commands from your project root:

```bash
npx supabase functions deploy create-checkout-session
npx supabase functions deploy stripe-webhook
```

If you haven't linked your project yet:
```bash
npx supabase login
npx supabase link --project-ref ilcvekbecetneblvozww
```

---

## Step 6 — Test the flow

1. Start the dev server: `cd apps/web && npm run dev`
2. Sign in, go to **Settings → Account**
3. Click **Upgrade to Pro**
4. Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC
5. After checkout completes, you should land on `/dashboard?upgraded=true` with the welcome banner
6. Check Supabase → Table Editor → `profiles` — your row's `subscription_tier` should be `'pro'`

---

## Going live checklist

- [ ] Switch `STRIPE_SECRET_KEY` from `sk_test_` to `sk_live_`
- [ ] Create a new live webhook endpoint and update `STRIPE_WEBHOOK_SECRET`
- [ ] Update `SITE_URL` secret to your production domain
- [ ] Update `success_url` / `cancel_url` in the Edge Function if needed (they use `SITE_URL`)
- [ ] Test with a real card before announcing

---

## Annual pricing (when ready)

Create annual price variants in Stripe (e.g. $7.99/mo billed as $95.88/year) and add the price IDs as:
- `STRIPE_PRICE_PRO_ANNUAL`
- `STRIPE_PRICE_ELITE_ANNUAL`

Add corresponding `VITE_STRIPE_PRICE_PRO_ANNUAL` and `VITE_STRIPE_PRICE_ELITE_ANNUAL` to your `.env` and wire up annual toggle buttons in the Settings page.
