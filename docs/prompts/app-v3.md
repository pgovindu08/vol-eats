# APP_V3_PROMPT.md: Campus Fuel (Vol Hacks)

Paste everything between the `=====` lines into Claude Code from the repo root, on branch `feature/app-v3`. It runs in 5 phases and stops after each one so you can review, commit and open a PR.

=====

## Role and ground rules

You are the frontend engineer on Campus Fuel. Read `CONTEXT.md`, `README.md`, `lib/types.ts`, `lib/api.ts`, `lib/mock-api.ts`, `lib/scraper-menus.ts` and `lib/plate-builder.ts` before writing code. Make a short plan first.

**Don't change teammates' work.** Supul's live-scraper integration is merged and works. That covers `lib/scraper-menus.ts`, `app/api/menus`, `app/api/locations`, `lib/plate-builder.ts`, `.github/workflows/scrape-menus.yml` and `scraper/`.
- Reuse these files. Don't rewrite them.
- If you need something from them, add a new function in a new file, or make a small additive export, and say so in your phase summary.
- Never edit the scraper's data files.

**Keep what already works:**
- Design tokens only, no hard-coded colors.
- Mobile-first, with no sideways overflow at 360px or 430px.
- Lighthouse accessibility at 100.
- Loading, empty and error states on every screen.
- The Suspense + `use(browser())` pattern for anything that reads the time, the URL or localStorage while rendering.
- `signOut()` doing a full page load.
- Mocks on and off both work.

Log every phase in `CONTEXT.md`.

## Target app layout

**Bottom tabs:** Today · Food · Log · Menus · Events
- Log uses a plain log icon (lucide `NotebookPen`), not the camera, and no longer has the big orange circle.
- Budget no longer has a tab. It moves into Profile.

**Profile:** a round avatar button in the top-right header of every main tab, linking to `/profile`.

## Phase 1: Navigation, Profile, dark mode, Reset app, Today cleanup

1. **Tabs:** the new tab bar above. `/budget` keeps working as a page but is reached from Profile.
2. **Today:**
   - Remove the "Lunch is being served" pill.
   - Keep the date, greeting, macro rings and free-food card.
   - Replace the big "What should I eat?" button with a **small** row/link: "Not sure what to eat? See picks near you →", going to `/food`.
   - Replace the full logged-meals list with a one-line summary: "Logged 3 meals · 640 cal · View in Log →".
   - The finish-setup banner stays.
3. **`/profile`** (new), with these sections:
   - **Targets:** calories and protein/carbs/fat, with the same sliders as the targets screen (reuse that component). Saving calls `PATCH /api/profile` and refreshes `ProfileProvider`.
   - **Your details:** goal, body, diet and allergies, where you live and favorite hall. Each row has "Edit", which opens onboarding at that step with `&edit=1`. Finishing returns to `/profile` instead of the targets screen, and saving recomputes the targets.
   - **Budget:** dining dollars, swipes and weekly budget, using `components/budget/amount-editor.tsx`, plus a link to the full `/budget` page.
   - **Settings:**
     - Appearance: System / Light / Dark.
     - Units: ft/lb or cm/kg, used by onboarding and Profile.
     - Sign out.
     - **Reset app.**
4. **Dark mode:**
   - Add dark values for every token in `app/globals.css`, under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` when the setting is System.
   - Keep `--protein`, `--carbs` and `--fat` distinguishable, with AA contrast on both themes.
   - Store the choice in localStorage (`cf.theme`), a per-device convenience.
   - Add a tiny inline script in `app/layout.tsx` that sets `data-theme` before first paint, so there's no flash.
   - Lighthouse accessibility must be 100 in both themes.
5. **Reset app** (mocks only, for demos):
   - Confirm first: "This clears all accounts and data on this device."
   - Then remove every `cf.*` localStorage key (accounts, drafts, logs, budget prefs, banner dismissals, theme), sign in as the demo user, and do a **full page load** to `/today`, where the demo shows breakfast already logged.
   - Remove the old ↺ button from Today. Profile is the one place to reset.

## Phase 2: Log tab (meal history and calendar)

`/log` becomes the meal tracker:
- **A week strip** at the top, showing the current week with Monday through Sunday chips. Arrows move between weeks, and a "Today" button jumps back.
  - Each day shows a **status dot** comparing logged calories to that day's target: within ±10% is hit (success token), more than 10% under is under (muted), more than 10% over is over (warning token).
  - Each dot also has a text label, so color is never the only signal.
  - Future days are disabled.
- **The selected day's meals,** grouped into breakfast, lunch and dinner. Tapping one opens the existing edit sheet (servings, delete with undo). There's a day total and "x / target".
- **A + button** opens a sheet with three options: **Photo** (existing photo flow), **Quick add** (existing form) and **From menu** (opens `/menus`). New logs go to the **selected day**, including past days, by setting `logged_at` to that date at a time inside the chosen meal.
- **Data:** add a `days` query to logs, `GET /api/logs?from=YYYY-MM-DD&to=YYYY-MM-DD`, in `lib/api.ts` and the mock (`TODO(§9)` for the backend). `LogsProvider` stays "today". Past days load on demand.
- **Seed demo history:** the demo user gets the last 6 days of plausible logs, a mix of hit, under and over, generated deterministically in `mock/demo-profile.ts`, so the calendar looks real in the demo. Reset app restores it.
- **Empty state** for a day with nothing logged: "Nothing logged on Tue, Nov 11. Add a meal."

## Phase 3: Food tab (where and what to eat)

`/food` replaces `/plates` as the entry point. Keep the `/plates` URL as a redirect, or a per-location view.

- **Distance:**
  - Add `lib/campus-geo.ts` with approximate coordinates for each location. Mark it `TODO(verify)`.
  - **Distance is measured from Min Kao Engineering (the default and only origin for now).**
  - Show it as "0.3 mi · 6 min walk", using haversine distance and walking at about 80 m/min.
  - Sort by distance.
- **Locations come from `GET /api/locations`.** Show every location it returns, so Student Union places appear automatically once teammates add their real data. Don't hard-code the list in the UI.
- **Each location card shows:**
  - Name and building.
  - Distance.
  - **Open now / Closed / Opens 5:00 PM**, from `lib/hours.ts` with approximate hours (`TODO(verify)`).
  - **Can pay here:** swipes or dining dollars, based on the user's meal plan, with dimmed cards and "Not on your plan" for places they can't use.
  - A **"Top pick for you"** line: the first plate from `buildPlates` for that location and meal, showing the name, calories and protein.
- **Filters:** "Open now" and "On my plan" chips. Meal period comes from the current time, with a picker.
- **Tapping a card** opens that location's plate picks. That's today's plates screen, scoped to the location: 2–3 plates, Log this plate, Regenerate. Phase 4 adds AI here.
- **Ask box** placeholder at the top: "Ask: high protein under 600 cal…". It's wired up in Phase 4. Hide it until then, or show a "coming soon" hint.

## Phase 4: AI (Grok/xAI or any OpenAI-compatible API)

**Provider-agnostic, server-side only:**
- Add `lib/ai/client.ts`, a tiny `fetch` wrapper around an **OpenAI-compatible Chat Completions API**. Don't add an SDK dependency.
- Configure it from environment variables, **read only on the server**:
  - `AI_API_KEY`
  - `AI_BASE_URL`, default `https://api.x.ai/v1` (Grok)
  - `AI_MODEL`, for text
  - `AI_VISION_MODEL`, for photos (must be a model that accepts images)
