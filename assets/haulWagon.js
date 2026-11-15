// The haul road's train (Part Fourteen, Chapter 45): the Makers' log haulier (the Tidewater Sound's tracked timber haulier,
// tidewaterMachines.js buildLogHaulier, in tarred iron) wound to work, with its timber wagon coupled behind it on a
// straight drawbar. The wagon: a flat plank bed on two side beams, four solid disc wheels (an offset square bolt plate on
// each, no spokes, no hub ring), plain upright stakes along both sides (no rails, no braces, nothing crossed) and, loaded,
// young poles laid side by side along the bed (never crossed, no bands across them). Square from above.
// Front is +z: the haulier at the origin, the wagon behind it. Used by the quest object on the stand between the Tide Mills
// (questObjects.js twhaul) and by the haul-road ride (game.js).
import * as THREE from 'three';
import { Builder, box, cyl } from './kit.js';
import { buildLogHaulier } from './tidewaterMachines.js';

const PI = Math.PI;
const WOOD = '#6a5440', WOOD2 = '#584634', BEAM = '#4a3a2c', IRON = '#46484a', POLE = '#7a6650';

// the wagon on its own (front at z 0, the bed running back to z -L), loaded with n young poles
export function buildHaulWagon(seed = 1700, load = 0) {
  const b = new Builder(seed), L = 4.2, W = 1.9, Y = 0.86, z0 = -0.5;
  // the drawbar forward to the haulier's tow plate, and its square coupling block
  b.add(box(0.16, 0.12, 1.2), 'wIron', { p: [0, 0.5, 0.05], c: IRON });
  b.add(box(0.34, 0.2, 0.3), 'wIron', { p: [0, 0.5, 0.6], c: IRON });
  // two side beams the length of the bed, the axles' bearing blocks under them
  for (const sx of [-1, 1]) b.add(box(0.18, 0.24, L + 0.1), 'wWood', { p: [sx * (W / 2 - 0.09), Y - 0.12, z0 - L / 2], c: BEAM });
  // the plank bed (the planks along the bed, a dark seam between each)
  const n = 6, pw = W / n;
  for (let i = 0; i < n; i++) b.add(box(pw - 0.03, 0.1, L), 'wWood', { p: [-W / 2 + pw * (i + 0.5), Y + 0.05, z0 - L / 2], c: i % 2 ? WOOD : WOOD2 });
  // a headboard and a tailboard of upright planks (square)
  for (const z of [z0 - 0.06, z0 - L + 0.06]) b.add(box(W, 0.42, 0.08), 'wWood', { p: [0, Y + 0.31, z], c: WOOD2 });
  // the axles and four solid wheels
  for (const az of [z0 - 0.75, z0 - L + 0.75]) {
    b.add(cyl(0.06, 0.06, W + 0.32, 8), 'wIron', { p: [0, 0.44, az], r: [0, 0, PI / 2], c: IRON });
    for (const sx of [-1, 1]) {
      b.add(cyl(0.44, 0.44, 0.14, 20), 'wWood', { p: [sx * (W / 2 + 0.14), 0.44, az], r: [0, 0, PI / 2], c: '#4e3e30' });
      b.add(cyl(0.445, 0.445, 0.06, 20), 'wIron', { p: [sx * (W / 2 + 0.14), 0.44, az], r: [0, 0, PI / 2], c: IRON }); // the iron tyre, flush with the disc
      b.add(box(0.05, 0.16, 0.16), 'wIron', { p: [sx * (W / 2 + 0.23), 0.5, az + 0.1], c: '#3a3c3e' }); // an offset bolt plate
    }
  }
  // plain upright stakes along both sides
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) b.add(box(0.1, 0.8, 0.1), 'wWood', { p: [sx * (W / 2 - 0.02), Y + 0.4, z0 - 0.4 - k * (L - 0.8) / 4], c: BEAM });
  // the load: young poles side by side along the bed, in two layers, tapering to the tip (all one way)
  for (let i = 0; i < load; i++) {
    const layer = Math.floor(i / 8), k = i % 8, r = 0.07 + b.r(0, 0.02);
    b.add(cyl(r * 0.6, r, L - 0.4, 7), 'wWood', { p: [-0.77 + k * 0.22 + layer * 0.11, Y + 0.18 + layer * 0.16, z0 - L / 2 + b.r(-0.1, 0.1)], r: [PI / 2, 0, 0], c: i % 3 ? POLE : '#8a7458' });
  }
  return b.build();
}

// the whole train: the haulier (wound: it ticks over, its stack smoking; unwound: still, chocks under its tracks) and the
// wagon behind it. userData.update(dt, t, speed) runs the haulier's tracks (speed in m/s)
export function buildHaulTrain({ wound = true, load = 0, seed = 1700 } = {}) {
  const g = new THREE.Group();
  const h = buildLogHaulier(0);
  g.add(h);
  const w = buildHaulWagon(seed, load);
  w.position.z = -1.75;
  g.add(w);
  if (!wound) {
    // timber chocks in front of and behind both tracks, and the wagon's drawbar let down onto the ground
    const c = new Builder(seed + 5);
    for (const sx of [-0.95, 0.95]) for (const z of [1.75, -1.75]) c.add(box(0.5, 0.26, 0.32), 'wWood', { p: [sx, 0.13, z], c: '#5a4634' });
    g.add(c.build());
  }
  const M = h.userData.machine;
  g.userData.haulier = h;
  g.userData.update = (dt, t, speed = 0) => { if (wound) M.update(dt, speed); };
  return g;
}
