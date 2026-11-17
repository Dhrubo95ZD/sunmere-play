// Buildings from the concept sheet: guild hall, ranger lodge, bazaar, treehouse, forge, watchtower outpost,
// ruins, foundry. Each returns { builder, colliders: [{x,z,hw,hd,rot}|{x,z,r}], fires, smokes, lanterns, glows }.
import * as THREE from 'three';
import { Builder, rbox, box, cyl, cone, sphere, torus, lathe, extrude, tube, gear, arcShape, lumpy, ico, card, prism, V3, lerp, sstep, rgb } from './kit.js';
import { addRock, addTuft, crystalCluster } from './trees.js';
import { lanternBuilder } from './dynamic.js';

const PI = Math.PI;
const W = (x) => x; // readability

// ------------------------------------------------------------------ pieces
// irregular stone foundation ring along a rectangle
function foundation(b, w, d, h = 0.6, mat = 'stoneLarge', seed = 1) {
  b.add(rbox(w + 0.3, h, d + 0.3, 0.08), mat, { p: [0, h / 2 - 0.1, 0], c: '#d8d0c0', ao: { y0: -0.1, y1: h, min: 0.7 } });
  // chunky corner stones
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rbox(0.55, h + 0.15, 0.55, 0.08), 'stoneLarge', { p: [sx * (w / 2 + 0.05), (h + 0.15) / 2 - 0.1, sz * (d / 2 + 0.05)], c: '#e8e0d0' });
}

function gableRoof(b, w, d, h, mat, { over = 0.45, thick = 0.16, ridge = 'beam', y0 = 0, x0 = 0, z0 = 0, cap = true } = {}) {
  const half = w / 2 + over;
  const slope = Math.hypot(half, h);
  const ang = Math.atan2(h, half);
  for (const sx of [-1, 1]) {
    b.add(box(slope, thick, d + over * 2), mat, { p: [x0 + sx * half / 2, y0 + h / 2, z0], r: [0, 0, -sx * ang], c: 0xffffff, us: 0.45, uv: 'box' });
    // underside boards
    b.add(box(slope, 0.04, d + over * 2), 'woodDark', { p: [x0 + sx * half / 2, y0 + h / 2 - thick * 0.55, z0], r: [0, 0, -sx * ang], c: '#c8b8a0' });
  }
  if (cap) b.add(cyl(0.13, 0.13, d + over * 2 + 0.1, 8), ridge, { p: [x0, y0 + h + 0.06, z0], r: [PI / 2, 0, 0], c: 0xffffff });
  return ang;
}

function gableWall(b, w, h, z, mat, y0) {
  const g = prism(w, h, 0.2);
  b.add(g, mat, { p: [0, y0, z], c: '#f0e8d8', uv: 'box' });
}

function windowArch(b, x, y, z, rotY = 0, w = 0.8, h = 1.3, frame = 'woodDark', glass = 'glassWarm') {
  const s = arcShape(w, h, w / 2);
  const g = extrude(s, 0.06, 0.0, 12);
  b.add(g, glass, { p: [x, y - h / 2, z], r: [0, rotY, 0], c: 0xffffff });
  // frame: arch ring + sill
  const fr = new THREE.Shape(s.getPoints(24).map((p) => new THREE.Vector2(p.x * 1.18, (p.y - h / 2) * 1.1 + h / 2)));
  fr.holes.push(new THREE.Path(s.getPoints(24).reverse()));
  b.add(extrude(fr, 0.14, 0.02, 12), frame, { p: [x, y - h / 2, z], r: [0, rotY, 0], c: 0xffffff });
  const dz = 0.1;
  b.add(box(w * 1.35, 0.1, 0.28), frame, { p: [x + Math.sin(rotY) * dz, y - h / 2 - 0.05, z + Math.cos(rotY) * dz], r: [0, rotY, 0], c: 0xffffff });
  // two vertical mullions
  for (const sx of [-0.25, 0.25]) b.add(box(0.035, h * 0.8, 0.08), frame, { p: [x + Math.cos(rotY) * sx * w, y - h * 0.08, z - Math.sin(rotY) * sx * w], r: [0, rotY, 0], c: 0xffffff });
}

function windowSquare(b, x, y, z, rotY = 0, w = 0.75, h = 0.85, frame = 'woodDark') {
  b.add(box(w, h, 0.06), 'glassWarm', { p: [x, y, z], r: [0, rotY, 0], c: 0xffffff });
  const ox = Math.cos(rotY), oz = -Math.sin(rotY);
  for (const sx of [-1, 1]) b.add(box(0.1, h + 0.1, 0.16), frame, { p: [x + ox * sx * (w / 2 + 0.03), y, z + oz * sx * (w / 2 + 0.03)], r: [0, rotY, 0], c: 0xffffff });
  for (const sy of [-1, 1]) b.add(box(w + 0.2, 0.1, 0.18), frame, { p: [x, y + sy * (h / 2 + 0.03), z], r: [0, rotY, 0], c: 0xffffff });
  b.add(box(0.035, h, 0.08), frame, { p: [x, y, z], r: [0, rotY, 0], c: 0xffffff });
  // shutters
  for (const sx of [-1, 1]) b.add(box(w * 0.5, h + 0.05, 0.05), 'wood', { p: [x + ox * sx * (w * 0.78), y, z + oz * sx * (w * 0.78) + Math.cos(rotY) * 0.04], r: [0, rotY + sx * 0.25, 0], c: '#c8a070', us: 1.2 });
}

function door(b, x, y, z, rotY = 0, w = 1.15, h = 2.2, arched = true) {
  const s = arched ? arcShape(w, h, w / 2) : arcShape(w, h, 0.01);
  b.add(extrude(s, 0.1, 0.01, 12), 'woodDark', { p: [x, y, z], r: [0, rotY, 0], c: '#e8d8c0', us: 0.9, boxuv: true });
  const ox = Math.cos(rotY), oz = -Math.sin(rotY), fx = Math.sin(rotY) * 0.07, fz = Math.cos(rotY) * 0.07;
  for (const yy of [0.4, 1.2, 1.85]) b.add(box(w * 0.92, 0.07, 0.04), 'iron', { p: [x + fx, y + yy, z + fz], r: [0, rotY, 0], c: 0xffffff });
  b.add(torus(0.07, 0.015, 6, 12), 'gold', { p: [x + ox * 0.3 + fx * 1.4, y + 1.05, z + oz * 0.3 + fz * 1.4], r: [0, rotY, 0], c: 0xffffff });
  // stone frame
  const fr = new THREE.Shape(s.getPoints(24).map((p) => new THREE.Vector2(p.x * 1.22, p.y * 1.07)));
  fr.holes.push(new THREE.Path(s.getPoints(24).reverse()));
  b.add(extrude(fr, 0.2, 0.02, 12), 'stone', { p: [x - fx * 0.3, y, z - fz * 0.3], r: [0, rotY, 0], c: '#f0e8d8', boxuv: true });
}

