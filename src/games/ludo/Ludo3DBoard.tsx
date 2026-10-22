import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useBlobShadowTexture } from "@/components/three/textures";
import { getTokenCoords, HOME_STRETCH_COORDS, SAFE_SQUARES, TRACK_COORDS } from "./board-map";
import type { LudoColor, LudoPlayer } from "./types";

export interface Ludo3DBoardProps {
  players: LudoPlayer[];
  currentTurnColor: LudoColor;
  /** token ids (of my colour) that may be moved right now */
  movableTokenIds: number[];
  myColor: LudoColor | null;
  diceValue: number | null;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  onTokenClick: (tokenId: number) => void;
}

const COLORS: Record<LudoColor, { main: string; light: string; dark: string }> = {
  red: { main: "#e5484d", light: "#fbd0d2", dark: "#a8262b" },
  green: { main: "#2eb872", light: "#c9f0dc", dark: "#17784a" },
  yellow: { main: "#f5b81c", light: "#fdecb4", dark: "#b07f06" },
  blue: { main: "#3b82f6", light: "#cfe0fd", dark: "#1d4fa8" },
};
const ORDER: LudoColor[] = ["red", "green", "yellow", "blue"];
/** centre of each yard in cell coordinates */
const YARD_CENTER: Record<LudoColor, [number, number]> = {
  red: [2.5, 2.5], green: [2.5, 11.5], yellow: [11.5, 11.5], blue: [11.5, 2.5],
};
const cellToWorld = (r: number, c: number): [number, number] => [c - 7, r - 7];
const yardSpot = (color: LudoColor, id: number): [number, number] => {
  const [yr, yc] = YARD_CENTER[color];
  return cellToWorld(yr + (id < 2 ? -1 : 1), yc + (id % 2 === 0 ? -1 : 1));
};
/** triangle centroids in the home area (where finished tokens rest) */
const HOME_REST: Record<LudoColor, [number, number]> = {
  red: [-0.75, 0], green: [0, -0.75], yellow: [0.75, 0], blue: [0, 0.75],
};

/* ---------------------------------------------------------------- pawn */
const PAWN_GEO = (() => {
  const body = new THREE.LatheGeometry(
    [[0, 0], [0.34, 0], [0.36, 0.05], [0.3, 0.12], [0.2, 0.22], [0.14, 0.38], [0.16, 0.46], [0.24, 0.5], [0.22, 0.56], [0.12, 0.6], [0, 0.6]]
      .map(([r, y]) => new THREE.Vector2(r, y)),
    28,
  );
  const head = new THREE.SphereGeometry(0.2, 22, 16);
  head.translate(0, 0.76, 0);
  return { body, head };
})();
const pawnMaterials: Partial<Record<LudoColor, THREE.MeshStandardMaterial>> = {};
const pawnMaterial = (c: LudoColor) =>
  (pawnMaterials[c] ??= new THREE.MeshStandardMaterial({ color: COLORS[c].main, roughness: 0.28, metalness: 0.15 }));

