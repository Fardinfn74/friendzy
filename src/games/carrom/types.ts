export type CarromCoinType = "white" | "black" | "queen";

export type CarromCoin = {
  id: number;
  type: CarromCoinType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pocketed: boolean;
};

export type CarromStriker = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
};

export type CarromPlayer = {
  profileId: string;
  assignedColor: "white" | "black";
  score: number;
  side: "bottom" | "top" | "left" | "right";
};

export type CarromSettings = {
  boardMode: "fast" | "classic"; // fast = 9 coins (4 white, 4 black, 1 queen), classic = 19 coins (9 white, 9 black, 1 queen)
  targetScore: 15 | 25;
};

export type CarromPhase = "aiming" | "shooting" | "ended";

export type CarromServerData = {
  settings: CarromSettings;
  phase: CarromPhase;
  players: CarromPlayer[];
  currentTurnProfileId: string;
  coins: CarromCoin[];
  striker: CarromStriker;
  queenPocketedBy: string | null;
  winnerId: string | null;
  lastActionText: string | null;
  rematchRequested: string | null;
};

export type CarromClientState = {
  settings: CarromSettings;
  phase: CarromPhase;
  players: CarromPlayer[];
  currentTurnProfileId: string;
  isMyTurn: boolean;
  myColor: "white" | "black" | null;
  mySide: "bottom" | "top" | "left" | "right" | null;
  coins: CarromCoin[];
  striker: CarromStriker;
  winnerId: string | null;
  lastActionText: string | null;
  rematchRequested: string | null;
};
