import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pickRandomPrompt, type PromptItem, type PromptLevel } from "@/games/prompts/prompt-bank";
import type {
  TruthOrDareClientState,
  TruthOrDarePhase,
  TruthOrDareServerData,
  TruthOrDareSettings,
} from "./types";

type AnyPlayer = {
  id: string;
  profile_id: string;
  is_host: boolean;
  profiles: { display_name: string; avatar_id: string } | null;
};

type AnyGame = {
  id: string;
  code: string;
  host_id: string;
  status: string;
  game_type?: string | null;
  game_settings?: Record<string, unknown> | null;
};

export const DEFAULT_TRUTH_OR_DARE_SETTINGS: TruthOrDareSettings = {
  promptLevel: "Chill",
  customPrompts: [],
};

export function getDefaultServerData(
  customSettings?: Partial<TruthOrDareSettings>,
): TruthOrDareServerData {
  const promptLevel: "All" | PromptLevel =
    customSettings?.promptLevel === "Funny" ||
    customSettings?.promptLevel === "Wild" ||
    customSettings?.promptLevel === "All"
      ? customSettings.promptLevel
      : "Chill";

  return {
    settings: {
      promptLevel,
      customPrompts: customSettings?.customPrompts ?? [],
    },
    phase: "choosing_type",
    turnOrder: [],
    turnIndex: 0,
    currentPlayerId: "",
    promptType: null,
    currentPrompt: null,
    usedPromptIds: [],
    skipsUsed: {},
    history: [],
  };
}

export function parseTruthOrDareData(game: AnyGame): TruthOrDareServerData {
  const raw = game.game_settings?.["truthOrDare"] as Partial<TruthOrDareServerData> | undefined;
  if (!raw) return getDefaultServerData();

  const promptLevel: "All" | PromptLevel =
    raw.settings?.promptLevel === "Funny" ||
    raw.settings?.promptLevel === "Wild" ||
    raw.settings?.promptLevel === "All"
      ? raw.settings.promptLevel
      : "Chill";

  return {
    settings: {
      promptLevel,
      customPrompts: raw.settings?.customPrompts ?? [],
    },
    phase: (raw.phase as TruthOrDarePhase) ?? "choosing_type",
    turnOrder: raw.turnOrder ?? [],
    turnIndex: raw.turnIndex ?? 0,
    currentPlayerId: raw.currentPlayerId ?? "",
    promptType: raw.promptType ?? null,
    currentPrompt: raw.currentPrompt ?? null,
    usedPromptIds: raw.usedPromptIds ?? [],
    skipsUsed: raw.skipsUsed ?? {},
    history: raw.history ?? [],
  };
}

export async function saveTruthOrDareData(gameId: string, data: TruthOrDareServerData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentGame } = await (supabaseAdmin.from("games") as any)
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const currentSettings = (currentGame?.game_settings as Record<string, unknown>) || {};
  const updatedSettings = {
    ...currentSettings,
    truthOrDare: data,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({ game_settings: updatedSettings })
    .eq("id", gameId);
}

export async function startTruthOrDareMatch(game: AnyGame, players: AnyPlayer[]) {
  if (players.length < 3) {
    throw new Error("Truth or Dare requires at least 3 players.");
  }

  const existingSettings = (game.game_settings?.["truthOrDare"] as Partial<TruthOrDareServerData>)
    ?.settings;

  const data = getDefaultServerData(existingSettings);

  // Shuffle players into a random turn order
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  data.turnOrder = shuffled.map((p) => p.profile_id);
  data.turnIndex = 0;
  data.currentPlayerId = data.turnOrder[0]!;
  data.phase = "choosing_type";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({
      status: "hint",
      game_settings: {
        ...(game.game_settings || {}),
        truthOrDare: data,
      },
    })
    .eq("id", game.id);
}

export async function syncTruthOrDareState(
  game: AnyGame,
  _players: AnyPlayer[],
  myProfileId: string,
): Promise<TruthOrDareClientState> {
  const data = parseTruthOrDareData(game);

  const mySkipsUsed = data.skipsUsed[myProfileId] ?? 0;
  const mySkipsRemaining = Math.max(0, 1 - mySkipsUsed);

  return {
    settings: data.settings,
    phase: data.phase,
    turnOrder: data.turnOrder,
    turnIndex: data.turnIndex,
    currentPlayerId: data.currentPlayerId,
    promptType: data.promptType,
    currentPrompt: data.currentPrompt,
    skipsUsed: data.skipsUsed,
    mySkipsRemaining,
    history: data.history,
  };
}

export async function chooseTruthOrDareType(
  game: AnyGame,
  profileId: string,
  type: "truth" | "dare",
) {
  const data = parseTruthOrDareData(game);

  if (data.phase !== "choosing_type") {
    throw new Error("Prompt type cannot be chosen right now.");
  }

  if (data.currentPlayerId && data.currentPlayerId !== profileId) {
    throw new Error("It's not your turn to choose Truth or Dare!");
  }

  const prompt = pickRandomPrompt(
    type,
    data.settings.promptLevel,
    data.usedPromptIds,
    data.settings.customPrompts,
  );

  data.phase = "prompt_active";
  data.promptType = type;
  data.currentPrompt = prompt;
  data.usedPromptIds = [...data.usedPromptIds, prompt.id];

  await saveTruthOrDareData(game.id, data);
  return { prompt };
}

export async function completeTruthOrDare(game: AnyGame, profileId: string) {
  const data = parseTruthOrDareData(game);

  if (data.phase !== "prompt_active" && data.phase !== "choosing_type") {
    throw new Error("No active prompt to complete.");
  }

  if (data.currentPrompt && data.currentPlayerId) {
    data.history.unshift({
      playerId: data.currentPlayerId,
      type: data.promptType ?? "truth",
      promptText: data.currentPrompt.text,
      skipped: false,
      ts: Date.now(),
    });
  }

  // Advance to next player in turn order
  if (data.turnOrder.length > 0) {
    data.turnIndex = (data.turnIndex + 1) % data.turnOrder.length;
    data.currentPlayerId = data.turnOrder[data.turnIndex]!;
  }
  data.phase = "choosing_type";
  data.promptType = null;
  data.currentPrompt = null;

  await saveTruthOrDareData(game.id, data);
}

export async function skipTruthOrDare(game: AnyGame, profileId: string) {
  const data = parseTruthOrDareData(game);

  if (data.phase !== "prompt_active") {
    throw new Error("No active prompt to skip.");
  }

  if (data.currentPlayerId !== profileId) {
    throw new Error("Only the active player can skip.");
  }

  const used = data.skipsUsed[profileId] ?? 0;
  if (used >= 1) {
    throw new Error("You have already used your 1 skip for this game!");
  }

  data.skipsUsed[profileId] = used + 1;

  if (data.currentPrompt) {
    data.history.unshift({
      playerId: profileId,
      type: data.promptType ?? "truth",
      promptText: data.currentPrompt.text,
      skipped: true,
      ts: Date.now(),
    });
  }

  // Provide a replacement prompt
  const freshPrompt = pickRandomPrompt(
    data.promptType ?? "truth",
    data.settings.promptLevel,
    data.usedPromptIds,
    data.settings.customPrompts,
  );

  data.currentPrompt = freshPrompt;
  data.usedPromptIds = [...data.usedPromptIds, freshPrompt.id];

  await saveTruthOrDareData(game.id, data);
  return { prompt: freshPrompt };
}
