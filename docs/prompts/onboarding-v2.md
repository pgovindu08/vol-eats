# ONBOARDING_V2_PROMPT.md: Campus Fuel (Vol Hacks)

Paste everything between the two `=====` lines into Claude Code from the repo root, on branch `feature/onboarding-v2`. Like the frontend prompt, it runs in phases and stops after each one so you can review and commit.

**Scope guard:** the work is split into tiers. Build **Tier 1** completely before touching Tier 2, and stop after any phase if time is short. A finished Tier 1 is a better demo than a half-built Tier 3.

=====

## Role

You are the senior frontend engineer on Campus Fuel. Onboarding v1 already works: `app/(onboarding)/onboarding`, `components/onboarding/*`, `lib/schemas.ts`, `lib/onboarding-draft.ts` and `lib/targets.ts`. Your job is onboarding v2. It should understand **how the student actually eats** (on campus with a meal plan, off campus with a plan, or off campus buying their own groceries), and it should hold up when a real student **leaves partway, skips setup, or comes back later**.

Read these first:
- `CONTEXT.md`: the team log, plus §7–§9 if a teammate has written them by now.
- `README.md`.
- The existing onboarding files listed above.
- `lib/types.ts`, `lib/api.ts`, `lib/session.ts` and `lib/hooks/use-profile.tsx`.

Then make a short plan before writing code. Keep everything that already works: the zod-per-step validation, the unit toggle, the guardrails, design tokens only, and Lighthouse accessibility at 100.

It's a 44-hour hackathon judged by live demo. Make it reliable and fast to finish, and keep the demo path in mind.

## Priority tiers

| Tier | What | Why |
|---|---|---|
| **1: Must** | Living-situation branch (on campus / off campus with a plan / off campus cooking), favorite dining hall → Plates default, leaving and coming back (below), review step | The core ask, and it keeps real users from getting stuck. Mostly cheap. |
| **2: Should** | Goal pace, training days → protein, foods you don't like → plate filtering, Profile screen to edit answers later, off-campus grocery budget card on Budget | Better targets and personalization that judges can see |
| **3: Stretch** | Target date with projected goal date, hide-calories mode on every screen, sport toggle, grocery stores, cook time | Nice touches. Each one is optional. |

## Leaving and coming back (Tier 1)

Real students get interrupted: class starts, the phone dies, they just want to look around first. Handle each case.

1. **Leave mid-setup, come back later.**
   - The draft autosaves on every step change, as it does now.
   - When they return to `/onboarding` with a draft, show a small "Welcome back" card above the current step: "Pick up where you left off: Step 3 of 6", with buttons **Continue** (the default) and **Start over**.
   - Start over asks for confirmation, then clears the draft.
2. **Drafts are per user (privacy fix).** v1 saves the draft under one shared key (`cf.onboarding-draft`). Change it:
   - Key the draft by email, e.g. `cf.onboarding-draft:<email>`.
   - Signing in as someone else must never show another person's answers.
   - Signing out keeps your own draft (so you can come back) but never shows it to anyone else.
   - Migrate an old unkeyed draft to the current user once, then delete it.
3. **Drafts expire.** A draft older than 14 days is dropped quietly. Store `updated_at` in it.
4. **The browser back button works.** Put the step in the URL (`/onboarding?step=3`), so the phone's back gesture moves back a step instead of leaving onboarding. Refreshing keeps the step. A step in the URL beyond what's been completed falls back to the last valid step.
5. **"Set up later" (skip).**
   - Show a quiet "Set up later" link on step 1.
   - On step 2, once the minimum is filled in, add "Calculate now, finish the rest later".
   - **The minimum for targets is goal + body** (steps 1–2).
     - Skipping before that minimum creates a profile with `onboarding_status: "skipped"` and safe defaults: maintain, light activity, average adult values, no diet, no meal plan. Targets are labeled "rough estimate".
     - Finishing early (after step 2) saves `onboarding_status: "partial"` with real targets. The remaining steps use defaults.
6. **A finish-setup banner on Today.** When `onboarding_status` isn't `"complete"`, Today shows a dismissible card: "Finish setup for accurate targets (about 1 min)", with **Continue setup**.
   - It reopens onboarding at the first unfinished step, prefilled from the saved profile and draft.
   - Dismissing hides it for 24 hours (localStorage).
   - Plates shows a one-line hint if diet or meal plan is unknown: "Tell us your diet for better picks".
