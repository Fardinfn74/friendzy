export type WordDuelRoundsOption = 3 | 5 | 7;
export type WordDuelTimeOption = 20 | 30 | 45;

export type WordDuelSettings = {
  rounds: WordDuelRoundsOption;
  roundTime: WordDuelTimeOption;
};

export type WordDuelPhase = "lobby" | "pick" | "countdown" | "word" | "round_ended" | "match_ended";

export type WordDuelRoundHistory = {
  round: number;
  letters: [string, string];
  winnerId: string | null; // null if draw
  winningWord: string | null;
  scores: Record<string, number>;
};

export type WordDuelServerData = {
  settings: WordDuelSettings;
  phase: WordDuelPhase;
  currentRound: number;
  scores: Record<string, number>; // profileId -> score
  picks: Record<string, string>; // profileId -> uppercase single letter
  revealedLetters: [string, string] | null;
  letterOwners: Record<string, string>; // letter -> profileId
  countdownEndsAt: number | null; // epoch timestamp ms
  roundDeadline: number | null; // epoch timestamp ms
  roundWinnerId: string | null; // profileId or "draw" | null
  winningWord: string | null;
  history: WordDuelRoundHistory[];
  matchWinnerId: string | null;
};

export type WordDuelClientState = {
  settings: WordDuelSettings;
  phase: WordDuelPhase;
  currentRound: number;
  maxRounds: number;
  targetWins: number;
  roundTime: number;
  scores: Record<string, number>;
  myPick: string | null;
  hasPicked: boolean;
  opponentLocked: boolean;
  revealedLetters: [string, string] | null;
  letterOwners: Record<string, string>; // letter -> profileId
  countdownEndsAt: number | null;
  roundDeadline: number | null;
  roundWinnerId: string | null;
  winningWord: string | null;
  history: WordDuelRoundHistory[];
  matchWinnerId: string | null;
};
