# IRONLAB — Product Requirements Document (v0.4)

> Source-of-truth spec for the IRONLAB fitness app. Captures product vision, the 5 modules, data schema, and subscription model.

---

## 1. PRODUCT VISION

A subscription-based fitness app that closes the feedback loop between training, nutrition, and body composition. Every other fitness app on the market is a logging tool. IRONLAB is a *coaching* tool — it reads your data and adjusts your plan automatically.

**Target user:** the serious lifter / amateur athlete training 3-6 days a week with body composition goals (cut, bulk, recomp). Not the casual gym-goer; not the elite pro athlete. The middle-prosumer.

**Pricing:** Free tier for acquisition, $9.99/mo Pro for core revenue, $19.99/mo Elite for high-margin coaching-grade tier.

---

## 2. THE FIVE MODULES

### Module 1 — Vision-Nutrition (`vision_nutrition.jsx`)

**Purpose:** Frictionless meal logging via camera scan.

**Flow:**
1. User taps camera, photographs meal
2. Image POSTed to Edge Function `analyze-meal-image` which proxies to vision API
3. API returns ranked candidate matches (3-5 results) with confidence scores
4. User confirms top match OR selects alternate OR falls through to manual entry
5. Confirmed entry writes to `nutrition_logs` with `source='vision_api'` and confidence score

**Critical decisions:**
- Vendor: LogMeal primary, Bite AI fallback (negotiate pricing tiers)
- Cost: ~$0.008/scan — gated to Pro tier only
- Auto-confirm threshold: 90%+ confidence, otherwise force user selection
- Manual fallback always available (no scan failure can block logging)
- Photos NOT permanently stored unless user opts in

### Module 2 — Exercise Library (`exercise_library.jsx`)

**Purpose:** Curated database of exercises with metadata enabling smart filtering.

**Schema per exercise:**
- `name`, `primary_muscle`, `secondary_muscles[]`, `equipment`, `pattern` (push/pull/squat/hinge/isolation), `difficulty` (1-5), `splits[]` (which programs it fits), `premium` (free/Pro), `cues[]` (form notes), `popularity` (computed from logs)

**Filters:**
- Search (text, name match)
- Training split: PPL / Upper-Lower / Bro split (multi-group chip selector)
- Muscle group (multi-select chips)
- Equipment (multi-select)
- Sort: popular, A-Z, compound-first, hardest-first

**Pro gating:**
- Free: 30 exercises, basic cues
- Pro: 100+ exercises, video demos, advanced variations
- Elite: form-check video reviews

### Module 3 — IRONLAB LOGGER (`ironlab_logger.jsx`)

**Purpose:** Excel-grade workout logging with progressive overload tracking.

**Core features:**
- Editable grid: rows = exercises, columns = sets (weight, reps, RPE)
- Progressive overload badges per set (PR / MATCH / DOWN / NEW) computed against last session
- Live muscle volume heatmap — front + back anatomical SVG, colors warm by stimulus intensity
- Volume calculation: `sets × reps × weight × muscle_weight` (primary 1.0×, secondary 0.5×)
- Volume breakdown bars showing distribution across muscle groups
- Hover tooltips on muscle paths

**Data flow:**
- Each row saved to `sets` table on blur (debounced)
- Volume aggregations computed client-side from session, server-side for trends

### Module 4 — Biometric Vault (`biometric_vault.jsx`)

**Purpose:** Longitudinal body composition tracking with predictive math.

**Components:**
1. **90-day weight chart** — raw daily points + 7-day moving average + linear regression trendline + goal weight reference line + photo capture markers + interactive crosshair tooltip
2. **Goal projection** — extrapolates from regression slope to estimate goal-weight ETA in days + calendar date
3. **Body composition split** — lean vs fat mass bars, start vs current with deltas
4. **Photo timeline scrubber** — horizontal slider with photo markers; click to compare start vs current photos (front/side/back × 2)
5. **Derived metrics card** — slope per week, % bw/wk, est daily deficit, days remaining, pace status

**Math:**
- Linear regression: ordinary least squares
- Moving average window: 7 days
- Goal projection: `daysToGoal = (currentWeight - goalWeight) / -slope`