function chimney(b, x, z, y0, h, mat = 'stoneDark') {
  b.add(rbox(0.7, h, 0.7, 0.05), mat, { p: [x, y0 + h / 2, z], c: '#e0d8c8' });
  b.add(rbox(0.85, 0.18, 0.85, 0.04), mat, { p: [x, y0 + h + 0.05, z], c: '#f0e8d8' });
  return [x, y0 + h + 0.2, z];
}

function barrel(b, x, y, z, s = 1, rot = 0) {
  b.add(lathe([[0.001, 0], [0.26, 0], [0.32, 0.2], [0.33, 0.4], [0.32, 0.6], [0.26, 0.8], [0.001, 0.8]].map(([r, yy]) => [r * s, yy * s]), 14), 'wood', { p: [x, y, z], r: [0, rot, 0], c: 0xffffff, uv: 'box', us: 1.4 });
  for (const yy of [0.12, 0.4, 0.68]) b.add(torus(0.325 * s * (yy === 0.4 ? 1 : 0.94), 0.018 * s, 5, 18), 'iron', { p: [x, y + yy * s, z], r: [PI / 2, 0, 0], c: 0xffffff });
}
function crate(b, x, y, z, s = 1, rot = 0, mat = 'woodLight') {
  b.add(rbox(0.7 * s, 0.7 * s, 0.7 * s, 0.03), mat, { p: [x, y + 0.35 * s, z], r: [0, rot, 0], c: 0xffffff, us: 1.2 });
  const o = 0.36 * s;
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.74 * s, 0.07 * s, 0.07 * s), 'woodDark', { p: [x, y + 0.35 * s + sy * (o - 0.03 * s), z], r: [0, rot, 0], c: 0xffffff });
  b.add(box(0.07 * s, 0.85 * s, 0.07 * s), 'woodDark', { p: [x, y + 0.35 * s, z + 0.36 * s], r: [0, rot, 0.78], c: 0xffffff });
}

function bannerPole(b, x, z, h, mat = 'bannerSun', y0 = 0) {
  b.add(cyl(0.05, 0.06, h, 8), 'woodDark', { p: [x, y0 + h / 2, z], c: 0xffffff });
  b.add(cyl(0.03, 0.03, 0.9, 6), 'woodDark', { p: [x, y0 + h - 0.15, z + 0.0], r: [0, 0, PI / 2], c: 0xffffff });
  b.add(sphere(0.07, 10, 8), 'gold', { p: [x, y0 + h + 0.05, z], c: 0xffffff });
  for (const sx of [-0.45, 0.45]) b.add(sphere(0.045, 8, 6), 'gold', { p: [x + sx, y0 + h - 0.15, z], c: 0xffffff });
  // banner cloth (rippling): pinned at the top
  const g = card(0.8, 1.6, 4, 8);
  b.add(g, mat, { p: [x, y0 + h - 0.95, z + 0.02], uv: 'keep', c: 0xffffff, w: (xx, yy) => { const k = sstep(y0 + h - 0.2, y0 + h - 1.8, yy); return [0, 0.02 * k, 0, 0.12 * k]; } });
}

function flowerBox(b, x, y, z, rotY, w = 1.0, flowerMat = 'lavender') {
  b.add(box(w, 0.22, 0.28), 'wood', { p: [x, y, z], r: [0, rotY, 0], c: '#c8a070' });
  addTuft(b, flowerMat, [x, y + 0.08, z], w * 0.9, 0.42, rotY, 0xffffff, 2);
}

// ======================================================================
// GUILD HALL — stone hall with blue slate roof, gold trim, grand stairs
// ======================================================================
export function guildHall(seed = 1) {
  const b = new Builder(seed);
  const w = 11, d = 8, wallH = 4.6, base = 1.2;
  foundation(b, w, d, base, 'stoneLarge');
  // walls
  b.add(box(w, wallH, d), 'stone', { p: [0, base + wallH / 2, 0], c: '#f4ece0', ao: { y0: base, y1: base + 2, min: 0.78 } });
  // gold trim band + corner pilasters
  b.add(box(w + 0.12, 0.18, d + 0.12), 'gold', { p: [0, base + wallH - 0.1, 0], c: 0xffffff });
  b.add(box(w + 0.1, 0.12, d + 0.1), 'stoneDark', { p: [0, base + 0.06, 0], c: 0xffffff });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rbox(0.5, wallH + 0.1, 0.5, 0.04), 'stoneLarge', { p: [sx * w / 2, base + wallH / 2, sz * d / 2], c: '#fff8ec' });
  // roof (blue slate) with gable ends
  gableWall(b, w, 3.2, d / 2 - 0.1, 'stone', base + wallH);
  gableWall(b, w, 3.2, -d / 2 + 0.1, 'stone', base + wallH);
  b.add(box(w, 0.3, d), 'stone', { p: [0, base + wallH + 0.15, 0], c: 0xffffff });
  gableRoof(b, w, d, 3.2, 'slate', { y0: base + wallH, over: 0.6, ridge: 'gold' });
  // front gabled porch over the entrance
  const pz = d / 2;
  for (const sx of [-1, 1]) {
    b.add(cyl(0.22, 0.26, 3.3, 14), 'stoneLarge', { p: [sx * 1.6, base + 1.65, pz + 1.6], c: '#fff6ea' });
    b.add(cyl(0.32, 0.32, 0.2, 14), 'gold', { p: [sx * 1.6, base + 3.3, pz + 1.6], c: 0xffffff });
    b.add(rbox(0.6, 0.3, 0.6, 0.04), 'stoneLarge', { p: [sx * 1.6, base + 0.15, pz + 1.6], c: 0xffffff });
  }
  b.add(box(4.2, 0.35, 2.2), 'stone', { p: [0, base + 3.55, pz + 0.95], c: '#fff8ec' });
  b.add(box(4.3, 0.12, 2.3), 'gold', { p: [0, base + 3.4, pz + 0.95], c: 0xffffff });
  b.add(prism(4.4, 1.3, 2.4), 'stone', { p: [0, base + 3.72, pz + 0.95], c: '#fff4e8', uv: 'box' });
  gableRoof(b, 4.4, 2.4, 1.3, 'slate', { y0: base + 3.72, z0: pz + 0.95, over: 0.3, ridge: 'gold' });
  // a small square gold plaque on the porch gable (no disc, ring or halo)
  b.add(box(0.62, 0.42, 0.08), 'gold', { p: [0, base + 4.15, pz + 2.2], c: 0xffffff });
  // door
  door(b, 0, base, pz + 0.02, 0, 1.5, 2.8, true);
  // grand stairs with blue carpet
  for (let i = 0; i < 5; i++) {
    const sw = 4.4 + i * 0.5;
    b.add(rbox(sw, 0.25, 0.55, 0.03), 'stoneLarge', { p: [0, base - 0.12 - i * 0.24, pz + 2.6 + i * 0.5], c: '#f0e8dc' });
  }
  {
    const steps = 5, len = Math.hypot(steps * 0.5, steps * 0.24);
    b.add(box(1.6, 0.04, len + 0.6), 'carpetBlue', { p: [0, base - 0.55, pz + 3.4], r: [Math.atan2(0.24, 0.5), 0, 0], c: 0xffffff, us: [1, 1], uv: 'keep' });
  }
  // windows (round arches) along the walls
  for (const x of [-3.6, -1.9, 1.9, 3.6]) windowArch(b, x, base + 2.3, d / 2 + 0.03, 0, 0.85, 1.5, 'gold');
  for (const z of [-2, 1.6]) for (const sx of [-1, 1]) windowArch(b, sx * (w / 2 + 0.03), base + 2.3, z, sx * PI / 2, 0.85, 1.5, 'gold');
  // flower boxes
  for (const x of [-3.6, -1.9, 1.9, 3.6]) flowerBox(b, x, base + 1.35, d / 2 + 0.25, 0, 1.1);
  // chimneys (instead of towers)
  const smokes = [];
  for (const sx of [-1, 1]) { const top = chimney(b, sx * 3.6, -1.6, base + wallH + 0.5, 3.4, 'stoneDark'); smokes.push({ p: top, opts: { rate: 1.5, size: 1.0 } }); }
  // banners on poles either side of the stairs
  bannerPole(b, -3.4, pz + 4.2, 4.6, 'bannerSun', base - 1.2);
  bannerPole(b, 3.4, pz + 4.2, 4.6, 'bannerSun', base - 1.2);
  // wall banners
  for (const sx of [-1, 1]) {
    const g = card(0.9, 1.9, 3, 8);
    b.add(g, 'bannerSun', { p: [sx * 5.6, base + 3.0, d / 2 + 0.12], uv: 'keep', c: 0xffffff, w: (xx, yy) => [0, 0, 0, 0.05 * sstep(base + 3.9, base + 2.1, yy)] });
    b.add(cyl(0.03, 0.03, 1.1, 6), 'gold', { p: [sx * 5.6, base + 3.98, d / 2 + 0.14], r: [0, 0, PI / 2], c: 0xffffff });
  }
  // cypress-like shrubs
  for (const sx of [-1, 1]) {
    b.add(lumpy(cone(0.7, 3.4, 10), 0.08, 3, 3 + sx), 'coreTree', { p: [sx * 6.6, base - 1.2 + 1.7, d / 2 + 1.8], c: '#e0f0d0', uv: 'box' });
  }
  const lanterns = [{ p: [-1.6, base + 3.25, pz + 1.6], len: 0.5, color: 'yellow' }, { p: [1.6, base + 3.25, pz + 1.6], len: 0.5, color: 'yellow' }];
  return { builder: b, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.3, hd: d / 2 + 0.3 }, { x: -1.6, z: pz + 1.6, r: 0.4 }, { x: 1.6, z: pz + 1.6, r: 0.4 }], smokes, lanterns, glows: [{ p: [0, base + 1.4, pz + 0.6], color: 0xffc060, size: 3, intensity: 0.35 }] };
}

