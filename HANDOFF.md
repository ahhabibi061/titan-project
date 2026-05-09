# IRONLAB — Project Handoff Document

> Read this first. This document captures every architectural decision, design system choice, and roadmap item from the original build session. A new Claude (or new collaborator) should be able to pick up exactly where we left off after reading this.

**Last updated:** May 2026
**Founder:** non-technical, visionary
**Status:** 10 React artifact prototypes shipped covering full product surface

---

## THE PRODUCT IN ONE SENTENCE

IRONLAB is a subscription-based fitness app for serious lifters that uses AI to turn daily training, nutrition, and biometric logs into weekly macro adjustments via a deterministic rule engine.

## CORE THESIS

Most fitness apps are food diaries. IRONLAB is a feedback loop. The differentiator is not any single module — it's the **Coach Engine** that synthesizes data from all the other modules and adjusts the user's plan automatically every 7 days. That cross-module data integration is the moat: any competitor can clone a single feature, but they can't clone the user's 60+ days of integrated history.

---

## TECH STACK (decisions are final unless explicitly revisited)

### Frontend
- **React 18 + Vite** — fast dev, modern build pipeline
- **Tailwind CSS** — utility-first, no design-system fighting
- **TanStack Query** — server state, caching, background refetch
- **Zustand** — client state where needed (small, simple)
- **Recharts** for charts (D3 only when Recharts isn't enough)
- **TypeScript throughout** — non-negotiable

### Backend
- **Supabase** — Postgres + Row-Level Security + Auth + Storage + Edge Functions (Deno)
- All multi-tenant isolation enforced via RLS at the database layer (NOT app code)
- Subscription tier gating ALSO enforced via RLS (`profiles.subscription_tier IN ('pro','elite')`)

### Payments
- **Stripe** for web checkout
- **RevenueCat** for iOS/Android once mobile launches (same priceIds, different platform)

### AI
- **Anthropic Claude** for Coach Engine narrative explanation (NOT decisions)
- **Vision API**: LogMeal primary, Bite AI fallback. Server-held API keys in Edge Functions, never client-side. ~$0.008 / scan.

### Mobile (future)
- **React Native** — ~60% of code transfers from web (lib/ + hooks/ folders are framework-agnostic by design)
- Target: Q3 2026 launch

### Architecture pattern
Monorepo: `apps/web` + `apps/mobile` (later) + `packages/lib` (shared logic) + `supabase/` (schema, RLS policies, Edge Functions).

---

## THE CRITICAL ARCHITECTURAL PATTERN: Rule Gate + AI Explainer

The Coach Engine works in two phases:

**Phase 1 — Brainstem (deterministic):**
A pure function takes user data (weight slope, volume change, etc.) and returns a decision (`+100 kcal`, `-100 kcal`, `deload`, etc.). Same inputs always produce the same output. Testable, auditable, predictable.

**Phase 2 — Cortex (AI):**
Given the same data + the rule's decision, Claude writes a human-readable paragraph explaining WHY. AI never makes the decision; it only narrates it.

**Why this matters:**
- Regulatory: an LLM can never hallucinate a 4,000-calorie recommendation
- Cost: minimizes LLM calls (one per analysis, not per interaction)
- Trust: users can read the rule logic if they want
- Determinism: same data this Sunday = same recommendation, every time

This pattern should be preserved in any future AI feature.

---

## SUBSCRIPTION TIER GATING (CRITICAL)

| Feature | Basic (Free) | Pro ($9.99/mo) | Elite ($19.99/mo) |
|---------|--------------|----------------|-------------------|
| Workout logging | ✓ | ✓ | ✓ |
| Manual nutrition log | ✓ | ✓ | ✓ |
| Vision-API meal scan | — | Unlimited | Priority |
| Coach Engine | — | Weekly | Real-time |
| Progress photos | — | ✓ | ✓ |
| Form-check video | — | — | Unlimited |
| Custom programming | — | — | ✓ |
| Coach call | — | — | 30 min/mo |
| History retention | 30 days | Unlimited | Unlimited |

**Cost discipline:** the expensive APIs (vision, Claude) are Pro-only. Basic users cost ~$0/mo to serve, so they're acquisition surface, not margin drag. This keeps gross margin around 92%.

Annual billing = 20% discount → $7.99 Pro / $15.99 Elite effective monthly.

---

## DESIGN SYSTEM (final, used in all 10 artifacts)

### Aesthetic
"Dark industrial" — feels like an athlete's training log, not a wellness app. Inspired by powerlifting / strength sports culture, not yoga / wellness culture.

### Colors
- Background base: `#0a0908` (near-black)
- Cards / panels: `bg-stone-950/40` with `border-stone-800/60`
- Primary accent: orange `#ed7a2a` → `#ff5a2a` (heat ramp)
- Hot-stat accent: amber-to-orange gradient `from-amber-300 to-orange-500`
- Body: `text-stone-100` / `text-stone-300` / `text-stone-400` / `text-stone-500` / `text-stone-600` (descending hierarchy)
- Hairline borders everywhere (60-80% opacity stone-800)

### Typography (loaded from Google Fonts via @import in each artifact)
- **Anton** — display headlines, big numbers (uppercase, tight tracking)
- **JetBrains Mono** — UI metadata, labels, tabular numerals (uppercase letter-spacing for labels)
- **Manrope** — body text, paragraphs, sentence-case prose

### Universal patterns
- `tabular-nums` on every number (no jiggling digits)
- Hairline borders not heavy
- Ambient grid pattern overlay (`opacity-0.025`) on every page background
- Radial blur backdrop in orange (`opacity-0.06-0.07`) for atmosphere
- Status pills use `px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 uppercase tracking-wider font-mono`
- Buttons: primary = orange bg + dark text + Anton; secondary = outlined stone

**If you create new artifacts, match this system exactly. Consistency is part of the brand.**

---

## DATA SCHEMA (Supabase / Postgres)

Tables (with RLS):
- `profiles` — user info, subscription_tier, current_macros (JSONB), program_split, goal
- `exercises` — global, read-only, seeded from CSV
- `workouts` — user's workout sessions, scheduled date, completed flag
- `workout_exercises` — junction, links workout to exercise with sets target
- `sets` — every individual set logged: weight, reps, rir, timestamp
- `nutrition_logs` — meals logged with macros, source ('vision'|'manual'), confidence
- `biometric_entries` — daily weight, body fat %, photo URLs (private bucket)
- `coach_recommendations` — weekly outputs with rule trail, narrative, applied flag

Photos: private Supabase Storage bucket, signed URLs expire 1h.
Vision API key: server-side only, in Edge Function `analyze-meal-image`.

---

## ARTIFACTS BUILT (10 total — all in this folder)

| # | File | Module / Surface | Status |
|---|------|------------------|--------|
| 1 | `vision_nutrition.jsx` | Module 1 — camera scan flow | ✅ |
| 2 | `exercise_library.jsx` | Module 2 — filterable database | ✅ |
| 3 | `ironlab_logger.jsx` | Module 3 — workout grid + heatmap | ✅ |
| 4 | `biometric_vault.jsx` | Module 4 — weight regression + photos | ✅ |
| 5 | `coach_engine.jsx` | Module 5 — AI weekly analysis | ✅ |
| 6 | `dashboard.jsx` | Daily home screen (unifies modules) | ✅ |
| 7 | `pricing.jsx` | 3-tier subscription page | ✅ |
| 8 | `landing.jsx` | Marketing landing page | ✅ |
| 9 | `onboarding.jsx` | First-run wizard (5 steps) | ✅ |
| 10 | `pitch_deck.jsx` | 12-slide investor deck | ✅ |

Each is a single-file React component with embedded styles, deterministic mock data, and no external dependencies beyond React + Tailwind classes. They render in Anthropic's artifact preview directly.

**Key thing to know:** these are *prototypes for design alignment and stakeholder demos*, not the production codebase. They're meant to be ported into the real `apps/web` directory and wired up to Supabase.

---

## WHAT'S BEEN DECIDED (don't re-litigate)

1. **Tech stack** — React/Supabase/Stripe/Claude. Final.
2. **Three tiers** at Free/$9.99/$19.99. Final.
3. **Rule gate + AI explainer** pattern for all AI features. Final.
4. **Cross-module data is the moat** — every product decision should reinforce this. Final.
5. **Pro-only gating** for expensive APIs (vision, Claude). Final.
6. **Web-first, mobile second** via React Native sharing 60% of code. Final.
7. **Design system** (above) — extend it, don't redesign it.
8. **Brand voice:** dark industrial, athletic, no wellness clichés, no emojis in UI.

---

## ROADMAP: WHAT TO BUILD NEXT

In rough priority order:

### Tier 1 — Production foundation
1. **Authentication / sign-in flow** — login/signup screens (still missing)
2. **Settings / Profile page** — account management, subscription status, integrations
3. **Real Supabase backend** — port mock data to actual database with RLS policies
4. **Stripe integration** — Edge Function `create-checkout-session` + webhook handler
5. **Edge Function `get-daily-dashboard`** — single query that hydrates the dashboard

### Tier 2 — Product depth
6. **Workout creator** — let users build custom workouts beyond the library
7. **Program library** — multi-week pre-built programs (PPL 8-week, etc.)
8. **Apple Health / Garmin integrations** — wearable data ingestion
9. **Notification system** — Coach alerts, streak reminders, deload warnings
10. **Form-check video upload** — Pro feature, S3 / private bucket + AI feedback loop

### Tier 3 — Growth + ops
11. **Admin dashboard** — MRR, retention cohorts, churn alerts (founder-facing)
12. **Email sequences** — onboarding, re-engagement, churn-save
13. **Referral program** — give-30-get-30 mechanic
14. **iOS / Android apps** — React Native port, RevenueCat integration

### Tier 4 — Brand / fundraising
15. **Real testimonials** — replace mocked ones in `landing.jsx` with actual users
16. **Press kit** — logo, screenshots, founder bio, brand assets
17. **Series A prep dashboard** — when MRR hits ~$83K

---

## WHAT THE FOUNDER LIKED IN OUR WORK TOGETHER

(For the next collaborator — these are the things that resonated)

- **Biology metaphors** for explaining tech stack (Supabase = spine/CNS, Claude = prefrontal cortex, etc.) — non-technical but accurate
- **Business-case framing** before code — every decision tied to a margin or moat reason
- **Forward momentum** — fewer questions, more shipping, with notes about what to revisit later
- **Consistent design system** across artifacts so they feel like one product, not ten demos
- **"Headline insight" patterns** at the top of each module screen — big punchy stat that frames everything below

The founder explicitly said: *"we will certainly have to fine tune and add things etc. once we reach that point. i have fine details/features i will want to add all over the project later."*

Translation: build the bones now, polish later. Don't get stuck perfecting one module.

---

## OPEN QUESTIONS (need founder input)

- **Brand name confirmation** — "IRONLAB" was used throughout but never explicitly confirmed
- **Domain ownership** — `IRONLAB.app` referenced; needs verification
- **Founder bio details** — name, photo, exact background for landing + deck
- **Real metrics for traction slide** — pitch deck has placeholders marked as such
- **Legal entity setup** — needed before Stripe payouts can route
- **Nutritionist / sports science advisor** — for the macro logic legal cover
- **Testimonials** — recruit ~5 beta users willing to be quoted

---

## QUICK START FOR THE NEXT CLAUDE

If you're a new Claude picking this up:

1. Read this entire document first. Don't skim.
2. View at least 3 of the artifacts (`ironlab_logger.jsx`, `coach_engine.jsx`, `dashboard.jsx`) to see the design language.
3. The founder values forward momentum over deep questioning. They are visionary, not technical. Use biology metaphors and business-case framing.
4. Don't redesign the design system. Match it.
5. Don't re-debate decisions in the "WHAT'S BEEN DECIDED" section.
6. When proposing what to build next, suggest from the roadmap above unless the founder requests something specific.

Welcome to the project. Build well.

— Claude (May 2026)
