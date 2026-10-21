import { check, throws, lobby, readyAll, gameRow, pastDeadline, profileIdOf, rowsOf, E } from "./lib";

async function startedGame(count: number, settings?: { mode?: "classic" | "double"; imposterCount?: number }) {
  const g = await lobby("imposter", count);
  if (settings) await E.updateSettings(g.host.token, g.code, settings as any);
  await readyAll(g.ps, g.code);
  await E.startGame(g.host.token, g.code);
  return g;
}
async function toHint(g: Awaited<ReturnType<typeof startedGame>>) {
  for (const p of g.ps) await E.confirmCardSeen(p.token, g.code);
}
async function allHint(g: Awaited<ReturnType<typeof startedGame>>) {
  // everyone gives a clue in turn
  for (let i = 0; i < g.ps.length + 2 && gameRow(g.code).status === "hint"; i++) {
    const cur = gameRow(g.code).current_turn_profile_id;
    const p = g.ps.find((x) => profileIdOf(x.token) === cur)!;
    await E.submitHint(p.token, g.code, "clue" + i);
  }
}

// ---- A: crew wins
{
  console.log("\n== Imposter A: crew wins ==");
  const g = await startedGame(4);
  let s = await E.getState(g.host.token, g.code);
  check("A1 start -> reveal", s.status === "reveal");
  const imposters = rowsOf("game_players").filter((r) => r.game_id === gameRow(g.code).id && r.is_imposter);
  check("A2 exactly 1 imposter dealt", imposters.length === 1);
  const cards = await Promise.all(g.ps.map((p) => E.getState(p.token, g.code).then((x) => x.myCard)));
  check("A3 imposter card has no word, crew cards share one word", cards.filter((c) => c?.role === "imposter").length === 1 && new Set(cards.filter((c) => c?.role === "crew").map((c) => c!.word)).size === 1);
  await toHint(g);
  s = await E.getState(g.host.token, g.code);
  check("A4 all cards seen -> hint round", s.status === "hint" && !!s.currentTurnProfileId);
  const wrong = g.ps.find((p) => profileIdOf(p.token) !== s.currentTurnProfileId)!;
  await throws("A5 clue out of turn is rejected", () => E.submitHint(wrong.token, g.code, "hello"), /not your turn/i);
  const cur = g.ps.find((p) => profileIdOf(p.token) === s.currentTurnProfileId)!;
  await throws("A6 clue containing the secret word is rejected", () => E.submitHint(cur.token, g.code, "its " + gameRow(g.code).secret_word), /secret word/i);
  await allHint(g);
  s = await E.getState(g.host.token, g.code);
  check("A7 after all clues -> voting", s.status === "voting");
  const imp = imposters[0]!.profile_id as string;
  const impToken = g.ps.find((p) => profileIdOf(p.token) === imp)!;
  await throws("A8 can't vote for yourself", () => E.submitVote(g.ps[0]!.token, g.code, { targetIds: [profileIdOf(g.ps[0]!.token)], replay: false }), /yourself/i);
  for (const p of g.ps) {
    const target = p === impToken ? profileIdOf(g.ps.find((x) => x !== impToken)!.token) : imp;
    await E.submitVote(p.token, g.code, { targetIds: [target], replay: false });
  }
  s = await E.getState(g.host.token, g.code);
  check("A9 imposter voted out -> resolved + crew winner pending", s.status === "resolved" && gameRow(g.code).pending_status === "ended" && gameRow(g.code).winner === "crew", JSON.stringify({ st: s.status, w: gameRow(g.code).winner }));
  pastDeadline(g.code, "resolve_until");
  s = await E.getState(g.host.token, g.code);
  check("A10 resolve timer -> ended, word revealed", s.status === "ended" && !!s.revealedWord && s.winner === "crew");
  await E.playAgain(g.host.token, g.code);
  s = await E.getState(g.host.token, g.code);
  check("A11 play again returns to lobby", s.status === "lobby" && s.players.every((p) => !p.isReady));
}

// ---- B: imposters win
{
  console.log("\n== Imposter B: imposters win ==");
  const g = await startedGame(3);
  await toHint(g); await allHint(g);
  const imp = rowsOf("game_players").find((r) => r.game_id === gameRow(g.code).id && r.is_imposter)!.profile_id as string;
  const crew = g.ps.filter((p) => profileIdOf(p.token) !== imp);
  for (const p of g.ps) await E.submitVote(p.token, g.code, { targetIds: [profileIdOf(crew[0]!.token) === profileIdOf(p.token) ? profileIdOf(crew[1]!.token) : profileIdOf(crew[0]!.token)], replay: false });
  const s = await E.getState(g.host.token, g.code);
  check("B1 crew voted out (3p: 1 imp vs 1 crew) -> imposters win", gameRow(g.code).winner === "imposters" && gameRow(g.code).pending_status === "ended", JSON.stringify({ w: gameRow(g.code).winner, st: s.status }));
}