// ======================================================================
// COUNCIL HALL: the Brass Concord's long hall in Ledgerholm (dark stone, slate, brass trim, three chimneys)
// ======================================================================
export function councilHall(seed = 9) {
  const b = new Builder(seed);
  const w = 15, d = 8.5, wallH = 4.4, base = 0.9;
  foundation(b, w, d, base, 'stoneDark');
  b.add(box(w, wallH, d), 'stone', { p: [0, base + wallH / 2, 0], c: '#9a948c', ao: { y0: base, y1: base + 2, min: 0.75 } });
  b.add(box(w + 0.14, 0.2, d + 0.14), 'gold', { p: [0, base + wallH - 0.1, 0], c: '#c89a50' });
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) b.add(rbox(0.55, wallH + 0.1, 0.55, 0.04), 'stoneDark', { p: [sx * w / 2, base + wallH / 2, sz * d / 2], c: 0xffffff });
  gableWall(b, w, 3.0, d / 2 - 0.1, 'stone', base + wallH);
  gableWall(b, w, 3.0, -d / 2 + 0.1, 'stone', base + wallH);
  gableRoof(b, w, d, 3.0, 'slate', { y0: base + wallH, over: 0.6, ridge: 'gold' });
  const pz = d / 2;
  door(b, 0, base, pz + 0.02, 0, 1.8, 3.0, false);
  b.add(box(2.6, 0.22, 0.5), 'gold', { p: [0, base + 3.2, pz + 0.15], c: '#c89a50' });
  for (let i = 0; i < 4; i++) b.add(rbox(4.6 + i * 0.5, 0.24, 0.5, 0.03), 'stoneLarge', { p: [0, base - 0.12 - i * 0.22, pz + 0.5 + i * 0.5], c: '#a8a098' });
  for (const x of [-5.6, -3.4, 3.4, 5.6]) windowArch(b, x, base + 2.0, pz + 0.03, 0, 0.9, 1.6, 'gold');
  for (const z of [-2.2, 1.6]) for (const sx of [-1, 1]) windowArch(b, sx * (w / 2 + 0.03), base + 2.0, z, sx * PI / 2, 0.9, 1.6, 'gold');
  const smokes = [];
  for (const x of [-5, 0, 5]) { const top = chimney(b, x, -2.2, base + wallH + 0.5, 3.2, 'stoneDark'); smokes.push({ p: top, opts: { rate: 1.4, size: 1.0 } }); }
  const lanterns = [{ p: [-1.6, base + 2.9, pz + 0.4], len: 0.4, color: 'yellow' }, { p: [1.6, base + 2.9, pz + 0.4], len: 0.4, color: 'yellow' }];
  return { builder: b, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.3, hd: d / 2 + 0.3 }], smokes, lanterns, glows: [{ p: [0, base + 1.4, pz + 0.6], color: 0xffc060, size: 3, intensity: 0.35 }] };
}

