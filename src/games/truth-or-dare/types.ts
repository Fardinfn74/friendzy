import type { PromptItem, PromptLevel } from "@/games/prompts/prompt-bank";

export type TruthOrDareSettings = {
  promptLevel: "All" | PromptLevel;
  customPrompts: PromptItem[];
};

export type TruthOrDarePhase = "choosing_type" | "prompt_active" | "turn_summary";

export type TruthOrDareHistoryEntry = {
  playerId: string;
  type: "truth" | "dare";
  promptText: string;
  skipped: boolean;
  ts: number;
};

export type TruthOrDareServerData = {
  settings: TruthOrDareSettings;
  phase: TruthOrDarePhase;
  turnOrder: string[]; // list of profileIds
  turnIndex: number;
  currentPlayerId: string;
  promptType: "truth" | "dare" | null;
  currentPrompt: PromptItem | null;
  usedPromptIds: string[];
  skipsUsed: Record<string, number>;
  history: TruthOrDareHistoryEntry[];
};

export type TruthOrDareClientState = {
  settings: TruthOrDareSettings;
  phase: TruthOrDarePhase;
  turnOrder: string[];
  turnIndex: number;
  currentPlayerId: string;
  promptType: "truth" | "dare" | null;
  currentPrompt: PromptItem | null;
  skipsUsed: Record<string, number>;
  mySkipsRemaining: number;
  history: TruthOrDareHistoryEntry[];
};