7. **The submit fails.** The draft stays, and the user sees "Couldn't save. Your answers are kept. Try again" with a Retry button. Never lose answers.
8. **Already finished.** Visiting `/onboarding` with a complete profile goes to `/profile` (Tier 2) or `/today` (if Tier 2 isn't built). It never restarts.
9. **Mid-setup, the app is reopened from the home screen.** `ProfileProvider` already sends a user with no profile to `/onboarding`. It must land on the saved step, not step 1.

Add to `Profile`: `onboarding_status: "complete" | "partial" | "skipped"`, marked `// TODO(schema)`. Treat an existing v1 profile as `"complete"`.

## New flow (up to 6 steps; the count adjusts to the branch)

### Step 1: Your goal
- **Goal cards** (existing): Lose fat / Build muscle / Maintain & eat healthier.
- **Pace** (Tier 2), shown for Lose fat and Build muscle only:
  - Lose fat: Gentle −250, Steady −500 (default), Faster −750 kcal/day.
  - Build muscle: Lean +250 (default), Standard +400.
  - Explain each option in plain words, e.g. "about 0.5 lb a week".
- **Target date** (Tier 3, optional): show "At this pace you'd reach your goal around <date>" on the targets screen. Never push the pace past the safe limits to hit a date.
- **"Describe it in your own words"** (existing, `goal_text`).

### Step 2: About you
- Keep: sex (with the "why we ask" note), age, height, weight, goal weight, activity level, and every guardrail.
- **Training days per week** (Tier 2): 0–7 stepper that feeds the protein target.
- **Club or varsity sport?** (Tier 3, optional).

### Step 3: How you eat
- Keep: diet chips and allergens, with the nut-free note.
- **"Foods you don't like"** (Tier 2, optional): chips such as Seafood, Mushrooms, Spicy food, Eggs, Red meat, Tofu, plus free-text "Other". Plate picks must never suggest these. Extend `lib/diet.ts` with name matching, the same approach as pork.

### Step 4: Where you live and eat (Tier 1: the branch)
First choose one of three cards:

- **A. On campus (dorm)**
  - Meal plan picker, grouped (`lib/meal-plans.ts`). Put "No meal plan" behind a small link.
  - **Favorite dining hall(s)**: chips from `/api/locations`, multi-select. The first one becomes the Plates and Menus default.
- **B. Off campus, with a meal plan**
  - Meal plan picker and favorite dining hall(s).
  - Kitchen access: Full / Microwave + fridge / None.
- **C. Off campus, cooking for myself**
  - No meal plan picker. Show an optional "I also have dining dollars" toggle.
  - Kitchen access.
  - **Weekly grocery budget ($)**: required in this branch. It maps to `weekly_food_budget_usd`.
  - Tier 3 extras: cooking comfort, time per meal, and where they shop (Kroger, Walmart, Aldi, Food City, Publix).

Derive `meal_plan_type` exactly as v1 does.

### Step 5: Money
- Only show what applies to the branch and plan:
  - Dining dollars balance, for plans with dining dollars.
  - Swipes remaining, for Block plans.
  - Weekly off-campus budget, if it wasn't already asked.
- If none apply, skip the step automatically, and update the step count so it stays honest.

### Step 6: Review (Tier 1)
- One card per section with an "Edit" link to that step, then "Looks right, calculate my targets".
- On submit: `POST /api/profile` with `onboarding_status: "complete"` → `/onboarding/targets`.

## Data model changes (`lib/types.ts`, each marked `// TODO(schema): ask Supul to add`)

**Tier 1:**
- `living_situation`: `"on_campus" | "off_campus_plan" | "off_campus_cooking"`
- `favorite_location_ids`: `string[]`
- `kitchen_access`: `"full" | "microwave" | "none" | null`
- `onboarding_status`: `"complete" | "partial" | "skipped"`

**Tier 2:**
- `goal_pace`: `"gentle" | "steady" | "faster" | "lean" | "standard"`
- `training_days_per_week`: `number`
- `disliked_foods`: `string[]`

**Tier 3:**
- `target_date`: `string | null`
- `plays_sport`: `boolean`
- `hide_calories`: `boolean`
- `cooking_skill`, `cook_time`, `grocery_stores`

Also:
- Update the demo profile: on campus, Vol Block 100, favorite Rocky Top, 4 training days, lean pace, `onboarding_status: "complete"`.
- **v1 data must still load.** A v1 profile in the mock DB, or a v1 draft, gets sensible defaults: `living_situation` comes from the meal plan, status is `"complete"`, and so on.

## Formula changes (`lib/targets.ts`, Tier 2)

- Replace the fixed −500/+300 with `GOAL_PACE_DELTA[pace]`.
- Protein in g/kg rises with training days. For example: base 1.6, +0.05 per day, +0.1 for a sport, capped at 2.2. Keep the 40%-of-calories cap.
- Tier 3: add `projectedGoalDate(weightKg, goalWeightKg, dailyDelta, today)`, using roughly 7,700 kcal per kg.
- Keep `MIN_CALORIES`. If the pace would go below it, clamp to it and say so.
- Add `defaultTargetsInput()` for the "Set up later" profile.
- Unit-test every new branch, and mark the new constants `TODO(§7)`.

## Wire it into the app

- **Tier 1:** Plates and Menus default to the first entry in `favorite_location_ids`, falling back to the first dining hall. Remove `TODO(nearest)`.
- **Tier 1:** the finish-setup banner on Today and the hint on Plates (see "Leaving and coming back").
- **Tier 2:** plate picks filter out `disliked_foods`, in both the mock route and the offline builder.
- **Tier 2:** on Budget, `off_campus_cooking` users see a "Weekly grocery budget" card instead of swipes.
- **Tier 3:** when `hide_calories` is true, hide the calorie ring and every calorie number on Today, Plates, Menus and Log. Show protein, carbs and fat only.

## Profile screen (`/profile`, Tier 2)

- Open it from an avatar button in the Today header.
- Show sections that match the onboarding steps, each with "Edit". Reuse the step components (refactor them so they also work outside the wizard).
- Saving calls `POST /api/profile`, which recomputes targets, shows a toast ("Targets updated: 2,450 cal") and refreshes `ProfileProvider`.
- For a partial or skipped profile, show "Finish setup" at the top.
- Tier 3: a "Hide calorie numbers" switch. Also include "Reset demo data" for the demo account with mocks on.

## Cross-cutting requirements (unchanged from v1)

- Every new screen has loading, empty and error states. Errors get a retry button and never show a raw error.
- Every input has a label. Focus rings are visible. Color is never the only signal. Tap targets are at least 44px.
- Use `min-w-0` on chip fieldsets, and design tokens only.
- Any component that reads the time, the URL or localStorage while rendering uses the Suspense + `use(browser())` pattern, like the existing pages.
- Re-run the Lighthouse accessibility audit and the 360px/430px overflow check at the end.
- Log every change in `CONTEXT.md` in the same style as the earlier phases.

## Build in phases (stop after each one, summarize, and wait for "next")

1. **Tier 1, data and resume:**
   - New Tier 1 fields with v1 migration.
   - Per-user drafts with expiry and migration.
   - Step in the URL.
   - The "Welcome back: Continue / Start over" card.
   - Safe submit failure.
   - Tests for the draft keying and expiry logic.
2. **Tier 1, flow:**
   - Step 4 branching (A/B/C), step 5 auto-skip, step 6 review, and the dynamic step count.
   - "Set up later" and "Calculate now, finish later" with `onboarding_status`.
   - The finish-setup banner on Today, and the favorite hall default on Plates and Menus.
   - Demo path check.
3. **Tier 2:**
   - Pace and training days in `lib/targets.ts` (with tests) and in the UI.
   - Foods you don't like, with plate filtering.
   - `/profile` with section editing and recalculation.
   - The off-campus grocery budget card.
4. **Tier 3 and QA** (do as much of Tier 3 as time allows):
   - Then the full test suite, Lighthouse accessibility at 100, the overflow check, and these paths end to end:
     - New student on campus.
     - New student off campus cooking.
     - Quit at step 3 → sign out → a different user signs in (doesn't see the first user's answers) → the first user signs back in (resumes at step 3).
     - Set up later → banner → finish.
     - Demo account.

After each phase, list the files changed, anything you assumed, and every new `TODO(schema)` or `TODO(§7)` a teammate needs to confirm.

## Out of scope

- Real auth.
- Supabase tables and API route internals (teammates own those; keep consuming routes through `lib/api.ts`).
- Syncing a draft across devices (local only for now).
- AI autofill from `goal_text`.
- The grocery list generator.
- Reminders or notifications.
- Picking a visual theme.

## Done means

**Tier 1 done (the minimum to ship):**
- All three living situations can finish onboarding, and each branch asks only its own questions.
- Leaving mid-setup and coming back resumes at the right step.
- Another user on the same device never sees someone else's draft.
- The back button moves between steps.
- "Set up later" gets a user into the app with rough targets and a banner that brings them back.
- Plates opens on the user's favorite hall.
- v1 data still loads.
- Tests, lint, type-check and build pass, and Lighthouse accessibility is 100.

**Tier 2 done:**
- Targets reflect pace and training days.
- Disliked foods never appear in plate picks.
- Profile edits recompute targets.
- Off-campus cooks see a grocery budget card.

=====