// ======================================================================
// RANGER LODGE — timber cottage with mossy roof, awning and archery range
// ======================================================================
export function rangerLodge(seed = 2) {
  const b = new Builder(seed);
  const w = 7, d = 5.5, wallH = 3.0, base = 0.5;
  foundation(b, w, d, base, 'stoneDark');
  // lower stone course + timber frame + plank infill
  b.add(box(w, 1.0, d), 'stoneDark', { p: [0, base + 0.5, 0], c: '#e8e0d0' });
  b.add(box(w - 0.1, wallH - 1.0, d - 0.1), 'woodDark', { p: [0, base + 1 + (wallH - 1) / 2, 0], c: '#f0e0c8', us: 0.9 });
  const posts = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, d / 2], [0, -d / 2], [-w / 2, 0], [w / 2, 0]];
  for (const [x, z] of posts) b.add(box(0.28, wallH + 0.1, 0.28), 'beam', { p: [x, base + wallH / 2, z], c: 0xffffff });
  for (const z of [-d / 2, d / 2]) b.add(box(w + 0.3, 0.26, 0.3), 'beam', { p: [0, base + wallH, z], c: 0xffffff });
  for (const x of [-w / 2, w / 2]) b.add(box(0.3, 0.26, d + 0.3), 'beam', { p: [x, base + wallH, 0], c: 0xffffff });
  // diagonal braces (single direction per panel, never crossing)
  // (right panel only: a left brace at -w/4-0.4 ran straight across the lit front window at x -1.9 as a dark stripe)
  for (const x of [w / 4 + 0.4]) b.add(box(0.14, 1.9, 0.12), 'beam', { p: [x, base + 2.0, d / 2 + 0.05], r: [0, 0, x < 0 ? 0.6 : -0.6], c: 0xffffff });
  // moss-covered roof
  gableWall(b, w, 2.6, d / 2 - 0.05, 'woodDark', base + wallH);
  gableWall(b, w, 2.6, -d / 2 + 0.05, 'woodDark', base + wallH);
  gableRoof(b, w, d, 2.6, 'mossRoof', { y0: base + wallH, over: 0.7, thick: 0.3, ridge: 'beam' });
  // moss and ivy clumps draping
  for (let i = 0; i < 7; i++) {
    const x = b.r(-w / 2, w / 2);
    addTuft(b, 'ivy', [x, base + wallH - 0.1, d / 2 + 0.75], 1.1, 0.9, 0, 0xffffff, 1);
  }
  door(b, 0.8, base, d / 2 + 0.02, 0, 1.1, 2.15, true);
  windowSquare(b, -1.9, base + 1.7, d / 2 + 0.04, 0);
  windowSquare(b, -w / 2 - 0.04, base + 1.7, 0.8, -PI / 2);
  windowSquare(b, w / 2 + 0.04, base + 1.7, -0.8, PI / 2);
  // chimney + smoke
  const top = chimney(b, -w / 2 + 0.9, -d / 2 + 0.6, base, wallH + 3.3, 'stoneDark');
  // side awning (striped cloth) on poles
  for (const z of [0.8, 2.6]) b.add(cyl(0.07, 0.07, 2.4, 8), 'woodDark', { p: [w / 2 + 2.2, base + 1.2, z - 1.4], c: 0xffffff });
  {
    const g = card(2.4, 2.4, 6, 6);
    b.add(g, 'clothWind', { p: [w / 2 + 1.1, base + 2.55, -0.5], r: [-PI / 2, 0, 0.32], uv: 'keep', c: '#efe2c4', w: (x) => [0, 0, 0, 0.06 * sstep(w / 2, w / 2 + 2.3, x)] });
  }
  // firewood stack, barrels, archery target, bow rack
  for (let i = 0; i < 9; i++) b.add(cyl(0.1, 0.1, 1.1, 7), 'beam', { p: [-w / 2 - 0.45, base - 0.3 + 0.12 + Math.floor(i / 3) * 0.2, -1.0 + (i % 3) * 0.22], r: [PI / 2, 0, 0], c: '#e0c8a8' });
  barrel(b, w / 2 + 0.6, base - 0.3, 1.8, 1, 0.3);
  barrel(b, w / 2 + 1.3, base - 0.3, 2.2, 0.9, 1.1);
  crate(b, w / 2 + 1.1, base - 0.3, 1.0, 0.9, 0.4);
  // archery target on a stand
  const tx = 2.6, tz = d / 2 + 3.6;
  // a square straw bale with one plain square patch to aim at (no ringed target face, content rules)
  b.add(box(1.3, 1.2, 0.4), 'cloth', { p: [tx, 1.3, tz], c: '#d8c890' });
  b.add(box(0.42, 0.42, 0.42), 'cloth', { p: [tx + 0.12, 1.36, tz], c: '#a84a32' });
  for (const sx of [-1, 1]) b.add(box(0.1, 2.0, 0.1), 'woodDark', { p: [tx + sx * 0.4, 1.0, tz - 0.3], r: [0.2, 0, 0], c: 0xffffff });
  // a plain cloth awning over the door on two posts (no banner, no emblem: content rules)
  {
    const ax = 0.8, aw = 1.8, ad = 1.2, ay = base + 2.42, az = d / 2 + 0.58;
    b.add(card(aw, ad, 4, 3), 'clothWind', { p: [ax, ay, az], r: [-PI / 2 + 0.3, 0, 0], uv: 'keep', c: '#7a8a5a', w: [0, 0, 0, 0.03] });
    for (const sx of [-1, 1]) b.add(cyl(0.045, 0.05, ay - 0.2, 8), 'woodDark', { p: [ax + sx * (aw / 2 - 0.06), 0.2 + (ay - 0.2) / 2 - 0.08, az + 0.52], c: 0xffffff });
    b.add(box(aw, 0.06, 0.06), 'beam', { p: [ax, ay - 0.2, az + 0.54], c: 0xffffff });
  }
  return { builder: b, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.3, hd: d / 2 + 0.3 }, { x: tx, z: tz, r: 0.8 }], smokes: [{ p: top, opts: { rate: 2, size: 0.9 } }], lanterns: [{ p: [-0.2, base + 2.6, d / 2 + 0.5], len: 0.4, color: 'yellow' }] };
}

