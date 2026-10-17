import type { PromptItem, PromptLevel } from "@/games/prompts/prompt-bank";

export type BottleSpinSettings = {
  promptLevel: "All" | PromptLevel;
  customPrompts: PromptItem[];
};

export type BottleSpinPhase =
  "ready_to_spin" | "spinning" | "choosing_prompt" | "prompt_active" | "round_done";

export type BottleSpinHistoryEntry = {
  spinnerId: string;
  targetId: string;
  type: "truth" | "dare";
  promptText: string;
  skipped: boolean;
  ts: number;
};

export type BottleSpinServerData = {
  settings: BottleSpinSettings;
  phase: BottleSpinPhase;
  currentSpinnerId: string;
  targetPlayerId: string | null;
  targetAngle: number;
  totalRotation: number;
  spinEndsAt: number | null;
  promptType: "truth" | "dare" | null;
  currentPrompt: PromptItem | null;
  usedPromptIds: string[];
  skipsUsed: Record<string, number>;
  history: BottleSpinHistoryEntry[];
};

export type BottleSpinClientState = {
  settings: BottleSpinSettings;
  phase: BottleSpinPhase;
  currentSpinnerId: string;
  targetPlayerId: string | null;
  targetAngle: number;
  totalRotation: number;
  spinEndsAt: number | null;
  promptType: "truth" | "dare" | null;
  currentPrompt: PromptItem | null;
  skipsUsed: Record<string, number>;
  mySkipsRemaining: number;
  history: BottleSpinHistoryEntry[];
};
