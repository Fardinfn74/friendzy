import {
  check,
  throws,
  lobby,
  readyAll,
  gameRow,
  profileIdOf,
  makePlayers,
  E,
  rowsOf,
} from "./lib";
const gs = (c: string) => gameRow(c).game_settings as any;
const past = (c: string, key: string) => {
  gs(c)[key] = new Date(Date.now() - 1000).toISOString();
};
const roundOf = (c: string) => gs(c).doodleRushRound as any;
const stroke = (n = 10, color = "#ef4444") => ({
  x: Array.from({ length: n }, (_, i) => i / n),
  y: Array.from({ length: n }, (_, i) => i / n),
  color,
  size: 8,
  tool: "pen" as const,
});

async function newMatch(n = 3, drawTime?: number) {
  const g = await lobby("doodle-rush", n, {});
  if (drawTime !== undefined)
    await E.updateSettings(g.host.token, g.code, { doodleRushSettings: { drawTime } } as any);
  await readyAll(g.ps, g.code);
  await E.startGame(g.host.token, g.code);
  const drawer = () => g.ps.find((p) => profileIdOf(p.token) === roundOf(g.code).drawerId)!;
  const guessers = () => g.ps.filter((p) => p !== drawer());
  return { ...g, drawer, guessers };
}
const startDrawing = async (g: Awaited<ReturnType<typeof newMatch>>) => {
  past(g.code, "doodleRushCountdownEndsAt");
  await E.getState(g.ps[0]!.token, g.code);
};

console.log("\n== Doodle Rush ==");
{
  const g = await newMatch(3);
  const word = roundOf(g.code).word as string;
  let s = await E.getState(g.guessers()[0]!.token, g.code);
  check(
    "DR1 countdown: the secret word is NOT sent to guessers",
    !JSON.stringify(s).toLowerCase().includes(word.toLowerCase()),
    `"${word}" leaked`,
  );
  s = await E.getState(g.drawer().token, g.code);
  check("DR2 the artist can see the word", s.doodleRush?.currentRound?.word === word);
  await startDrawing(g);
  s = await E.getState(g.guessers()[0]!.token, g.code);
  check(
    "DR3 drawing: still no word anywhere in a guesser's state (incl. raw settings)",
    !JSON.stringify(s).toLowerCase().includes(word.toLowerCase()),
    `"${word}" leaked`,
  );
  check(
    "DR4 guessers do get the blanks (_ _ _)",
    /_/.test(s.doodleRush?.currentRound?.wordMask ?? ""),
  );
  check(
    "DR5 the state no longer carries the drawing itself (polls stay small)",
    !JSON.stringify(s).includes('"strokes"'),
  );

  const outsider = (await makePlayers(1))[0]!;
  await throws(
    "DR6 an outsider cannot guess",
    () => E.submitDoodleGuess(outsider.token, g.code, word),
    /not in this game/i,
  );
  await throws(
    "DR7 an outsider cannot read the picture",
    () => E.getDoodleCanvas(outsider.token, g.code),
    /not in this game/i,
  );
  await throws(
    "DR8 an outsider cannot draw",
    () => E.pushDoodleCanvas(outsider.token, g.code, [stroke()]),
    /not in this game/i,
  );
  await throws(
    "DR9 guessers cannot draw",
    () => E.pushDoodleCanvas(g.guessers()[0]!.token, g.code, [stroke()]),
    /only the artist/i,
  );

  const r1 = await E.pushDoodleCanvas(g.drawer().token, g.code, [
    stroke(20),
    stroke(5, "javascript:alert(1)"),
  ]);
  check("DR10 the artist saves a picture", r1.seq === 1);
  const pic = await E.getDoodleCanvas(g.guessers()[0]!.token, g.code);
  check(
    "DR11 guessers can fetch it; bad colours are replaced by a safe default",
    pic.strokes.length === 2 && pic.strokes[1]!.color === "#1a1a1a" && pic.seq === 1,
    JSON.stringify(pic.strokes.map((x) => x.color)),
  );
  await throws(
    "DR12 a huge drawing is refused",
    () =>
      E.pushDoodleCanvas(
        g.drawer().token,
        g.code,
        Array.from({ length: 401 }, () => stroke(5)),
      ),
    /too big/i,
  );
  await throws(
    "DR13 too many points is refused",
    () =>
      E.pushDoodleCanvas(
        g.drawer().token,
        g.code,
        Array.from({ length: 30 }, () => stroke(1000)),
      ),
    /too big/i,
  );

  // guessing
  const [a, b] = g.guessers();
  let r: any = await E.submitDoodleGuess(a!.token, g.code, "totally wrong");
  check("DR14 wrong guess is accepted as a guess, not correct", r.ok && !r.correct);
  await new Promise((res) => setTimeout(res, 650));
  r = await E.submitDoodleGuess(a!.token, g.code, word.toUpperCase().replace(/(.+)/, " $1 !!"));
  check(
    "DR15 correct guess works even with caps/spaces/punctuation",
    r.ok && r.correct,
    JSON.stringify(r),
  );
  const round = roundOf(g.code);
  check(
    "DR16 a correct answer is never stored as text (others can't copy it)",
    round.guesses.every((x: any) => !x.correct || x.guess === ""),
  );
  s = await E.getState(b!.token, g.code);
  check(
    "DR17 after someone guessed, the word is still hidden from the others",
    !JSON.stringify(s).toLowerCase().includes(word.toLowerCase()),
    "leak",
  );
  check(
    "DR18 each correct guess reveals one more letter",
    (round.revealedIndices ?? []).length >= (word.replace(/ /g, "").length > 1 ? 1 : 0),
  );
  check(
    "DR19 the artist earns a point per correct guess",
    gs(g.code).doodleRushScores[profileIdOf(g.drawer().token)] === 1,
  );
  r = await E.submitDoodleGuess(a!.token, g.code, word);
  check("DR20 you can't win twice", r.ok === false);
  r = await E.submitDoodleGuess(g.drawer().token, g.code, word);
  check("DR21 the artist can't guess their own picture", r.ok === false);
  r = await E.submitDoodleGuess(b!.token, g.code, word);
  check(
    "DR22 last guesser -> round ends, word revealed to everybody",
    r.ok && gs(g.code).doodleRushPhase === "round_end",
  );
  s = await E.getState(b!.token, g.code);
  check(
    "DR23 round summary shows the word and the 1st/2nd order",
    s.doodleRush?.currentRound?.revealedWord === word &&
      s.doodleRush.currentRound.winnerIds.length === 2 &&
      s.doodleRush.currentRound.winnerIds[0] === profileIdOf(a!.token),
  );

  // auto-advance, fresh canvas
  past(g.code, "doodleRushNextAt");
  const firstDrawer = roundOf(g.code).drawerId;
  await Promise.all(g.ps.map((p) => E.getState(p.token, g.code)));
  check(
    "DR24 next drawing starts by itself (3 players polling at once advance exactly once)",
    gs(g.code).doodleRushRoundNumber === 2 &&
      roundOf(g.code).drawerId !== firstDrawer &&
      gs(g.code).doodleRushPhase === "drawing",
    String(gs(g.code).doodleRushRoundNumber),
  );
  const fresh = await E.getDoodleCanvas(g.ps[0]!.token, g.code);
  check("DR25 the new artist starts on a blank board", fresh.strokes.length === 0);
}