// ======================================================================
// BAZAAR — sandstone trader's house with cloth canopies
// ======================================================================
export function bazaar(seed = 3) {
  const b = new Builder(seed);
  const w = 6.5, d = 5, wallH = 3.4, base = 0.35;
  foundation(b, w, d, base, 'sandstone');
  b.add(box(w, wallH, d), 'sandstone', { p: [0, base + wallH / 2, 0], c: '#fff4e4' });
  b.add(box(w + 0.3, 0.3, d + 0.3), 'sandstone', { p: [0, base + wallH + 0.1, 0], c: '#fff8ec' });
  // flat roof parapet with crenels
  for (let i = 0; i < 9; i++) b.add(rbox(0.4, 0.45, 0.4, 0.04), 'sandstone', { p: [-w / 2 + 0.2 + i * (w - 0.4) / 8, base + wallH + 0.45, d / 2 + 0.05], c: '#fff8ec' });
  // painted red band with gold diamonds
  b.add(box(w + 0.04, 0.3, d + 0.04), 'cloth', { p: [0, base + wallH - 0.5, 0], c: '#9c2a2a' });
  for (let i = 0; i < 7; i++) b.add(rbox(0.16, 0.16, 0.04, 0.01), 'gold', { p: [-w / 2 + 0.6 + i * 0.88, base + wallH - 0.5, d / 2 + 0.03], r: [0, 0, PI / 4], c: 0xffffff });
  door(b, 0, base, d / 2 + 0.02, 0, 1.2, 2.3, true);
  windowArch(b, -2.0, base + 1.8, d / 2 + 0.03, 0, 0.7, 1.1, 'woodDark');
  windowArch(b, 2.0, base + 1.8, d / 2 + 0.03, 0, 0.7, 1.1, 'woodDark');
  // big striped canopy over the front on gold-capped poles
  for (const sx of [-1, 1]) {
    b.add(cyl(0.07, 0.08, 3.4, 10), 'woodDark', { p: [sx * 3.0, 1.7, d / 2 + 2.4], c: 0xffffff });
    b.add(sphere(0.1, 10, 8), 'gold', { p: [sx * 3.0, 3.48, d / 2 + 2.4], c: 0xffffff });
  }
  for (let i = 0; i < 6; i++) {
    const g = card(1.1, 2.7, 2, 6);
    b.add(g, 'clothWind', { p: [-2.75 + i * 1.1, 3.1, d / 2 + 1.15], r: [-PI / 2 + 0.38, 0, 0], uv: 'keep', c: i % 2 ? '#9c2a2a' : '#efe2c4', w: (x, y, z) => [0, 0, 0, 0.07 * sstep(d / 2, d / 2 + 2.5, z)] });
  }
  // scalloped valance
  for (let i = 0; i < 12; i++) b.add(sphere(0.2, 8, 6, 0, PI * 2, PI / 2, PI / 2), 'cloth', { p: [-2.9 + i * 0.53, 2.62, d / 2 + 2.45], s: [1.2, 1, 0.3], c: i % 2 ? '#9c2a2a' : '#efe2c4' });
  // goods: vases, carpet roll, books, crates
  for (let i = 0; i < 3; i++) {
    const x = -2.4 + i * 0.6;
    b.add(lathe([[0.001, 0], [0.18, 0.02], [0.28, 0.25], [0.22, 0.5], [0.12, 0.62], [0.14, 0.7], [0.001, 0.7]], 14), 'cloth', { p: [x, 0, d / 2 + 1.0], c: ['#3a7a6a', '#3a5a9a', '#e0d8c0'][i] }); // (review) glazed jars, no amber (amber jars read as wine)
    b.add(torus(0.25, 0.02, 5, 16), 'gold', { p: [x, 0.28, d / 2 + 1.0], r: [PI / 2, 0, 0], c: 0xffffff });
  }
  b.add(cyl(0.18, 0.18, 1.4, 12), 'carpetRed', { p: [2.3, 0.18, d / 2 + 1.2], r: [0, 0.3, PI / 2], c: 0xffffff });
  b.add(box(1.8, 0.03, 1.2), 'carpetRed', { p: [0, 0.03, d / 2 + 1.6], c: 0xffffff, uv: 'keep', us: [1, 1] });
  crate(b, 2.6, 0, d / 2 + 0.5, 0.8, 0.2);
  for (let i = 0; i < 4; i++) b.add(rbox(0.32, 0.08, 0.24, 0.02), 'leather', { p: [2.6, 0.6 + i * 0.085, d / 2 + 0.5], r: [0, i * 0.4, 0], c: ['#7a2a1a', '#2a4a7a', '#5a3a1a', '#3a5a2a'][i] });
  bannerPole(b, -w / 2 - 0.6, d / 2 + 0.5, 3.6, 'bannerRed', 0);
  return { builder: b, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.3, hd: d / 2 + 0.3 }, { x: -3, z: d / 2 + 2.4, r: 0.3 }, { x: 3, z: d / 2 + 2.4, r: 0.3 }], lanterns: [{ p: [-1.8, 2.75, d / 2 + 2.3], len: 0.35, color: 'yellow' }, { p: [1.8, 2.75, d / 2 + 2.3], len: 0.35, color: 'yellow' }] };
}

// ======================================================================
// FORGE — open smithy with anvil, glowing hearth and bellows
// ======================================================================
export function forge(seed = 4) {
  const b = new Builder(seed);
  const w = 5.5, d = 4.2;
  b.add(rbox(w + 0.4, 0.25, d + 0.4, 0.05), 'cobble', { p: [0, 0.1, 0], c: 0xffffff });
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) b.add(box(0.3, 3.0, 0.3), 'beam', { p: [x, 1.6, z], c: 0xffffff });
  for (const z of [-d / 2, d / 2]) b.add(box(w + 0.3, 0.25, 0.3), 'beam', { p: [0, 3.1, z], c: 0xffffff });
  gableRoof(b, w, d, 1.8, 'shingleWood', { y0: 3.1, over: 0.6 });
  // back wall of stone with the hearth
  b.add(box(w, 3.0, 0.5), 'stoneDark', { p: [0, 1.6, -d / 2 + 0.1], c: '#e0d8c8' });
  b.add(rbox(1.8, 1.1, 1.3, 0.06), 'stoneLarge', { p: [-1.2, 0.75, -d / 2 + 0.8], c: '#d8d0c0' });
  b.add(rbox(1.2, 0.2, 0.9, 0.04), 'fire', { p: [-1.2, 1.32, -d / 2 + 0.85], c: 0xffffff });
  const top = chimney(b, -1.2, -d / 2 + 0.3, 3.0, 2.6, 'stoneDark');
  // anvil
  b.add(rbox(0.5, 0.5, 0.4, 0.04), 'beam', { p: [0.9, 0.5, 0.2], c: 0xffffff });
  b.add(extrude((() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.3, 0); s.quadraticCurveTo(0.55, 0.05, 0.62, 0.18); s.lineTo(0.3, 0.2); s.lineTo(-0.5, 0.2); s.closePath(); return s; })(), 0.25, 0.02, 8), 'iron', { p: [0.9, 0.78, 0.2], c: 0xffffff });
  // bellows + tools rack
  b.add(rbox(0.8, 0.3, 0.5, 0.1), 'leather', { p: [-2.2, 0.8, -d / 2 + 1.2], r: [0, 0, 0.2], c: '#7a4a2a' });
  for (let i = 0; i < 4; i++) b.add(cyl(0.025, 0.025, 1.2, 6), 'woodDark', { p: [w / 2 - 0.3, 1.4, -1.2 + i * 0.35], r: [0, 0, 0.1], c: 0xffffff });
  for (let i = 0; i < 4; i++) b.add(rbox(0.25, 0.12, 0.08, 0.02), 'iron', { p: [w / 2 - 0.3, 2.05, -1.2 + i * 0.35], c: 0xffffff });
  barrel(b, 2.2, 0.2, 1.4, 0.9);
  // weapons on display
  for (let i = 0; i < 3; i++) b.add(box(0.06, 1.1, 0.02), 'metal', { p: [-0.5 + i * 0.35, 1.8, -d / 2 + 0.38], r: [0, 0, 0.05], c: 0xffffff });
  return { builder: b, colliders: [{ x: 0, z: -d / 2 + 0.4, hw: w / 2, hd: 0.6 }, { x: -1.2, z: -d / 2 + 0.8, r: 0.9 }, { x: 0.9, z: 0.2, r: 0.5 }], fires: [{ p: [-1.2, 1.35, -d / 2 + 0.85], scale: 0.7 }], smokes: [{ p: top, opts: { rate: 3, size: 0.9, color: 0x6a645c } }] };
}

