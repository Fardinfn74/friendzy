import { check, throws, lobby, readyAll, gameRow, profileIdOf, makePlayers, E } from "./lib";
import { playableLetterPairs } from "@/games/word-duel/dictionary.server";
const lbd = (c: string) => gameRow(c).game_settings as any;
const past = (c: string, key: string) => {
  lbd(c)[key] = new Date(Date.now() - 1000).toISOString();
};

console.log("\n== Letter Blitz ==");
const pairs = playableLetterPairs();
check(
  "LB0 the pair pool only holds playable letter pairs (>= 40 real words)",
  pairs.length >= 40 && !pairs.some(([a, b]) => "QXZJ".includes(a) && "QXZJ".includes(b)),
  `${pairs.length} pairs`,
);

const g = await lobby("letter-blitz", 3, {});
await E.updateSettings(g.host.token, g.code, {
  letterBlitzSettings: { rounds: 3, roundTime: 45 },
} as any);
await readyAll(g.ps, g.code);
await E.startGame(g.host.token, g.code);
check("LB1 starts with a countdown", lbd(g.code).letterBlitzPhase === "countdown");
past(g.code, "letterBlitzCountdownEndsAt");
let s = await E.getState(g.ps[0]!.token, g.code);
check(
  "LB2 countdown ends -> round active (one poll is enough)",
  s.letterBlitz?.phase === "round_active",
  String(s.letterBlitz?.phase),
);
const [l1, l2] = s.letterBlitz!.currentRound!.letters;
check(
  "LB3 the round letters are a playable pair",
  pairs.some(([a, b]) => (a === l1 && b === l2) || (a === l2 && b === l1)),
  `${l1}${l2}`,
);
check(
  "LB4 answers are not handed out during the round",
  !(s.letterBlitz!.currentRound as any).examples,
);

// find real words for the pair
const { exampleWordsFor } = await import("@/games/word-duel/dictionary.server");
const words = exampleWordsFor(l1, l2, 6);
const outsider = (await makePlayers(1))[0]!;
const r0 = await E.submitLetterBlitzGuess(outsider.token, g.code, words[0]!).catch((e: Error) => ({
  ok: false,
  error: e.message,
}));
check(
  "LB5 someone who is not in the room cannot score",
  (r0 as any).ok === false && /not in this game/i.test((r0 as any).error ?? ""),
  JSON.stringify(r0),
);
let r: any = await E.submitLetterBlitzGuess(g.ps[0]!.token, g.code, "zzzz");
check("LB6 an invalid word is refused", r.ok === false);
r = await E.submitLetterBlitzGuess(g.ps[0]!.token, g.code, words[0]!);
check("LB7 first valid word = rank 1", r.ok === true && r.rank === 1, JSON.stringify(r));
r = await E.submitLetterBlitzGuess(g.ps[1]!.token, g.code, words[0]!);
check(
  "LB8 the same word can't be claimed twice",
  r.ok === false && /already claimed/i.test(r.error),
);
r = await E.submitLetterBlitzGuess(g.ps[0]!.token, g.code, words[1]!);
check("LB9 one answer per player", r.ok === false && /already/i.test(r.error));
r = await E.submitLetterBlitzGuess(g.ps[1]!.token, g.code, words[1]!);
check("LB10 second valid word = rank 2", r.ok === true && r.rank === 2);
check(
  "LB11 not everyone answered yet -> round still on",
  lbd(g.code).letterBlitzPhase === "round_active",
);
r = await E.submitLetterBlitzGuess(g.ps[2]!.token, g.code, words[2]!);
check(
  "LB12 when the last player answers the round ends early, with answers revealed",
  r.ok &&
    lbd(g.code).letterBlitzPhase === "round_end" &&
    (lbd(g.code).letterBlitzRound.examples ?? []).length > 0,
);
const sc = lbd(g.code).letterBlitzScores;
check(
  "LB13 scoring 3 / 2 / 1",
  sc[profileIdOf(g.ps[0]!.token)] === 3 &&
    sc[profileIdOf(g.ps[1]!.token)] === 2 &&
    sc[profileIdOf(g.ps[2]!.token)] === 1,
  JSON.stringify(Object.values(sc)),
);
r = await E.submitLetterBlitzGuess(g.ps[2]!.token, g.code, words[3] ?? "xxx");
check("LB14 no answers after the round ended", r.ok === false);
// the next round starts by itself (the host may be away)
past(g.code, "letterBlitzNextAt");
s = await E.getState(g.ps[1]!.token, g.code);
check(
  "LB15 round summary ends on its own -> round 2, no host click needed",
  s.letterBlitz?.phase === "round_active" && s.letterBlitz.roundNumber === 2,
  JSON.stringify([s.letterBlitz?.phase, s.letterBlitz?.roundNumber]),
);
// timeout path
past(g.code, "letterBlitzRoundEndsAt");
s = await E.getState(g.ps[1]!.token, g.code);
check("LB16 clock runs out -> round ends", s.letterBlitz?.phase === "round_end");
// many players polling at the same instant must not double-advance
past(g.code, "letterBlitzNextAt");
await Promise.all(g.ps.map((p) => E.getState(p.token, g.code)));
check(
  "LB17 three players polling at once advance the round exactly once",
  lbd(g.code).letterBlitzRoundNumber === 3 && lbd(g.code).letterBlitzPhase === "round_active",
  String(lbd(g.code).letterBlitzRoundNumber),
);
past(g.code, "letterBlitzRoundEndsAt");
await E.getState(g.ps[0]!.token, g.code);
past(g.code, "letterBlitzNextAt");
s = await E.getState(g.ps[0]!.token, g.code);
check(
  "LB18 after the last round the game ends",
  s.letterBlitz?.phase === "game_over" && s.status === "ended",
  JSON.stringify([
    s.letterBlitz?.phase,
    s.letterBlitz?.roundNumber,
    s.status,
    lbd(g.code).letterBlitzNextAt,
  ]),
);
