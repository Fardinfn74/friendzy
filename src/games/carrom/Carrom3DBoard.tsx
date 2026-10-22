import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

import { useBlobShadowTexture } from "@/components/three/textures";
import type { CarromCoin, CarromStriker } from "./types";

export interface Carrom3DBoardProps {
  coinsRef: MutableRefObject<CarromCoin[]>;
  strikerRef: MutableRefObject<CarromStriker>;
  aimVector: { dx: number; dy: number } | null;
  isDraggingAim: boolean;
  isSimulating: boolean;
  isMyTurn: boolean;
  /** changes whenever the board contents changed outside the physics loop (server sync, slider) */
  renderKey: string | number;
  /** pointer positions in board units (0..500, y grows downward, same as the 2D board) */
  onAimStart: (x: number, y: number) => void;
  onAimMove: (x: number, y: number) => void;
  onAimEnd: () => void;
}

const BOARD = 500;
const K = 0.02; // world units per board unit -> the board is 10 x 10
const toW = (v: number) => (v - BOARD / 2) * K;
const POCKETS = [
  [34, 34], [BOARD - 34, 34], [34, BOARD - 34], [BOARD - 34, BOARD - 34],
] as const;
const POCKET_R = 26;
const MAX_COINS = 20;

/** The board markings, drawn once into a texture so they stay crisp and cost nothing per frame. */
function makeBoardTexture() {
  const S = 1024;
  const k = S / BOARD;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.scale(k, k);
  const grad = g.createLinearGradient(0, 0, BOARD, BOARD);
  grad.addColorStop(0, "#f1dcb3");
  grad.addColorStop(1, "#e4c998");
  g.fillStyle = grad;
  g.fillRect(0, 0, BOARD, BOARD);
  // wood grain
  g.globalAlpha = 0.07;
  g.strokeStyle = "#7a4b1e";
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * BOARD;
    g.lineWidth = 0.6 + Math.random() * 1.4;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(BOARD * 0.3, y + (Math.random() - 0.5) * 14, BOARD * 0.7, y + (Math.random() - 0.5) * 14, BOARD, y + (Math.random() - 0.5) * 10);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = "#8b4513";
  g.lineWidth = 2;
  g.strokeRect(26, 26, BOARD - 52, BOARD - 52);
  // centre ornament
  g.strokeStyle = "#9c572b";
  g.lineWidth = 2.5;
  for (const r of [46, 96]) {
    g.beginPath();
    g.arc(BOARD / 2, BOARD / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.arc(BOARD / 2, BOARD / 2, 12, 0, Math.PI * 2);
  g.fillStyle = "#c0392b";
  g.fill();
  // corner arrows
  g.strokeStyle = "#8b4513";
  g.lineWidth = 2;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const ox = sx === 1 ? 0 : BOARD;
    const oy = sy === 1 ? 0 : BOARD;
    g.beginPath();
    g.moveTo(ox + sx * 70, oy + sy * 70);
    g.lineTo(ox + sx * 150, oy + sy * 150);
    g.stroke();
  }
  // baselines
  for (const y of [75, BOARD - 75]) {
    g.beginPath();
    g.moveTo(85, y);
    g.lineTo(BOARD - 85, y);
    g.stroke();
    for (const x of [85, BOARD - 85]) {
      g.beginPath();
      g.arc(x, y, 12, 0, Math.PI * 2);
      g.fillStyle = "#e67e22";
      g.fill();
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const COIN_COLORS = {
  white: { body: "#f5efe0", ring: "#cdbf9c" },
  black: { body: "#2a2a33", ring: "#4d4d5a" },
  queen: { body: "#d9363e", ring: "#8f1f26" },
} as const;

/* ---------------------------------------------------------------- one coin (position comes from the physics refs) */
function CoinSlot({ index, coinsRef, shadow }: { index: number; coinsRef: MutableRefObject<CarromCoin[]>; shadow: THREE.Texture }) {
  const group = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const sink = useRef(1);
  const lastType = useRef<string>("");

  useFrame((_, dt) => {
    const g = group.current;
    const coin = coinsRef.current[index];
    if (!g) return;
    if (!coin) {
      g.visible = false;
      return;
    }
    if (coin.type !== lastType.current) {
      lastType.current = coin.type;
      bodyMat.current?.color.set(COIN_COLORS[coin.type].body);
      ringMat.current?.color.set(COIN_COLORS[coin.type].ring);
    }
    // pocketed coins shrink and sink instead of vanishing
    sink.current = coin.pocketed ? Math.max(0, sink.current - dt * 5) : 1;
    g.visible = sink.current > 0.02;
    const r = coin.radius * K;
    g.position.set(toW(coin.x), 0.06 - (1 - sink.current) * 0.15, toW(coin.y));
    g.scale.setScalar(r * sink.current * 3.33);
  });

  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.057} raycast={() => null}>
        <circleGeometry args={[0.5, 20]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <mesh position-y={0}>
        <cylinderGeometry args={[0.3, 0.3, 0.12, 28]} />
        <meshStandardMaterial ref={bodyMat} color="#f5efe0" roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.062} raycast={() => null}>
        <ringGeometry args={[0.15, 0.22, 28]} />
        <meshBasicMaterial ref={ringMat} color="#cdbf9c" />
      </mesh>
    </group>
  );
}

function Striker({ strikerRef, shadow }: { strikerRef: MutableRefObject<CarromStriker>; shadow: THREE.Texture }) {
  const group = useRef<THREE.Group>(null);
  const sink = useRef(1);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const s = strikerRef.current;
    sink.current = s.active ? 1 : Math.max(0, sink.current - dt * 5);
    g.visible = sink.current > 0.02;
    g.position.set(toW(s.x), 0.085 - (1 - sink.current) * 0.15, toW(s.y));
    g.scale.setScalar(s.radius * K * sink.current * 2.94);
  });
  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.083} raycast={() => null}>
        <circleGeometry args={[0.52, 22]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.34, 0.34, 0.14, 32]} />
        <meshStandardMaterial color="#f39c12" roughness={0.3} metalness={0.15} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.073} raycast={() => null}>
        <ringGeometry args={[0.16, 0.24, 28]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.074} raycast={() => null}>
        <circleGeometry args={[0.1, 20]} />
        <meshBasicMaterial color="#c0392b" />
      </mesh>
    </group>
  );
}

