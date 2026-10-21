import { check, throws, lobby, readyAll, gameRow, profileIdOf, E } from "./lib";
const ng = (code: string) => (gameRow(code).game_settings as any).numberGuess;
const past = (code: string) => { ng(code).countdownEndsAt = Date.now() - 1000; };
const clearCooldown = (code: string) => { const g = ng(code); for (const k of Object.keys(g.guessHistory)) if (k.includes("__cd__")) delete g.guessHistory[k]; };

console.log("\n== Number Guess ==");
const g = await lobby("number-guess", 3, { numberGuess: { settings: { range: "1-100", hints: true, rounds: 3 } } });
await readyAll(g.ps, g.code);
await E.startGame(g.host.token, g.code);
const [a, b, c] = g.ps;
check("N1 starts in pick phase", ng(g.code).phase === "pick", ng(g.code).phase);
await throws("N2 number out of range rejected", () => E.lockNumberGuessSecret(a!.token, g.code, 500), /between 1 and 100/);
await E.lockNumberGuessSecret(a!.token, g.code, 42);
await throws("N3 can't change a locked number", () => E.lockNumberGuessSecret(a!.token, g.code, 43), /already/i);
await E.lockNumberGuessSecret(b!.token, g.code, 77);
check("N4 2 of 3 locked -> still picking", ng(g.code).phase === "pick");
await E.lockNumberGuessSecret(c!.token, g.code, 10);
check("N5 all 3 locked -> countdown starts", ng(g.code).phase === "countdown", "phase is '" + ng(g.code).phase + "'");
past(g.code);
let s = await E.getState(a!.token, g.code);
check("N6 countdown ends -> guess phase", s.numberGuess?.phase === "guess", String(s.numberGuess?.phase));
const leaked = JSON.stringify(s.numberGuess).includes("77") && JSON.stringify(s.numberGuess).includes('"secrets"');
check("N7 other players' secrets are not sent to the browser during guessing", !JSON.stringify(s.numberGuess).match(/"secrets"\s*:\s*\{[^}]*"[0-9a-f-]{36}"/), "secrets visible in client state");
let r: any = await E.submitNumberGuess(a!.token, g.code, profileIdOf(a!.token), 5);
check("N8 can't guess your own number", r.ok === false);
r = await E.submitNumberGuess(a!.token, g.code, profileIdOf(b!.token), 50);
check("N9 wrong guess 50 vs 77 -> hint 'higher'", r.ok && r.correct === false && r.hint === "higher", JSON.stringify(r));
r = await E.submitNumberGuess(a!.token, g.code, profileIdOf(b!.token), 60);
check("N10 immediate second guess hits the cooldown", r.ok === false && /wait/i.test(r.reason ?? ""), JSON.stringify(r));
clearCooldown(g.code);
r = await E.submitNumberGuess(a!.token, g.code, profileIdOf(b!.token), 77);
check("N11 correct guess wins the round", r.ok && r.correct === true && ng(g.code).roundWinnerId === profileIdOf(a!.token));
s = await E.getState(c!.token, g.code);
check("N12 secrets revealed after the round ends", s.numberGuess?.phase === "round_ended" && JSON.stringify(s.numberGuess).includes("77"));
r = await E.submitNumberGuess(c!.token, g.code, profileIdOf(a!.token), 42);
check("N13 guess after round ended is refused", r.ok === false);
await E.advanceNumberGuessRound(a!.token, g.code);
check("N14 next round resets to pick", ng(g.code).phase === "pick" && Object.keys(ng(g.code).secrets).length === 0 && ng(g.code).currentRound === 2);

console.log("\n== Number Guess: simultaneous ==");
{
  let lost = 0, N = 20;
  for (let i = 0; i < N; i++) {
    const t = await lobby("number-guess", 2, {}); await readyAll(t.ps, t.code); await E.startGame(t.host.token, t.code);
    await Promise.all([E.lockNumberGuessSecret(t.ps[0]!.token, t.code, 11), E.lockNumberGuessSecret(t.ps[1]!.token, t.code, 22)]);
    if (ng(t.code).phase !== "countdown") lost++;
  }
  check(`N15 both players lock a number at the same instant (${N} tries)`, lost === 0, `${lost}/${N} failed to start the countdown`);
}
