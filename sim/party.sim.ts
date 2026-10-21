import { check, throws, lobby, readyAll, gameRow, profileIdOf, E } from "./lib";
const bs = (c: string) => (gameRow(c).game_settings as any).bottleSpin;
const td = (c: string) => (gameRow(c).game_settings as any).truthOrDare;

console.log("\n== Bottle Spin ==");
{
  const g = await lobby("bottle-spin", 4, { bottleSpin: { settings: { promptLevel: "All", customPrompts: [] } } });
  await throws("B0 can't start with < 3 players ready", async () => { const t = await lobby("bottle-spin", 2); await readyAll(t.ps, t.code); await E.startGame(t.host.token, t.code); }, /at least 3/i);
  await readyAll(g.ps, g.code); await E.startGame(g.host.token, g.code);
  check("B1 starts ready_to_spin", bs(g.code).phase === "ready_to_spin", bs(g.code).phase);
  const spin = await E.spinBottle(g.ps[0]!.token, g.code);
  check("B2 spin picks someone other than the spinner and rotates 5+ turns", spin.targetPlayerId !== profileIdOf(g.ps[0]!.token) && spin.totalRotation >= 1800);
  await throws("B3 can't spin again while spinning", () => E.spinBottle(g.ps[1]!.token, g.code), /cannot be spun/i);
  bs(g.code).spinEndsAt = Date.now() - 1000;
  let s = await E.getState(g.ps[0]!.token, g.code);
  check("B4 after the animation -> choosing_prompt", s.bottleSpin?.phase === "choosing_prompt", String(s.bottleSpin?.phase));
  const target = g.ps.find((p) => profileIdOf(p.token) === spin.targetPlayerId)!;
  const other = g.ps.find((p) => p !== target)!;
  await throws("B5 only the chosen player picks truth/dare", () => E.chooseBottlePrompt(other.token, g.code, "truth"), /chosen player/i);
  const pr = await E.chooseBottlePrompt(target.token, g.code, "dare");
  check("B6 a dare prompt is served", !!pr.prompt?.text && bs(g.code).phase === "prompt_active");
  await throws("B7 only chosen player may skip", () => E.skipBottlePrompt(other.token, g.code), /chosen player/i);
  const sk = await E.skipBottlePrompt(target.token, g.code);
  check("B8 skip gives a different prompt", !!sk && bs(g.code).currentPrompt.id !== pr.prompt.id);
  await throws("B9 second skip refused (1 per game)", () => E.skipBottlePrompt(target.token, g.code), /already used/i);
  await E.completeBottlePrompt(target.token, g.code);
  check("B10 done -> chosen player becomes next spinner", bs(g.code).phase === "ready_to_spin" && bs(g.code).currentSpinnerId === profileIdOf(target.token));
  // many rounds: prompts never repeat
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const sp = await E.spinBottle(target.token, g.code); bs(g.code).spinEndsAt = Date.now() - 1; await E.getState(target.token, g.code);
    const t2 = g.ps.find((p) => profileIdOf(p.token) === sp.targetPlayerId)!;
    const r = await E.chooseBottlePrompt(t2.token, g.code, i % 2 ? "truth" : "dare"); seen.add(r.prompt.id);
    await E.completeBottlePrompt(t2.token, g.code);
  }
  check("B11 40 rounds: no prompt repeated", seen.size === 40, `${seen.size} unique of 40`);
}

console.log("\n== Truth or Dare ==");
{
  const g = await lobby("truth-or-dare", 3, {});
  await readyAll(g.ps, g.code); await E.startGame(g.host.token, g.code);
  check("T1 starts at choosing_type", td(g.code).phase === "choosing_type" && td(g.code).turnOrder.length === 3);
  const cur = () => g.ps.find((p) => profileIdOf(p.token) === td(g.code).currentPlayerId)!;
  const notCur = g.ps.find((p) => p !== cur())!;
  await throws("T2 only the current player picks", () => E.chooseTruthOrDarePrompt(notCur.token, g.code, "truth"), /not your turn/i);
  const first = cur();
  await E.chooseTruthOrDarePrompt(first.token, g.code, "truth");
  check("T3 prompt active", td(g.code).phase === "prompt_active" && !!td(g.code).currentPrompt?.text);
  await throws("T4 can't pick twice", () => E.chooseTruthOrDarePrompt(first.token, g.code, "dare"), /cannot be chosen/i);
  await E.completeTruthOrDarePrompt(first.token, g.code);
  check("T5 done -> next player's turn (wraps around the order)", cur() !== first);
  const order: string[] = [];
  for (let i = 0; i < 6; i++) { order.push(td(g.code).currentPlayerId); await E.chooseTruthOrDarePrompt(cur().token, g.code, "dare"); await E.completeTruthOrDarePrompt(cur().token, g.code); }
  check("T6 turns cycle fairly through all 3 players", new Set(order).size === 3);
  const t = await lobby("truth-or-dare", 3, { truthOrDare: { settings: { promptLevel: "Chill", customPrompts: [{ id: "c1", type: "truth", level: "Chill", text: "My custom truth" }] } } });
  await readyAll(t.ps, t.code); await E.startGame(t.host.token, t.code);
  const p = t.ps.find((x) => profileIdOf(x.token) === td(t.code).currentPlayerId)!;
  await E.chooseTruthOrDarePrompt(p.token, t.code, "truth");
  check("T7 level filter 'Chill' respected", td(t.code).currentPrompt.level === "Chill" || td(t.code).currentPrompt.id === "c1", JSON.stringify(td(t.code).currentPrompt));
  // exhaust the bank
  let err = "";
  try { await E.completeTruthOrDarePrompt(p.token, t.code); for (let i = 0; i < 400; i++) { const c = t.ps.find((x) => profileIdOf(x.token) === td(t.code).currentPlayerId)!; await E.chooseTruthOrDarePrompt(c.token, t.code, i % 2 ? "truth" : "dare"); await E.completeTruthOrDarePrompt(c.token, t.code); } } catch (e: any) { err = e.message; }
  check("T8 running out of prompts never crashes the game", err === "", err);
}
