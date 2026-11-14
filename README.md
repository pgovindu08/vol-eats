# vol-eats

Vol Eats: a mobile-first web app that helps UTK students hit their calorie and macro targets with what the dining halls are serving today.

## Run the frontend

You need Node 18 or newer.

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_USE_MOCKS=true
npm run dev                  # http://localhost:3000
```

Open it at phone width and tap **Use demo account**. The demo user has breakfast already logged.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (vitest) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run build` | Production build |
| `npm run mock:menus` | Rebuilds the mock dining-hall menus from `scraper/data/*.json` |

## Mocks

`NEXT_PUBLIC_USE_MOCKS=true` runs everything against an in-browser fake backend (`lib/mock-api.ts`), so the app works without the real API.

- **Simulate errors:** add `?fail=1` to any URL to make every API call fail and test the error screens.
- **Reset the demo:** the ↺ button on Today (demo account only) puts the demo user back to breakfast-only, for rehearsing.

When the real routes exist, set `NEXT_PUBLIC_USE_MOCKS=false`. Every call goes through `lib/api.ts`, which lists each route the frontend expects. Anything still unconfirmed with the backend is marked `TODO(schema)`, `TODO(§9)` or `PROPOSED`.

## Where things are

- `app/`: screens. `(auth)/login`, `(onboarding)/onboarding`, and the main tabs in `(app)/`: today, plates, menus, log, budget, events.
- `components/`: UI pieces, grouped by feature. Shared primitives are in `components/ui`.
- `lib/`: types, the API client, the targets formula, and helpers for diet, budget and dates.
- `mock/`: demo data.
- `scraper/`: the UTK menu scraper.
- `app/globals.css`: every theme color and size (see `docs/theme.md`).
- `CONTEXT.md`: a log of AI-made changes.
