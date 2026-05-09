---
# IRONLAB — Claude Code Context File

## READ FIRST
Subscription fitness app for serious lifters. 10 React prototypes built and migrated.
Full project context in HANDOFF.md. Full technical spec in PRD.md.

## DESIGN SYSTEM — NON-NEGOTIABLE
- Background: #0a0908, Cards: bg-stone-950/40, Accent: orange #ed7a2a → #ff5a2a
- Fonts: Anton (headlines), JetBrains Mono (labels/numbers), Manrope (body)
- Match existing .jsx files exactly. Never redesign.

## DECIDED — DO NOT RE-DEBATE
- Stack: React 18 + Vite + Tailwind + TanStack Query + Supabase + Stripe + Claude AI
- Tiers: Free / Pro $9.99 / Elite $19.99
- AI pattern: Rule gate decides, Claude narrates. AI never makes the decision.

## CURRENT BUILD STATUS
- 10 prototype artifacts migrated into apps/web/src/pages/
- Auth flow complete (UI + SQL schema with RLS)
- Supabase client configured via env vars
- Next: wire auth screens to Supabase signUp/signIn

## WORKING WITH THIS FOUNDER
- Non-technical, visionary. Plain English always.
- Forward momentum. Ship then refine.
- Always tell me which files changed and the exact git commit command to run.
---