{
  // no time limit + skipping
  const g = await newMatch(3, 0);
  check("DR26 'no time limit' is supported (no deadline set)", roundOf(g.code).endsAt === null);
  await startDrawing(g);
  await new Promise((r) => setTimeout(r, 20));
  const s = await E.getState(g.guessers()[0]!.token, g.code);
  check("DR27 with no limit the drawing stays open", s.doodleRush?.phase === "drawing");
  await throws(
    "DR28 a plain guesser can't skip the drawing",
    () =>
      E.endDoodleRound(
        g.guessers().find((p) => p !== g.host)?.token ?? g.guessers()[0]!.token,
        g.code,
      ),
    /only the artist or the host/i,
  );
  await E.endDoodleRound(g.drawer().token, g.code);
  check(
    "DR29 the artist can give up -> round ends, word revealed",
    gs(g.code).doodleRushPhase === "round_end" &&
      roundOf(g.code).revealedWord === roundOf(g.code).word,
  );
}

{
  // timer
  const g = await newMatch(3, 60);
  await startDrawing(g);
  past(g.code, "doodleRushCountdownEndsAt");
  roundOf(g.code).endsAt = new Date(Date.now() - 1000).toISOString();
  await E.getState(g.ps[1]!.token, g.code);
  check("DR30 the timer ends the drawing", gs(g.code).doodleRushPhase === "round_end");
}

{
  // leaving
  const g = await newMatch(3, 0);
  await startDrawing(g);
  await E.leaveGame(g.drawer().token, g.code);
  check(
    "DR31 the artist leaves -> their drawing is skipped (no frozen room)",
    gs(g.code).doodleRushPhase === "round_end" && gameRow(g.code).status !== "ended",
  );
  past(g.code, "doodleRushNextAt");
  const rest = g.ps.filter((p) => profileIdOf(p.token) !== roundOf(g.code).drawerId);
  await E.getState(rest[0]!.token, g.code).catch(() => {});
  const remaining = g.ps.filter((p) =>
    rowsOf("game_players").some(
      (r) =>
        r.profile_id === profileIdOf(p.token) && r.game_id === gameRow(g.code).id && !r.left_game,
    ),
  );
  await E.leaveGame(remaining[0]!.token, g.code);
  check(
    "DR32 only one player left -> the match finishes",
    gs(g.code).doodleRushPhase === "game_over" && gameRow(g.code).status === "ended",
  );
}
