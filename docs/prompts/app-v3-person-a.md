# Person A prompt: screens (Campus Fuel app v3)

Paste everything between the `=====` lines into Claude Code from the repo root. Start on branch `feature/app-v3`, and create `feature/app-v3-screens` from it. Person B works on AI and data at the same time, in a different branch, on different files.

=====

## Role

You are the frontend engineer for Campus Fuel's screens. Read these first:
- `CONTEXT.md`, `README.md` and `docs/prompts/app-v3.md` (the full plan; you own Phases 1, 2 and 3, the Phase 4 UI, and your half of Phase 5).
- `lib/types.ts`, `lib/api.ts`, `lib/hooks/*` and `app/(app)/*`.

Then make a short plan before writing code.

## Files you own (Person B doesn't touch these)

- `app/(app)/*`, `app/(onboarding)/*`, `app/layout.tsx` and `app/globals.css`
- `components/*`
- `lib/hooks/*`
- `docs/theme.md`

## Files you must NOT edit (Person B, or teammates)

- `lib/ai/*`, `app/api/*`, `lib/campus-geo.ts`, `lib/hours.ts`, `mock/demo-profile.ts`, `lib/mock-api.ts`
- `lib/scraper-menus.ts`, `lib/plate-builder.ts`, `scraper/*` and `.github/*`

If you need something from those files, ask Person B, or use the agreed functions below.

## Agreed interfaces (Person B builds these; use these exact names)

```ts
// lib/campus-geo.ts
distanceFromMinKao(location_id: string): { miles: number; walkMinutes: number } | null

// lib/hours.ts
openStatus(location_id: string, now?: Date): { open: boolean; label: string } // "Open now" / "Closed" / "Opens 5:00 PM"

// lib/api.ts (additions)
api.logsRange(from: string, to: string): Promise<FoodLog[]>          // YYYY-MM-DD
api.ai.ask(body: { question: string; meal_period: MealPeriod; remaining: Macros }):
  Promise<{ answer: string; picks: { location_id: string; menu_item_id: string; servings: number }[]; offline?: boolean }>
// api.ai.plates and api.ai.photo keep their current shapes, plus an optional `offline?: boolean`
```

Until B's versions land, put temporary stand-ins in `lib/stubs.ts`, which you own: same names, simple fake values. Swap your imports over when B's branch merges, then delete the stubs.

## Step 1: Phase 1 (do this FIRST, merge before B merges)

- **Tabs:** Today · Food · Log · Menus · Events.
  - Log uses a plain log icon (lucide `NotebookPen`), not the camera, and no orange circle.
  - Budget no longer has a tab. `/budget` still works and is linked from Profile.
- **Profile avatar:** a round button at the top right of every main tab's header, linking to `/profile`.
- **Today:**
  - Remove the "Lunch is being served" pill.
  - Change "What should I eat?" to a small row: "Not sure what to eat? See picks near you →" going to `/food`.
  - Change the meal list to one line: "Logged 3 meals · 640 cal · View in Log →".
  - Remove the old ↺ reset button.
- **`/profile`:**
  - **Targets:** reuse the slider component from `/onboarding/targets`, saving with `api.updateTargets`.
  - **Your details:** Edit opens `/onboarding?step=<id>&edit=1&return=profile`. Finishing goes back to `/profile`.
  - **Budget:** reuse `components/budget/amount-editor.tsx`, plus a link to `/budget`.
  - **Settings:**
    - Appearance: System / Light / Dark.
    - Units: ft/lb or cm/kg.
    - Sign out, via `signOut()` from `lib/session.ts`.
    - **Reset app** (mocks only): confirm first, remove every `cf.*` localStorage key, set the demo session `{ email: "demo@vols.utk.edu", isDemo: true }`, then do a full page load to `/today`.
- **Dark mode:**
  - Add dark values for every token in `globals.css`, under `[data-theme="dark"]` and under `prefers-color-scheme` when the setting is System.
  - Store the choice in localStorage `cf.theme`.
  - Add a tiny inline script in `app/layout.tsx` that sets `data-theme` before first paint.
  - Keep AA contrast in both themes, and keep protein, carbs and fat distinguishable.

## Step 2: Log tab (Phase 2)

- **Week strip:** Monday through Sunday, with arrows between weeks and a "Today" button. Future days are disabled.
- **Status dot per day,** comparing logged calories to the target:
  - Within ±10% = hit (success token).
  - More than 10% under = under (muted).
  - More than 10% over = over (warning token).
  - Each dot also has a text label, so color isn't the only signal.
- **The selected day's meals,** grouped by meal, using the existing edit sheet, with a day total "x / target". Load past days with `api.logsRange`.
- **A + sheet:** Photo (existing), Quick add (existing), From menu (`/menus`). New logs go to the **selected day**, with `logged_at` set to that date inside the chosen meal.
- **Empty day:** "Nothing logged on Tue, Nov 11. Add a meal."

## Step 3: Food tab (Phase 3)

- **`/food`:** all locations from `useLocations()`, sorted by `distanceFromMinKao`. Don't hard-code the list.
- **Each card:**
  - Name and building.
  - "0.3 mi · 6 min walk".
  - `openStatus` label.
  - "Can pay here" or a dimmed "Not on your plan", based on the meal plan.
  - "Top pick": the first plate from `buildPlates` (import only, don't edit it).
- **Filters:** "Open now" and "On my plan". The meal period defaults to now, with a picker.
- **Tap a card:** opens that location's plate picks. Reuse the current `/plates` screen with `?location=`, and make `/plates` with no location redirect to `/food`.
- **Ask box** at the top of Food: an input, then the answer text, then tappable result cards with Log. Use `api.ai.ask`.
- **Badges:** "AI" on AI results and "Offline estimate" when `offline` is true, on Ask, the plate picks and the photo result.

## Rules

- Design tokens only.
- No sideways overflow at 360px or 430px.
- Loading, empty and error states everywhere.
- The Suspense + `use(browser())` pattern for anything that reads the time, the URL or localStorage while rendering.
- Lighthouse accessibility at 100 in light and dark.
- Log changes in `CONTEXT.md`, under a "Person A" heading.
- Stop after each step: summarize, list the files changed, and wait for "next".

## Finishing (together with B)

1. After both branches merge, run the demo script:
   1. Reset app.
   2. Today shows breakfast logged.
   3. Food: nearest open place, then a plate picked, logged, and the rings move.
   4. Log: the photo flow, and past days on the calendar.
   5. Profile: adjust targets, switch to dark mode.
   6. Reset again.
2. Check dark mode and 360px/430px.

=====