// ---- C: double agent
{
  console.log("\n== Imposter C: Double Agent ==");
  const g = await startedGame(4, { mode: "double" });
  const cards = await Promise.all(g.ps.map((p) => E.getState(p.token, g.code).then((x) => x.myCard)));
  check("C1 everyone sees role 'crew' + a word", cards.every((c) => c?.role === "crew" && !!c.word));
  check("C2 imposter's word differs from crew word", new Set(cards.map((c) => c!.word)).size === 2, JSON.stringify(cards.map((c) => c!.word)));
}

// ---- D: timeouts + replay
{
  console.log("\n== Imposter D: timeouts & replay ==");
  const g = await startedGame(4);
  await toHint(g);
  const before = gameRow(g.code).current_turn_profile_id;
  pastDeadline(g.code, "turn_deadline");
  await E.getState(g.host.token, g.code);
  const sk = rowsOf("hints").filter((h) => h.game_id === gameRow(g.code).id && h.skipped);
  check("D1 hint timeout -> silent skip recorded + turn advances", sk.length === 1 && gameRow(g.code).current_turn_profile_id !== before);
  await allHint(g);
  check("D2 reaches voting", gameRow(g.code).status === "voting");
  // replay vote by majority
  for (const p of g.ps) await E.submitVote(p.token, g.code, { targetIds: [], replay: true });
  check("D3 unanimous replay -> resolved with 'Replay' note, no one eliminated", gameRow(g.code).status === "resolved" && /Replay/i.test(gameRow(g.code).last_resolution_note ?? "") && gameRow(g.code).last_eliminated_id === null);
  pastDeadline(g.code, "resolve_until");
  await E.getState(g.host.token, g.code);
  check("D4 after resolve -> new hint round (round 2)", gameRow(g.code).status === "hint" && gameRow(g.code).round_number === 2);
  await allHint(g);
  pastDeadline(g.code, "vote_deadline");
  await E.getState(g.host.token, g.code);
  check("D5 vote timeout with zero votes -> nobody eliminated", gameRow(g.code).status === "resolved" && /No votes/i.test(gameRow(g.code).last_resolution_note ?? ""));
}

// ---- E: join rules + leaving
{
  console.log("\n== Imposter E: join/leave edge cases ==");
  const g = await lobby("imposter", 3);
  await E.joinGame(g.ps[1]!.token, g.code);
  check("E1 joining twice doesn't duplicate the seat", rowsOf("game_players").filter((r) => r.game_id === gameRow(g.code).id).length === 3);
  await throws("E2 start with < 3 ready is blocked", () => E.startGame(g.host.token, g.code), /ready/i);
  await throws("E3 non-host can't start", () => E.startGame(g.ps[1]!.token, g.code), /host/i);
  await readyAll(g.ps, g.code);
  await E.startGame(g.host.token, g.code);
  const late = (await (await import("./lib")).makePlayers(1))[0]!;
  await throws("E4 outsider can't join after start", () => E.joinGame(late.token, g.code), /already started/i);
  await throws("E5 unknown room code", () => E.joinGame(g.ps[0]!.token, "ZZZZZ"), /No game found/i);

  // leave during reveal: remaining players already confirmed
  const g2 = await startedGame(4);
  const isImp = (t: string) => !!rowsOf("game_players").find((r) => r.profile_id === profileIdOf(t) && r.game_id === gameRow(g2.code).id)!.is_imposter;
  const crewLeaver = g2.ps.find((p) => !isImp(p.token))!;   // (an imposter leaving would legitimately end the game)
  for (const p of g2.ps.filter((x) => x !== crewLeaver)) await E.confirmCardSeen(p.token, g2.code);
  await E.leaveGame(crewLeaver.token, g2.code);   // last unseen player leaves
  let s = await E.getState(g2.host.token, g2.code).catch((e) => ({ status: "ERR " + e.message }) as any);
  check("E6 last unconfirmed player leaves during card reveal -> game moves on", s.status === "hint", "status is " + s.status + " (stuck?)");

  // host leaves in lobby
  const g3 = await lobby("imposter", 3);
  await E.leaveGame(g3.host.token, g3.code);
  check("E7 host leaves lobby -> next player becomes host", gameRow(g3.code).host_id === profileIdOf(g3.ps[1]!.token));
}
