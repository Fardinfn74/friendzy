import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Camera, ArrowRight } from "lucide-react";
import { GameLayout, PageTitle } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/hooks/use-account";
import { usePlayer } from "@/hooks/use-player";
import { joinGameFn, saveProfile } from "@/lib/game.functions";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/join")({
  head: () =>
    pageHead("Join a room", "Enter your friend's five-character room code to join FRIENDZY."),
  component: Join,
});
function Join() {
  const { player, save, ready, hasProfile } = usePlayer();
  const { account, avatarId } = useAccount();
  const join = useServerFn(joinGameFn);
  const persist = useServerFn(saveProfile);
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    if (scanning) {
      (async () => {
        try {
          const Detector = (
            window as unknown as {
              BarcodeDetector?: new (options: { formats: string[] }) => {
                detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
              };
            }
          ).BarcodeDetector;
          if (!Detector) {
            setError("Use your phone's Camera app to scan the host's QR code.");
            setScanning(false);
            return;
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          if (stopped) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          if (video.current) {
            video.current.srcObject = stream;
            await video.current.play();
          }
          const detector = new Detector({ formats: ["qr_code"] });
          timer = setInterval(async () => {
            try {
              if (!video.current) return;
              const found = await detector.detect(video.current);
              const raw = found[0]?.rawValue;
              if (raw) {
                const u = new URL(raw);
                if (u.origin !== location.origin) return;
                const match = u.pathname.match(/^\/game\/([A-Z0-9]{5})$/);
                if (match) {
                  setCode(match[1] ?? "");
                  setScanning(false);
                  setError("");
                }
              }
            } catch {
              /* ignore frame scan failures */
            }
          }, 500);
        } catch {
          setError("Camera unavailable. Enter the room code instead.");
          setScanning(false);
        }
      })();
    }
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (timer) clearInterval(timer);
    };
  }, [scanning]);
  async function submit() {
    if (!player) return;
    setBusy(true);
    setError("");
    try {
      const p = await persist({
        data: {
          sessionToken: player.sessionToken,
          displayName: account?.displayName ?? player.displayName,
          avatarId: account ? avatarId : player.avatarId,
        },
      });
      if ("error" in p) throw Error(p.error);
      save(p.displayName, p.avatarId);
      const r = await join({ data: { sessionToken: player.sessionToken, code } });
      if ("error" in r) throw Error(r.error);
      nav({ to: "/game/$code", params: { code: r.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Room not found. Check the code.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <GameLayout back>
      <PageTitle subtitle="Enter the code from your host">Join a room</PageTitle>
      {!account && !hasProfile ? (
        <div className="my-auto text-center">
          <p className="mb-4">Choose your face before joining the crew.</p>
          <Button asChild>
            <Link to="/account">Create Account</Link>
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="room-code" className="label">
            Room code
          </label>
          <Input
            id="room-code"
            autoFocus
            autoComplete="off"
            value={code}
            maxLength={5}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="– – – – –"
            className="h-20 text-center font-display text-3xl tracking-[0.25em]"
          />
          {error && (
            <p role="alert" className="status-error mt-4">
              {error}
            </p>
          )}
          {scanning && (
            <video ref={video} playsInline muted className="mt-6 aspect-square w-full rounded-xl" />
          )}
          <div className="primary-dock space-y-4">
            <Button type="submit" className="w-full" disabled={!ready || code.length !== 5 || busy}>
              {busy ? "Joining…" : "Join"}
              <ArrowRight />
            </Button>
            <p className="text-center text-sm text-muted-foreground">or</p>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setError("");
                setScanning(!scanning);
              }}
            >
              <Camera />
              {scanning ? "Cancel scan" : "Scan QR code"}
            </Button>
          </div>
        </form>
      )}
    </GameLayout>
  );
}