// ======================================================================
// TREEHOUSE — giant twisted tree with a cottage in its arms
// ======================================================================
export function treehouse(seed = 5) {
  const b = new Builder(seed);
  const barkC = (x, y, z, nx, ny) => { const k = lerp(0.6, 1.08, sstep(-0.2, 2, y)); const m = sstep(0.4, 0.9, ny) * 0.5; return [lerp(1, 0.85, m) * k, lerp(1, 1.5, m) * k, lerp(1, 0.55, m) * k]; };
  // massive trunk from twisted strands
  for (let s = 0; s < 4; s++) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, a = t * 2.4 + (s / 4) * PI * 2; const r = 0.9 * (1 - t * 0.35); pts.push(V3(Math.cos(a) * r, -0.4 + t * 7.5, Math.sin(a) * r)); }
    b.add(tube(pts, (t) => lerp(0.75, 0.42, t) * (1 + 0.8 * Math.pow(Math.max(0, 1 - t / 0.12), 2)), 10, 30), 'bark', { uv: 'keep', c: barkC, w: (x, y) => [0.004 * y * y, 0, 0, 0] });
  }
  // roots
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    const d = V3(Math.cos(a), 0, Math.sin(a));
    b.add(tube([d.clone().multiplyScalar(0.9).setY(1.2), d.clone().multiplyScalar(1.6).setY(0.4), d.clone().multiplyScalar(2.8).setY(0.05), d.clone().multiplyScalar(3.6).setY(-0.4)], (t) => 0.5 * (1 - t) + 0.12, 9, 14, { capEnd: false }), 'bark', { uv: 'keep', c: barkC });
  }
  // platform + cottage
  const py = 5.2;
  b.add(cyl(3.0, 3.0, 0.3, 20), 'wood', { p: [0, py, 0], c: '#e0c8a0', us: 0.8 });
  for (let i = 0; i < 20; i++) { const a = (i / 20) * PI * 2; b.add(cyl(0.05, 0.05, 0.9, 6), 'woodDark', { p: [Math.cos(a) * 2.9, py + 0.6, Math.sin(a) * 2.9], c: 0xffffff }); }
  b.add(torus(2.9, 0.06, 6, 40), 'woodDark', { p: [0, py + 1.05, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; b.add(tube([V3(Math.cos(a) * 0.9, py - 2.2, Math.sin(a) * 0.9), V3(Math.cos(a) * 2.6, py - 0.15, Math.sin(a) * 2.6)], 0.12, 6, 4), 'beam', { uv: 'keep', c: 0xffffff }); }
  b.add(box(3.2, 2.4, 2.6), 'plaster', { p: [0.3, py + 1.35, 0.5], c: '#fff4e0' });
  for (const [x, z] of [[-1.3, -0.8], [1.9, -0.8], [-1.3, 1.8], [1.9, 1.8]]) b.add(box(0.2, 2.5, 0.2), 'beam', { p: [x, py + 1.35, z], c: 0xffffff });
  b.add(box(3.4, 0.2, 2.8), 'beam', { p: [0.3, py + 2.6, 0.5], c: 0xffffff });
  gableWall(b, 3.2, 1.6, 1.8, 'plaster', py + 2.55);
  gableWall(b, 3.2, 1.6, -0.8, 'plaster', py + 2.55);
  gableRoof(b, 3.2, 2.6, 1.6, 'slateRed', { y0: py + 2.55, over: 0.45, ridge: 'beam' });
  door(b, 0.9, py + 0.15, 1.82, 0, 0.9, 1.8, true);
  windowArch(b, -0.5, py + 1.5, 1.83, 0, 0.6, 0.9, 'woodDark');
  // spiral stair around the trunk
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 1.6 + PI * 0.9, y = 0.3 + i * (py - 0.3) / 16;
    b.add(rbox(1.0, 0.1, 0.45, 0.03), 'wood', { p: [Math.cos(a) * 1.75, y, Math.sin(a) * 1.75], r: [0, -a, 0], c: '#e8d0a8' });
  }
  // canopy above
  const canopyC = V3(0, py + 6.5, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2;
    const r = i % 2 ? 3.6 : 2.6;
    const c = V3(Math.cos(a) * r, py + 4.2 + (i % 3) * 0.8, Math.sin(a) * r);
    b.add(tube([V3(0, py + 2.2, 0), c.clone().multiplyScalar(0.5).setY(py + 3.4), c], (t) => lerp(0.35, 0.08, t), 7, 8), 'bark', { uv: 'keep', c: barkC });
  }
  const res = { builder: b };
  // leaf clusters via card generator
  const nCl = 14;
  for (let i = 0; i < nCl; i++) {
    const a = (i / nCl) * PI * 2 + b.r(-0.2, 0.2);
    const rr = b.r(2.2, 4.4);
    const c = V3(Math.cos(a) * rr, py + 4.6 + b.r(0, 2.4), Math.sin(a) * rr);
    const R = b.r(1.8, 2.4);
    const core = lumpy(ico(R * 0.62, 2), R * 0.15, 1.1 / R, i * 7);
    b.add(core, 'coreTree', { p: [c.x, c.y, c.z], uv: 'box', us: 0.5, c: (x, y, z, nx, ny) => { const k = 0.55 + (ny * 0.5 + 0.5) * 0.45; return [k, k, k]; }, w: [0.06, 0.06, 0.01, 0] });
    for (let k = 0; k < 9; k++) {
      const dir = V3(b.r(-1, 1), b.r(-0.4, 1) + 0.2, b.r(-1, 1)).normalize();
      const pc = c.clone().addScaledVector(dir, R * b.r(0.55, 0.95));
      const nrm = pc.clone().sub(c).normalize().multiplyScalar(0.6).add(pc.clone().sub(canopyC).normalize().multiplyScalar(0.4)).normalize();
      const kk = 0.7 + Math.max(0, nrm.y) * 0.35;
      b.add(bbCardLocal(pc, R * b.r(1.2, 1.6), b.r(-0.35, 0.35), nrm), 'leafTree', { uv: 'keep', c: [kk, kk, kk], w: [0.06, 0.08, 0.05, 0] });
    }
  }
  crystalCluster(b, [2.4, 0, 2.2], 0.8, 'crystalTeal', 5, 5);
  crystalCluster(b, [-2.6, 0, 1.4], 0.55, 'crystalTeal', 6, 4);
  for (let i = 0; i < 6; i++) { const a = b.r(0, 6.28), d = b.r(3, 4.5); addTuft(b, i % 2 ? 'fern' : 'grassCard', [Math.cos(a) * d, 0, Math.sin(a) * d], 1.1, 0.7, b.r(0, 3)); }
  bannerPole(b, 2.2, 2.4, 3.4, 'bannerLeaf', py + 0.15);
  res.colliders = [{ x: 0, z: 0, r: 1.9 }];
  res.lanterns = [{ p: [2.6, py + 3.2, 1.2], len: 0.9, color: 'green' }, { p: [-2.4, py + 3.6, -1.4], len: 1.1, color: 'yellow' }, { p: [1.0, py + 4.0, -2.8], len: 1.0, color: 'green' }];
  res.glows = []; // (review) no teal glow round the crystals at the tree's foot (read as magic)
  return res;
}
import { bbCard as bbCardLocal } from './kit.js';

