import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { getAccountFn } from "@/lib/shop.functions";

export const usernameEmail = (u: string) => `${u.trim().toLowerCase()}@players.imposta.app`;

export function useAccount() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [avatarId, setAvatarId] = useState("fox");
  const qc = useQueryClient();
  const get = useServerFn(getAccountFn);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAvatarId(data.user?.user_metadata?.["avatar_id"] ?? "fox");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUserId(session?.user.id ?? null);
      setAvatarId(session?.user.user_metadata?.["avatar_id"] ?? "fox");
      qc.invalidateQueries({ queryKey: ["account"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const q = useQuery({
    queryKey: ["account", userId],
    queryFn: () => get(),
    enabled: !!userId,
  });

  return {
    loading: userId === undefined || (!!userId && q.isLoading),
    signedIn: !!userId,
    account: q.data ?? null,
    avatarId,
    refresh: () => q.refetch(),
  };
}
