import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "imposta.session";
const NAME_KEY = "imposta.name";
const AVATAR_KEY = "imposta.avatar";

export type LocalPlayer = {
  sessionToken: string;
  displayName: string;
  avatarId: string;
};

function randomToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/** Anonymous identity persisted in the browser so a refresh rejoins the same seat. */
export function usePlayer() {
  const [player, setPlayer] = useState<LocalPlayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let sessionToken = localStorage.getItem(TOKEN_KEY);
    if (!sessionToken) {
      sessionToken = randomToken();
      localStorage.setItem(TOKEN_KEY, sessionToken);
    }
    const displayName = localStorage.getItem(NAME_KEY) ?? "";
    const avatarId = localStorage.getItem(AVATAR_KEY) ?? "fox";
    setPlayer({ sessionToken, displayName, avatarId });
    setReady(true);
  }, []);

  const save = useCallback((displayName: string, avatarId: string) => {
    localStorage.setItem(NAME_KEY, displayName);
    localStorage.setItem(AVATAR_KEY, avatarId);
    setPlayer((prev) => (prev ? { ...prev, displayName, avatarId } : prev));
  }, []);

  return {
    player,
    ready,
    save,
    hasProfile: Boolean(player?.displayName),
  };
}
