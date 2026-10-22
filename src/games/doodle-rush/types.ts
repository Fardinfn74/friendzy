export type DoodleRushPhase =
  | "lobby"
  | "countdown"
  | "drawing"
  | "round_end"
  | "game_over";

export interface DoodleRushSettings {
  rounds: number;      // how many drawing rounds
  drawTime: number;    // seconds per drawing turn
}

export interface DrawStroke {
  x: number[];
  y: number[];
  color: string;
  size: number;
  tool: "pen" | "eraser";
}

export interface DoodleRushGuess {
  profileId: string;
  displayName: string;
  guess: string;
  correct: boolean;
  submittedAt: string;
}

export interface DoodleRushRound {
  roundNumber: number;
  drawerId: string;
  drawerName: string;
  word: string | null;   // null for all but drawer until round ends
  revealedWord: string | null;  // revealed after round
  strokes: DrawStroke[];
  guesses: DoodleRushGuess[];
  winnerIds: string[];   // first to guess correctly
  endsAt: string | null;
  ended: boolean;
}

export interface DoodleRushClientState {
  phase: DoodleRushPhase;
  settings: DoodleRushSettings;
  currentRound: (Omit<DoodleRushRound, "word"> & { word: string | null }) | null;
  scores: Record<string, number>;
  roundNumber: number;
  totalRounds: number;
  countdownEndsAt: string | null;
  isDrawer: boolean;   // computed for this client
}

export interface DoodleRushServerData {
  settings: DoodleRushSettings;
  phase: DoodleRushPhase;
  currentRound: DoodleRushRound | null;
  scores: Record<string, number>;
  roundNumber: number;
  drawerOrder: string[];  // profile_ids in order
  drawerIndex: number;
  usedWords: string[];
  countdownEndsAt: string | null;
}

export const DEFAULT_DOODLE_RUSH_SETTINGS: DoodleRushSettings = {
  rounds: 3,
  drawTime: 80,
};

// ── Word bank for drawing ─────────────────────────────────────────────────────
export const DRAW_WORDS: string[] = [
  // Animals
  "elephant", "giraffe", "penguin", "dolphin", "kangaroo", "butterfly", "octopus", "crocodile",
  // Food
  "pizza", "sushi", "hamburger", "watermelon", "ice cream", "hotdog", "pretzel", "tacos",
  // Objects
  "umbrella", "telescope", "guitar", "bicycle", "camera", "backpack", "lantern", "compass",
  // Places
  "lighthouse", "volcano", "castle", "pyramid", "igloo", "windmill", "skyscraper", "treehouse",
  // Actions
  "dancing", "swimming", "skateboarding", "sleeping", "cooking", "painting", "reading", "flying",
  // Nature
  "rainbow", "tornado", "snowflake", "cactus", "mushroom", "waterfall", "sunset", "aurora",
  // Fun
  "robot", "alien", "dragon", "mermaid", "unicorn", "zombie", "pirate", "astronaut",
  // Everyday
  "toothbrush", "bathtub", "bookshelf", "blender", "hairdryer", "calculator", "mailbox", "escalator",
];
