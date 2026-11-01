import { check, throws, lobby, readyAll, gameRow, profileIdOf, E } from "./lib";
const td = (c: string) => (gameRow(c).game_settings as any).truthOrDare;

console.log("\n== Truth or Dare ==");
{
  const g = await lobby("truth-or-dare", 3, {});
  await readyAll(g.ps, g.code);
  await E.startGame(g.host.token, g.code);
  check(
    "T1 starts at choosing_type",
    td(g.code).phase === "choosing_type" && td(g.code).turnOrder.length === 3,
  );
  const cur = () => g.ps.find((p) => profileIdOf(p.token) === td(g.code).currentPlayerId)!;
  const notCur = g.ps.find((p) => p !== cur())!;
  await throws(
    "T2 only the current player picks",
    () => E.chooseTruthOrDarePrompt(notCur.token, g.code, "truth"),
    /not your turn/i,
  );
  const first = cur();
  await E.chooseTruthOrDarePrompt(first.token, g.code, "truth");
  check(
    "T3 prompt active",
    td(g.code).phase === "prompt_active" && !!td(g.code).currentPrompt?.text,
  );
  await throws(
    "T4 can't pick twice",
    () => E.chooseTruthOrDarePrompt(first.token, g.code, "dare"),
    /cannot be chosen/i,
  );
  await E.completeTruthOrDarePrompt(first.token, g.code);
  check("T5 done -> next player's turn (wraps around the order)", cur() !== first);
  const order: string[] = [];
  for (let i = 0; i < 6; i++) {
    order.push(td(g.code).currentPlayerId);
    await E.chooseTruthOrDarePrompt(cur().token, g.code, "dare");
    await E.completeTruthOrDarePrompt(cur().token, g.code);
  }
  check("T6 turns cycle fairly through all 3 players", new Set(order).size === 3);
  const t = await lobby("truth-or-dare", 3, {
    truthOrDare: {
      settings: {
        promptLevel: "Chill",
        customPrompts: [{ id: "c1", type: "truth", level: "Chill", text: "My custom truth" }],
      },
    },
  });
  await readyAll(t.ps, t.code);
  await E.startGame(t.host.token, t.code);
  const p = t.ps.find((x) => profileIdOf(x.token) === td(t.code).currentPlayerId)!;
  await E.chooseTruthOrDarePrompt(p.token, t.code, "truth");
  check(
    "T7 level filter 'Chill' respected",
    td(t.code).currentPrompt.level === "Chill" || td(t.code).currentPrompt.id === "c1",
    JSON.stringify(td(t.code).currentPrompt),
  );
  // exhaust the bank
  let err = "";
  try {
    await E.completeTruthOrDarePrompt(p.token, t.code);
    for (let i = 0; i < 400; i++) {
      const c = t.ps.find((x) => profileIdOf(x.token) === td(t.code).currentPlayerId)!;
      await E.chooseTruthOrDarePrompt(c.token, t.code, i % 2 ? "truth" : "dare");
      await E.completeTruthOrDarePrompt(c.token, t.code);
    }
  } catch (e: any) {
    err = e.message;
  }
  check("T8 running out of prompts never crashes the game", err === "", err);
}
