import * as E from "@/lib/game-engine.server";
import { __stats, __tables } from "./mock-supabase";

const ms = (n: number) => `${Math.round(n)} ms`;
async function mk(type: string, n: number) {
  const ps: string[] = [];
  for (let i = 0; i < n; i++) { const t = `bench${type}${i}-`.padEnd(40, "x"); await E.upsertProfile({ sessionToken: t, displayName: "P" + i, avatarId: "fox" }); ps.push(t); }
  const { code } = await E.createGame(ps[0]!, type, {});
  for (const t of ps.slice(1)) await E.joinGame(t, code);
  for (const t of ps) await E.setReady(t, code, true);
  await E.startGame(ps[0]!, code);
  return { ps, code };
}
async function poll(label: string, token: string, code: string, n = 8) {
  await E.getState(token, code);                       // warm any caches like a real session
  __stats.calls = 0; __stats.writes = 0;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) await E.getState(token, code);
  const dt = (performance.now() - t0) / n;
  console.log(`${label.padEnd(34)} ${ms(dt).padStart(8)} per poll | ${(__stats.calls / n).toFixed(1)} DB calls | ${(__stats.writes / n).toFixed(2)} writes`);
}
const chess = await mk("chess", 2);
await poll("Chess poll", chess.ps[1]!, chess.code);
const ludo = await mk("ludo", 4);
await poll("Ludo poll (4 players)", ludo.ps[1]!, ludo.code);
const imp = await mk("imposter", 5);
await poll("Imposter poll (5 players)", imp.ps[2]!, imp.code);

// one chess move, timed from tap to the server finishing
const row = __tables.games!.find((g) => g.code === chess.code)!;
const white = (row.game_settings as any).chess.whiteProfileId as string;
const wtok = chess.ps.find((t) => __tables.profiles!.find((p) => p.session_token === t)!.id === white)!;
__stats.calls = 0; const t0 = performance.now();
await E.makeChessMove(wtok, chess.code, "e2", "e4");
console.log(`${"Chess move (action)".padEnd(34)} ${ms(performance.now() - t0).padStart(8)} total      | ${__stats.calls} DB calls`);
