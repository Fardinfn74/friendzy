import { check, lobby, readyAll, gameRow, profileIdOf, rowsOf, E } from "./lib";
const ld = (c: string) => (gameRow(c).game_settings as any).ludo;

async function playRandomGame(n: number) {
  const g = await lobby("ludo", n, {}); await readyAll(g.ps, g.code); await E.startGame(g.host.token, g.code);
  let steps = 0, stuck = "";
  while (ld(g.code).phase !== "ended" && steps < 30000) {
    steps++;
    const d = ld(g.code);
    const cur = d.players.find((p: any) => p.color === d.currentTurnColor);
    const tok = g.ps.find((p) => profileIdOf(p.token) === cur.profileId)!;
    if (d.phase === "rolling") {
      const r = await E.rollLudoDice(tok.token, g.code);
      if (ld(g.code).phase === "moving") {
        const choices = r.validMoves as number[];
        if (!choices.length) { stuck = "moving phase but no valid moves"; break; }
        await E.moveLudoToken(tok.token, g.code, choices[Math.floor(Math.random() * choices.length)]!);
      }
    } else { stuck = "unexpected phase " + d.phase; break; }
    // invariants
    for (const p of ld(g.code).players) for (const t of p.tokens) if (t.step < -1 || t.step > 57) { stuck = `token step ${t.step} out of range`; }
    if (stuck) break;
  }
  const d = ld(g.code);
  return { g, d, steps, stuck };
}

console.log("\n== Ludo: 15 random full games (2/3/4 players) ==");
for (const n of [2, 3, 4]) {
  let ok = 0, problems: string[] = [];
  for (let i = 0; i < 5; i++) {
    const { d, steps, stuck } = await playRandomGame(n);
    const ranks = d.players.map((p: any) => p.rank).sort();
    const good = d.phase === "ended" && !stuck && JSON.stringify(ranks) === JSON.stringify(Array.from({ length: n }, (_, k) => k + 1));
    if (good) ok++; else problems.push(`phase=${d.phase} steps=${steps} ${stuck} ranks=${JSON.stringify(ranks)}`);
  }
  check(`L${n} ${n}-player games finish with a full ranking (${ok}/5)`, ok === 5, problems[0] ?? "");
}
{
  const g = await lobby("ludo", 2, {}); await readyAll(g.ps, g.code); await E.startGame(g.host.token, g.code);
  const d = ld(g.code); const notCur = g.ps.find((p) => profileIdOf(p.token) !== d.players[0].profileId)!;
  let err = ""; try { await E.rollLudoDice(notCur.token, g.code); } catch (e: any) { err = e.message; }
  check("L5 rolling out of turn is rejected", /not your turn/i.test(err), err);
}