/** Dotted aim guide that follows the pull-back, getting redder with more power. */
function AimGuide({ strikerRef, aim, visible }: { strikerRef: MutableRefObject<CarromStriker>; aim: { dx: number; dy: number } | null; visible: boolean }) {
  const group = useRef<THREE.Group>(null);
  const dots = useRef<(THREE.Mesh | null)[]>([]);
  const COUNT = 22;
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = visible && !!aim;
    if (!g.visible || !aim) return;
    const s = strikerRef.current;
    const len = Math.hypot(aim.dx, aim.dy);
    const nx = aim.dx / (len || 1);
    const ny = aim.dy / (len || 1);
    const power = Math.min(1, len / 180);
    const color = new THREE.Color().setHSL(0.14 - power * 0.14, 0.95, 0.5);
    dots.current.forEach((m, i) => {
      if (!m) return;
      const d = 26 + i * 17; // board units from the striker
      m.position.set(toW(s.x + nx * d), 0.12, toW(s.y + ny * d));
      const inPower = d < len + 20;
      (m.material as THREE.MeshBasicMaterial).color.copy(color);
      (m.material as THREE.MeshBasicMaterial).opacity = inPower ? 0.95 : Math.max(0.08, 0.5 - (d - len) / 320);
      m.scale.setScalar(inPower ? 1.15 : 0.8);
    });
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh key={i} ref={(m) => { dots.current[i] = m; }} rotation-x={-Math.PI / 2} raycast={() => null}>
          <circleGeometry args={[0.085, 12]} />
          <meshBasicMaterial transparent />
        </mesh>
      ))}
    </group>
  );
}

function Scene(props: Carrom3DBoardProps) {
  const { coinsRef, strikerRef, aimVector, isDraggingAim, isSimulating, isMyTurn, renderKey, onAimStart, onAimMove, onAimEnd } = props;
  const shadow = useBlobShadowTexture();
  const board = useMemo(() => makeBoardTexture(), []);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    invalidate();
  }, [renderKey, isSimulating, isDraggingAim, aimVector, isMyTurn, invalidate]);

  const toBoard = (e: ThreeEvent<PointerEvent>): [number, number] => [e.point.x / K + BOARD / 2, e.point.z / K + BOARD / 2];

  return (
    <>
      <ambientLight intensity={0.95} />
      <hemisphereLight args={["#fff6e6", "#8a6a44", 0.45]} />
      <directionalLight position={[3, 10, 6]} intensity={1.5} />
      {/* wooden frame + playing surface */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[11, 0.5, 11]} />
        <meshStandardMaterial color="#3e2410" roughness={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial map={board} roughness={0.45} />
      </mesh>
      {/* raised rim */}
      {[
        [0, 4.78, 10, 0.44], [0, -4.78, 10, 0.44], [4.78, 0, 0.44, 9.12], [-4.78, 0, 0.44, 9.12],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x as number, 0.1, z as number]}>
          <boxGeometry args={[w as number, 0.32, d as number]} />
          <meshStandardMaterial color="#6b3d17" roughness={0.45} />
        </mesh>
      ))}
      {/* pockets */}
      {POCKETS.map(([px, py]) => (
        <group key={`${px}${py}`} position={[toW(px), 0.012, toW(py)]}>
          <mesh rotation-x={-Math.PI / 2}>
            <circleGeometry args={[POCKET_R * K, 28]} />
            <meshBasicMaterial color="#0b0603" />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
            <ringGeometry args={[POCKET_R * K - 0.02, POCKET_R * K + 0.07, 28]} />
            <meshStandardMaterial color="#a9834f" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: MAX_COINS }, (_, i) => (
        <CoinSlot key={i} index={i} coinsRef={coinsRef} shadow={shadow} />
      ))}
      <Striker strikerRef={strikerRef} shadow={shadow} />
      <AimGuide strikerRef={strikerRef} aim={aimVector} visible={isDraggingAim && !isSimulating && isMyTurn} />
      {/* invisible touch surface: converts finger / mouse positions into board coordinates */}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.3}
        onPointerDown={(e) => {
          (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
          const [x, y] = toBoard(e);
          onAimStart(x, y);
        }}
        onPointerMove={(e) => {
          const [x, y] = toBoard(e);
          onAimMove(x, y);
        }}
        onPointerUp={() => onAimEnd()}
        onPointerCancel={() => onAimEnd()}
      >
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

export default function Carrom3DBoard(props: Carrom3DBoardProps) {
  const animate = props.isSimulating || props.isDraggingAim;
  return (
    <div className="max-w-[480px] mx-auto">
      <div className="relative aspect-square rounded-2xl overflow-hidden border-4 border-amber-950 shadow-inner bg-gradient-to-b from-amber-100/30 to-amber-900/30">
        <Canvas
          frameloop={animate ? "always" : "demand"}
          dpr={[1, 1.75]}
          camera={{ position: [0, 14.4, 11.2], fov: 42, near: 0.1, far: 60 }}
          onCreated={({ camera }) => camera.lookAt(0, 0, 0.3)}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          style={{ touchAction: "none" }}
        >
          <Scene {...props} />
        </Canvas>
      </div>
    </div>
  );
}
