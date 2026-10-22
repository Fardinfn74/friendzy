import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Chess } from "chess.js";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { makeLabelTexture, useBlobShadowTexture } from "@/components/three/textures";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
type Color = "w" | "b";

export interface Chess3DBoardProps {
  fen: string;
  myColor: Color | null;
  selectedSquare: string | null;
  legalDestinations: Set<string>;
  lastMove: { from: string; to: string; san?: string } | null;
  inCheckColor: Color | null;
  interactive: boolean;
  moveCount: number;
  onSquareClick: (square: string) => void;
}

const FILES = "abcdefgh";
/** Square name -> board position. Rank 1 is nearest the white player (+z). */
const pos = (sq: string): [number, number] => [FILES.indexOf(sq[0]!) - 3.5, 4.5 - Number(sq[1])];

/* ------------------------------------------------------------------ piece models (built in code) */
const BASE: [number, number][] = [
  [0, 0], [0.36, 0], [0.38, 0.03], [0.38, 0.07], [0.32, 0.11], [0.28, 0.14],
];
const lathe = (pts: [number, number][]) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 36);

type RawPart = { geo: THREE.BufferGeometry; position?: [number, number, number]; rotation?: [number, number, number] };
type Part = { geo: THREE.BufferGeometry; position: [number, number, number]; rotation: [number, number, number] };

function knightHead() {
  const pts: [number, number][] = [
    [-0.2, 0.14], [0.2, 0.14], [0.17, 0.3], [0.27, 0.5], [0.42, 0.58], [0.42, 0.68],
    [0.26, 0.82], [0.2, 1.0], [0.1, 0.88], [-0.02, 1.0], [-0.12, 0.8], [-0.26, 0.5], [-0.24, 0.3],
  ];
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 3,
  });
  geo.translate(0, 0, -0.11);
  return geo;
}

const partsCache: Partial<Record<PieceType, Part[]>> = {};
function partsFor(type: PieceType): Part[] {
  const cached = partsCache[type];
  if (cached) return cached;
  let parts: RawPart[];
  switch (type) {
    case "p":
      parts = [
        { geo: lathe([...BASE, [0.2, 0.2], [0.14, 0.32], [0.13, 0.42], [0.2, 0.46], [0.2, 0.5], [0.13, 0.53], [0, 0.53]]) },
        { geo: new THREE.SphereGeometry(0.18, 24, 18), position: [0, 0.66, 0] },
      ];
      break;
    case "r": {
      const m = new THREE.BoxGeometry(0.15, 0.13, 0.15);
      parts = [
        { geo: lathe([...BASE, [0.26, 0.2], [0.22, 0.5], [0.3, 0.57], [0.3, 0.8], [0, 0.8]]) },
        { geo: m, position: [0.2, 0.86, 0] }, { geo: m, position: [-0.2, 0.86, 0] },
        { geo: m, position: [0, 0.86, 0.2] }, { geo: m, position: [0, 0.86, -0.2] },
      ];
      break;
    }
    case "b": {
      const head = new THREE.SphereGeometry(0.19, 24, 18);
      head.scale(1, 1.4, 1);
      parts = [
        { geo: lathe([...BASE, [0.24, 0.2], [0.15, 0.38], [0.12, 0.46], [0.2, 0.52], [0, 0.52]]) },
        { geo: head, position: [0, 0.74, 0] },
        { geo: new THREE.SphereGeometry(0.06, 16, 12), position: [0, 1.06, 0] },
      ];
      break;
    }
    case "q":
      parts = [
        { geo: lathe([...BASE, [0.26, 0.2], [0.15, 0.5], [0.13, 0.64], [0.25, 0.82], [0.2, 0.86], [0.12, 0.88], [0, 0.88]]) },
        { geo: new THREE.TorusGeometry(0.2, 0.04, 10, 28), position: [0, 0.86, 0], rotation: [Math.PI / 2, 0, 0] },
        { geo: new THREE.SphereGeometry(0.1, 20, 14), position: [0, 1.0, 0] },
      ];
      break;
    case "k":
      parts = [
        { geo: lathe([...BASE, [0.26, 0.2], [0.16, 0.5], [0.14, 0.7], [0.26, 0.86], [0.2, 0.9], [0.12, 0.92], [0, 0.92]]) },
        { geo: new THREE.BoxGeometry(0.09, 0.32, 0.09), position: [0, 1.1, 0] },
        { geo: new THREE.BoxGeometry(0.26, 0.09, 0.09), position: [0, 1.15, 0] },
      ];
      break;
    case "n":
    default:
      parts = [
        { geo: lathe([...BASE, [0.26, 0.2], [0.2, 0.28], [0, 0.28]]) },
        { geo: knightHead(), position: [0, 0.18, 0] },
      ];
  }
  const full: Part[] = parts.map((p) => ({ geo: p.geo, position: p.position ?? [0, 0, 0], rotation: p.rotation ?? [0, 0, 0] }));
  partsCache[type] = full;
  return full;
}

