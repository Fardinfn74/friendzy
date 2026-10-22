import { useMemo } from "react";
import * as THREE from "three";

/** Soft round "contact shadow" texture: far cheaper than real shadow maps and fine on phones. */
export function useBlobShadowTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
}

/** Small text label drawn into a texture (avoids downloading fonts). */
export function makeLabelTexture(text: string, color = "#f6e7c8") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.font = "bold 40px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
