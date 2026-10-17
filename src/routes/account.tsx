import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usernameEmail, useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { avatarEmoji } from "@/lib/game-types";
import { checkUsernameFn, createAccountFn } from "@/lib/shop.functions";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Profile — FRIENDZY" },
      {
        name: "description",
        content: "View your FRIENDZY profile, coin balance, and unlocked collectibles.",
      },
      { property: "og:title", content: "Profile — FRIENDZY" },
      {
        property: "og:description",
        content: "View your FRIENDZY profile, coin balance, and unlocked collectibles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const nav = useNavigate();
  const { signedIn, account, avatarId, loading, refresh } = useAccount();
  const check = useServerFn(checkUsernameFn);
  const create = useServerFn(createAccountFn);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const u = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(u)) throw new Error("Username: 3–20 letters, numbers or _.");
      if (password.length < 6) throw new Error("Password needs at least 6 characters.");
      if (mode === "signup") {
        if (name.trim().length < 2) throw new Error("Name needs at least 2 characters.");
        const { available } = await check({ data: { username: u } });
        if (!available) throw new Error("That username is taken.");
        const { error: e } = await supabase.auth.signUp({ email: usernameEmail(u), password });
        if (e)
          throw new Error(e.message.includes("registered") ? "That username is taken." : e.message);
        const r = await create({ data: { username: u, displayName: name.trim() } });
        if ("error" in r) throw new Error(r.error);
        localStorage.setItem("friendzy.bonus_pending", "true");
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({
          email: usernameEmail(u),
          password,
        });
        if (e) throw new Error("Wrong username or password.");
      }
      await refresh();
      nav({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GameLayout tab="profile" coins={account?.coins}>
      <div className="mx-auto max-w-md animate-rise pb-20 space-y-5">
        <h1 className="text-center font-display text-4xl sm:text-5xl">Your Profile</h1>

        {loading ? (
          <p className="mt-6 text-center text-muted-foreground font-bold">Loading profile…</p>
        ) : signedIn && account ? (
          <div className="space-y-4">
            <section className="play-panel p-6 text-center space-y-4">
              <div className="inline-flex items-center justify-center avatar-puck text-5xl mx-auto shadow-md">
                {avatarEmoji(account.equippedSkin ?? avatarId)}
              </div>
              <div>
                <h2 className="font-display text-3xl font-black">{account.displayName}</h2>
                <p className="font-mono text-sm font-bold text-muted-foreground">
                  @{account.username}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-card rounded-2xl border-2 border-border shadow-xs text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Coins</p>
                  <p className="font-display text-2xl text-amber-500 font-black">
                    🪙 {account.coins}
                  </p>
                </div>
                <div className="p-3 bg-card rounded-2xl border-2 border-border shadow-xs text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Equipped Skin</p>
                  <p className="font-display text-base capitalize font-bold truncate">
                    {account.equippedSkin || "Classic"}
                  </p>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <Button className="w-full text-base font-bold" onClick={() => nav({ to: "/shop" })}>
                  🛍️ Open Cosmetics Shop
                </Button>
                <Button
                  variant="secondary"
                  className="w-full text-base font-bold text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    try {
                      localStorage.removeItem("friendzy.room");
                    } catch {
                      /* ignore */
                    }
                    await refresh();
                    nav({ to: "/" });
                  }}
                >
                  Log Out
                </Button>
              </div>
            </section>
          </div>
        ) : (
          <section className="play-panel p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={mode === "signup" ? "default" : "secondary"}
                onClick={() => setMode("signup")}
              >
                Create account
              </Button>
              <Button
                variant={mode === "signin" ? "default" : "secondary"}
                onClick={() => setMode("signin")}
              >
                Sign in
              </Button>
            </div>
            {mode === "signup" && (
              <div>
                <label className="text-stencil block pb-1">Name</label>
                <Input
                  value={name}
                  maxLength={20}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sam"
                />
              </div>
            )}
            <div>
              <label className="text-stencil block pb-1">Username</label>
              <Input
                value={username}
                maxLength={20}
                autoCapitalize="none"
                onChange={(e) => setUsername(e.target.value)}
                placeholder="unique, e.g. sam_42"
              />
            </div>
            <div>
              <label className="text-stencil block pb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="status-error text-sm">
                {error}
              </p>
            )}
            <Button
              size="lg"
              className="sticker-action w-full font-display text-xl"
              disabled={busy}
              onClick={submit}
            >
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            {mode === "signup" && (
              <p className="text-xs text-center text-muted-foreground font-bold">
                🎉 New accounts receive 200 starter coins automatically!
              </p>
            )}
          </section>
        )}
      </div>
    </GameLayout>
  );
}
