# Person B prompt: AI and data (Campus Fuel app v3)

Paste everything between the `=====` lines into Claude Code from the repo root. Start on branch `feature/app-v3`, and create `feature/app-v3-ai` from it. Person A builds the screens at the same time, in a different branch, on different files.

=====

## Role

You are the backend/AI engineer for Campus Fuel. Read these first:
- `CONTEXT.md`, `README.md` and `docs/prompts/app-v3.md` (the full plan; you own the Phase 4 server work, the data pieces the screens need, and your half of Phase 5).
- `lib/types.ts`, `lib/api.ts`, `lib/mock-api.ts`, `lib/scraper-menus.ts`, `lib/plate-builder.ts`, `lib/diet.ts`, and `app/api/menus` and `app/api/locations`.

Then make a short plan before writing code.

## Files you own (Person A doesn't touch these)

- `lib/ai/*` (new) and `app/api/ai/*` (new)
- `lib/campus-geo.ts` and `lib/hours.ts` (new)
- `lib/api.ts`: additions only, keeping the existing functions and their shapes
- `lib/mock-api.ts`, `mock/demo-profile.ts` and `.env.example`

## Files you must NOT edit

- `app/(app)/*`, `app/(onboarding)/*`, `components/*`, `app/globals.css`, `app/layout.tsx` and `lib/hooks/*` (Person A)
- `lib/scraper-menus.ts`, `lib/plate-builder.ts`, `app/api/menus`, `app/api/locations`, `scraper/*` and `.github/*` (Supul's merged work). **Import from these, never change them.**

## Agreed interfaces (Person A codes against these; use these exact names)

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

## Step 1: Data the screens need (do this first; Person A is waiting on it)

1. **`lib/campus-geo.ts`:**
   - Approximate lat/lng for Min Kao Engineering and every location id in `/api/locations` (Rocky Top, Stokely, Chick-fil-A, Panda Express), with room for Student Union places. Mark the coordinates `TODO(verify)`.
   - `distanceFromMinKao` uses haversine distance, rounds miles to 0.1, and assumes walking at about 80 m/min.
   - An unknown id returns `null`.
2. **`lib/hours.ts`:**
   - Approximate weekly hours per location (`TODO(verify)`), in **America/New_York** time.
   - `openStatus` returns "Open now", "Closed", or "Opens 5:00 PM" / "Opens tomorrow 7:00 AM".
3. **Log history:**
   - `api.logsRange(from, to)` calls `GET /api/logs?from=&to=` (`TODO(§9)` for the real backend). Add it to the mock.
   - Seed the **last 6 days** of demo history in `mock/demo-profile.ts`. Make it deterministic, with a mix of days within ±10% of the target, more than 10% under, and more than 10% over.
   - The mock DB re-seeds this whenever it's empty, which happens after Reset app.
4. **Tests:** distance (including Min Kao to itself = 0), open/closed edges in Eastern time, logsRange filtering, and seeded history that's stable across runs.
5. **Merge Step 1 early,** so Person A can swap out their stubs.

## Step 2: AI client (Grok/xAI or any OpenAI-compatible API)

- **`lib/ai/client.ts`:** a small `fetch` wrapper around an OpenAI-compatible **Chat Completions** API. Don't add an SDK.
- **Server-only environment variables:**
  - `AI_API_KEY`
  - `AI_BASE_URL`, default `https://api.x.ai/v1`
  - `AI_MODEL`
  - `AI_VISION_MODEL`, which must accept images
- **Add the names only** to `.env.example`. The real key goes only in `.env.local`, which git ignores. Never log it, never return it, and never use a `NEXT_PUBLIC_` name for it.
- **Behavior:**
  - An 8-second timeout.
  - JSON output (`response_format: { type: "json_object" }` where supported), validated with zod.
  - On a missing key, timeout, error or invalid JSON, return the offline result with `offline: true`.
- **Abuse limits:** an in-memory per-IP rate limit (20 requests a minute) and a maximum request body size (photo about 2 MB, text about 4 KB).
- **`lib/ai/prompts.ts`:** short system prompts. "Choose only from the provided items. Output JSON only." Include the goal, remaining macros, diet and allergies.

## Step 3: AI routes

1. **`POST /api/ai/plates`** with `{ location_id, meal_period, remaining, variant, profile }`:
   - Load the menu with `hallMenuItems` / `RETAIL_ITEMS`, then apply `filterForProfile`.
   - Send the model a compact item list: id, name, calories, protein/carbs/fat, and tags.
   - Expect `{ plates: [{ title, items: [{ menu_item_id, servings }], reason }] }`.
   - **Drop any id that isn't in the menu,** clamp servings to 0.5–3, and **recompute the totals from real macros.**
   - The fallback is `buildPlates(...)`, unchanged.
2. **`POST /api/ai/photo`** with `{ image }` (a data URL):
   - Send it to the vision model and ask for `PhotoEstimate` JSON.
   - Clamp to calories 0–3000 and grams 0–300. Default `confidence` to "low" if it's missing.
   - The fallback is `offline: true` with **no made-up numbers**. The UI shows a blank form.
3. **`POST /api/ai/ask`** with `{ question, meal_period, remaining, profile }`:
   - Build the context from **open** locations (`openStatus`), sorted by `distanceFromMinKao`, and their filtered menus.
   - Expect `{ answer (≤ 2 sentences), picks: [{ location_id, menu_item_id, servings }] }`, and validate the picks against real items.
   - The fallback is a keyword and macro filter: "high protein" sorts by protein per calorie, "under N cal" filters by calories, and "vegan"/"vegetarian" filter by tags. It returns 3 picks plus a one-line answer.
4. **Wiring:**
   - In `lib/api.ts`, when `NEXT_PUBLIC_AI_LIVE=true`, the AI calls go to the real `/api/ai/*` routes even if `NEXT_PUBLIC_USE_MOCKS=true`.
   - Otherwise the mock returns the offline results.
   - The client's existing 5-second fallback stays.
5. **Tests**, with `fetch` mocked and no live calls:
   - The zod validators.
   - Dropping unknown ids and recomputing totals.
   - Clamping.
   - The Ask keyword fallback.
   - The rate limiter.
   - Missing key → `offline: true`.

## Rules

- `npm test`, lint, type-check and build must all pass.
- Mocks on and off both work.
- No secrets in git.
- Log changes in `CONTEXT.md`, under a "Person B" heading.
- Stop after each step: summarize, list the files changed and any `TODO`s, and wait for "next".

## Finishing (together with A)

- After both branches merge, test with a real key in `.env.local`: plate picks (the "AI" badge shows), a photo of real food, and the Ask box.
- Then remove the key, and confirm everything falls back with "Offline estimate".
- Update `README.md`: the AI environment variable names (not the values), and how to turn AI on.

=====
