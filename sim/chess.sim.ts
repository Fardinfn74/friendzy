import { check, throws, lobby, readyAll, gameRow, profileIdOf, E } from "./lib";
const ch = (c: string) => (gameRow(c).game_settings as any).chess;
async function newGame(settings: any = {}) {
  const g = await lobby("chess", 2, settings); await readyAll(g.ps, g.code); await E.startGame(g.host.token, g.code);
  const white = g.ps.find((p) => profileIdOf(p.token) === ch(g.code).whiteProfileId)!;
  const black = g.ps.find((p) => p !== white)!;
  return { ...g, white, black };
}
console.log("\n== Chess ==");
{
  const g = await newGame();
  check("C1 starts with white to move", ch(g.code).phase === "playing" && ch(g.code).turn === "w");
  await throws("C2 black can't move first", () => E.makeChessMove(g.black.token, g.code, "e7", "e5"), /not your turn/i);
  await throws("C3 illegal move rejected (pawn jumps 3)", () => E.makeChessMove(g.white.token, g.code, "e2", "e5"), /invalid/i);
  const outsider = (await (await import("./lib")).makePlayers(1))[0]!;
  await throws("C4 spectator/outsider can't move", () => E.makeChessMove(outsider.token, g.code, "e2", "e4"), /not in this game|not a player/i);
  await E.makeChessMove(g.white.token, g.code, "f2", "f3");
  await E.makeChessMove(g.black.token, g.code, "e7", "e5");
  await E.makeChessMove(g.white.token, g.code, "g2", "g4");
  await E.makeChessMove(g.black.token, g.code, "d8", "h4");
  const s = await E.getState(g.white.token, g.code);
  check("C5 fool's mate: black wins by checkmate", s.chess?.phase === "ended" && s.chess.resultReason === "checkmate" && s.chess.winnerId === profileIdOf(g.black.token) && s.status === "ended", JSON.stringify({ p: s.chess?.phase, r: s.chess?.resultReason, st: s.status }));
  await throws("C6 no moves after the game ended", () => E.makeChessMove(g.white.token, g.code, "a2", "a3"), /not in progress/i);
  const r1 = await E.rematchChess(g.white.token, g.code);
  const r2 = await E.rematchChess(g.black.token, g.code);
  check("C7 rematch needs both players, colors swap", (r1 as any).waiting === true && (r2 as any).waiting === false && ch(g.code).whiteProfileId === profileIdOf(g.black.token) && ch(g.code).phase === "playing");
}
{
  const g = await newGame();
  await E.resignChess(g.black.token, g.code);
  check("C8 resign -> white wins", ch(g.code).winnerId === profileIdOf(g.white.token) && ch(g.code).resultReason === "resignation");
}
{
  const g = await newGame({ chess: { settings: { timedMode: true, minutes: 1, incrementSeconds: 0 } } });
  const st = ch(g.code);
  check("C9 timed mode sets clocks", st.settings.timedMode === true && st.whiteTimeMs > 0, JSON.stringify(st.settings));
  st.turnStartedAt = Date.now() - st.whiteTimeMs - 5000;  // white has been thinking past the whole clock
  const s = await E.getState(g.black.token, g.code);
  check("C10 white runs out of time -> black wins on timeout", s.chess?.resultReason === "timeout" && s.chess.winnerId === profileIdOf(g.black.token), JSON.stringify({ r: s.chess?.resultReason }));
}
{
  const g = await newGame({ chess: { settings: { timedMode: true, minutes: 1, incrementSeconds: 0 } } });
  ch(g.code).turnStartedAt = Date.now() - ch(g.code).whiteTimeMs - 5000;   // nobody polled yet
  let moved = true; try { await E.makeChessMove(g.white.token, g.code, "e2", "e4"); } catch { moved = false; }
  check("C11 a player whose clock already hit zero can't still make a move", moved === false, "move was accepted after the clock expired");
}
console.log("\n== Chess: promotion ==");
{
  const g = await newGame();
  // force a position: white pawn on a7 ready to promote, kings far apart
  ch(g.code).fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1"; ch(g.code).turn = "w";
  await E.makeChessMove(g.white.token, g.code, "a7", "a8", "n");
  check("C12 promotion piece is honoured (knight)", ch(g.code).moves.at(-1).promotion === "n", JSON.stringify(ch(g.code).moves.at(-1)));
}
