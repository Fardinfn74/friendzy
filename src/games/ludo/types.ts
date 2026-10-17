export type LudoColor = "red" | "green" | "yellow" | "blue";

export type LudoToken = {
  id: number; // 0, 1, 2, 3
  color: LudoColor;
  // position: -1 means in yard, 0..51 means on main track, 52..56 means in home column, 57 means home finished
  step: number;
  hasFinished: boolean;
};

export type LudoPlayer = {
  profileId: string;
  color: LudoColor;
  tokens: LudoToken[];
  rank: number | null; // 1 for 1st place, etc.
};

export type LudoSettings = {
  tokensPerPlayer: 2 | 4; // Fast mode (2 tokens) vs Classic (4 tokens)
};

export type LudoPhase = "rolling" | "moving" | "ended";

export type LudoServerData = {
  settings: LudoSettings;
  phase: LudoPhase;
  players: LudoPlayer[];
  currentTurnColor: LudoColor;
  diceValue: number | null;
  hasRolledSix: boolean;
  consecutiveSixes: number;
  winnerId: string | null;
  ranking: string[]; // profileIds in finishing order
  lastActionText: string | null;
  rematchRequested: string | null;
};

export type LudoClientState = {
  settings: LudoSettings;
  phase: LudoPhase;
  players: LudoPlayer[];
  currentTurnColor: LudoColor;
  diceValue: number | null;
  isMyTurn: boolean;
  myColor: LudoColor | null;
  validTokenMoves: number[]; // ids of tokens that can move with current diceValue
  winnerId: string | null;
  ranking: string[];
  lastActionText: string | null;
  rematchRequested: string | null;
};
