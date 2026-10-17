# FRIENDZY 🎮

A playful, retro toybox style multiplayer game hub featuring classic board games and party games with friends!

## Games Included

- ♟️ **Chess**: Full turn-based 2-player chess with legal move highlights, check/checkmate detection, and move history powered by `chess.js`.
- 🎲 **Ludo**: 2–4 player classic Indian board game with dice rolls, token racing, home path tracking, and safe squares.
- 🎯 **Carrom**: 2-player carrom board with animated striker, carrom men pockets, queen mechanics, and foul tracking.
- 🎭 **Imposter**: Party deduction game for 3 to 12 players with secret words, classic & double-imposter modes, and voting.
- 📝 **Word Duel**: Rapid turn-based vocabulary battle.
- 🍾 **Spin the Bottle**: Classic party bottle-spin game.
- 🤫 **Truth or Dare**: Party prompts with custom or AI generation.
- 🔢 **Number Guess**: Fast deduction number guessing.

---

## Features

- **Retro Toybox Aesthetic**: Tactile sticker pieces, collectible role cards, sound effects, and light/dark theme persistence (`imposta.theme`).
- **Real-Time Multiplayer**: Built with Supabase for real-time presence, state synchronization, rooms, and account stats.
- **Full-Stack TanStack Start**: Server-side rendering, type-safe RPC server functions, and file-based routing.
- **Deploy Ready**: Pre-configured with Nitro for smooth deployment on Vercel.

---

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) with React 19 & Vite
- **Server Engine**: [Nitro](https://nitro.unjs.io/)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **Data & State**: [TanStack Query](https://tanstack.com/query)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) + Radix UI Primitives
- **Database / Realtime**: PostgreSQL with [Supabase](https://supabase.com) & [Drizzle ORM](https://orm.drizzle.team)

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm or bun

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your Supabase keys:
   ```env
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
   SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_PUBLISHABLE_KEY="your-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

---

## Vercel Deployment

1. Import this repository in [Vercel](https://vercel.com).
2. Framework Preset will automatically detect **TanStack Start** (via `vercel.json` and `nitro()`).
3. Add the following **Environment Variables** in Vercel Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID` (optional)
   - `OPENAI_API_KEY` (optional, for AI word generation)
4. Click **Deploy**!
