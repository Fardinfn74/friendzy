import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pickRandomPrompt, type PromptItem, type PromptLevel } from "@/games/prompts/prompt-bank";
import type {
  BottleSpinClientState,
  BottleSpinPhase,
  BottleSpinServerData,
  BottleSpinSettings,
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

export const DEFAULT_BOTTLE_SPIN_SETTINGS: BottleSpinSettings = {
  promptLevel: "Chill",
  customPrompts: [],
};

export function getDefaultServerData(
  customSettings?: Partial<BottleSpinSettings>,
): BottleSpinServerData {
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
    phase: "ready_to_spin",
    currentSpinnerId: "",
    targetPlayerId: null,
    targetAngle: 0,
    totalRotation: 0,
    spinEndsAt: null,
    promptType: null,
    currentPrompt: null,
    usedPromptIds: [],
    skipsUsed: {},
    history: [],
  };
}

export function parseBottleSpinData(game: AnyGame): BottleSpinServerData {
  const raw = game.game_settings?.["bottleSpin"] as Partial<BottleSpinServerData> | undefined;
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
    phase: (raw.phase as BottleSpinPhase) ?? "ready_to_spin",
    currentSpinnerId: raw.currentSpinnerId ?? "",
    targetPlayerId: raw.targetPlayerId ?? null,
    targetAngle: raw.targetAngle ?? 0,
    totalRotation: raw.totalRotation ?? 0,
    spinEndsAt: raw.spinEndsAt ?? null,
    promptType: raw.promptType ?? null,
    currentPrompt: raw.currentPrompt ?? null,
    usedPromptIds: raw.usedPromptIds ?? [],
    skipsUsed: raw.skipsUsed ?? {},
    history: raw.history ?? [],
  };
}

export async function saveBottleSpinData(gameId: string, data: BottleSpinServerData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentGame } = await (supabaseAdmin.from("games") as any)
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const currentSettings = (currentGame?.game_settings as Record<string, unknown>) || {};
  const updatedSettings = {
    ...currentSettings,
    bottleSpin: data,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({ game_settings: updatedSettings })
    .eq("id", gameId);
}

export async function startBottleSpinMatch(game: AnyGame, players: AnyPlayer[]) {
  if (players.length < 3) {
    throw new Error("Bottle Spin requires at least 3 players.");
  }

  const existingSettings = (game.game_settings?.["bottleSpin"] as Partial<BottleSpinServerData>)
    ?.settings;

  const data = getDefaultServerData(existingSettings);
  data.currentSpinnerId = players[0]?.profile_id ?? game.host_id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({
      status: "hint",
      game_settings: {
        ...(game.game_settings || {}),
        bottleSpin: data,
      },
    })
    .eq("id", game.id);
}

export async function syncBottleSpinState(
  game: AnyGame,
  players: AnyPlayer[],
  myProfileId: string,
): Promise<BottleSpinClientState> {
  const data = parseBottleSpinData(game);

  // If spinning and 3s animation expired, transition to choosing_prompt
  if (data.phase === "spinning" && data.spinEndsAt && Date.now() >= data.spinEndsAt) {
    data.phase = "choosing_prompt";
    data.spinEndsAt = null;
    await saveBottleSpinData(game.id, data);
  }

  const mySkipsUsed = data.skipsUsed[myProfileId] ?? 0;
  const mySkipsRemaining = Math.max(0, 1 - mySkipsUsed);

  return {
    settings: data.settings,
    phase: data.phase,
    currentSpinnerId: data.currentSpinnerId,
    targetPlayerId: data.targetPlayerId,
    targetAngle: data.targetAngle,
    totalRotation: data.totalRotation,
    spinEndsAt: data.spinEndsAt,
    promptType: data.promptType,
    currentPrompt: data.currentPrompt,
    skipsUsed: data.skipsUsed,
    mySkipsRemaining,
    history: data.history,
  };
}