- Document them in `.env.example` **without real values**. The key goes only in `.env.local`, which git ignores. Never log it, and never send it to the browser.
- Ask for JSON output (`response_format: { type: "json_object" }` where supported). **Validate every response with zod.** On a timeout (8 s on the server), an error, invalid JSON or a missing key, return the offline result with `offline: true`.
- Add a per-IP rate limit (in-memory, for example 20 requests a minute) and a max request size so the demo can't be abused.

**Routes** (match the shapes already in `lib/types.ts` and `lib/api.ts`):
1. **`POST /api/ai/plates`** with `{ location_id, meal_period, remaining, variant }`.
   - Load the menu with `hallMenuItems` / retail on the server.
   - Filter it with `filterForProfile` (diet, allergies, pork rules). The profile comes from the request body for now (`TODO(auth)`).
   - Send the model **only that menu** (id, name, macros and tags per item).
   - Ask for 2–3 plates as `{ plates: [{ title, items: [{ menu_item_id, servings }], reason }] }`.
   - **On the server, drop any `menu_item_id` that isn't in the menu,** then compute the totals from real macros. Never trust model numbers.
   - The fallback is `buildPlates(...)`.
2. **`POST /api/ai/photo`** with `{ image }` (a data URL, already under 1024px).
   - Send it to the vision model and ask for `PhotoEstimate` JSON.
   - Clamp numbers to sane ranges, and default `confidence` to "low" if missing.
   - The fallback is a blank form (the current behavior), never a made-up estimate.
3. **`POST /api/ai/ask`** with `{ question, meal_period, remaining }`.
   - Build a compact context from **open** locations near Min Kao (name, distance) and their filtered menus.
   - Ask for `{ answer: string (≤ 2 sentences), picks: [{ location_id, menu_item_id, servings }] }`.
   - Validate the picks against real items, and show them as tappable cards with Log.
   - The fallback is a simple keyword and macro filter, for example "high protein" sorts by protein per calorie and "under 600" filters by calories.

**Frontend:**
- With mocks on and no key, the mock routes keep returning offline results.
- With a key, the client calls the real routes even when mocks are on for everything else. Add `NEXT_PUBLIC_AI_LIVE=true`.
- Show an **"AI"** badge on AI results and **"Offline estimate"** on fallbacks.
- The client keeps its existing 5-second fallback.

**Prompts:** keep them short, in `lib/ai/prompts.ts`, and include the user's goal, remaining macros, diet and allergies. Tell the model to choose only from the provided items, and to output JSON only.

**Tests:**
- Unit-test the zod validators, the "drop unknown items and recompute totals" logic, the Ask keyword fallback, and the rate limiter.
- No live API calls in tests. Mock `fetch`.

## Phase 5: Polish and demo QA

- Every tab in light and dark: loading, empty and error states, plus 360px and 430px checks.
- Lighthouse accessibility at 100 in both themes on Today, Food, a location's picks, Log, Menus, Events, Profile and onboarding.
- **The demo script works end to end with Reset app:**
  1. Reset app.
  2. Today shows breakfast logged.
  3. Food: nearest open place, then a plate picked, logged, and the rings move.
  4. Log: the photo flow, and the calendar showing past days.
  5. Profile: adjust targets, switch to dark mode.
  6. Reset again.
- Update `README.md`: tabs, AI env vars (names only), Reset app, and how to refresh menus.

## Out of scope

- Real auth.
- Changing the scraper or its data.
- Real GPS (Min Kao is the only origin for now; leave a `TODO(location)`).
- Notifications.
- The grocery list generator.
- Real Student Union menus. Teammates are adding them; the UI just needs to show whatever `/api/locations` and `/api/menus` return.

After each phase, list the files changed, anything you assumed, and every `TODO(schema)`, `TODO(§9)`, `TODO(verify)` and `TODO(auth)`.

=====
