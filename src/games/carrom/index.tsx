import { useEffect, useRef, useState, useCallback } from "react";
import { Target, Trophy, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { avatarEmoji, type GameState } from "@/lib/game-types";
import { play } from "@/lib/sounds";
import { submitCarromShotResultFn, rematchCarromFn } from "@/lib/game.functions";
import type { CarromCoin, CarromStriker } from "./types";

interface CarromGameProps {
  s: GameState;
  token: string;
  refresh: () => void;
  runAction: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
}

const BOARD_SIZE = 500;
const POCKET_RADIUS = 26;
const POCKETS = [
  { x: 34, y: 34 },
  { x: BOARD_SIZE - 34, y: 34 },
  { x: 34, y: BOARD_SIZE - 34 },
  { x: BOARD_SIZE - 34, y: BOARD_SIZE - 34 },
];

export function CarromGame({ s, token, refresh, runAction }: CarromGameProps) {
  const carromState = s.carrom;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Local physics simulation states
  const coinsRef = useRef<CarromCoin[]>([]);
  const strikerRef = useRef<CarromStriker>({
    x: BOARD_SIZE / 2,
    y: BOARD_SIZE - 75,
    vx: 0,
    vy: 0,
    radius: 18,
    active: true,
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [aimVector, setAimVector] = useState<{ dx: number; dy: number } | null>(null);
  const [isDraggingAim, setIsDraggingAim] = useState(false);
  const [strikerBaselinePos, setStrikerBaselinePos] = useState(BOARD_SIZE / 2);

  const isMyTurn = carromState?.isMyTurn ?? false;

  // Sync server coins to local ref when server state changes and not simulating
  useEffect(() => {
    if (!carromState || isSimulating) return;
    coinsRef.current = JSON.parse(JSON.stringify(carromState.coins));
    strikerRef.current = JSON.parse(JSON.stringify(carromState.striker));
    setStrikerBaselinePos(carromState.striker.x);
  }, [carromState, isSimulating]);

  useEffect(() => {
    if (isMyTurn) play("turn");
  }, [isMyTurn]);

  // Handle Shot Completion
  const onShotFinished = useCallback(
    (strikerFoul: boolean) => {
      setIsSimulating(false);
      setAimVector(null);

      void runAction(
        async () => {
          await submitCarromShotResultFn({
            data: {
              sessionToken: token,
              code: s.code,
              updatedCoins: coinsRef.current,
              strikerFoul,
            },
          });
        },
        () => refresh(),
      );
    },
    [runAction, token, s.code, refresh],
  );

  // Physics animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let strikerFoulOccurred = false;

    const render = () => {
      ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

      // 1. Draw Wooden Board Surface
      ctx.fillStyle = "#ebd5ad";
      ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

      // Wooden border rim
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#5a3214";
      ctx.strokeRect(7, 7, BOARD_SIZE - 14, BOARD_SIZE - 14);

      // Inner border lines
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#8b4513";
      ctx.strokeRect(26, 26, BOARD_SIZE - 52, BOARD_SIZE - 52);

      // 2. Center Circle & Ornament
      const cx = BOARD_SIZE / 2;
      const cy = BOARD_SIZE / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.strokeStyle = "#9c572b";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#c0392b";
      ctx.fill();

      // 3. Baselines & Circles
      // Bottom baseline
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#8b4513";
      ctx.beginPath();
      ctx.moveTo(85, BOARD_SIZE - 75);
      ctx.lineTo(BOARD_SIZE - 85, BOARD_SIZE - 75);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(85, BOARD_SIZE - 75, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#e67e22";
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(BOARD_SIZE - 85, BOARD_SIZE - 75, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#e67e22";
      ctx.fill();
      ctx.stroke();

      // Top baseline
      ctx.beginPath();
      ctx.moveTo(85, 75);
      ctx.lineTo(BOARD_SIZE - 85, 75);
      ctx.stroke();

      // 4. Corner Pockets
      for (const p of POCKETS) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "#1e130c";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#3e2718";
        ctx.stroke();

        // Pocket net pattern
        ctx.beginPath();
        ctx.arc(p.x, p.y, POCKET_RADIUS - 6, 0, Math.PI * 2);
        ctx.fillStyle = "#0a0604";
        ctx.fill();
      }

      // 5. Physics Update
      if (isSimulating) {
        const coins = coinsRef.current;
        const striker = strikerRef.current;
        const friction = 0.984;

        // Update striker
        if (striker.active) {
          striker.x += striker.vx;
          striker.y += striker.vy;
          striker.vx *= friction;
          striker.vy *= friction;

          // Wall bounce for striker
          const minBound = 22 + striker.radius;
          const maxBound = BOARD_SIZE - 22 - striker.radius;

          if (striker.x < minBound) {
            striker.x = minBound;
            striker.vx *= -0.8;
          }
          if (striker.x > maxBound) {
            striker.x = maxBound;
            striker.vx *= -0.8;
          }
          if (striker.y < minBound) {
            striker.y = minBound;
            striker.vy *= -0.8;
          }
          if (striker.y > maxBound) {
            striker.y = maxBound;
            striker.vy *= -0.8;
          }

          // Striker pocket check
          for (const p of POCKETS) {
            if (Math.hypot(striker.x - p.x, striker.y - p.y) < POCKET_RADIUS) {
              striker.active = false;
              striker.vx = 0;
              striker.vy = 0;
              strikerFoulOccurred = true;
              play("vote");
              break;
            }
          }

          if (Math.hypot(striker.vx, striker.vy) < 0.06) {
            striker.vx = 0;
            striker.vy = 0;
          }
        }

        // Update coins
        for (const c of coins) {
          if (c.pocketed) continue;

          c.x += c.vx;
          c.y += c.vy;
          c.vx *= friction;
          c.vy *= friction;

          // Wall bounce for coins
          const minBound = 22 + c.radius;
          const maxBound = BOARD_SIZE - 22 - c.radius;

          if (c.x < minBound) {
            c.x = minBound;
            c.vx *= -0.82;
          }
          if (c.x > maxBound) {
            c.x = maxBound;
            c.vx *= -0.82;
          }
          if (c.y < minBound) {
            c.y = minBound;
            c.vy *= -0.82;
          }
          if (c.y > maxBound) {
            c.y = maxBound;
            c.vy *= -0.82;
          }

          // Coin pocket check
          for (const p of POCKETS) {
            if (Math.hypot(c.x - p.x, c.y - p.y) < POCKET_RADIUS) {
              c.pocketed = true;
              c.vx = 0;
              c.vy = 0;
              play("reveal");
              break;
            }
          }

          if (Math.hypot(c.vx, c.vy) < 0.06) {
            c.vx = 0;
            c.vy = 0;
          }
        }

        // Striker <-> Coin Collisions
        if (striker.active) {
          for (const c of coins) {
            if (c.pocketed) continue;
            const dx = c.x - striker.x;
            const dy = c.y - striker.y;
            const dist = Math.hypot(dx, dy);
            const minDist = striker.radius + c.radius;

            if (dist < minDist && dist > 0) {
              // Elastic collision impulse
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = (minDist - dist) / 2;

              striker.x -= nx * overlap;
              striker.y -= ny * overlap;
              c.x += nx * overlap;
              c.y += ny * overlap;

              const kx = striker.vx - c.vx;
              const ky = striker.vy - c.vy;
              const p = (2 * (nx * kx + ny * ky)) / (1.5 + 1.0); // striker is heavier (1.5x)

              striker.vx -= p * 1.0 * nx * 0.9;
              striker.vy -= p * 1.0 * ny * 0.9;
              c.vx += p * 1.5 * nx * 0.9;
              c.vy += p * 1.5 * ny * 0.9;

              play("pick");
            }
          }
        }

        // Coin <-> Coin Collisions
        for (let i = 0; i < coins.length; i++) {
          const c1 = coins[i]!;
          if (c1.pocketed) continue;

          for (let j = i + 1; j < coins.length; j++) {
            const c2 = coins[j]!;
            if (c2.pocketed) continue;

            const dx = c2.x - c1.x;
            const dy = c2.y - c1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = c1.radius + c2.radius;

            if (dist < minDist && dist > 0) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = (minDist - dist) / 2;

              c1.x -= nx * overlap;
              c1.y -= ny * overlap;
              c2.x += nx * overlap;
              c2.y += ny * overlap;

              const kx = c1.vx - c2.vx;
              const ky = c1.vy - c2.vy;
              const p = nx * kx + ny * ky;

              c1.vx -= p * nx * 0.9;
              c1.vy -= p * ny * 0.9;
              c2.vx += p * nx * 0.9;
              c2.vy += p * ny * 0.9;

              play("pick");
            }
          }
        }

        // Check if all stopped
        const strikerMoving =
          striker.active && (Math.abs(striker.vx) > 0 || Math.abs(striker.vy) > 0);
        const coinsMoving = coins.some(
          (c) => !c.pocketed && (Math.abs(c.vx) > 0 || Math.abs(c.vy) > 0),
        );

        if (!strikerMoving && !coinsMoving) {
          onShotFinished(strikerFoulOccurred);
        }
      }

      // 6. Draw Coins
      for (const c of coinsRef.current) {
        if (c.pocketed) continue;

        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);

        if (c.type === "queen") {
          ctx.fillStyle = "#e74c3c";
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#f1c40f";
          ctx.stroke();
          // Queen crown dot
          ctx.beginPath();
          ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#f1c40f";
          ctx.fill();
        } else if (c.type === "white") {
          ctx.fillStyle = "#fdfefe";
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#bdc3c7";
          ctx.stroke();
        } else {
          ctx.fillStyle = "#2c3e50";
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#1a252f";
          ctx.stroke();
        }
      }

      // 7. Draw Striker
      const striker = strikerRef.current;
      if (striker.active) {
        ctx.beginPath();
        ctx.arc(striker.x, striker.y, striker.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#f39c12";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#d35400";
        ctx.stroke();

        // Striker inner circle
        ctx.beginPath();
        ctx.arc(striker.x, striker.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }

      // 8. Draw Aiming Slingshot Arrow & Trajectory Guideline
      if (aimVector && isDraggingAim && !isSimulating && isMyTurn) {
        ctx.beginPath();
        ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(striker.x + aimVector.dx, striker.y + aimVector.dy);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "rgba(230, 126, 34, 0.85)";
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target Arrow
        ctx.beginPath();
        ctx.arc(striker.x + aimVector.dx, striker.y + aimVector.dy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#e67e22";
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isSimulating, aimVector, isDraggingAim, isMyTurn, onShotFinished]);

  if (!carromState) {
    return (
      <div className="play-panel p-8 text-center space-y-3">
        <p className="font-bold text-muted-foreground">Setting up Toybox Carrom…</p>
      </div>
    );
  }

  // Baseline position slider change
  const handleBaselineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSimulating || !isMyTurn) return;
    const x = parseFloat(e.target.value);
    setStrikerBaselinePos(x);
    strikerRef.current.x = x;
    strikerRef.current.y = BOARD_SIZE - 75;
  };

  // Canvas Mouse / Touch events for aiming and flicking
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || isSimulating) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = BOARD_SIZE / rect.width;
    const clickX = (e.clientX - rect.left) * scale;
    const clickY = (e.clientY - rect.top) * scale;

    const striker = strikerRef.current;
    if (Math.hypot(clickX - striker.x, clickY - striker.y) < striker.radius * 2) {
      setIsDraggingAim(true);
      play("pick");
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingAim || !isMyTurn || isSimulating) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = BOARD_SIZE / rect.width;
    const curX = (e.clientX - rect.left) * scale;
    const curY = (e.clientY - rect.top) * scale;

    const striker = strikerRef.current;
    // Pull-back vector (slingshot direction is inverted for natural flick)
    const pullX = striker.x - curX;
    const pullY = striker.y - curY;

    // Cap power
    const maxPull = 120;
    const dist = Math.hypot(pullX, pullY);
    const power = Math.min(dist, maxPull);
    const angle = Math.atan2(pullY, pullX);

    setAimVector({
      dx: Math.cos(angle) * power * 1.5,
      dy: Math.sin(angle) * power * 1.5,
    });
  };

  const handleMouseUp = () => {
    if (!isDraggingAim || !aimVector || isSimulating || !isMyTurn) {
      setIsDraggingAim(false);
      setAimVector(null);
      return;
    }

    setIsDraggingAim(false);

    // Launch striker!
    const forceFactor = 0.14;
    strikerRef.current.vx = aimVector.dx * forceFactor;
    strikerRef.current.vy = aimVector.dy * forceFactor;
    setIsSimulating(true);
    play("clue");
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Toybox Game Board Frame */}
      <div className="bg-amber-950/20 dark:bg-amber-950/40 p-4 sm:p-5 rounded-3xl border-4 border-amber-800/40 shadow-2xl backdrop-blur-sm">
        {/* Header HUD */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <div>
              <h3 className="font-display font-bold text-base leading-tight">Toybox Carrom</h3>
              <p className="text-xs text-muted-foreground">{carromState.lastActionText}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                isMyTurn
                  ? "bg-amber-500 text-white border-amber-600 animate-pulse"
                  : "bg-muted text-muted-foreground border-border/50"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {isMyTurn ? "Your Strike!" : "Opponent Aiming…"}
            </span>
          </div>
        </div>

        {/* The Carrom Canvas */}
        <div className="relative aspect-square max-w-[440px] mx-auto rounded-2xl overflow-hidden border-4 border-amber-950 shadow-inner bg-[#ebd5ad] select-none">
          <canvas
            ref={canvasRef}
            width={BOARD_SIZE}
            height={BOARD_SIZE}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-full cursor-crosshair touch-none"
          />
        </div>

        {/* Baseline Slider Bar (for positioning striker before shot) */}
        {isMyTurn && !isSimulating && (
          <div className="mt-3 p-3 rounded-2xl bg-card border border-border/80 shadow-panel space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>Slide Striker on Baseline</span>
              <span className="text-primary font-mono">{Math.round(strikerBaselinePos)}px</span>
            </div>
            <input
              type="range"
              min={110}
              max={BOARD_SIZE - 110}
              value={strikerBaselinePos}
              onChange={handleBaselineChange}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Drag back the striker to aim, then release to flick!
            </p>
          </div>
        )}

        {/* Players Score Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {carromState.players.map((p) => {
            const playerProfile = s.players.find((pl) => pl.profileId === p.profileId);
            const isTurn =
              p.profileId === carromState.currentTurnProfileId && carromState.phase !== "ended";

            return (
              <div
                key={p.profileId}
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  isTurn
                    ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/40"
                    : "border-border/60 bg-card/60"
                }`}
              >
                <div className="relative">
                  <span className="text-xl">{avatarEmoji(playerProfile?.avatarId)}</span>
                  <span className="absolute -bottom-1 -right-1 text-xs">
                    {p.assignedColor === "white" ? "⚪" : "⚫"}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <span className="text-xs font-bold block truncate">
                    {playerProfile?.displayName ?? "Player"}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Score: {p.score} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rematch Button on Ended */}
        {carromState.phase === "ended" && (
          <div className="mt-4 text-center">
            <Button
              size="default"
              onClick={() => {
                void runAction(
                  async () => {
                    await rematchCarromFn({
                      data: { sessionToken: token, code: s.code },
                    });
                  },
                  () => refresh(),
                );
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Play Again
            </Button>
          </div>
        )}
      </div>

      {/* Match Result Banner */}
      {carromState.phase === "ended" && (
        <div className="play-panel p-6 text-center space-y-3 border-4 border-amber-500/50 shadow-xl bg-amber-500/5">
          <div className="text-4xl animate-bounce">🏆</div>
          <h2 className="text-xl font-display font-bold">Carrom Match Over!</h2>
          <p className="text-sm text-muted-foreground">
            {carromState.winnerId === s.me.profileId
              ? "Magnificent shots! You won the Carrom championship!"
              : "Great game! The queen has been pocketed."}
          </p>
        </div>
      )}
    </div>
  );
}
