// Chess game types - built on top of chess.js FEN/move format

export type ChessColor = "w" | "b";
export type ChessPiece = "p" | "n" | "b" | "r" | "q" | "k";
export type ChessSquare = string; // e.g. 'e4', 'a1' etc

export type ChessSettings = {
  timedMode: boolean;
  timePerSide: 60 | 180 | 300 | 600; // seconds
  incrementSeconds: 0 | 3 | 5;
};

export type ChessPhase = "waiting" | "playing" | "ended";

export type ChessMove = {
  from: ChessSquare;
  to: ChessSquare;
  piece: ChessPiece;
  color: ChessColor;
  san: string; // Standard Algebraic Notation e.g. "e4", "Nf3", "O-O"
  captured?: ChessPiece | undefined;
  promotion?: ChessPiece | undefined;
  ts: number;
};

export type ChessServerData = {
  settings: ChessSettings;
  phase: ChessPhase;
  /** FEN string representing the full board state */
  fen: string;
  /** profileId of the player with WHITE pieces */
  whiteProfileId: string;
  /** profileId of the player with BLACK pieces */
  blackProfileId: string;
  /** Whose turn: 'w' | 'b' */
  turn: ChessColor;
  /** Move history as SAN strings */
  moves: ChessMove[];
  /** Game result: null if in progress */
  result: "white" | "black" | "draw" | null;
  resultReason: "checkmate" | "stalemate" | "draw" | "resignation" | "timeout" | null;
  /** Remaining time in ms per side */
  whiteTimeMs: number;
  blackTimeMs: number;
  /** Server timestamp when the current turn started (for clock countdown) */
  turnStartedAt: number | null;
  /** Winner profileId */
  winnerId: string | null;
  rematchRequested: string | null;
};

export type ChessClientState = {
  settings: ChessSettings;
  phase: ChessPhase;
  fen: string;
  whiteProfileId: string;
  blackProfileId: string;
  myColor: ChessColor | null;
  turn: ChessColor;
  moves: ChessMove[];
  result: "white" | "black" | "draw" | null;
  resultReason: "checkmate" | "stalemate" | "draw" | "resignation" | "timeout" | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  turnStartedAt: number | null;
  winnerId: string | null;
  rematchRequested: string | null;
  isMyTurn: boolean;
  inCheck: boolean;
};