export async function spinBottle(game: AnyGame, players: AnyPlayer[], spinnerProfileId: string) {
  const data = parseBottleSpinData(game);

  if (data.phase !== "ready_to_spin" && data.phase !== "round_done") {
    throw new Error("The bottle cannot be spun right now.");
  }

  // Pick target: any player other than the spinner if possible, or any player
  const eligible = players.filter((p) => p.profile_id !== spinnerProfileId);
  const target =
    eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]!
      : players[Math.floor(Math.random() * players.length)]!;

  const targetIndex = players.findIndex((p) => p.profile_id === target.profile_id);
  const totalPlayers = players.length;
  // Calculate angle on 360deg circle: player 0 is at 0 deg (top), player i is at i * (360 / N)
  const anglePerPlayer = 360 / totalPlayers;
  const targetAngle = targetIndex * anglePerPlayer;

  // Compute total rotation with at least 5-6 full spins
  const currentRotation = data.totalRotation;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  const diff = (targetAngle - currentMod + 360) % 360;
  // Add 5 full rotations (1800deg) + the diff
  const newTotal = currentRotation + 1800 + diff;

  data.phase = "spinning";
  data.currentSpinnerId = spinnerProfileId;
  data.targetPlayerId = target.profile_id;
  data.targetAngle = targetAngle;
  data.totalRotation = newTotal;
  data.spinEndsAt = Date.now() + 3000;
  data.promptType = null;
  data.currentPrompt = null;

  await saveBottleSpinData(game.id, data);
  return { targetPlayerId: target.profile_id, totalRotation: newTotal };
}

export async function chooseBottlePromptType(
  game: AnyGame,
  profileId: string,
  type: "truth" | "dare",
) {
  const data = parseBottleSpinData(game);

  if (data.phase !== "choosing_prompt") {
    throw new Error("Prompt type cannot be chosen right now.");
  }

  if (data.targetPlayerId && data.targetPlayerId !== profileId) {
    throw new Error("Only the chosen player can pick Truth or Dare.");
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

  await saveBottleSpinData(game.id, data);
  return { prompt };
}

export async function completeBottlePrompt(game: AnyGame, profileId: string) {
  const data = parseBottleSpinData(game);

  if (data.phase !== "prompt_active" && data.phase !== "choosing_prompt") {
    throw new Error("No prompt is active to complete.");
  }

  if (data.currentPrompt && data.targetPlayerId) {
    data.history.unshift({
      spinnerId: data.currentSpinnerId,
      targetId: data.targetPlayerId,
      type: data.promptType ?? "truth",
      promptText: data.currentPrompt.text,
      skipped: false,
      ts: Date.now(),
    });
  }

  // The chosen player becomes the next spinner!
  if (data.targetPlayerId) {
    data.currentSpinnerId = data.targetPlayerId;
  }
  data.phase = "ready_to_spin";
  data.targetPlayerId = null;
  data.promptType = null;
  data.currentPrompt = null;

  await saveBottleSpinData(game.id, data);
}

export async function skipBottlePrompt(game: AnyGame, profileId: string) {
  const data = parseBottleSpinData(game);

  if (data.phase !== "prompt_active") {
    throw new Error("No active prompt to skip.");
  }

  if (data.targetPlayerId !== profileId) {
    throw new Error("Only the chosen player can skip.");
  }

  const used = data.skipsUsed[profileId] ?? 0;
  if (used >= 1) {
    throw new Error("You have already used your 1 skip for this game!");
  }

  data.skipsUsed[profileId] = used + 1;

  if (data.currentPrompt) {
    data.history.unshift({
      spinnerId: data.currentSpinnerId,
      targetId: profileId,
      type: data.promptType ?? "truth",
      promptText: data.currentPrompt.text,
      skipped: true,
      ts: Date.now(),
    });
  }

  // Give a fresh prompt
  const freshPrompt = pickRandomPrompt(
    data.promptType ?? "truth",
    data.settings.promptLevel,
    data.usedPromptIds,
    data.settings.customPrompts,
  );

  data.currentPrompt = freshPrompt;
  data.usedPromptIds = [...data.usedPromptIds, freshPrompt.id];

  await saveBottleSpinData(game.id, data);
  return { prompt: freshPrompt };
}

/** A player left: if the bottle was pointing at them (or they were spinning), reset to a fresh spin. */
export async function handleBottleSpinPlayerLeft(
  game: AnyGame,
  leaverId: string,
  remainingIds: string[],
) {
  const data = parseBottleSpinData(game);
  if (remainingIds.length === 0) return;
  const wasTarget = data.targetPlayerId === leaverId;
  const wasSpinner = data.currentSpinnerId === leaverId;
  if (!wasTarget && !wasSpinner) return;
  if (wasSpinner) data.currentSpinnerId = remainingIds[0]!;
  data.phase = "ready_to_spin";
  data.targetPlayerId = null;
  data.promptType = null;
  data.currentPrompt = null;
  data.spinEndsAt = null;
  await saveBottleSpinData(game.id, data);
}
