import { check, lobby, readyAll, gameRow, profileIdOf, E } from "./lib";
const hay = (o: unknown) => JSON.stringify(o);

{
  // Number Guess: can another player read my secret number from the state they fetch?
  const g = await lobby("number-guess", 3, {});
  await readyAll(g.ps, g.code);
  await E.startGame(g.host.token, g.code);
  await E.lockNumberGuessSecret(g.ps[0]!.token, g.code, 4242 % 100 || 42);
  const s = await E.getState(g.ps[1]!.token, g.code);
  const secrets = (s.gameSettings as any)?.numberGuess?.secrets;
  check(
    "LEAK1 Number Guess: other players' secret numbers are NOT in the state sent to a rival",
    !secrets || Object.keys(secrets).length === 0,
    "secrets: " + hay(secrets),
  );
}
{
  // Word Duel: opponent's letter before reveal
  const g = await lobby("word-duel", 2, {});
  await readyAll(g.ps, g.code);
  await E.startGame(g.host.token, g.code);
  await E.sendWordDuelLetter(g.ps[0]!.token, g.code, "q");
  const s = await E.getState(g.ps[1]!.token, g.code);
  const picks = (s.gameSettings as any)?.wordDuel?.picks;
  check(
    "LEAK3 Word Duel: opponent's hidden letter is NOT in the state",
    !picks || Object.keys(picks).length === 0,
    "picks: " + hay(picks),
  );
}
