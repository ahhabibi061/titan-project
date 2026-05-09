# IRONLAB — Project Files

> A subscription-based fitness app for serious lifters. AI-driven feedback loop between training, nutrition, and body composition.

---

## What's in this folder

10 React artifact prototypes + 3 documentation files capturing the full product surface.

### Documentation (read these first)
| File | Purpose |
|------|---------|
| `HANDOFF.md` | **READ FIRST.** Complete project state, decisions made, and roadmap. Designed for transferring to a new collaborator. |
| `PRD.md` | Product Requirements Document — full technical spec for all 5 modules + data schema |
| `README.md` | This file |

### Application surfaces (the 5 modules)
| File | Module |
|------|--------|
| `vision_nutrition.jsx` | Module 1 — Camera-scan meal logging |
| `exercise_library.jsx` | Module 2 — Filterable exercise database |
| `ironlab_logger.jsx` | Module 3 — Workout grid + muscle volume heatmap |
| `biometric_vault.jsx` | Module 4 — Weight regression + photo timeline |
| `coach_engine.jsx` | Module 5 — Weekly AI macro adjustments |

### Application surfaces (supporting screens)
| File | Surface |
|------|--------|
| `dashboard.jsx` | Daily home screen — unifies all 5 modules |
| `onboarding.jsx` | First-run setup wizard (5 steps, computes starting macros) |

### Marketing & business surfaces
| File | Purpose |
|------|--------|
| `landing.jsx` | Public marketing landing page |
| `pricing.jsx` | 3-tier subscription page with feature comparison |
| `pitch_deck.jsx` | 12-slide investor pitch deck (keyboard-navigable) |

---

## Tech stack at a glance

- **Frontend:** React 18 + Vite + Tailwind + TanStack Query + Zustand + TypeScript
- **Backend:** Supabase (Postgres + RLS + Auth + Storage + Edge Functions)
- **Payments:** Stripe (web), RevenueCat (mobile, future)
- **AI:** Anthropic Claude (Coach narrative) + LogMeal/Bite AI (vision)
- **Mobile:** React Native (Q3 2026)

Detailed rationale + architecture in `HANDOFF.md`.

---

## How to use these files

Each `.jsx` file is a **single-file React component** with:
- Embedded Tailwind classes
- Embedded Google Fonts via `@import`
- Deterministic mock data
- No external dependencies beyond React

**To preview:**
- Drop into Anthropic's artifact preview, or
- Wrap in a Vite + React + Tailwind starter and import as the default export

**To productionize:**
- Port the component logic into your `apps/web/src/pages/` directory
- Replace mock data with TanStack Query hooks against Supabase
- Extract reusable primitives (charts, cards) into `apps/web/src/components/`
- Move framework-agnostic logic (linear regression, rule gate, macro calc) into `packages/lib/`

---

## Project status (May 2026)

**Built:**
- Visual prototypes for all 5 modules ✓
- Daily dashboard ✓
- Onboarding flow with macro calculator (Mifflin-St Jeor) ✓
- Marketing landing + pricing + pitch deck ✓

**Next priorities** (full list in `HANDOFF.md` § Roadmap):
1. Authentication / sign-in
2. Settings + profile
3. Real Supabase backend with RLS policies
4. Stripe integration
5. Workout creator
6. Apple Health / Garmin integration
7. Mobile React Native port

---

## Design system summary

- **Aesthetic:** dark industrial — feels like an athlete's training log
- **Background:** `#0a0908` near-black
- **Accent:** orange `#ed7a2a` → `#ff5a2a` heat ramp
- **Display:** Anton (uppercase, tight)
- **Mono:** JetBrains Mono (labels, numerals)
- **Body:** Manrope
- **Borders:** hairline, 60-80% opacity stone-800
- **Numbers:** always `tabular-nums`

Full design system spec in `HANDOFF.md` § Design System.

---

## Key product principle: rule gate + AI explainer

The Coach Engine architecture is the most important pattern in the codebase:

1. **Deterministic rule function** decides what to do (the brainstem)
2. **Claude API** writes the human-readable explanation (the cortex)

AI never makes the decision — it only narrates it. This is non-negotiable for trust, cost control, and auditability.

Apply this pattern to any future AI feature.

---

*For questions, start with `HANDOFF.md`.*