const MATERIALS = {
  w: new THREE.MeshStandardMaterial({ color: "#f3e8d0", roughness: 0.42, metalness: 0.05 }),
  b: new THREE.MeshStandardMaterial({ color: "#2e2724", roughness: 0.32, metalness: 0.18 }),
};

/* ------------------------------------------------------------------ a single piece (hops when it just moved) */
function Piece({
  type, color, square, animFrom, shadow,
}: { type: PieceType; color: Color; square: string; animFrom: string | null; shadow: THREE.Texture }) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [tx, tz] = pos(square);
  const from = animFrom ? pos(animFrom) : null;
  const startedAt = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (from && group.current) {
      group.current.position.set(from[0], 0.12, from[1]);
      startedAt.current = performance.now();
      invalidate();
    }
    // runs once when this piece mounts (a piece that moved is re-created with a new key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g || startedAt.current === null || !from) return;
    const t = Math.min(1, (performance.now() - startedAt.current) / 300);
    const e = 1 - Math.pow(1 - t, 3);
    g.position.x = from[0] + (tx - from[0]) * e;
    g.position.z = from[1] + (tz - from[1]) * e;
    g.position.y = 0.12 + Math.sin(Math.PI * t) * 0.5;
    if (t >= 1) {
      startedAt.current = null;
      g.position.set(tx, 0.12, tz);
    } else {
      invalidate();
    }
  });

  // pieces face the opponent: white looks toward -z, black toward +z
  // knights are turned a little so they read as horses (not a flat slab) from the player's seat
  const facing = color === "w" ? Math.PI / 2 - 0.75 : -Math.PI / 2 - 0.75;
  return (
    <group ref={group} position={[tx, 0.12, tz]} scale={0.86}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01} raycast={() => null}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <group rotation-y={type === "n" ? facing : 0}>
        {partsFor(type).map((p, i) => (
          <mesh key={i} geometry={p.geo} material={MATERIALS[color]} position={p.position} rotation={p.rotation} />
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ board */
const LIGHT = "#f0d9ab";
const DARK = "#a9733f";

function Squares({
  selectedSquare, legalDestinations, occupied, lastMove, checkSquare, interactive, onSquareClick,
}: {
  selectedSquare: string | null;
  legalDestinations: Set<string>;
  occupied: Set<string>;
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  interactive: boolean;
  onSquareClick: (sq: string) => void;
}) {
  const out = [];
  for (let f = 0; f < 8; f++) {
    for (let r = 1; r <= 8; r++) {
      const sq = `${FILES[f]}${r}`;
      const [x, z] = pos(sq);
      const light = (f + r) % 2 !== 0;
      const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
      const legal = legalDestinations.has(sq);
      out.push(
        <group key={sq} position={[x, 0, z]}>
          <mesh
            position-y={0.06}
            onClick={(e) => {
              if (!interactive) return;
              e.stopPropagation();
              onSquareClick(sq);
            }}
          >
            <boxGeometry args={[1, 0.12, 1]} />
            <meshStandardMaterial color={light ? LIGHT : DARK} roughness={0.7} />
          </mesh>
          {isLast && (
            <mesh rotation-x={-Math.PI / 2} position-y={0.125} raycast={() => null}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshBasicMaterial color="#e8d84a" transparent opacity={0.5} />
            </mesh>
          )}
          {selectedSquare === sq && (
            <mesh rotation-x={-Math.PI / 2} position-y={0.13} raycast={() => null}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
            </mesh>
          )}
          {checkSquare === sq && (
            <mesh rotation-x={-Math.PI / 2} position-y={0.13} raycast={() => null}>
              <circleGeometry args={[0.5, 28]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.75} />
            </mesh>
          )}
          {legal && !occupied.has(sq) && (
            <mesh rotation-x={-Math.PI / 2} position-y={0.135} raycast={() => null}>
              <circleGeometry args={[0.17, 24]} />
              <meshBasicMaterial color="#22c55e" transparent opacity={0.85} />
            </mesh>
          )}
          {legal && occupied.has(sq) && (
            <mesh rotation-x={-Math.PI / 2} position-y={0.135} raycast={() => null}>
              <ringGeometry args={[0.38, 0.48, 32]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.9} />
            </mesh>
          )}
        </group>,
      );
    }
  }
  return <>{out}</>;
}

function Frame() {
  const wood = "#5a3a1f";
  return (
    <group>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[9.3, 0.24, 9.3]} />
        <meshStandardMaterial color={wood} roughness={0.55} />
      </mesh>
      {[
        [0, 4.3, 9.3, 0.5], [0, -4.3, 9.3, 0.5], [4.3, 0, 0.5, 8.1], [-4.3, 0, 0.5, 8.1],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x as number, 0.07, z as number]}>
          <boxGeometry args={[w as number, 0.2, d as number]} />
          <meshStandardMaterial color="#6b4423" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Labels({ flip }: { flip: boolean }) {
  const textures = useMemo(() => {
    const t: Record<string, THREE.Texture> = {};
    for (const c of "abcdefgh12345678") t[c] = makeLabelTexture(c);
    return t;
  }, []);
  const items = [];
  for (let i = 0; i < 8; i++) {
    const file = FILES[flip ? 7 - i : i]!;
    const rank = String(flip ? 8 - i : i + 1);
    items.push(
      <mesh key={`f${i}`} rotation-x={-Math.PI / 2} position={[i - 3.5, 0.18, 4.28]} raycast={() => null}>
        <planeGeometry args={[0.36, 0.36]} />
        <meshBasicMaterial map={textures[file] ?? null} transparent />
      </mesh>,
      <mesh key={`r${i}`} rotation-x={-Math.PI / 2} position={[-4.28, 0.18, 3.5 - i]} raycast={() => null}>
        <planeGeometry args={[0.36, 0.36]} />
        <meshBasicMaterial map={textures[rank] ?? null} transparent />
      </mesh>,
    );
  }
  return <>{items}</>;
}

function Scene(props: Chess3DBoardProps) {
  const { fen, myColor, selectedSquare, legalDestinations, lastMove, inCheckColor, interactive, moveCount, onSquareClick } = props;
  const shadow = useBlobShadowTexture();
  const invalidate = useThree((s) => s.invalidate);
  const flip = myColor === "b";

  const pieces = useMemo(() => {
    let board;
    try {
      board = new Chess(fen).board();
    } catch {
      board = new Chess().board();
    }
    return board.flat().filter(Boolean) as { square: string; type: PieceType; color: Color }[];
  }, [fen]);
  const occupied = useMemo(() => new Set(pieces.map((p) => p.square)), [pieces]);
  const kingSquare = inCheckColor ? pieces.find((p) => p.type === "k" && p.color === inCheckColor)?.square ?? null : null;

  // keep the picture fresh when anything the board shows changes (the canvas only redraws on demand to save battery)
  useLayoutEffect(() => {
    invalidate();
  }, [fen, selectedSquare, legalDestinations, lastMove, kingSquare, flip, invalidate]);

  // which piece just arrived (hop animation) and, for castling, which rook moved with the king
  const arrivals = useMemo(() => {
    const map = new Map<string, string>();
    if (!lastMove) return map;
    map.set(lastMove.to, lastMove.from);
    const san = lastMove.san ?? "";
    const rank = lastMove.to[1]!;
    if (san.startsWith("O-O-O")) map.set(`d${rank}`, `a${rank}`);
    else if (san.startsWith("O-O")) map.set(`f${rank}`, `h${rank}`);
    return map;
  }, [lastMove]);

  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#fff4e0", "#7a5a3a", 0.55]} />
      <directionalLight position={[5, 11, 7]} intensity={1.7} />
      <directionalLight position={[-6, 6, -4]} intensity={0.45} />
      <group rotation-y={flip ? Math.PI : 0}>
        <Frame />
        <Squares
          selectedSquare={selectedSquare}
          legalDestinations={legalDestinations}
          occupied={occupied}
          lastMove={lastMove}
          checkSquare={kingSquare}
          interactive={interactive}
          onSquareClick={onSquareClick}
        />
        {pieces.map((p) => {
          const from = arrivals.get(p.square) ?? null;
          const moved = from !== null && (p.square === lastMove?.to || p.type === "r");
          return (
            <Piece
              key={`${p.square}${p.color}${p.type}${moved ? `@${moveCount}` : ""}`}
              type={p.type}
              color={p.color}
              square={p.square}
              animFrom={moved ? from : null}
              shadow={shadow}
            />
          );
        })}
        {/* invisible, clickable layer over each piece so tapping a piece selects/captures */}
        {pieces.map((p) => {
          const [x, z] = pos(p.square);
          return (
            <mesh
              key={`hit-${p.square}`}
              position={[x, 0.5, z]}
              visible={false}
              onClick={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                onSquareClick(p.square);
              }}
            >
              <cylinderGeometry args={[0.38, 0.38, 1, 12]} />
              <meshBasicMaterial />
            </mesh>
          );
        })}
      </group>
      <Labels flip={flip} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        minDistance={10}
        maxDistance={19}
        minPolarAngle={0.25}
        maxPolarAngle={1.25}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function Chess3DBoard(props: Chess3DBoardProps) {
  return (
    <div className="max-w-[480px] mx-auto">
      <div className="relative aspect-square rounded-2xl overflow-hidden border-4 border-amber-900/60 shadow-inner bg-gradient-to-b from-amber-100/40 to-amber-900/30">
        <Canvas
          frameloop="demand"
          dpr={[1, 1.75]}
          camera={{ position: [0, 10.3, 8.8], fov: 42, near: 0.1, far: 60 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          style={{ touchAction: "none" }}
        >
          <Scene {...props} />
        </Canvas>
      </div>
      <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Drag to rotate · pinch to zoom · tap a piece, then a square
      </p>
    </div>
  );
}