/* ---------------------------------------------------------------- token (walks along the track) */
function Token({
  color, id, step, finished, slot, movable, onClick, shadow,
}: {
  color: LudoColor; id: number; step: number; finished: boolean;
  slot: [number, number]; movable: boolean; onClick: () => void; shadow: THREE.Texture;
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  const finalPos = useMemo<[number, number]>(() => {
    if (finished || step >= 57) {
      const [x, z] = HOME_REST[color];
      return [x + slot[0] * 0.5, z + slot[1] * 0.5];
    }
    if (step === -1) return yardSpot(color, id);
    const [r, c] = getTokenCoords(color, step, id);
    const [x, z] = cellToWorld(r, c);
    return [x + slot[0], z + slot[1]];
  }, [color, id, step, finished, slot]);

  const prevStep = useRef<number | null>(null);
  const queue = useRef<[number, number][]>([]);
  const seg = useRef<{ from: [number, number]; to: [number, number]; t0: number } | null>(null);
  const current = useRef<[number, number]>(finalPos);

  // when the step changes, hop cell by cell along the track
  useLayoutEffect(() => {
    const prev = prevStep.current;
    prevStep.current = step;
    if (prev === null || prev === step || !group.current) {
      current.current = finalPos;
      group.current?.position.set(finalPos[0], 0.1, finalPos[1]);
      return;
    }
    const way: [number, number][] = [];
    if (step > prev && prev >= 0 && step < 57) {
      for (let s = prev + 1; s < step; s++) {
        const [r, c] = getTokenCoords(color, s, id);
        way.push(cellToWorld(r, c));
      }
    }
    way.push(finalPos);
    queue.current = way;
    seg.current = null;
    invalidate();
  }, [step, finalPos, color, id, invalidate]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    // walking
    if (!seg.current && queue.current.length) {
      seg.current = { from: current.current, to: queue.current.shift()!, t0: performance.now() };
    }
    if (seg.current) {
      const { from, to, t0 } = seg.current;
      const dur = queue.current.length === 0 && Math.hypot(to[0] - from[0], to[1] - from[1]) > 2.5 ? 520 : 170;
      const t = Math.min(1, (performance.now() - t0) / dur);
      g.position.x = from[0] + (to[0] - from[0]) * t;
      g.position.z = from[1] + (to[1] - from[1]) * t;
      g.position.y = 0.1 + Math.sin(Math.PI * t) * (dur > 300 ? 1.2 : 0.35);
      if (t >= 1) {
        current.current = to;
        seg.current = null;
        if (!queue.current.length) g.position.set(to[0], 0.1, to[1]);
      }
      invalidate();
    } else if (movable) {
      // movable tokens bounce so they are easy to spot
      g.position.y = 0.1 + Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.28;
      if (ring.current) ring.current.rotation.z = clock.elapsedTime * 2;
    }
  });

  return (
    <group ref={group} position={[finalPos[0], 0.1, finalPos[1]]} scale={finished ? 0.62 : 0.86}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} raycast={() => null}>
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={PAWN_GEO.body} material={pawnMaterial(color)} />
      <mesh geometry={PAWN_GEO.head} material={pawnMaterial(color)} />
      {movable && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.04} raycast={() => null}>
          <ringGeometry args={[0.5, 0.66, 28]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
        </mesh>
      )}
      <mesh
        position-y={0.45}
        visible={false}
        onClick={(e) => {
          if (!movable) return;
          e.stopPropagation();
          onClick();
        }}
      >
        <cylinderGeometry args={[0.6, 0.6, 1.1, 10]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- dice */
function faceTexture(n: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fffdf5";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#e3d6b4";
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 122);
  const spots: Record<number, [number, number][]> = {
    1: [[64, 64]],
    2: [[36, 36], [92, 92]],
    3: [[36, 36], [64, 64], [92, 92]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]],
    5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
    6: [[36, 34], [92, 34], [36, 64], [92, 64], [36, 94], [92, 94]],
  };
  for (const [x, y] of spots[n]!) {
    g.beginPath();
    g.fillStyle = n === 1 ? "#d63b3b" : "#1f1b16";
    g.arc(x, y, n === 1 ? 17 : 11, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

// materials order of a BoxGeometry: +x, -x, +y, -y, +z, -z  (opposite faces add up to 7)
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const TOP_ROTATION: Record<number, [number, number, number]> = {
  1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0],
};

function Dice({
  value, rolling, canRoll, onRoll,
}: { value: number | null; rolling: boolean; canRoll: boolean; onRoll: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const mats = useMemo(() => FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({ map: faceTexture(v), roughness: 0.35 })), []);
  const target = useMemo(() => {
    const [x, y, z] = TOP_ROTATION[value ?? 1] ?? [0, 0, 0];
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  }, [value]);
  const spin = useRef(new THREE.Vector3(5, 7, 4));

  useEffect(() => {
    if (rolling) spin.current.set(4 + Math.random() * 5, 5 + Math.random() * 6, 3 + Math.random() * 5);
    invalidate();
  }, [rolling, value, invalidate]);

  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    if (rolling) {
      m.rotation.x += spin.current.x * dt;
      m.rotation.y += spin.current.y * dt;
      m.rotation.z += spin.current.z * dt;
      m.position.y = 1.1 + Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.7;
      invalidate();
    } else {
      m.quaternion.slerp(target, Math.min(1, dt * 9));
      const settled = m.quaternion.angleTo(target) < 0.01;
      m.position.y = canRoll ? 0.85 + Math.abs(Math.sin(clock.elapsedTime * 3.2)) * 0.25 : 0.7;
      if (!settled || canRoll) invalidate();
    }
  });

  return (
    <mesh
      ref={mesh}
      material={mats}
      position={[0, 0.7, 0]}
      onClick={(e) => {
        if (!canRoll) return;
        e.stopPropagation();
        onRoll();
      }}
    >
      <boxGeometry args={[1.05, 1.05, 1.05]} />
    </mesh>
  );
}

