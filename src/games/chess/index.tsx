import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Clock, RotateCcw, Flag, Trophy, AlertCircle, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { avatarEmoji, type GameState } from "@/lib/game-types";
import { PlayerAvatar } from "@/components/player-avatar";
import { play } from "@/lib/sounds";
import { makeChessMoveFn, resignChessFn, rematchChessFn } from "@/lib/game.functions";

interface ChessGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

// Retro sticker piece representations with collectible toybox aesthetic
const PIECE_SYMBOLS: Record<string, { symbol: string; label: string; toyIcon: string }> = {
  wp: { symbol: "♙", label: "White Pawn", toyIcon: "🧸" },
  wn: { symbol: "♘", label: "White Knight", toyIcon: "🐴" },
  wb: { symbol: "♗", label: "White Bishop", toyIcon: "🧙" },
  wr: { symbol: "♖", label: "White Rook", toyIcon: "🏰" },
  wq: { symbol: "♕", label: "White Queen", toyIcon: "👑" },
  wk: { symbol: "♔", label: "White King", toyIcon: "🤴" },
  bp: { symbol: "♟", label: "Black Pawn", toyIcon: "🧸" },
  bn: { symbol: "♞", label: "Black Knight", toyIcon: "🦄" },
  bb: { symbol: "♝", label: "Black Bishop", toyIcon: "🧙‍♂️" },
  br: { symbol: "♜", label: "Black Rook", toyIcon: "🏯" },
  bq: { symbol: "♛", label: "Black Queen", toyIcon: "👸" },
  bk: { symbol: "♚", label: "Black King", toyIcon: "👑" },
};