**Photo storage:**
- Private Supabase Storage bucket
- Signed URLs expire 1h
- Encrypted at rest
- Pro tier feature only

### Module 5 — Coach Engine (`coach_engine.jsx`)

**Purpose:** Weekly cross-module synthesis that adjusts the user's plan.

**Architecture (CRITICAL):**

Two phases:

**Phase 1 — Rule Gate (deterministic, server-side function):**
```
Inputs:  goal, weight slope, calorie avg, volume change per muscle group
Outputs: { kcalDelta, deload (bool), label, reasoningTrail[] }
```

Rules (for `goal === 'cut'`):
- `slope >= -0.3% bw/wk` → cut stalled → `kcalDelta: -100`
- `slope < -0.7% bw/wk` AND `regressing muscles >= 3` → over-reaching → `kcalDelta: +150, deload: true`
- `slope < -0.7% bw/wk` AND `regressing muscles < 3` → too aggressive → `kcalDelta: +100`
- `-0.3% to -0.7% bw/wk` → on target → `kcalDelta: 0`

Rules for bulk, recomp, maintain follow same pattern with different thresholds.

**Phase 2 — Narrative (Claude API):**

Given the rule's decision and the same context, Claude writes a 2-4 sentence paragraph explaining the *why*. AI explains, doesn't decide.

**Why this split matters:**
- Regulatory: deterministic rules are auditable
- Cost: 1 LLM call/week/user, not per-interaction
- Trust: users can read the rule path
- Reproducibility: same data → same recommendation

**Output stored in `coach_recommendations` table** with:
- Trail (for UI highlighting active branch)
- Decision (kcalDelta, deload, label)
- Narrative (Claude output)
- Applied (bool, true once user confirms)
- Auto-apply after 24h with no user action

---

## 3. DATA SCHEMA (Supabase / Postgres)

```sql
-- All tables have RLS enabled. Default policy: user_id = auth.uid()

profiles (
  id uuid PK references auth.users,
  display_name text,
  subscription_tier text CHECK (IN ('basic','pro','elite')),
  stripe_customer_id text,
  goal text CHECK (IN ('cut','bulk','recomp','maintain')),
  start_weight_kg numeric,
  goal_weight_kg numeric,
  height_cm numeric,
  age int,
  sex text,
  activity_level text,
  experience text,
  program_split text,
  current_macros jsonb,  -- { kcal, protein, carbs, fat }
  created_at timestamptz DEFAULT now()
)

exercises (
  id text PK,
  name text NOT NULL,
  primary_muscle text,
  secondary_muscles text[],
  equipment text,
  pattern text,
  difficulty int CHECK (BETWEEN 1 AND 5),
  splits text[],
  premium bool DEFAULT false,
  cues text[],
  video_url text  -- private CDN, signed
)
-- Read-only, global. RLS: SELECT true for free; premium=true gated by tier.

workouts (
  id uuid PK,
  user_id uuid references profiles,
  name text,
  scheduled_date date,
  completed_at timestamptz,
  notes text
)

workout_exercises (
  id uuid PK,
  workout_id uuid references workouts,
  exercise_id text references exercises,
  order_index int,
  sets_target int
)

sets (
  id uuid PK,
  workout_exercise_id uuid references workout_exercises,
  set_number int,
  weight_kg numeric,
  reps int,
  rir int,  -- reps in reserve
  logged_at timestamptz DEFAULT now()
)

nutrition_logs (
  id uuid PK,
  user_id uuid references profiles,
  meal_name text,
  kcal int,
  protein_g int,
  carbs_g int,
  fat_g int,
  source text CHECK (IN ('manual','vision_api','barcode')),
  confidence numeric,  -- 0-100, only set if source=vision_api
  logged_at timestamptz DEFAULT now()
)

biometric_entries (
  id uuid PK,
  user_id uuid references profiles,
  weight_kg numeric NOT NULL,
  body_fat_pct numeric,
  photo_front_url text,  -- signed URL from private bucket
  photo_side_url text,
  photo_back_url text,
  notes text,
  logged_at date NOT NULL
  UNIQUE (user_id, logged_at)
)

coach_recommendations (
  id uuid PK,
  user_id uuid references profiles,
  generated_at timestamptz DEFAULT now(),
  cycle_number int,
  trail jsonb,  -- rule path taken
  decision jsonb,  -- { kcalDelta, deload, label }
  narrative text,  -- Claude-generated explanation
  old_macros jsonb,
  new_macros jsonb,
  applied bool DEFAULT false,
  applied_at timestamptz
)
```

