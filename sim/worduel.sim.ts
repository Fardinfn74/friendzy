import { check, throws, lobby, readyAll, gameRow, profileIdOf, E } from "./lib";

const wd = (code: string) => (gameRow(code).game_settings as any).wordDuel;
const past = (code: string, key: "countdownEndsAt" | "roundDeadline") => {
  const gs = gameRow(code).game_settings as any; gs.wordDuel[key] = Date.now() - 1000;
};
async function newDuel(rounds = 3) {
  const g = await lobby("word-duel", 2, { wordDuel: { settings: { rounds, roundTime: 30 } } });
  await readyAll(g.ps, g.code);
  await E.startGame(g.host.token, g.code);
  return g;
}

console.log("\n== Word Duel: rules ==");
{
  const g = await newDuel(3);
  const [a, b] = g.ps;
  check("W1 starts in pick phase", wd(g.code).phase === "pick");
  await throws("W2 non-letter rejected", () => E.sendWordDuelLetter(a!.token, g.code, "7"), /single letter/i);
  await E.sendWordDuelLetter(a!.token, g.code, "a");
  await throws("W3 can't change a locked letter", () => E.sendWordDuelLetter(a!.token, g.code, "b"), /already/i);
  let s = await E.getState(b!.token, g.code);
  check("W4 opponent sees 'locked' but not the letter", s.wordDuel?.opponentLocked === true && s.wordDuel?.revealedLetters === null);
  await E.sendWordDuelLetter(b!.token, g.code, "t");
  s = await E.getState(a!.token, g.code);
  check("W5 both sent -> countdown + letters revealed", s.wordDuel?.phase === "countdown" && s.wordDuel.revealedLetters?.join("") === "AT");
  let r = await E.submitWordDuelWord(a!.token, g.code, "ant");
  check("W6 typing during countdown is refused", r.ok === false);
  past(g.code, "countdownEndsAt");
  const bad: [string, RegExp][] = [["area", /start with/i], ["tot", /start with/i], ["at", /short/i], ["a t", /letters only/i], ["azzt", /dictionary/i]];
  for (const [w, re] of bad) { r = await E.submitWordDuelWord(a!.token, g.code, w); check(`W7 "${w}" rejected (${r.reason})`, r.ok === false && re.test(r.reason ?? "")); }
  r = await E.submitWordDuelWord(b!.token, g.code, "tea");
  check("W8 'tea' (T...A) wins the round for B", r.ok === true && wd(g.code).roundWinnerId === profileIdOf(b!.token));
  r = await E.submitWordDuelWord(a!.token, g.code, "ant");
  check("W9 late valid word is refused", r.ok === false, r.reason);
  await E.advanceWordDuelRound(a!.token, g.code);
  check("W10 next round -> pick phase, picks cleared", wd(g.code).phase === "pick" && Object.keys(wd(g.code).picks).length === 0 && wd(g.code).currentRound === 2);
  // same-letter round + timeout draw
  await E.sendWordDuelLetter(a!.token, g.code, "s"); await E.sendWordDuelLetter(b!.token, g.code, "s");
  past(g.code, "countdownEndsAt");
  r = await E.submitWordDuelWord(a!.token, g.code, "sea");
  check("W11 same letters: 'sea' (S..A) rejected, must start AND end with S", r.ok === false && /start AND end/i.test(r.reason ?? ""));
  r = await E.submitWordDuelWord(a!.token, g.code, "sass");
  check("W12 same letters: 'sass' accepted", r.ok === true, r.reason);
  check("W13 score 1-1 -> match not over", wd(g.code).phase === "round_ended");
  await E.advanceWordDuelRound(a!.token, g.code);
  await E.sendWordDuelLetter(a!.token, g.code, "m"); await E.sendWordDuelLetter(b!.token, g.code, "k");
  past(g.code, "countdownEndsAt"); await E.getState(a!.token, g.code); // syncs countdown -> word
  past(g.code, "roundDeadline");
  s = await E.getState(a!.token, g.code);
  check("W14 timeout with no word -> draw (nobody scores)", s.wordDuel?.phase === "round_ended" && s.wordDuel.roundWinnerId === "draw");
  await E.advanceWordDuelRound(a!.token, g.code);
  await E.sendWordDuelLetter(a!.token, g.code, "d"); await E.sendWordDuelLetter(b!.token, g.code, "g");
  past(g.code, "countdownEndsAt");
  r = await E.submitWordDuelWord(a!.token, g.code, "dog");
  s = await E.getState(a!.token, g.code);
  check("W15 first to 2 wins the match", s.wordDuel?.phase === "match_ended" && s.status === "ended" && s.wordDuel.matchWinnerId === profileIdOf(a!.token), JSON.stringify(s.wordDuel?.scores));
  await E.rematchWordDuel(a!.token, g.code);
  check("W16 rematch resets scores", Object.values(wd(g.code).scores).every((v) => v === 0) && wd(g.code).phase === "pick");
}

console.log("\n== Word Duel: simultaneous actions (the 'both press Send at once' case) ==");
{
  let lost = 0, bothWon = 0; const N = 30;
  for (let i = 0; i < N; i++) {
    const g = await newDuel(3);
    await Promise.all([E.sendWordDuelLetter(g.ps[0]!.token, g.code, "a"), E.sendWordDuelLetter(g.ps[1]!.token, g.code, "t")]);
    if (wd(g.code).phase !== "countdown") { lost++; continue; }
    past(g.code, "countdownEndsAt");
    const [r1, r2] = await Promise.all([E.submitWordDuelWord(g.ps[0]!.token, g.code, "ant"), E.submitWordDuelWord(g.ps[1]!.token, g.code, "tea")]);
    if (r1.ok && r2.ok) bothWon++;
  }
  check(`W17 both players sending a letter at the same instant (${N} tries)`, lost === 0, `${lost}/${N} times a letter was lost and the round never started`);
  check(`W18 both players submitting a valid word at the same instant (${N} tries)`, bothWon === 0, `${bothWon}/${N} times BOTH were told they won`);
}
