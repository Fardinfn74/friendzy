import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  CarromClientState,
  CarromCoin,
  CarromCoinType,
  CarromPlayer,
  CarromServerData,
  CarromSettings,
  CarromStriker,
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

export const BOARD_SIZE = 500;
export const POCKET_RADIUS = 26;
export const COIN_RADIUS = 14;
export const STRIKER_RADIUS = 19;

export const DEFAULT_CARROM_SETTINGS: CarromSettings = {
  boardMode: "fast",
  targetScore: 15,
};

function generateInitialCoins(mode: "fast" | "classic"): CarromCoin[] {
  const coins: CarromCoin[] = [];
  const cx = BOARD_SIZE / 2;
  const cy = BOARD_SIZE / 2;

  // Center Queen
  coins.push({
    id: 0,
    type: "queen",
    x: cx,
    y: cy,
    vx: 0,
    vy: 0,
    radius: COIN_RADIUS,
    pocketed: false,
  });

  // Inner ring: 6 coins (alternating white/black)
  const innerRadius = COIN_RADIUS * 2 + 1;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const type: CarromCoinType = i % 2 === 0 ? "white" : "black";
    coins.push({
      id: coins.length,
      type,
      x: cx + Math.cos(angle) * innerRadius,
      y: cy + Math.sin(angle) * innerRadius,
      vx: 0,
      vy: 0,
      radius: COIN_RADIUS,
      pocketed: false,
    });
  }

  // If classic mode, add outer ring of 12 coins (alternating)
  if (mode === "classic") {
    const outerRadius = innerRadius * 1.85;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const type: CarromCoinType = i % 2 === 0 ? "white" : "black";
      coins.push({
        id: coins.length,
        type,
        x: cx + Math.cos(angle) * outerRadius,
        y: cy + Math.sin(angle) * outerRadius,
        vx: 0,
        vy: 0,
        radius: COIN_RADIUS,
        pocketed: false,
      });
    }
  }

  return coins;
}

function getInitialStriker(side: "bottom" | "top" | "left" | "right"): CarromStriker {
  let x = BOARD_SIZE / 2;
  let y = BOARD_SIZE - 75; // bottom baseline

  if (side === "top") y = 75;
  else if (side === "left") {
    x = 75;
    y = BOARD_SIZE / 2;
  } else if (side === "right") {
    x = BOARD_SIZE - 75;
    y = BOARD_SIZE / 2;
  }

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius: STRIKER_RADIUS,
    active: true,
  };
}

export function getDefaultServerData(customSettings?: Partial<CarromSettings>): CarromServerData {
  const settings: CarromSettings = {
    boardMode: customSettings?.boardMode === "classic" ? "classic" : "fast",
    targetScore: customSettings?.targetScore === 25 ? 25 : 15,
  };

  const coins = generateInitialCoins(settings.boardMode);

  return {
    settings,
    phase: "aiming",
    players: [],
    currentTurnProfileId: "",
    coins,
    striker: getInitialStriker("bottom"),
    queenPocketedBy: null,
    winnerId: null,
    lastActionText: "Flick the striker to pocket coins!",
    rematchRequested: null,
  };
}

export function parseCarromData(game: AnyGame): CarromServerData {
  const raw = game.game_settings?.["carrom"] as Partial<CarromServerData> | undefined;
  if (!raw) return getDefaultServerData();

  return {
    settings: {
      boardMode: raw.settings?.boardMode === "classic" ? "classic" : "fast",
      targetScore: raw.settings?.targetScore === 25 ? 25 : 15,
    },
    phase: raw.phase ?? "aiming",
    players: raw.players ?? [],
    currentTurnProfileId: raw.currentTurnProfileId ?? "",
    coins: raw.coins ?? generateInitialCoins("fast"),
    striker: raw.striker ?? getInitialStriker("bottom"),
    queenPocketedBy: raw.queenPocketedBy ?? null,
    winnerId: raw.winnerId ?? null,
    lastActionText: raw.lastActionText ?? null,
    rematchRequested: raw.rematchRequested ?? null,
  };
}

export async function saveCarromData(gameId: string, data: CarromServerData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentGame } = await (supabaseAdmin.from("games") as any)
    .select("game_settings")
    .eq("id", gameId)
    .single();

  const currentSettings = (currentGame?.game_settings as Record<string, unknown>) || {};
  const updatedSettings = { ...currentSettings, carrom: data };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({ game_settings: updatedSettings })
    .eq("id", gameId);
}

export async function startCarromMatch(game: AnyGame, players: AnyPlayer[]) {
  if (players.length < 2 || players.length > 4) {
    throw new Error("Carrom requires 2 to 4 players.");
  }

  const existingSettings = (game.game_settings?.["carrom"] as Partial<CarromServerData>)?.settings;
  const data = getDefaultServerData(existingSettings);

  const sides: ("bottom" | "top" | "left" | "right")[] = ["bottom", "top", "left", "right"];

  data.players = players.map((p, idx) => ({
    profileId: p.profile_id,
    assignedColor: idx % 2 === 0 ? "white" : "black",
    score: 0,
    side: sides[idx]!,
  }));

  data.currentTurnProfileId = data.players[0]!.profileId;
  data.striker = getInitialStriker(data.players[0]!.side);
  data.phase = "aiming";
  data.lastActionText = "Match started! Player 1 takes the first strike.";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("games") as any)
    .update({
      status: "hint",
      game_settings: {
        ...(game.game_settings || {}),
        carrom: data,
      },
    })
    .eq("id", game.id);
}