export function ChessGame({ s, token, refresh, runAction }: ChessGameProps) {
  const chessState = s.chess;
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);

  // Parse board state client-side using chess.js
  const chessInstance = useMemo(() => {
    try {
      return new Chess(chessState?.fen);
    } catch {
      return new Chess();
    }
  }, [chessState?.fen]);

  const myColor = chessState?.myColor ?? null;
  const isMyTurn = chessState?.isMyTurn ?? false;

  // Real-time ticking clocks
  const [whiteRemaining, setWhiteRemaining] = useState<number>(chessState?.whiteTimeMs ?? 300000);
  const [blackRemaining, setBlackRemaining] = useState<number>(chessState?.blackTimeMs ?? 300000);

  useEffect(() => {
    if (!chessState) return;
    setWhiteRemaining(chessState.whiteTimeMs);
    setBlackRemaining(chessState.blackTimeMs);
  }, [chessState?.whiteTimeMs, chessState?.blackTimeMs]);

  useEffect(() => {
    if (
      !chessState ||
      chessState.phase !== "playing" ||
      !chessState.settings.timedMode ||
      !chessState.turnStartedAt
    ) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - chessState.turnStartedAt!;
      if (chessState.turn === "w") {
        setWhiteRemaining(Math.max(0, chessState.whiteTimeMs - elapsed));
      } else {
        setBlackRemaining(Math.max(0, chessState.blackTimeMs - elapsed));
      }
    }, 250);

    return () => clearInterval(interval);
  }, [chessState]);

  // Sound cue on turn change
  useEffect(() => {
    if (isMyTurn) {
      play("turn");
    }
  }, [isMyTurn]);

  // Calculate legal moves for selected square
  const legalDestinations = useMemo(() => {
    if (!selectedSquare || !isMyTurn) return new Set<string>();
    const moves = chessInstance.moves({ square: selectedSquare, verbose: true });
    return new Set(moves.map((m) => m.to));
  }, [selectedSquare, isMyTurn, chessInstance]);

  if (!chessState) {
    return (
      <div className="play-panel p-8 text-center space-y-3">
        <p className="font-bold text-muted-foreground">Setting up the Toybox Chessboard…</p>
      </div>
    );
  }

  // Handle square click
  const handleSquareClick = (square: Square) => {
    if (chessState.phase !== "playing" || !isMyTurn) return;

    const piece = chessInstance.get(square);

    // If no piece selected yet: must click own piece
    if (!selectedSquare) {
      if (piece && piece.color === myColor) {
        setSelectedSquare(square);
        play("pick");
      }
      return;
    }

    // If clicked on own piece again: switch selection
    if (piece && piece.color === myColor) {
      setSelectedSquare(square);
      play("pick");
      return;
    }

    // If clicked on legal destination square
    if (legalDestinations.has(square)) {
      const movingPiece = chessInstance.get(selectedSquare);
      // Check for pawn promotion
      const isPromotion =
        movingPiece?.type === "p" &&
        ((movingPiece.color === "w" && square[1] === "8") ||
          (movingPiece.color === "b" && square[1] === "1"));

      if (isPromotion) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      executeMove(selectedSquare, square);
      return;
    }

    // Otherwise clear selection
    setSelectedSquare(null);
  };

  const executeMove = (from: Square, to: Square, promotion?: string) => {
    setSelectedSquare(null);
    setPendingPromotion(null);
    play("clue");

    void runAction(
      async () => {
        return await makeChessMoveFn({
          data: {
            sessionToken: token,
            code: s.code,
            from,
            to,
            promotion,
          },
        });
      },
      () => refresh(),
    );
  };

  const formatClock = (ms: number) => {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const whitePlayer = s.players.find((p) => p.profileId === chessState.whiteProfileId);
  const blackPlayer = s.players.find((p) => p.profileId === chessState.blackProfileId);

  // Ranks & files based on player perspective (White on bottom, or Black on bottom if viewing as Black)
  const ranks = myColor === "b" ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files =
    myColor === "b"
      ? ["h", "g", "f", "e", "d", "c", "b", "a"]
      : ["a", "b", "c", "d", "e", "f", "g", "h"];

  const lastMove = chessState.moves[chessState.moves.length - 1];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Toybox Game Board Frame */}
      <div className="bg-amber-950/20 dark:bg-amber-950/40 p-4 sm:p-6 rounded-3xl border-4 border-amber-800/40 shadow-2xl backdrop-blur-sm">
        {/* Top Player Card (Opponent) */}
        <div className="flex items-center justify-between mb-3 px-2">
          {(() => {
            const opponent = myColor === "w" ? blackPlayer : whitePlayer;
            const oppColor = myColor === "w" ? "b" : "w";
            const oppTime = oppColor === "w" ? whiteRemaining : blackRemaining;
            const isOppTurn = chessState.turn === oppColor && chessState.phase === "playing";

            return (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`relative w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-md border-2 ${
                      isOppTurn
                        ? "border-amber-400 bg-amber-100 ring-2 ring-amber-400 animate-pulse"
                        : "border-border bg-card"
                    }`}
                  >
                    <PlayerAvatar id={opponent?.avatarId} size={28} />
                    <span className="absolute -bottom-1 -right-1 text-xs">
                      {oppColor === "w" ? "⚪" : "⚫"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-bold block leading-tight">
                      {opponent?.displayName ?? (oppColor === "w" ? "White" : "Black")}
                    </span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {oppColor === "w" ? "White Pieces" : "Black Pieces"}
                    </span>
                  </div>
                </div>

                {/* Opponent Clock */}
                {chessState.settings.timedMode && (
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold border ${
                      isOppTurn
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                        : "bg-muted/70 text-foreground/80 border-border/50"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatClock(oppTime)}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* The 8x8 Wooden Chess Board */}
        <div className="relative aspect-square max-w-[460px] mx-auto rounded-2xl overflow-hidden border-4 border-amber-900/60 shadow-inner bg-[#e6c280]">
          <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
            {ranks.map((rank) =>
              files.map((file) => {
                const square = `${file}${rank}` as Square;
                const fileIdx = file.charCodeAt(0) - 97;
                const isLight = (fileIdx + rank) % 2 !== 0;
                const piece = chessInstance.get(square);
                const isSelected = selectedSquare === square;
                const isLegalDest = legalDestinations.has(square);
                const isLastMoveSquare =
                  lastMove && (lastMove.from === square || lastMove.to === square);
                const isInCheckSquare =
                  chessState.inCheck && piece?.type === "k" && piece.color === chessState.turn;

                const pieceKey = piece ? `${piece.color}${piece.type}` : null;
                const pieceInfo = pieceKey ? PIECE_SYMBOLS[pieceKey] : null;

                return (
                  <button
                    key={square}
                    type="button"
                    onClick={() => handleSquareClick(square)}
                    className={`relative flex items-center justify-center select-none transition-transform active:scale-95 ${
                      isLight ? "bg-[#f4dfb8] text-amber-950" : "bg-[#b88648] text-amber-950"
                    } ${isLastMoveSquare ? "bg-amber-300/80 dark:bg-amber-600/60" : ""} ${
                      isSelected ? "ring-4 ring-inset ring-amber-500 bg-amber-200/90" : ""
                    } ${isInCheckSquare ? "bg-red-500/80 ring-4 ring-red-500 animate-pulse" : ""}`}
                  >
                    {/* Retro coordinate labels on edges */}
                    {file === (myColor === "b" ? "h" : "a") && (
                      <span className="absolute top-0.5 left-1 text-[9px] font-bold opacity-60">
                        {rank}
                      </span>
                    )}
                    {rank === (myColor === "b" ? 8 : 1) && (
                      <span className="absolute bottom-0.5 right-1 text-[9px] font-bold opacity-60">
                        {file}
                      </span>
                    )}

                    {/* Sticker Chess Piece */}
                    {pieceInfo && (
                      <div
                        className={`text-3xl sm:text-4xl leading-none transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] filter ${
                          piece?.color === "w"
                            ? "text-slate-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
                            : "text-slate-900 drop-shadow-[0_2px_3px_rgba(255,255,255,0.4)]"
                        } ${isSelected ? "scale-110 -translate-y-1" : "hover:scale-105"}`}
                      >
                        {pieceInfo.symbol}
                      </div>
                    )}

                    {/* Legal Move Indicators (Toybox sticker dots) */}
                    {isLegalDest && (
                      <div
                        className={`absolute rounded-full pointer-events-none ${
                          piece
                            ? "w-full h-full border-4 border-amber-600/80 bg-amber-500/20 rounded-lg animate-pulse"
                            : "w-3.5 h-3.5 sm:w-4 sm:h-4 bg-amber-700/60 shadow-sm"
                        }`}
                      />
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        {/* Bottom Player Card (You) */}
        <div className="flex items-center justify-between mt-3 px-2">
          {(() => {
            const me = myColor === "w" ? whitePlayer : blackPlayer;
            const myPlayerObj = s.players.find((p) => p.profileId === s.me.profileId);
            const myTurn = isMyTurn;
            const myTime = myColor === "w" ? whiteRemaining : blackRemaining;

            return (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`relative w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-md border-2 ${
                      myTurn
                        ? "border-emerald-400 bg-emerald-100 ring-2 ring-emerald-400 animate-pulse"
                        : "border-border bg-card"
                    }`}
                  >
                    <PlayerAvatar id={me?.avatarId ?? myPlayerObj?.avatarId} size={28} />
                    <span className="absolute -bottom-1 -right-1 text-xs">
                      {myColor === "w" ? "⚪" : myColor === "b" ? "⚫" : "👀"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-bold block leading-tight">
                      {myPlayerObj?.displayName ?? "You"} (You)
                    </span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {myColor === "w"
                        ? "White Pieces"
                        : myColor === "b"
                          ? "Black Pieces"
                          : "Spectator"}
                    </span>
                  </div>
                </div>

                {/* My Clock */}
                {chessState.settings.timedMode && (
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold border ${
                      myTurn
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                        : "bg-muted/70 text-foreground/80 border-border/50"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatClock(myTime)}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Game Status Banner */}
        <div className="mt-4 pt-3 border-t border-amber-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {chessState.phase === "playing" ? (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isMyTurn
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                {isMyTurn ? "Your move! Flick a piece." : "Waiting for opponent…"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                <Trophy className="w-3.5 h-3.5" />
                Game Ended
              </span>
            )}

            {chessState.inCheck && chessState.phase === "playing" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-600 border border-red-500/40 animate-bounce">
                <AlertCircle className="w-3.5 h-3.5" /> Check!
              </span>
            )}
          </div>

          {/* Action buttons: Resign & Rematch */}
          <div className="flex items-center gap-2">
            {chessState.phase === "playing" && myColor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmResign(true)}
                className="text-xs border-red-400/40 text-red-500 hover:bg-red-500/10 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5 mr-1" />
                Resign
              </Button>
            )}

            {chessState.phase === "ended" && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  void runAction(
                    async () => {
                      return await rematchChessFn({
                        data: { sessionToken: token, code: s.code },
                      });
                    },
                    () => refresh(),
                  );
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Rematch
              </Button>
            )}
          </div>
        </div>

        {/* Move History Strip */}
        {chessState.moves.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto py-1 px-2 bg-background/50 rounded-xl text-xs font-mono">
            <span className="text-[10px] text-muted-foreground uppercase font-bold mr-1">
              Moves:
            </span>
            {chessState.moves.slice(-8).map((m, idx) => (
              <span
                key={m.ts + idx}
                className="px-2 py-0.5 rounded-md bg-card border border-border/60 shadow-2xs font-semibold whitespace-nowrap"
              >
                {m.san}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pawn Promotion Modal */}
      {pendingPromotion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="play-panel p-6 max-w-sm w-full space-y-4 text-center border-4 border-amber-600 shadow-2xl">
            <h3 className="font-display font-bold text-lg">Promote Your Pawn! 👑</h3>
            <p className="text-xs text-muted-foreground">
              Select a piece to promote your toy pawn to:
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { type: "q", label: "Queen", icon: myColor === "w" ? "♕" : "♛" },
                { type: "r", label: "Rook", icon: myColor === "w" ? "♖" : "♜" },
                { type: "b", label: "Bishop", icon: myColor === "w" ? "♗" : "♝" },
                { type: "n", label: "Knight", icon: myColor === "w" ? "♘" : "♞" },
              ].map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => executeMove(pendingPromotion.from, pendingPromotion.to, p.type)}
                  className="p-3 rounded-2xl border-2 border-border hover:border-amber-500 bg-card hover:bg-amber-100 dark:hover:bg-amber-950/50 flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105"
                >
                  <span className="text-3xl">{p.icon}</span>
                  <span className="text-[11px] font-bold mt-1">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resignation Confirmation Modal */}
      {confirmResign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="play-panel p-6 max-w-sm w-full space-y-4 text-center border-2 border-red-500 shadow-2xl">
            <h3 className="font-display font-bold text-lg text-red-500">Resign Match?</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to surrender this game to your opponent?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={() => setConfirmResign(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 cursor-pointer font-bold"
                onClick={() => {
                  setConfirmResign(false);
                  void runAction(
                    async () => {
                      return await resignChessFn({
                        data: { sessionToken: token, code: s.code },
                      });
                    },
                    () => refresh(),
                  );
                }}
              >
                Yes, Resign
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Match Result Celebration Banner */}
      {chessState.phase === "ended" && (
        <div className="play-panel p-6 text-center space-y-3 border-4 border-amber-500/50 shadow-xl bg-amber-500/5">
          <div className="text-4xl animate-bounce">
            {chessState.winnerId === s.me.profileId ? "🏆" : "🤝"}
          </div>
          <h2 className="text-xl font-display font-bold">
            {chessState.result === "draw"
              ? "Game Drawn!"
              : chessState.winnerId === s.me.profileId
                ? "Victory is Yours!"
                : "Match Over!"}
          </h2>
          <p className="text-sm text-muted-foreground capitalize">
            {chessState.resultReason === "checkmate"
              ? "Checkmate! The king could not escape."
              : chessState.resultReason === "resignation"
                ? "Victory by resignation."
                : chessState.resultReason === "timeout"
                  ? "Time expired on the clock."
                  : "Stalemate or agreed draw."}
          </p>
        </div>
      )}
    </div>
  );
}
