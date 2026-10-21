import * as E from "@/lib/game-engine.server";
import { __tables } from "./mock-supabase";

export const results: { name: string; ok: boolean; detail?: string }[] = [];
export function check(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`);
}
export async function throws(name: string, fn: () => Promise<unknown>, expect?: RegExp) {
  try { await fn(); check(name, false, "expected an error but call succeeded"); }
  catch (e) { const m = e instanceof Error ? e.message : String(e); check(name, expect ? expect.test(m) : true, `got: ${m}`); }
}
let n = 0;
export async function makePlayers(count: number) {
  const out: { name: string; token: string }[] = [];
  for (let i = 0; i < count; i++) {
    const name = ["Ana", "Bob", "Cy", "Dee", "Eli", "Fay", "Gus", "Hal"][i]!;
    const token = `tok${++n}-${name}-`.padEnd(40, "x");
    await E.upsertProfile({ sessionToken: token, displayName: name, avatarId: "fox" });
    out.push({ name, token });
  }
  return out;
}
export async function lobby(gameType: string, count: number, settings: Record<string, unknown> = {}) {
  const ps = await makePlayers(count);
  const { code } = await E.createGame(ps[0]!.token, gameType, settings);
  for (const p of ps.slice(1)) await E.joinGame(p.token, code);
  return { ps, code, host: ps[0]! };
}
export async function readyAll(ps: { token: string }[], code: string) {
  for (const p of ps) await E.setReady(p.token, code, true);
}
export const gameRow = (code: string) => __tables.games!.find((g) => g.code === code)!;
export const rowsOf = (t: string) => __tables[t]!;
export const profileIdOf = (token: string) => __tables.profiles!.find((p) => p.session_token === token)!.id as string;
export const pastDeadline = (code: string, field: string) => { gameRow(code)[field] = new Date(Date.now() - 1000).toISOString(); };
export { E, __tables };