// ======================================================================
// WATCHTOWER OUTPOST (desert) — tower, tent, campfire, sandstone walls
// ======================================================================
export function watchtower(seed = 6) {
  const b = new Builder(seed);
  const H = 6.5;
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) b.add(box(0.26, H, 0.26), 'beam', { p: [x * (1 - 0.1), H / 2, z * (1 - 0.1)], r: [z * 0.05, 0, -x * 0.05], c: 0xffffff });
  for (const y of [1.6, 3.6]) for (const [x, z, r] of [[0, -1.1, 0], [0, 1.1, 0], [-1.1, 0, PI / 2], [1.1, 0, PI / 2]]) b.add(box(2.4, 0.18, 0.18), 'beam', { p: [x, y, z], r: [0, r, 0], c: 0xffffff });
  // one-direction braces per face (no X)
  for (const [x, z, r] of [[0, -1.12, 0], [0, 1.12, 0], [-1.12, 0, PI / 2], [1.12, 0, PI / 2]]) b.add(box(2.6, 0.12, 0.12), 'beam', { p: [x, 2.6, z], r: [0, r, 0.72], c: 0xffffff });
  b.add(box(3.0, 0.2, 3.0), 'wood', { p: [0, H, 0], c: '#e8d0a8' });
  for (const [x, z, r] of [[0, -1.45, 0], [0, 1.45, 0], [-1.45, 0, PI / 2], [1.45, 0, PI / 2]]) b.add(box(3.0, 0.8, 0.1), 'wood', { p: [x, H + 0.5, z], r: [0, r, 0], c: '#e0c8a0' });
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { const ph = z < 0 ? 2.6 : 2.2; b.add(box(0.14, ph, 0.14), 'beam', { p: [x, H + ph / 2, z], c: 0xffffff }); } // (RF.5) back posts up to the single pitch
  // (RF.5) a single-pitch canopy roof: one flat sloping slab on a timber rim, from above a plain square (the old hipped
  // slab's four corner hips drew an X round its flat top from straight above)
  b.add(box(3.5, 0.14, 3.5), 'cloth', { p: [0, H + 2.42, 0], r: [0.14, 0, 0], c: '#efe2c4' });
  b.add(box(3.6, 0.1, 0.12), 'wood', { p: [0, H + 2.42 - 0.25, 1.74], r: [0.14, 0, 0], c: '#e0c8a0' });
  // ladder
  for (let i = 0; i < 10; i++) b.add(box(0.6, 0.06, 0.06), 'woodDark', { p: [1.6, 0.4 + i * 0.6, 0], c: 0xffffff });
  for (const sz of [-0.3, 0.3]) b.add(box(0.07, H, 0.07), 'woodDark', { p: [1.62, H / 2, sz], c: 0xffffff });
  // lean-to tent with red trim
  for (const x of [3.5, 6.3]) { b.add(cyl(0.06, 0.06, 2.4, 8), 'woodDark', { p: [x, 1.2, 2.6], c: 0xffffff }); }
  {
    const g = card(3.4, 3.0, 6, 6);
    b.add(g, 'clothWind', { p: [4.9, 1.6, 1.6], r: [-PI / 2 + 0.6, 0, 0], uv: 'keep', c: '#efe2c4', w: (x, y) => [0, 0, 0, 0.04 * sstep(2.4, 1.0, y)] });
    b.add(box(3.4, 0.12, 0.05), 'cloth', { p: [4.9, 2.4, 2.65], c: '#9c2a2a' });
  }
  b.add(box(1.8, 0.04, 1.2), 'carpetRed', { p: [4.9, 0.03, 1.4], c: 0xffffff, uv: 'keep', us: [1, 1] });
  // campfire ring
  // (RF.5) two short straight rows of stones either side and three logs side by side: no ring round the fire, no crossed logs
  for (let i = 0; i < 6; i++) { const sx = i < 3 ? -1 : 1; addRock(b, [-2.6 + sx * b.r(0.6, 0.68), 0, 3.0 - 0.5 + (i % 3) * 0.5 + b.r(-0.06, 0.06)], [b.r(0.15, 0.24), 0.15, b.r(0.14, 0.22)], i + 3, { mat: 'rock', moss: 0 }); }
  for (const dz of [-0.15, 0, 0.15]) b.add(cyl(0.06, 0.06, 0.8, 6), 'beam', { p: [-2.6, 0.12, 3.0 + dz], r: [0, 0, PI / 2 + dz], c: '#5a3a20' });
  // crates and sandstone wall segments
  crate(b, 3.0, 0, -1.6, 0.9, 0.3);
  crate(b, 3.6, 0, -2.2, 0.75, 1.0);
  barrel(b, 2.2, 0, -2.6, 0.9);
  for (let i = 0; i < 5; i++) b.add(rbox(1.2, 1.0 - (i % 2) * 0.3, 0.7, 0.08), 'sandstone', { p: [-5 + i * 1.25, 0.4, -4.2], r: [0, b.r(-0.08, 0.08), 0], c: '#fff4e4' });
  bannerPole(b, -1.7, 1.9, 3.2, 'bannerSun', 0);
  return { builder: b, colliders: [{ x: 0, z: 0, hw: 1.4, hd: 1.4 }, { x: 4.9, z: 2.2, r: 1.3 }, { x: -2.5, z: -4.2, hw: 3.2, hd: 0.5 }], fires: [{ p: [-2.6, 0.1, 3.0], scale: 0.9 }] };
}