console.log("\n== Leaving mid-game (every game type) ==");
const gs = (c: string, k: string) => (gameRow(c).game_settings as any)[k];
async function started(type: string, n: number, settings: any = {}) { const g = await lobby(type, n, settings); await readyAll(g.ps, g.code); await E.startGame(g.host.token, g.code); return g; }
{
  const g = await started("ludo", 4);
  const cur = gs(g.code, "ludo").players.find((p: any) => p.color === gs(g.code, "ludo").currentTurnColor);
  const leaver = g.ps.find((p) => profileIdOf(p.token) === cur.profileId)!;
  await E.leaveGame(leaver.token, g.code);
  const d = gs(g.code, "ludo");
  check("LV1 Ludo: player leaves on their own turn -> game goes on, turn passes, they are removed", gameRow(g.code).status !== "ended" && d.players.length === 3 && d.currentTurnColor !== cur.color && d.phase === "rolling", JSON.stringify({ st: gameRow(g.code).status, n: d.players.length, ph: d.phase }));
  const rest = g.ps.filter((p) => p !== leaver);
  await E.leaveGame(rest[0]!.token, g.code); await E.leaveGame(rest[1]!.token, g.code);
  check("LV2 Ludo: down to one player -> game ends, last player ranked", gs(g.code, "ludo").phase === "ended" && gs(g.code, "ludo").players.length === 1);
}
{
  const g = await started("truth-or-dare", 4);
  const cur = g.ps.find((p) => profileIdOf(p.token) === gs(g.code, "truthOrDare").currentPlayerId)!;
  await E.leaveGame(cur.token, g.code);
  const d = gs(g.code, "truthOrDare");
  check("LV3 Truth or Dare: current player leaves -> next player's turn, 3 left in order", gameRow(g.code).status !== "ended" && d.turnOrder.length === 3 && d.currentPlayerId !== profileIdOf(cur.token) && d.turnOrder.includes(d.currentPlayerId) && d.phase === "choosing_type");
}
{
  const g = await started("bottle-spin", 4);
  const sp = await E.spinBottle(g.ps[0]!.token, g.code);
  gs(g.code, "bottleSpin").spinEndsAt = Date.now() - 1; await E.getState(g.ps[0]!.token, g.code);
  const target = g.ps.find((p) => profileIdOf(p.token) === sp.targetPlayerId)!;
  await E.leaveGame(target.token, g.code);
  const d = gs(g.code, "bottleSpin");
  check("LV4 Bottle Spin: the chosen player leaves -> back to a fresh spin", gameRow(g.code).status !== "ended" && d.phase === "ready_to_spin" && d.targetPlayerId === null, JSON.stringify({ ph: d.phase }));
}
{
  const g = await started("number-guess", 3);
  await E.lockNumberGuessSecret(g.ps[0]!.token, g.code, 5); await E.lockNumberGuessSecret(g.ps[1]!.token, g.code, 6);
  await E.leaveGame(g.ps[2]!.token, g.code);   // the player everyone was waiting for leaves
  check("LV5 Number Guess: the player we were waiting on leaves -> countdown starts", gs(g.code, "numberGuess").phase === "countdown" && gameRow(g.code).status !== "ended", gs(g.code, "numberGuess").phase);
  await E.leaveGame(g.ps[1]!.token, g.code);
  check("LV6 Number Guess: only one player left -> match ends with them as winner", gs(g.code, "numberGuess").phase === "match_ended" && gs(g.code, "numberGuess").matchWinnerId === profileIdOf(g.ps[0]!.token));
}
{
  const g = await started("chess", 2);
  const white = g.ps.find((p) => profileIdOf(p.token) === gs(g.code, "chess").whiteProfileId)!; const black = g.ps.find((p) => p !== white)!;
  await E.leaveGame(black.token, g.code);
  check("LV7 Chess: opponent leaves -> the player who stayed wins", gs(g.code, "chess").phase === "ended" && gs(g.code, "chess").winnerId === profileIdOf(white.token));
}
{
  const g = await started("word-duel", 2);
  await E.leaveGame(g.ps[1]!.token, g.code);
  check("LV8 Word Duel: opponent leaves -> the player who stayed wins the match", gs(g.code, "wordDuel").phase === "match_ended" && gs(g.code, "wordDuel").matchWinnerId === profileIdOf(g.ps[0]!.token));
}
{
  const g = await started("carrom", 3);
  const cd = () => gs(g.code, "carrom");
  const cur = g.ps.find((p) => profileIdOf(p.token) === cd().currentTurnProfileId)!;
  await E.leaveGame(cur.token, g.code);
  check("LV9 Carrom: current player leaves -> next player's turn, game continues", gameRow(g.code).status !== "ended" && cd().players.length === 2 && cd().currentTurnProfileId !== profileIdOf(cur.token) && cd().phase === "aiming", JSON.stringify({ n: cd().players.length, ph: cd().phase }));
}
{
  const g = await started("imposter", 4);
  const crewMember = g.ps.find((p) => !(rowsOf("game_players").find((r) => r.profile_id === profileIdOf(p.token) && r.game_id === gameRow(g.code).id)!.is_imposter))!;
  await E.leaveGame(crewMember.token, g.code);
  check("LV10 Imposter keeps its own leave rules (game continues with 3)", ["reveal", "hint"].includes(gameRow(g.code).status), gameRow(g.code).status);
}