export async function submitCarromShotResult(
  game: AnyGame,
  profileId: string,
  updatedCoins: CarromCoin[],
  strikerFoul: boolean,
) {
  const data = parseCarromData(game);
  if (data.phase === "ended") throw new Error("Match has already ended.");
  if (data.currentTurnProfileId !== profileId) throw new Error("Not your turn to shoot.");

  const player = data.players.find((p) => p.profileId === profileId);
  if (!player) throw new Error("Player not in this game.");

  // Identify newly pocketed coins
  const previousPocketed = new Set(data.coins.filter((c) => c.pocketed).map((c) => c.id));
  const newlyPocketed = updatedCoins.filter((c) => c.pocketed && !previousPocketed.has(c.id));

  let pocketedOwnColor = false;
  let pocketedQueen = false;

  for (const coin of newlyPocketed) {
    if (coin.type === player.assignedColor) {
      player.score += 1;
      pocketedOwnColor = true;
    } else if (coin.type === "queen") {
      player.score += 3;
      pocketedQueen = true;
      data.queenPocketedBy = profileId;
    } else {
      // Pocketed opponent's coin — opponent gets the point
      const opponent = data.players.find((p) => p.assignedColor === coin.type);
      if (opponent) opponent.score += 1;
    }
  }

  // Foul handling: striker pocketed
  if (strikerFoul) {
    player.score = Math.max(0, player.score - 1);
  }

  data.coins = updatedCoins;

  // Check win condition (target score or all coins pocketed)
  const remainingCoins = updatedCoins.filter((c) => !c.pocketed);
  const highestScorer = [...data.players].sort((a, b) => b.score - a.score)[0];

  if (
    remainingCoins.length === 0 ||
    (highestScorer && highestScorer.score >= data.settings.targetScore)
  ) {
    data.phase = "ended";
    data.winnerId = highestScorer?.profileId ?? null;
    data.lastActionText = `🏆 Match finished! Winner scored ${highestScorer?.score} points.`;
  } else {
    // Advance turn unless player earned an extra turn (pocketed own coin or queen without foul)
    const bonusTurn = (pocketedOwnColor || pocketedQueen) && !strikerFoul;

    if (!bonusTurn) {
      const currentIdx = data.players.findIndex((p) => p.profileId === profileId);
      const nextIdx = (currentIdx + 1) % data.players.length;
      const nextPlayer = data.players[nextIdx]!;
      data.currentTurnProfileId = nextPlayer.profileId;
      data.striker = getInitialStriker(nextPlayer.side);
      data.lastActionText = `Turn switched to ${nextPlayer.assignedColor.toUpperCase()}.`;
    } else {
      data.striker = getInitialStriker(player.side);
      data.lastActionText = `🎯 Clean pocket! Bonus strike for ${player.assignedColor.toUpperCase()}!`;
    }
    data.phase = "aiming";
  }

  await saveCarromData(game.id, data);
}

export async function syncCarromState(
  game: AnyGame,
  _players: AnyPlayer[],
  myProfileId: string,
): Promise<CarromClientState> {
  const data = parseCarromData(game);
  const myPlayer = data.players.find((p) => p.profileId === myProfileId);
  const isMyTurn =
    myPlayer !== undefined &&
    myPlayer.profileId === data.currentTurnProfileId &&
    data.phase !== "ended";

  return {
    settings: data.settings,
    phase: data.phase,
    players: data.players,
    currentTurnProfileId: data.currentTurnProfileId,
    isMyTurn,
    myColor: myPlayer?.assignedColor ?? null,
    mySide: myPlayer?.side ?? null,
    coins: data.coins,
    striker: data.striker,
    winnerId: data.winnerId,
    lastActionText: data.lastActionText,
    rematchRequested: data.rematchRequested,
  };
}

export async function rematchCarrom(game: AnyGame, players: AnyPlayer[]) {
  await startCarromMatch(game, players);
}

/** A player left: pass the turn on if it was theirs; the last player standing wins. */
export async function handleCarromPlayerLeft(game: AnyGame, leaverId: string) {
  const data = parseCarromData(game);
  if (data.phase === "ended") return;
  const idx = data.players.findIndex((p) => p.profileId === leaverId);
  if (idx === -1) return;
  const wasTurn = data.currentTurnProfileId === leaverId;
  data.players.splice(idx, 1);

  if (data.players.length < 2) {
    data.phase = "ended";
    data.winnerId = data.players[0]?.profileId ?? null;
    data.lastActionText = "The other player left. You win!";
  } else if (wasTurn) {
    const next = data.players[idx % data.players.length]!;
    data.currentTurnProfileId = next.profileId;
    data.striker = getInitialStriker(next.side);
    data.phase = "aiming";
    data.lastActionText = `A player left. It's ${next.assignedColor.toUpperCase()}'s turn.`;
  }
  await saveCarromData(game.id, data);
}
