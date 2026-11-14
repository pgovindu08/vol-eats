All the changes done by the AI is entered in here.

## 2026-11-14 — Frontend phase 1: shell (Claude Code, for Swagat)

**Added** a Next.js 16 app (App Router, TypeScript strict, Tailwind v4) at the repo root, next to `scraper/`.

- `app/globals.css`: design tokens (placeholder theme, UT orange). Tailwind v4 maps tokens in CSS, so there is no `tailwind.config.ts`. Token list: `docs/theme.md`.
- `app/(app)/layout.tsx` + `components/layout/bottom-tabs.tsx`: mobile shell, 480px max width, tabs Today · Menus · Log · Budget · Events. Tab pages are placeholders for now.
- `lib/types.ts`: School, Location, MenuItem, Profile, FoodLog, Event, plus the proposed AI response types.
- `lib/api.ts`: typed client, one function per route. `NEXT_PUBLIC_USE_MOCKS=true` (in `.env.local`) routes calls to `lib/mock-api.ts`, which has fake latency and `?fail=1` to simulate errors.
- `lib/targets.ts`: Mifflin-St Jeor targets. Also `lib/meal-period.ts` (Eastern-time breakfast/lunch/dinner), `lib/units.ts`, `lib/schemas.ts` (zod), `lib/meal-plans.ts`.
- `mock/`: dining hall menus generated from the real scraper output (`npm run mock:menus`), 10 retail items, 4 events, demo profile with breakfast logged, canned AI responses.
- Tests: `npm test` (vitest, 24 tests).

