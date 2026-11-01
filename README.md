# FRIENDZY 🎮

A playful, retro "toybox" hub of multiplayer party, brain and board games. Players join a room with a short code
(or a QR code) and play together in real time. Built with TanStack Start (React 19), Supabase and Tailwind v4,
deployed on Vercel.

## Games

| Game | Players | Notes |
| --- | --- | --- |
| 🎭 Imposter | 3–12 | Secret word, clues, votes. Classic and Double Agent modes |
| 📝 Word Duel | 2 | Race to type a word that starts and ends with the two secret letters |
| ⚡ Letter Blitz | 2+ | Everyone races to find a word for two letters; 1st/2nd/3rd earn the most points |
| 🎨 Doodle Rush | 2+ | One player draws, the rest guess. Live drawing, optional time limit |
| 🔢 Number Guess | 2–6 | Pick a secret number, crack the others' first |
| 🤫 Truth or Dare | 3–12 | Turn-based prompts with levels and custom prompts |
| ♟️ Chess | 2 | Legal-move highlighting, clocks, 3D or 2D board |
| 🎲 Ludo | 2–4 | Full rules, walking tokens, 3D or 2D board |
| 🎯 Carrom | 2–4 | Physics striker, queen and fouls, 3D or 2D board |
| 🍾 Bottle Spin | any | **Offline**: no room. Spin it on your phone like a real bottle (names optional) |

## Getting started

```bash
npm install
cp .env.example .env     # then fill in your own values (see below)
npm run dev
```

### 1. Database (Supabase)

* **New project:** paste `drizzle/complete_database_setup.sql` into the Supabase SQL editor and run it. It contains everything.
* **Existing project:** run `drizzle/migrations/0006_doodle_canvas_and_lockdown.sql`. It adds the Doodle Rush canvas table
  **and locks the tables and helper functions down so they can only be used by the server**. Safe to run twice.

### 2. Environment variables

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are secrets: never put them in the browser build
(no `VITE_` prefix), never commit `.env`, and rotate them if a copy ever leaves your machine.

### 3. Supabase settings worth checking

* **Authentication → Providers/Settings → turn OFF "Allow new users to sign up".** All sign-ups go through the app's own
  `registerAccountFn` (using the service key), so public sign-up only lets strangers create junk accounts.
* **Realtime** must be enabled (it is by default). Moves and drawings reach other players instantly through Broadcast;
  if it is ever unavailable the app falls back to polling.
* **Region:** create the Vercel project in the region closest to your Supabase project (for Bangladesh, Singapore:
  Vercel `sin1`, Supabase `ap-southeast-1`). Server and database in different continents is the biggest cause of lag.

## Quality checks

```bash
npm run build            # production build
npx tsc --noEmit         # type check
npm run lint             # ESLint + Prettier
bash sim/run-all.sh      # plays full games of every type against an in-memory database
```

`sim/` runs the real server code against a fake database, so it needs no Supabase and finishes in seconds. Run it before
every deploy. `MOCK_LATENCY_MS=100 npx tsx --tsconfig sim/tsconfig.json sim/bench.ts` measures database round trips.

## How it works (short)

* `src/lib/game-engine.server.ts`: rooms, players, Imposter rules and the glue for every game. Server-only.
* `src/games/<game>/`: each game has `engine.server.ts` (rules, authoritative), `index.tsx` (screen) and `settings.tsx`.
  Every game screen is loaded only when that game is opened.
* `src/lib/game.functions.ts`, `shop.functions.ts`: the only entry points from the browser. Inputs are validated with zod.
* Game state lives in `games.game_settings` (JSON). **Clients never receive that raw JSON**, only a projection built on the
  server that leaves out secrets (hidden letters, secret numbers, the word being drawn).
* Every state-changing action runs one at a time per room (`room-lock.server.ts`) so simultaneous taps cannot overwrite each other.
* Rate limits (`rate-limit.server.ts`), friendly error messages (database details are logged, never shown), and security headers
  (`vercel.json`) are on by default.