### RLS Policies (representative)

```sql
-- profiles: only owner can read/write own profile
CREATE POLICY "own profile" ON profiles
  USING (auth.uid() = id);

-- nutrition_logs: only owner reads/writes
CREATE POLICY "own nutrition" ON nutrition_logs
  USING (auth.uid() = user_id);

-- vision_api scan results gated by tier
CREATE POLICY "vision is pro" ON nutrition_logs
  FOR INSERT WITH CHECK (
    source != 'vision_api' OR
    (SELECT subscription_tier FROM profiles WHERE id = auth.uid()) IN ('pro','elite')
  );

-- exercises: free read, premium gated
CREATE POLICY "exercise tier gate" ON exercises
  FOR SELECT USING (
    premium = false OR
    (SELECT subscription_tier FROM profiles WHERE id = auth.uid()) IN ('pro','elite')
  );
```

---

## 4. EDGE FUNCTIONS (Supabase Deno runtime)

| Function | Purpose | Tier gate |
|----------|---------|-----------|
| `analyze-meal-image` | Proxies image to vision API, parses results | Pro+ |
| `run-coach-analysis` | Weekly cron job per user; rule gate + Claude call | Pro+ |
| `get-daily-dashboard` | Single query joining all modules' today snapshot | All |
| `create-checkout-session` | Stripe checkout URL generation | All |
| `stripe-webhook` | Handles `checkout.session.completed` + cancellations | All |

---

## 5. SUBSCRIPTION MODEL

| | Basic | Pro | Elite |
|--|--|--|--|
| Price (monthly) | Free | $9.99 | $19.99 |
| Price (annual) | Free | $7.99/mo | $15.99/mo |
| Workout logging | ✓ | ✓ | ✓ |
| Manual nutrition | ✓ | ✓ | ✓ |
| Vision meal scan | — | Unlimited | Priority |
| Coach Engine | — | Weekly | Real-time |
| Progress photos | — | ✓ | ✓ |
| Form-check video | — | — | Unlimited |
| Custom programming | — | — | ✓ |
| Coach call | — | — | 30 min/mo |
| Library size | 30 | 100+ | 100+ |
| History retention | 30 days | Unlimited | Unlimited |
| API access | — | — | ✓ |
| Support | Community | 24h email | 4h priority |

**14-day free Pro trial** — no card required for Basic; card required for trial. Auto-converts day 15.

**Cost discipline:** vision API + Claude calls cost ~$0.10-0.30 per Pro user per month at typical usage. Basic users cost effectively $0. Gross margin target: 92%.

---

## 6. KEY METRICS & TARGETS

| Metric | Target |
|--------|--------|
| Free → Pro conversion | 8-12% |
| D30 retention (Pro) | 60%+ |
| D90 retention (Pro) | 45%+ |
| Avg sessions/active day | 4+ |
| Free trial → paid conversion | 35%+ |
| Pro → Elite upgrade rate | 5-8% |
| Annual upgrade rate | 30%+ |
| LTV / CAC | 3.0+ minimum, 5.0+ target |
| Gross margin | 90%+ |

---

## 7. NON-GOALS (explicit)

To stay focused, IRONLAB is NOT:
- A general wellness app (no meditation, sleep tracking as primary, etc.)
- A casual gym-goer app (we don't compete with Apple Fitness)
- A rehab / physical therapy tool
- A nutrition coaching service for people without clear body comp goals
- A social network (some social features later, but not a feed-driven app)
- A marketplace (no equipment sales, supplement affiliate, etc.)

We can add adjacent features later, but the core thesis is: feedback-loop coaching for serious lifters.

---

*This PRD is the source of truth. Any feature decisions should be checked against it. If something's not in here, it's an open question.*