**Needs teammate confirmation** (CONTEXT §7–§9 weren't written yet, so these are guesses):
- Supul: table/field names in `lib/types.ts`, and the `TODO(schema)` fields on Profile (`goal_type`, `meal_plan_name`, `dining_dollars_balance`, `swipes_remaining`, `weekly_food_budget_usd`) and `MenuItem.price_usd`.
- Route paths and payloads in `lib/api.ts` (`TODO(§9)`).
- Aarohan: `PROPOSED` AI response types (TargetsExplanation, PlateRecommendation, PhotoEstimate).
- Formula constants in `lib/targets.ts` (`TODO(§7)`): activity multipliers, −500/+300 kcal goal deltas, protein g/kg, 25% fat.

## 2026-11-14 — Frontend phase 2: login, onboarding, targets reveal (Claude Code, for Swagat)

- `/login` (`app/(auth)/login`): mocked sign-in. Accepts `@vols.utk.edu` / `@utk.edu`, and "Use demo account" signs in as the seeded demo user. New users go to `/onboarding`, existing users to `/today`. `TODO(auth)`: real sign-in replaces `lib/session.ts`.
- `/onboarding` (`app/(onboarding)/onboarding` + `components/onboarding/*`): 4 steps (goal, body, diet, meal plan & money), each validated with zod before Next. Answers autosave to localStorage, so a refresh keeps your place. Body step guardrails: goal BMI ≥ 18.5, and goal weight must be below current weight for "Lose fat" or above it for "Build muscle". ft/lb ↔ cm/kg toggle; values are saved in metric. Submit calls `POST /api/profile`.
- `/onboarding/targets`: calorie count-up, protein/carbs/fat cards, AI explanation (`POST /api/ai/targets`). If the AI takes over 5 s or fails, it shows the formula numbers with a generic explanation labeled "Offline estimate". "Adjust" opens sliders and saves with `PATCH /api/profile`.
- `lib/hooks/use-profile.tsx`: `ProfileProvider` wraps the main app. It loads the profile once and redirects to `/login` (no session) or `/onboarding` (no profile).
- Small UI primitives in `components/ui/` (Button, Field/Input/Select, ChoiceCards, ChipGroup, Skeleton, ErrorState). They're token-styled and deliberately plain until the theme is chosen.
- New route used: `PATCH /api/profile` for manual target overrides (`TODO(§9)`: confirm with backend).
- Tests: 27 passing (`npm test`).

## 2026-11-14 — Frontend phase 3: Today dashboard and logging (Claude Code, for Swagat)

- `/today` (`app/(app)/today/page.tsx`): greeting, date and current meal period (Eastern time), a big calorie ring and three small protein/carbs/fat rings (`components/today/macro-ring.tsx`, plain SVG, every number also shown as text), a "What should I eat?" button that goes to `/plates`, the free-food card, the logged meals list, an empty state for new users, and a sign-out button.
- Logged meals are grouped by meal period. Tapping one opens a bottom sheet (`components/ui/sheet.tsx`, native `<dialog>`) with a 0.5-step servings stepper, Save and Delete. Delete shows an "Undo" toast.
- `lib/hooks/use-logs.tsx`: `LogsProvider` holds today's logs for every tab, so a log added on Plates, Menus or Log shows up on Today without a refetch. `addLog` / `updateLog` / `deleteLog` are optimistic and roll back with an error toast if the API call fails.
- Free-food card: the next 1–2 events that haven't ended, with a "Fits your macros" / "Over your remaining" / "Calories unknown" badge based on `est_calories` vs remaining calories (`lib/events.ts`, `components/events/fit-badge.tsx`). If events fail to load, the card hides instead of erroring.
- Also added: `components/ui/toast.tsx`, `components/ui/stepper.tsx`, `lib/format.ts`.
- Tests: 31 passing.

## 2026-11-14 — Frontend phase 4: Plate picks and Menus (Claude Code, for Swagat)

- `/plates`: location chips (swipe-only plans see dining halls only; others also see retail), a Breakfast/Lunch/Dinner picker (disabled for retail, "Same menu all day"), skeleton cards with rotating copy while loading, and 2–3 plate cards. Each card shows its items with servings, the plate's protein/carbs/fat as bars against what's left today, and the AI reason. "Log this plate" logs every item (`source: "plate"`) and returns to `/today`. "Regenerate" sends `variant + 1`, and a "Browse the menu" link goes to `/menus`.
- AI fallback: if `POST /api/ai/plates` takes over 5 s or fails, the page builds plates locally from the real menu (`lib/plate-builder.ts`) and labels them "Offline estimate". The mock route uses the same builder.
- `lib/diet.ts`: diet and allergen filtering. Plates only use items that fit the user's diet tags and allergens. UTK data has no halal or pork flags, so "No pork" and "Halal" exclude pork by name (`TODO(schema)`).
- `/menus`: location chips, meal-period picker, search, and diet filter chips (the user's own diet is preselected). Items are grouped by station with calories, P/C/F, diet badges, price for retail, and a warning icon when an item contains one of the user's allergens. Tapping an item opens a sheet with full macros, allergens, a 0.5-step servings stepper and "Log". Empty states: "Menu not posted yet" and "Nothing matches your search or filters".
- `PROPOSED` for Aarohan: `POST /api/ai/plates` body `{ location_id, meal_period, remaining, variant? }` (`PlatesBody` in `lib/api.ts`).
- `TODO(nearest)`: Plates defaults to the first dining hall, since there's no location data yet.
- Fixed while testing:
  - Logging a plate showed one item three times on Today: the optimistic placeholders had the same temporary ID. They now use `crypto.randomUUID()`.
  - The page was 497px wide on phones because a `<fieldset>` defaults to `min-width: min-content`. Added `min-w-0` to the chip fieldsets.
- Tests: 36 passing.

## 2026-11-14 — Frontend phase 5: Photo log, Events, Budget (Claude Code, for Swagat)

- `/log` has two tabs:
  - **Photo:** "Snap your plate" opens the camera (`capture="environment"`). "Choose from library" uses a separate input without `capture`, because `capture` forces the camera on phones. Photos are downscaled to 1024px JPEG in the browser (`lib/image.ts`), then sent to `POST /api/ai/photo`. The user sees a preview with "Analyzing…", then an editable estimate with a confidence pill and notes. Save logs with `source: "photo"`.
  - **Quick add:** the same form (`components/log/food-form.tsx`), saved with `source: "manual"`.
  - If the photo AI fails or takes over 5 s, the form opens blank with "Couldn't analyze this photo". Unlike the other AI screens there's no canned estimate here, because a made-up calorie count would be wrong data.
- `/events`: today's events with time, place, food, estimated calories and a fit badge. Ended events are under "Earlier today". The poster is never shown.
- `/budget` (`lib/budget.ts`, pure and tested):
  - Semester end date (default Dec 12) → weeks left.
  - Swipes: "Unlimited" for unlimited plans; swipes left and swipes per week for Block plans; a weekly count for Weekly plans.
  - Dining dollars: balance, $/week until the semester ends, and a "spent this week" input that predicts the run-out date and warns if it's before the semester ends.
  - Top 5 retail items by protein per dollar, filtered by diet. Hidden for swipe-only plans.
  - A "Grocery list: Coming soon" card for the pitch.
  - The semester end and "spent this week" are saved in localStorage as per-person settings.
- `TODO(schema)`: retail `price_usd` values are still placeholders, and the page says "Prices are estimates".
- Tests: 41 passing.

## 2026-11-14 — Frontend phase 6: polish pass (Claude Code, for Swagat)

- **Accessibility:** Lighthouse accessibility scores 100 on all 12 screens: login, 4 onboarding steps, targets, Today, Plates, Menus, Log, Budget and Events. It ran against a production build at mobile size with the demo session. Fixes:
  - Darkened `--success` and `--warning` so small text passes 4.5:1 on `--surface-2`.
  - Logged-meal buttons now take their accessible name from the visible text plus a hidden "Edit".
  - The plate macro bars use a list instead of an invalid `<dl>`.
- **Mobile QA:** at 360px and 430px, no screen overflows sideways. Three-column choice cards (sex) are now text-only, and "Prefer not to say" became "Rather not say" so it fits on small phones.
- **Added:**
  - `app/error.tsx` (friendly crash screen; in this Next version the prop is `retry`) and `app/not-found.tsx`.
  - A "Reset demo data" button on Today, shown only for the demo account with mocks on.
  - Run instructions in `README.md`.
- **Mocks off** (`NEXT_PUBLIC_USE_MOCKS=false` production build): no mock code ships in the bundle. The repo has no `/api` routes yet, so every call 404s. Login shows "Couldn't sign in right now", and each screen shows "Try again" with no crash. The full demo path needs the backend routes in `lib/api.ts`.
- **Error copy:** 404 now uses the generic message instead of "We couldn't find that", since a 404 usually means a route isn't deployed yet. Menus and Plates no longer show a loading skeleton under the error when locations fail.
- **Mocks on:** ran the full demo path: demo login (640 cal) → plate picks → log a plate (1,180) → log from Menus (1,360) → Budget → Events → Reset (640).

## 2026-11-14 — Onboarding v2, phase 1: data and resume (Claude Code, for Swagat, branch `feature/onboarding-v2`)

Plan: `docs/prompts/onboarding-v2.md`.

- **New profile fields** in `lib/types.ts`, all `TODO(schema)` for Supul: `living_situation`, `favorite_location_ids`, `kitchen_access`, `onboarding_status`.
  - `lib/profile.ts` `normalizeProfile()` fills defaults for older profiles: living situation comes from the meal plan, and status is `"complete"`.
  - `lib/api.ts` applies it to every profile it returns, so v1 mock data and a backend without these columns both keep working.
  - The demo profile is now on campus, with Rocky Top as favorite.
- **Per-user drafts** (`lib/onboarding-draft.ts`): saved under `cf.onboarding-draft:<email>`, with `updated_at` and a 14-day expiry.
  - The v1 shared draft is deleted, not migrated, because its owner is unknown. This deliberately differs from the prompt.
  - `furthest` replaces `step`.
- **Step in the URL** (`/onboarding?step=N`): refresh keeps the step, the phone's back gesture goes back a step, and out-of-range steps clamp to the furthest reached.
- **Resume:** a "Welcome back: step N of 4" card with Continue / Start over (Start over asks to confirm). A "Not you? Sign out" link is on every step.
- **Safe submit:** answers are saved before submitting. On failure: "Couldn't save. Your answers are kept, so try again."
- **Already finished:** visiting `/onboarding` with a complete profile goes to `/today`.
- **Bug fixed:** sign-out leaked state between users.
  - Next 16 keeps visited pages alive in memory (`<Activity>`), so after sign-out the next user on the device saw the previous user's onboarding step and resume card.
  - All sign-outs now go through `signOut()` in `lib/session.ts`, which does a full page load, as Next's "State and authentication" guide recommends.
  - Onboarding also reloads if the signed-in user changed while it was hidden.
- **Tests:** 51 passing; new ones cover draft keying, expiry, legacy deletion and profile normalization.
- **Checked in the browser:** back and forward, `?step=9`, resume, the shared-phone switch, Start over, failed submit and the finished-user redirect.
- **Lighthouse** accessibility is 100 on all onboarding steps.

## 2026-11-14 — Onboarding v2, phase 2: living-situation flow, finish later (Claude Code, for Swagat)

- **Flow logic** (`lib/onboarding-flow.ts`, pure and tested):
  - Steps are `goal → body → diet → living → money → review`. The URL now carries the step id (`?step=living`) instead of a number, because the number of steps depends on the branch.
  - Off-campus cooks without dining dollars skip Money, and the count stays honest ("Step 5 of 5").
  - `buildProfileInput()` drops fields that don't apply to the chosen branch.
  - `profileToDraft()` rebuilds a draft from a saved partial or skipped profile.
- **Step 4, "Where do you live and eat?"** (`components/onboarding/step-living.tsx`):
  - **On campus:** meal plan, with "No meal plan" behind a link, plus favorite dining halls.
  - **Off campus with a plan:** meal plan, favorite halls and kitchen.
  - **Off campus cooking:** weekly grocery budget (required), kitchen (required), and an "I also have dining dollars" option with its plan.
- **Step 5, Money** (`step-money.tsx`, formerly `step-plan.tsx`): shows only the balances that apply (dining dollars, swipes for Block plans, off-campus budget unless already asked).
- **Step 6, Review** (`step-review.tsx`): one card per section. **Edit** opens that step with `&edit=1`, and Next returns to Review (or goes to Money if the change made it apply).
- **Finish later:**
  - **"Set up later" on step 1:** saves `onboarding_status: "skipped"` with default body values (rough targets), goes to `/today`, and keeps the draft.
  - **"Calculate now, finish the rest later" on step 2:** validates the body step, then saves `"partial"` with real targets and resumes at diet.
- **Today banner** (`components/today/finish-setup-banner.tsx`): shown while setup isn't complete, with different copy for skipped and partial. **Continue setup** resumes at the first unfinished step, rebuilding from the profile if the local draft is gone. "Hide for today" hides it for 24 hours.
  - Plates shows a "Finish setup" hint for incomplete profiles.
- **Favorite hall:** Plates and Menus open on the first favorite hall (`defaultLocationId` in `lib/hooks/use-locations.ts`). `TODO(nearest)` is removed.
- **Fixed while testing:**
  - "Finish later" resumed at body instead of diet.
  - Next keeps pages in memory, which would have left the Review button stuck on "Calculating…" when returning.
  - Continue setup with no local draft landed on step 1, because the URL was corrected before the rebuilt draft arrived.
- **Tests:** 64 passing.
- **Checked in the browser:**
  - On-campus path, and off-campus cooking path (5 steps).
  - Set up later → banner → Continue → finish later → banner → Continue, with and without a local draft → complete, after which the banner is gone.
  - Edit from Review, hiding the banner, and the demo account.
  - No overflow at 360px.
- **Lighthouse** accessibility is 100 on goal, both living branches, money, review, Today with the banner, and Plates with the hint.

## 2026-11-14 — Onboarding v2 polish (Claude Code, for Swagat)

- **Allergen names:** `ALLERGEN_LABELS` and `allergenList()` in `lib/diet.ts` are now used by the diet chips, the Review step and the Menus item sheet. Review used to show raw values like "peanut", and the Menus sheet replaced only the first underscore ("tree nuts, peanut").
- **Live step count:** the living step reports unsaved choices (`onChange`) so "Step 4 of 6" becomes "of 5" as soon as "Off campus, cooking for myself" is picked. The header, progress bar and resume card all update.

## 2026-11-14 — Menus refreshed from the scraper, and a pork-filter fix (Claude Code, for Swagat)

- **Fresh scrape:** ran `scraper/cli.js` for today (2026-11-14): Rocky Top 285 items, Stokely 279. Regenerated `mock/menu-items.generated.json` (`npm run mock:menus`), and 40 of the 66 demo items changed.
  - Before refreshing, I checked that the old mock menus matched the Nov 13 scraper output exactly (66 items, 0 mismatches).
- **The app still doesn't call the scraper live:**
  - There's no `/api/menus` route yet, and the GitHub workflow that `scraper/AUTOMATION.md` describes isn't in the repo.
  - So the demo menus are a snapshot until someone re-runs `node scraper/cli.js && npm run mock:menus`, or the backend serves the scraper.
- **Bug found by the new menu: pork filtering.** Halal and No-pork plate picks could include **Grilled Kielbasa**. Checking every scraped ingredient list found three more items whose names don't say pork: Salami, Hawaiian BBQ Pizza, and a "Beef Hot Dog" that lists pork in its ingredients.
  - `lib/diet.ts` now matches those words too.
  - Vegetarian- or vegan-tagged items skip the pork check, so "Incogmeato Sausage" and "Hot Dog Bun" aren't wrongly excluded.
  - Verified: every pork-containing item in today's scrape is excluded. A Halal demo got 28 different suggestions across halls and meals, with no pork.
  - `TODO(schema)` for Supul: derive a `contains_pork` flag from the scraper's ingredients instead of matching names.
- **Tests:** the diet tests used to look up yesterday's dishes by name, so they broke on the new menu. They now use their own sample items, so refreshing the menus can't break them. 65 tests passing.

## 2026-11-14 — No money questions in onboarding (Claude Code, for Swagat, branch `feature/onboarding-no-money`)

- **Onboarding is now 5 steps for everyone:** goal → body → diet → living → review.
  - Removed the Money step (`step-money.tsx` deleted), plus "I also have dining dollars" and the grocery budget field for off-campus cooks.
  - Meal plan names stay, because they decide which places a student can pay at.
  - The living step tells students they can add dining dollars, swipes and budgets on the Budget tab.
  - Old drafts saved with Money as a step resolve to Review.
- **Budget screen** (`components/budget/amount-editor.tsx`): students enter the numbers here instead.
  - Swipes left (Block plans, whole numbers only), dining dollars balance (plans with dining dollars) and a weekly budget (titled "Grocery budget" for off-campus cooks).
  - Each shows an input with Save when empty, and the value with "Update" once saved.
  - Saves call `PATCH /api/profile` through the new `api.updateMoney()` (`TODO(§9)`: confirm with backend).
- **Balances are preserved:** `buildProfileInput()` takes the balances already on the profile, so a student who skips setup, adds a budget on Budget, then finishes onboarding keeps it. Balances the new meal plan doesn't use are dropped.
- **Tests:** 65 passing.
- **Checked in the browser:**
  - A new student sees 5 steps and saves with no balances.
  - Budget: entering swipes (12.5 rejected) and dining dollars, then Update.
  - Skip → add budget → finish onboarding keeps the budget.
- **Lighthouse** accessibility is 100 on both living branches, Review, Budget with empty inputs, and the demo's Budget.