// ======================================================================
// RUINED WALL (desert / glade) — two broken pillar stumps and a low wall, no arch
// ======================================================================
export function ruinArch(seed = 7, { glade = false } = {}) {
  const b = new Builder(seed);
  const mat = glade ? 'stoneLarge' : 'sandstone';
  for (const sx of [-1, 1]) {
    for (let i = 0; i < (sx < 0 ? 5 : 3); i++) b.add(rbox(1.0, 0.75, 1.0, 0.06), mat, { p: [sx * 1.9 + b.r(-0.04, 0.04), 0.37 + i * 0.75, 0], r: [0, b.r(-0.06, 0.06), 0], c: glade ? '#e8e8e0' : '#fff4e4' });
  }
  // no arch (content rules): a low broken wall joins the two pillar stumps, square-topped and uneven
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2 - (i % 2); j++) b.add(rbox(1.0, 0.7, 0.8, 0.06), mat, { p: [-0.95 + i * 0.95 + b.r(-0.05, 0.05), 0.35 + j * 0.7, b.r(-0.05, 0.05)], r: [0, b.r(-0.08, 0.08), 0], c: glade ? '#e0e4d8' : '#fff0dc' });
  for (let i = 0; i < 7; i++) b.add(rbox(b.r(0.6, 1.0), b.r(0.4, 0.7), b.r(0.6, 1.0), 0.06), mat, { p: [b.r(-4, 4), 0.15, b.r(-2, 2.5)], r: [b.r(-0.3, 0.3), b.r(0, 3), b.r(-0.3, 0.3)], c: glade ? '#d8dcd0' : '#f8ead4' });
  if (glade) {
    // wisteria and ivy draping over the arch
    for (let i = 0; i < 4; i++) addTuft(b, 'wisteria', [-1.9 + b.r(-0.3, 0.3), 3.2 + b.r(-0.3, 0.3), 0.55], 1.1, 1.4, 0, 0xffffff, 1);
    for (let i = 0; i < 6; i++) addTuft(b, 'ivy', [b.r(-2.4, 2.4), b.r(0.2, 1.8), 0.55], 1.2, 1.0, 0, 0xffffff, 1);
  } else {
    for (let i = 0; i < 4; i++) addTuft(b, 'grassCard', [b.r(-3, 3), 0, b.r(-1.5, 2)], 0.9, 0.6, 0.5, '#e8d890');
  }
  return { builder: b, colliders: [{ x: -1.9, z: 0, r: 0.7 }, { x: 1.9, z: 0, r: 0.7 }], glows: [] };
}

// ======================================================================
// FOUNDRY — ruined brick works with stacks, gears and pipes (boss arena)
// ======================================================================
export function foundryRuins(seed = 8) {
  const b = new Builder(seed);
  // broken walls around a square yard
  const segs = [[-12, -12, 24, 0], [-12, 12, 9, 0], [5, 12, 7, 0], [-12, -12, 24, PI / 2], [12, -12, 10, PI / 2], [12, 4, 8, PI / 2]];
  for (const [x, z, L, r] of segs) {
    const n = Math.floor(L / 1.2);
    for (let i = 0; i < n; i++) {
      const h = 2.5 + Math.sin(i * 1.7 + x) * 1.2 + (i % 4 === 0 ? -1.4 : 0);
      const px = x + (r ? 0 : i * 1.2 + 0.6), pz = z + (r ? i * 1.2 + 0.6 : 0);
      b.add(box(1.22, h, 0.8), 'stoneDark', { p: [px, h / 2, pz], r: [0, r, 0], c: '#c88a70' });
    }
  }
  // furnace building with tall chimneys
  b.add(box(8, 6, 6), 'stoneDark', { p: [0, 3, -8], c: '#c8907a' });
  b.add(box(8.4, 0.4, 6.4), 'iron', { p: [0, 6.1, -8], c: 0xffffff });
  const smokes = [];
  // (review) square stacks of different heights, one set back: two equal round stacks with iron hoops read from straight
  // above as a pair of ringed discs (two eyes) over the glowing mouth, a face
  for (const [sx, sz, H] of [[-2.5, -9.4, 12], [2.5, -8.2, 9.5]]) {
    b.add(cyl(0.9, 1.2, H, 4), 'stoneDark', { p: [sx, 6 + H / 2, sz], r: [0, PI / 4, 0], c: '#b87a62' });
    for (const y of [8, 6 + H * 0.75]) { const r = 1.28 - (0.3 * (y - 6)) / H; b.add(cyl(r, r, 0.16, 4), 'iron', { p: [sx, y, sz], r: [0, PI / 4, 0], c: 0xffffff }); }
    smokes.push({ p: [sx, 6 + H + 0.2, sz], opts: { rate: 5, life: 5, size: 2.4, rise: 2.4, color: 0x3a3632, opacity: 0.55, spread: 0.6 } });
  }
  // glowing furnace mouth
  b.add(extrude(arcShape(2.8, 2.6, 1.4), 0.3, 0.05, 14), 'fire', { p: [0, 0, -4.9], c: 0xffffff });
  for (let i = 0; i < 5; i++) b.add(box(0.12, 2.4, 0.2), 'iron', { p: [-1.0 + i * 0.5, 1.2, -4.7], c: 0xffffff });
  // giant gears half buried + pipes
  b.add(gear(24, 2.6, 3.1, 0.5, { hole: 0, spokes: 0 }), 'copper', { p: [-7, 2.2, -2], r: [0.15, 0.4, 0.1], c: '#c8a080' });
  b.add(gear(28, 1.6, 1.8, 0.4, { hole: 0, spokes: 0 }), 'brass', { p: [7.5, 1.4, 3], r: [-0.3, -0.6, 0.2], c: '#c8a080' });
  b.add(gear(24, 1.0, 1.12, 0.3, { hole: 0 }), 'iron', { p: [-4, 0.4, 6], r: [PI / 2 - 0.2, 0, 0.3], c: 0xffffff });
  const pipe = (pts, r) => b.add(tube(pts.map((p) => V3(...p)), r, 10, 30), 'copper', { uv: 'keep', c: '#d0a080' });
  pipe([[4, 5.5, -5], [6, 5.5, -3], [8, 3, -1], [9, 0.5, 0]], 0.3);
  pipe([[-4, 4, -5], [-6, 4.5, -5.5], [-9, 3.5, -6], [-11, 1, -5]], 0.25);
  for (let i = 0; i < 6; i++) { crate(b, -9 + (i % 3) * 0.9, 0, 8 + Math.floor(i / 3) * 0.9, 0.85, i * 0.4, 'woodDark'); }
  for (let i = 0; i < 8; i++) addRock(b, [b.r(-10, 10), 0, b.r(-10, 10)], [b.r(0.3, 0.7), b.r(0.2, 0.4), b.r(0.3, 0.7)], i + 40, { moss: 0.1, tint: '#d8c8b8' });
  return { builder: b, colliders: [{ x: 0, z: -8, hw: 4.2, hd: 3.2 }, { x: -7, z: -2, r: 2.4 }, { x: 7.5, z: 3, r: 1.6 }, ...segs.map(([x, z, L, r]) => (r ? { x, z: z + L / 2, hw: 0.5, hd: L / 2 } : { x: x + L / 2, z, hw: L / 2, hd: 0.5 }))], smokes, fires: [{ p: [0, 0.6, -4.6], scale: 1.6 }], glows: [{ p: [0, 1.4, -4.4], color: 0xff7020, size: 6, intensity: 0.5 }] };
}
