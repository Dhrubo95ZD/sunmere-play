// A flat, soft-edged rectangular glow: the machine-safe stand-in for glowSprite on hulls, chests and heads.
// glowSprite is a camera-facing round halo, so on the front of a machine it reads as an eye (or a pair of eyes);
// this is a thin plane laid on the vent or slot it lights, so it reads as a light bar from the front and as a
// line (never a disc) from above. Same interface as glowSprite: .material.opacity, .scale, userData.update(dt, t).
//   slotGlow(color, w, h, intensity, { ry, rx, d }) : w x h metres, facing +z, then turned by ry (yaw) / rx (pitch);
//   d > 0 makes it a thin box (w x h x d) so it still shows edge-on, e.g. a pour stream or the heat over a molten bath
import * as THREE from 'three';
import { G } from '../engine/globals.js';

let TEX = null;
function slotTex() {
  if (TEX) return TEX;
  const W = 64, H = 32, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d'), img = x.createImageData(W, H);
  // separable falloff: a flat bright core that fades only near the edges, so the shape stays a rectangle
  const f = (u) => { const d = Math.min(u, 1 - u) / 0.32; const k = Math.min(1, d); return k * k * (3 - 2 * k); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = f((i + 0.5) / W) * f((j + 0.5) / H), o = (j * W + i) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.round(255 * a);
  }
  x.putImageData(img, 0, 0);
  TEX = new THREE.CanvasTexture(c);
  TEX.colorSpace = THREE.SRGBColorSpace;
  return TEX;
}

export function slotGlow(color = 0xff8a30, w = 0.5, h = 0.2, intensity = 0.6, { ry = 0, rx = 0, d = 0 } = {}) {
  const m = new THREE.MeshBasicMaterial({ map: slotTex(), color, transparent: true, opacity: intensity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const s = new THREE.Mesh(d > 0 ? new THREE.BoxGeometry(w, h, d) : new THREE.PlaneGeometry(w, h), m);
  s.rotation.set(rx, ry, 0, 'YXZ');
  s.renderOrder = 10;
  // a light never casts a shadow, even when a builder's finish() switches shadows on for every mesh
  Object.defineProperty(s, 'castShadow', { get: () => false, set() {} });
  Object.defineProperty(s, 'receiveShadow', { get: () => false, set() {} });
  const base = intensity, ph = Math.random() * 10;
  s.userData.update = (dt, t) => { m.opacity = base * (0.88 + 0.08 * Math.sin(t * 3.1 + ph) + 0.04 * Math.sin(t * 7.7 + ph)) * (1 + 0.9 * G.night.value); };
  s.userData.slot = { color, w, h };
  return s;
}
