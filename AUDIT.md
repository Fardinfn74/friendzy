# FRIENDZY audit: what was found and what was fixed

Checked: every page, every game's rules (by playing full games against the real server code), security, speed, code health.
Result: type check clean, lint 0 errors, production build OK, **149 automated game checks pass** (`bash sim/run-all.sh`).

## 1. Do these yourself (the code can't do them for you)

1. **Rotate your secrets.** `.env` was inside the archive you uploaded (Supabase service key, Gemini key, CRON_SECRET). Treat them as exposed:
   create new ones, update Vercel, and never put `.env` in a zip or git again.
2. **Run `drizzle/migrations/0006_doodle_canvas_and_lockdown.sql`** in the Supabase SQL editor (new project: `complete_database_setup.sql` already includes it).
   It creates the table Doodle Rush needs and stops the public (browser) key from touching game tables or calling the profile functions.
3. **Supabase -> Authentication -> turn OFF "Allow new users to sign up".** The app creates accounts itself on the server.
4. **Put Vercel and Supabase in the same region** (Singapore for Bangladesh: Vercel `sin1`, Supabase `ap-southeast-1`). This is the biggest remaining speed lever.
5. `npm install` (dependencies changed), then deploy.

## 2. Security problems fixed

| Problem                                                                                                                                                                                                                           | Fix                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Secrets reached other players.** The server sent every player the raw game JSON, which held Number Guess secret numbers, Word Duel hidden letters and the Doodle Rush word. Anyone could read them in the browser's network tab | Clients now get only a filtered projection; nested game state never leaves the server                                                                  |
| Doodle Rush: the word was visible to guessers during the countdown, and every correct guess was stored as text so later guessers could copy it                                                                                    | Word sent only to the artist (and everyone after the round); correct guesses are stored without text                                                   |
| Letter Blitz / Doodle Rush actions never checked the caller was in the room                                                                                                                                                       | Membership checked on every action                                                                                                                     |
| Drawing data was unbounded (a single request could fill the database)                                                                                                                                                             | Strokes, points, colours, sizes validated and capped on the server                                                                                     |
| Sign-up could **reset the password of an existing login** and take it over; half-created accounts were left behind; unlimited sign-ups                                                                                            | No more takeover path; failures roll back; per-IP rate limit; passwords 8-72 chars; names filtered                                                     |
| `prepareLoginFn` listed all auth users on every login attempt (slow, DoS-able, only saw the first 50) and `createAccountFn` was unused                                                                                            | Both removed                                                                                                                                           |
| Profile helper functions and game tables were reachable with the public key                                                                                                                                                       | Migration 0006 revokes it (server uses the service key)                                                                                                |
| Database/internal error text was shown to players                                                                                                                                                                                 | Logged on the server; players see a friendly message                                                                                                   |
| Custom prompts, names, theme text, strokes: no size limits                                                                                                                                                                        | Limits added                                                                                                                                           |
| No rate limiting anywhere                                                                                                                                                                                                         | Limits on sign-up, username checks, creating/joining rooms, profile saves, AI calls, and a per-player ceiling                                          |
| No security headers                                                                                                                                                                                                               | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, caching (`vercel.json`). Tested against the production build on 8 pages: 0 violations |
| Production silently fell back to the public key if the service key was missing                                                                                                                                                    | Production now refuses to start without it                                                                                                             |
| AI key sent in the URL (ends up in logs); AI calls could hang forever                                                                                                                                                             | Key moved to a header; timeouts added                                                                                                                  |
| Offensive words could be scored as valid answers / chosen as names                                                                                                                                                                | Word and name filter                                                                                                                                   |
| Session token fell back to `Math.random` on plain-http pages                                                                                                                                                                      | Uses secure random bytes                                                                                                                               |

## 3. Game bugs fixed

- **Letter Blitz:** picked letter pairs that have no real answers (e.g. Q/X); rounds never ended early; the next round needed the host (stalled if the host was away);
  late answers were accepted; clock changes could be applied twice by simultaneous pollers. Now: only playable pairs, early finish, auto-advance, answers shown at round end.
- **Doodle Rush:** each stroke was a server call and the whole drawing was resent on every poll (laggy and heavy). Now strokes are drawn live (Realtime) and saved as a
  snapshot in their own table. Added **no time limit** (default), Undo, "give up and reveal", auto next drawing, artist-leaves handling, "so close!" hint.
- Number Guess could never start (earlier fix, still covered by tests); leaving a game no longer ends it for everybody (earlier fix).
- Ludo: a failed dice roll left the dice spinning forever. Carrom: aiming did not work with a finger.
- Clock-driven changes (countdowns, deadlines) are applied once, inside the room lock.

## 4. Speed and weight

|                                     | Before                                               | After                                                        |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| One poll (100 ms per database call) | 705 ms, 7 calls, 1 write                             | ~102 ms, 1-2 calls, 0 writes                                 |
| Double Agent "Start"                | waited for an AI call every time                     | instant (hand-picked pairs first; AI only as a 3 s fallback) |
| Fonts                               | Google Fonts, render-blocking                        | self-hosted, subset, no third party                          |
| `public/` images                    | 4.2 MB (a 435 KB logo SVG loaded on every game page) | 0.7 MB (12 KB logo)                                          |
| Game screen code                    | 41 KB gz, all 10 games at once                       | 12 KB + one small chunk (4-11 KB) per game                   |
| npm dependencies                    | 59 + 19 dev                                          | 27 + 17 dev (93 packages and 42 unused UI files removed)     |

## 5. UI / UX

- Bottle Spin has a **"Just spin the bottle!"** mode: no names, no room, the bottle is the spin button; Truth/Dare optional.
- Doodle Rush: toolbar wraps on small phones, correct guesses show as "guessed the word!", "Next drawing in Ns" countdown.
- Home page has a proper heading; theme colour and share tags; web-app icons fixed (the manifest pointed at a 435 KB SVG).
- Passwords are 8+ characters everywhere (UI text updated).

## 6. Not verified / worth knowing

- I could not reach your live Supabase, so database behaviour was tested against a faithful in-memory copy, and Realtime push was not tested live (the app falls back to polling).
- The 3D boards were checked in a software-rendered browser, not on real phones. Each has a 3D/2D switch.
- Carrom's coin positions are computed on the shooter's phone; a technical player could cheat. Fine among friends, not for money games.
- The in-memory rate limiter is per server instance (a speed bump, not a wall).
- Old leftovers I did not touch: `config.toml`, `project.json`, `roadmap.md`, `AGENTS.md` (from the generator you started with).
- New accounts get 200 free coins; when you add real payments, add a limit so one person cannot farm accounts.
