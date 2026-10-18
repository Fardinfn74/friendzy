import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QrCode, ArrowRight, Pencil, Sparkles, Coins, X, Check } from "lucide-react";

import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccount, usernameEmail } from "@/hooks/use-account";
import { usePlayer } from "@/hooks/use-player";
import { supabase } from "@/integrations/supabase/client";
import {
  checkUsernameFn,
  createAccountFn,
  registerAccountFn,
  prepareLoginFn,
} from "@/lib/shop.functions";
import { joinGameFn, saveProfile } from "@/lib/game.functions";
import { pageHead } from "@/lib/page-head";
import { AVATARS, avatarEmoji } from "@/lib/game-types";
import { Emoji, PlayerAvatar } from "@/components/player-avatar";
import { play } from "@/lib/sounds";
import {
  GAMES,
  CATEGORY_FILTERS,
  filterGames,
  type CategoryFilter,
  type GameEntry,
} from "@/games/registry";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Home",
      "FRIENDZY — The multiplayer party, brain, and board games hub for friends. Play Imposter, Word Duel, Chess, Ludo, and more.",
    ),
  component: FriendzyHubHome,
});

function FriendzyHubHome() {
  const { account, avatarId, loading, signedIn, refresh } = useAccount();
  const { player, ready, save, hasProfile } = usePlayer();
  const nav = useNavigate();
  const join = useServerFn(joinGameFn);
  const persist = useServerFn(saveProfile);

  // Home state
  const [roomCode, setRoomCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("All");
  const [rejoinRoom, setRejoinRoom] = useState<string | null>(null);
  const [showBonusPopup, setShowBonusPopup] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [guestReady, setGuestReady] = useState(false);

  // Check for active room and bonus popup on mount
  useEffect(() => {
    try {
      const active = localStorage.getItem("friendzy.room") ?? localStorage.getItem("imposta.room");
      if (active && active.length === 5) {
        setRejoinRoom(active.toUpperCase());
      }
      const pendingBonus = localStorage.getItem("friendzy.bonus_pending");
      if (pendingBonus === "true") {
        setShowBonusPopup(true);
        play("win");
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Handle joining with code
  async function handleJoinCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const c = roomCode.trim().toUpperCase();
    if (c.length !== 5 || !player) return;
    setJoinBusy(true);
    try {
      const p = await persist({
        data: {
          sessionToken: player.sessionToken,
          displayName: account?.displayName ?? player.displayName ?? "Player",
          avatarId: account ? avatarId : (player.avatarId ?? "fox"),
        },
      });
      if ("error" in p) throw new Error(p.error);
      save(p.displayName, p.avatarId);

      const r = await join({
        data: { sessionToken: player.sessionToken, code: c },
      });
      if ("error" in r) throw new Error(r.error);
      nav({ to: "/game/$code", params: { code: r.code } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Room not found. Check the code.");
    } finally {
      setJoinBusy(false);
    }
  }

  // Handle game card tap
  function handleGameClick(game: GameEntry) {
    if (game.status === "soon") {
      toast("Coming soon! 🚀", {
        description: `${game.name} is currently in development. Stay tuned!`,
      });
      return;
    }
    nav({ to: game.route });
  }

  // Loading state
  if (loading || !ready) {
    return (
      <main className="game-table min-h-dvh flex items-center justify-center p-4 text-foreground">
        <div className="play-panel p-8 text-center space-y-3">
          <p className="text-3xl animate-bounce">🎲</p>
          <h2 className="font-display text-2xl font-bold">Loading FRIENDZY…</h2>
        </div>
      </main>
    );
  }

  // Show welcome auth only if neither cloud account nor local profile exists
  if (!signedIn && !hasProfile && !guestReady) {
    return (
      <WelcomeAuthScreen
        onComplete={() => {
          setGuestReady(true);
          refresh();
        }}
      />
    );
  }

  const filteredGames = filterGames(selectedCategory);

  return (
    <GameLayout tab="home" coins={account?.coins}>
      <div className="space-y-6 pb-20 animate-rise">
        {/* 1. "Playing as" compact card */}
        <div className="play-panel flex items-center justify-between p-3.5 sm:p-4">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar id={account?.equippedSkin ?? avatarId} size={42} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Playing as
              </p>
              <p className="font-display text-lg sm:text-xl truncate text-foreground leading-tight">
                {account?.displayName ?? player?.displayName ?? "Player"}
              </p>
              <p className="text-xs font-bold text-muted-foreground truncate">
                @{account?.username ?? "player"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowEditProfile(true)}
            className="shrink-0 font-bold min-h-[38px] px-3 gap-1.5"
          >
            <Pencil className="size-3.5" />
            <span>Edit</span>
          </Button>
        </div>

        {/* 2. Rejoin Active Room Banner (if any) */}
        {rejoinRoom && (
          <div className="flex items-center justify-between rounded-2xl border-3 border-border bg-amber-400/25 p-3.5 shadow-sm text-foreground">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl shrink-0">🎮</span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Active Room
                </p>
                <p className="font-display text-base font-bold tracking-widest truncate">
                  Room: {rejoinRoom}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => nav({ to: "/game/$code", params: { code: rejoinRoom } })}
                className="font-display bg-primary text-primary-foreground min-h-[38px] px-3"
              >
                Rejoin
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  try {
                    localStorage.removeItem("friendzy.room");
                    localStorage.removeItem("imposta.room");
                  } catch {
                    /* ignore */
                  }
                  setRejoinRoom(null);
                }}
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Dismiss"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 3. "Join with code" row */}
        <form onSubmit={handleJoinCode} className="space-y-1.5">
          <label
            htmlFor="join-code-input"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1"
          >
            Join with code
          </label>
          <div className="flex gap-2">
            <Input
              id="join-code-input"
              value={roomCode}
              maxLength={5}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="CODE"
              className="h-14 flex-1 text-center font-display text-2xl tracking-[0.2em] uppercase bg-card border-3 border-border rounded-2xl shadow-card"
            />
            <Button
              type="submit"
              disabled={joinBusy || roomCode.trim().length !== 5}
              className="min-h-[56px] px-5 font-display text-lg tracking-wide bg-primary text-primary-foreground shadow-button rounded-2xl"
            >
              {joinBusy ? "Joining…" : "Join"}
              <ArrowRight className="size-5 ml-1" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => nav({ to: "/join" })}
              className="min-h-[56px] px-3.5 border-3 border-border rounded-2xl shadow-button shrink-0"
              title="Scan QR Code"
            >
              <QrCode className="size-6 text-foreground" />
            </Button>
          </div>
        </form>

        {/* 4. Category chips */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-4 py-2 font-display text-sm tracking-wide transition-all shrink-0 ${
                  selectedCategory === cat ? "chip-active" : "chip-idle"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 5. 2-column grid of game cards */}
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
          {filteredGames.map((game) => {
            const isLive = game.status === "live";
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => handleGameClick(game)}
                className={`group relative flex flex-col justify-between rounded-2xl border-3 border-border bg-card p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-card min-h-[168px] ${
                  isLive ? "cursor-pointer" : "cursor-pointer opacity-85"
                }`}
              >
                {/* Top: Sticker Icon & Badge */}
                <div className="flex items-start justify-between w-full">
                  <div
                    className={`grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-border shadow-md transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3 p-2 ${game.accentBg}`}
                  >
                    <img
                      src={game.stickerUrl}
                      alt={game.name}
                      width={40}
                      height={40}
                      loading="lazy"
                      className="size-10 select-none drop-shadow-sm"
                    />
                  </div>
                  {!isLive && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-ink border-2 border-border shadow-xs">
                      SOON
                    </span>
                  )}
                  {isLive && (
                    <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 border border-teal-500/40">
                      PLAY
                    </span>
                  )}
                </div>

                {/* Bottom: Name & Players */}
                <div className="mt-3">
                  <h3 className="font-display text-xl leading-tight text-foreground group-hover:text-primary transition-colors">
                    {game.name}
                  </h3>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {game.playerCountLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 200 Coins Welcome Bonus Popup */}
      <Dialog
        open={showBonusPopup}
        onOpenChange={(open) => {
          if (!open) {
            try {
              localStorage.removeItem("friendzy.bonus_pending");
            } catch {
              /* ignore */
            }
            setShowBonusPopup(false);
          }
        }}
      >
        <DialogContent className="max-w-xs border-4 border-border rounded-3xl bg-surface p-6 text-center shadow-panel">
          <DialogHeader className="space-y-3">
            <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-amber-400 border-3 border-border text-ink shadow-panel transform rotate-[-6deg]">
              <Coins className="size-10 fill-ink" />
            </div>
            <DialogTitle className="font-display text-3xl tracking-tight text-foreground">
              You got 200 coins!
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold text-muted-foreground leading-relaxed">
              Welcome to <b>[FRIENDZY]</b>! We've deposited 200 starter coins into your account to
              unlock sticker packs & card skins in the Shop.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Button
              className="w-full min-h-[56px] font-display text-xl bg-primary text-primary-foreground shadow-button rounded-2xl"
              onClick={() => {
                try {
                  localStorage.removeItem("friendzy.bonus_pending");
                } catch {
                  /* ignore */
                }
                setShowBonusPopup(false);
              }}
            >
              Let's Play! 🎲
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfileModal
          open={showEditProfile}
          onOpenChange={setShowEditProfile}
          currentName={account?.displayName ?? player?.displayName ?? ""}
          currentAvatar={account?.equippedSkin ?? avatarId}
          onSaved={() => {
            refresh();
            setShowEditProfile(false);
          }}
        />
      )}
    </GameLayout>
  );
}

/**
 * Logged-Out / New Player Welcome & Authentication Screen
 */
function WelcomeAuthScreen({ onComplete }: { onComplete: () => void }) {
  const check = useServerFn(checkUsernameFn);
  const register = useServerFn(registerAccountFn);
  const prepareLogin = useServerFn(prepareLoginFn);
  const persist = useServerFn(saveProfile);
  const { player, save } = usePlayer();

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [step, setStep] = useState<1 | 2>(1); // Step 1: name/user/pwd, Step 2: avatar
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("fox");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUpStep1(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const u = username.trim().toLowerCase();
    if (name.trim().length < 2) {
      setError("Name needs at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      setError("Username: 3–20 letters, numbers or _.");
      return;
    }
    if (password.length < 6) {
      setError("Password needs at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const { available } = await check({ data: { username: u } });
      if (!available) {
        setError("That username is taken. Try another.");
        return;
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify username.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteSignUp() {
    setError(null);
    setBusy(true);
    const u = username.trim().toLowerCase();
    try {
      // 1. Create account server-side via Supabase Admin (bypasses email delivery / confirmation limits)
      const reg = await register({
        data: {
          username: u,
          displayName: name.trim(),
          password,
          avatarId: selectedAvatar,
        },
      });

      if (!reg.ok) {
        throw new Error(reg.error);
      }

      // 2. Sign in directly on the client to obtain session token
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: usernameEmail(u),
        password,
      });

      if (signInErr) {
        throw new Error(signInErr.message);
      }

      if (player) {
        await persist({
          data: {
            sessionToken: player.sessionToken,
            displayName: name.trim(),
            avatarId: selectedAvatar,
          },
        });
        save(name.trim(), selectedAvatar);
      }

      try {
        localStorage.setItem("friendzy.bonus_pending", "true");
      } catch {
        /* ignore */
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const u = username.trim().toLowerCase();
    if (!u || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setBusy(true);
    try {
      await prepareLogin({ data: { username: u } });
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: usernameEmail(u),
        password,
      });
      if (signInErr) {
        throw new Error(
          signInErr.message.includes("Invalid login credentials")
            ? "Incorrect username or password."
            : signInErr.message,
        );
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="game-table min-h-dvh flex items-center justify-center p-4 text-foreground">
      <div className="play-panel w-full max-w-sm p-6 sm:p-7 space-y-6 animate-rise shadow-panel">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <img
            src="/stickers/logo-friendzy.svg"
            alt="FRIENDZY"
            width={240}
            height={94}
            className="h-16 w-auto mx-auto drop-shadow-md select-none"
          />
          <p className="text-xs font-bold text-muted-foreground">
            Multiplayer Party & Board Games Hub
          </p>
        </div>

        {/* Tab Switcher: Create Account vs Log In */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/80 p-1 border-2 border-border">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setStep(1);
              setError(null);
            }}
            className={`rounded-xl py-2 font-display text-sm transition-all ${
              mode === "signup"
                ? "bg-surface text-foreground shadow-xs border-2 border-border"
                : "text-muted-foreground"
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`rounded-xl py-2 font-display text-sm transition-all ${
              mode === "signin"
                ? "bg-surface text-foreground shadow-xs border-2 border-border"
                : "text-muted-foreground"
            }`}
          >
            Log In
          </button>
        </div>

        {/* SIGN UP FORM */}
        {mode === "signup" && step === 1 && (
          <form onSubmit={handleSignUpStep1} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sam"
                className="h-12 text-base rounded-xl border-2 border-border"
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Unique Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm font-bold text-muted-foreground select-none">
                  @
                </span>
                <Input
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="sam_fox"
                  className="h-12 pl-8 text-base rounded-xl border-2 border-border"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="h-12 text-base rounded-xl border-2 border-border"
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="text-xs font-bold text-destructive text-center">{error}</p>}

            <Button
              type="submit"
              disabled={busy}
              className="w-full min-h-[56px] font-display text-lg bg-primary text-primary-foreground shadow-button rounded-2xl mt-2"
            >
              {busy ? "Checking…" : "Next: Pick Avatar"}
              <ArrowRight className="size-5 ml-1" />
            </Button>
          </form>
        )}

        {/* SIGN UP STEP 2: PICK AVATAR */}
        {mode === "signup" && step === 2 && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="font-display text-xl font-bold">Pick your avatar sticker</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Friends will see this on game boards
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
              {AVATARS.map((av) => {
                const isSelected = selectedAvatar === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatar(av.id)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-1.5 transition-transform border-3 ${
                      isSelected
                        ? "border-primary bg-primary/15 scale-110 shadow-sm"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <Emoji value={av.emoji} size={36} className="size-9 drop-shadow-xs" />
                  </button>
                );
              })}
            </div>

            {error && <p className="text-xs font-bold text-destructive text-center">{error}</p>}

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                disabled={busy}
                onClick={handleCompleteSignUp}
                className="w-full min-h-[56px] font-display text-xl bg-primary text-primary-foreground shadow-button rounded-2xl"
              >
                {busy ? "Creating Account…" : "Join & Get 200 Coins! 🪙"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="w-full text-xs font-bold text-muted-foreground"
              >
                ← Back to details
              </Button>
            </div>
          </div>
        )}

        {/* LOG IN FORM */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm font-bold text-muted-foreground select-none">
                  @
                </span>
                <Input
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="sam_fox"
                  className="h-12 pl-8 text-base rounded-xl border-2 border-border"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="h-12 text-base rounded-xl border-2 border-border"
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-xs font-bold text-destructive text-center">{error}</p>}

            <Button
              type="submit"
              disabled={busy}
              className="w-full min-h-[56px] font-display text-lg bg-primary text-primary-foreground shadow-button rounded-2xl mt-2"
            >
              {busy ? "Signing in…" : "Log In to FRIENDZY"}
            </Button>
          </form>
        )}

        {/* Quick guest play link */}
        <div className="pt-2 text-center border-t border-border/40">
          <button
            type="button"
            onClick={() => {
              save("Player", "fox");
              onComplete();
            }}
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Or play immediately as Guest →
          </button>
        </div>
      </div>
    </main>
  );
}

/**
 * Edit Profile Modal dialog to change display name & avatar sticker
 */
function EditProfileModal({
  open,
  onOpenChange,
  currentName,
  currentAvatar,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  currentAvatar: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [avatar, setAvatar] = useState(currentAvatar);
  const [busy, setBusy] = useState(false);
  const persist = useServerFn(saveProfile);
  const { player, save } = usePlayer();

  async function handleSave() {
    if (name.trim().length < 2) {
      toast.error("Name needs at least 2 characters.");
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.updateUser({
        data: {
          display_name: name.trim(),
          avatar_id: avatar,
        },
      });

      if (player) {
        await persist({
          data: {
            sessionToken: player.sessionToken,
            displayName: name.trim(),
            avatarId: avatar,
          },
        });
        save(name.trim(), avatar);
      }

      toast.success("Profile updated!");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-4 border-border rounded-3xl bg-surface p-6 shadow-panel">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold">Edit Profile</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update your display name and player avatar sticker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Display Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="h-12 text-base rounded-xl border-2 border-border"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Avatar Sticker
            </label>
            <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1">
              {AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setAvatar(av.id)}
                  className={`aspect-square rounded-2xl flex items-center justify-center p-1.5 border-3 transition-transform ${
                    avatar === av.id
                      ? "border-primary bg-primary/15 scale-105"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <Emoji value={av.emoji} size={36} className="size-9 drop-shadow-xs" />
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full min-h-[52px] font-display text-lg bg-primary text-primary-foreground shadow-button rounded-xl mt-3"
            disabled={busy}
            onClick={handleSave}
          >
            {busy ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