/* ---------------------------------------------------------------- static board */
function starShape(r = 0.34) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  return new THREE.ShapeGeometry(sh);
}

function Board({ currentTurnColor }: { currentTurnColor: LudoColor }) {
  const star = useMemo(() => starShape(), []);
  const trackSet = useMemo(() => new Set(TRACK_COORDS.map(([r, c]) => `${r},${c}`)), []);
  const stretch = useMemo(() => {
    const m = new Map<string, LudoColor>();
    for (const col of ORDER) HOME_STRETCH_COORDS[col].forEach(([r, c]) => m.set(`${r},${c}`, col));
    return m;
  }, []);
  const starts = useMemo(() => {
    const m = new Map<string, LudoColor>();
    ORDER.forEach((col, i) => {
      const [r, c] = TRACK_COORDS[i * 13]!;
      m.set(`${r},${c}`, col);
    });
    return m;
  }, []);
  const safeCells = useMemo(() => new Set([...SAFE_SQUARES].map((i) => `${TRACK_COORDS[i]![0]},${TRACK_COORDS[i]![1]}`)), []);

  const tiles = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const key = `${r},${c}`;
      const [x, z] = cellToWorld(r, c);
      const sCol = stretch.get(key);
      const startCol = starts.get(key);
      if (!trackSet.has(key) && !sCol) continue;
      const color = sCol ? COLORS[sCol].main : startCol ? COLORS[startCol].main : "#fff8e6";
      tiles.push(
        <group key={key} position={[x, 0, z]}>
          <mesh position-y={0.045}>
            <boxGeometry args={[0.94, 0.09, 0.94]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
          {safeCells.has(key) && (
            <mesh geometry={star} rotation-x={-Math.PI / 2} position-y={0.1} raycast={() => null}>
              <meshBasicMaterial color={startCol ? "#fff7d1" : "#e0a800"} />
            </mesh>
          )}
        </group>,
      );
    }
  }

  const yards = ORDER.map((col) => {
    const [yr, yc] = YARD_CENTER[col];
    const [x, z] = cellToWorld(yr, yc);
    const active = col === currentTurnColor;
    return (
      <group key={col} position={[x, 0, z]}>
        <mesh position-y={0.05}>
          <boxGeometry args={[6, 0.1, 6]} />
          <meshStandardMaterial color={COLORS[col].main} roughness={0.6} />
        </mesh>
        <mesh position-y={0.11}>
          <boxGeometry args={[4.4, 0.06, 4.4]} />
          <meshStandardMaterial color={COLORS[col].light} roughness={0.7} />
        </mesh>
        {[-1, 1].flatMap((dx) =>
          [-1, 1].map((dz) => (
            <mesh key={`${dx}${dz}`} rotation-x={-Math.PI / 2} position={[dx, 0.15, dz]} raycast={() => null}>
              <ringGeometry args={[0.46, 0.62, 28]} />
              <meshBasicMaterial color={COLORS[col].main} />
            </mesh>
          )),
        )}
        {active && (
          <mesh rotation-x={-Math.PI / 2} position-y={0.16} raycast={() => null}>
            <ringGeometry args={[2.35, 2.6, 4, 1, Math.PI / 4]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
        )}
      </group>
    );
  });

  const triangles = ORDER.map((col) => {
    const pts: Record<LudoColor, [number, number][]> = {
      red: [[-1.5, -1.5], [-1.5, 1.5], [0, 0]],
      green: [[-1.5, -1.5], [1.5, -1.5], [0, 0]],
      yellow: [[1.5, -1.5], [1.5, 1.5], [0, 0]],
      blue: [[-1.5, 1.5], [1.5, 1.5], [0, 0]],
    };
    const sh = new THREE.Shape(pts[col].map(([x, y]) => new THREE.Vector2(x, -y)));
    return (
      <mesh key={col} rotation-x={-Math.PI / 2} position-y={0.1} raycast={() => null}>
        <shapeGeometry args={[sh]} />
        <meshStandardMaterial color={COLORS[col].main} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
    );
  });

  return (
    <group>
      {/* wooden tray */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[15.8, 0.4, 15.8]} />
        <meshStandardMaterial color="#6b4423" roughness={0.55} />
      </mesh>
      <mesh position={[0, -0.001, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[15, 15]} />
        <meshStandardMaterial color="#f2e6c9" roughness={0.8} />
      </mesh>
      {yards}
      {tiles}
      {triangles}
    </group>
  );
}

function Scene(props: Ludo3DBoardProps) {
  const { players, currentTurnColor, movableTokenIds, myColor, diceValue, rolling, canRoll, onRoll, onTokenClick } = props;
  const shadow = useBlobShadowTexture();
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    invalidate();
  }, [players, currentTurnColor, movableTokenIds, diceValue, invalidate]);

  // tokens sharing a cell stand side by side instead of overlapping
  const slots = useMemo(() => {
    const groups = new Map<string, { color: LudoColor; id: number }[]>();
    for (const p of players)
      for (const t of p.tokens) {
        if (t.step === -1 || t.hasFinished || t.step >= 57) continue;
        const [r, c] = getTokenCoords(p.color, t.step, t.id);
        const k = `${r},${c}`;
        groups.set(k, [...(groups.get(k) ?? []), { color: p.color, id: t.id }]);
      }
    const out = new Map<string, [number, number]>();
    for (const list of groups.values()) {
      list.forEach((tk, i) => {
        if (list.length === 1) {
          out.set(`${tk.color}${tk.id}`, [0, 0]);
          return;
        }
        const a = (Math.PI * 2 * i) / list.length + Math.PI / 4;
        out.set(`${tk.color}${tk.id}`, [Math.cos(a) * 0.27, Math.sin(a) * 0.27]);
      });
    }
    return out;
  }, [players]);

  const finishedCount: Record<string, number> = {};
  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#fff4e0", "#7a5a3a", 0.5]} />
      <directionalLight position={[6, 14, 8]} intensity={1.6} />
      <directionalLight position={[-8, 8, -6]} intensity={0.4} />
      <Board currentTurnColor={currentTurnColor} />
      {players.flatMap((p) =>
        p.tokens.map((t) => {
          let slot: [number, number] = slots.get(`${p.color}${t.id}`) ?? [0, 0];
          const done = t.hasFinished || t.step >= 57;
          if (done) {
            const n = (finishedCount[p.color] = (finishedCount[p.color] ?? 0) + 1);
            slot = [((n - 1) % 2) - 0.5, Math.floor((n - 1) / 2) - 0.5];
          }
          return (
            <Token
              key={`${p.color}${t.id}`}
              color={p.color}
              id={t.id}
              step={t.step}
              finished={done}
              slot={slot}
              movable={p.color === myColor && movableTokenIds.includes(t.id)}
              onClick={() => onTokenClick(t.id)}
              shadow={shadow}
            />
          );
        }),
      )}
      <Dice value={diceValue} rolling={rolling} canRoll={canRoll} onRoll={onRoll} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        minDistance={17}
        maxDistance={34}
        minPolarAngle={0.2}
        maxPolarAngle={1.15}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function Ludo3DBoard(props: Ludo3DBoardProps) {
  const animate = props.rolling || props.canRoll || props.movableTokenIds.length > 0;
  return (
    <div className="max-w-[480px] mx-auto">
      <div className="relative aspect-square rounded-2xl overflow-hidden border-4 border-amber-900/60 bg-gradient-to-b from-amber-100/40 to-amber-900/30">
        <Canvas
          frameloop={animate ? "always" : "demand"}
          dpr={[1, 1.75]}
          camera={{ position: [0, 20.5, 15.8], fov: 42, near: 0.1, far: 90 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          style={{ touchAction: "none" }}
        >
          <Scene {...props} />
        </Canvas>
      </div>
      <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Tap the dice to roll · drag to rotate · tap a glowing pawn to move
      </p>
    </div>
  );
}
