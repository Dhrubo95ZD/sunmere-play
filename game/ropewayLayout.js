// The Makers' ropeway (Part Fifteen, P15.1): its upper station at the head of the Rainward Gorge's Slip, built into the
// gorge's group (World.buildRainward calls buildSlipStation first, so the gorge's dressing keeps clear of its posts), and
// the car the ropeway ride (game.js startRope) swings down the rope. The lower station in the Russet Weald is wealdLayout's.
//   the upper station: a square timber frame on four straight posts standing on the slope (each post down to its own ground),
//   level beams and level ties (never X bracing), a flat roof, the solid bull wheel lying flat under it (a plain disc); two
//   square timber trestle towers with straight legs and level ties carry the two ropes north up the cliff and over the
//   ridge, each with its solid disc sheaves; the car that has hung at the top station all this while, a square plank box on
//   one straight hanger. Checked from straight above (squares and parallel lines only), from the Slip and from the car.
import * as THREE from 'three';
import { Builder, box, cyl } from '../assets/kit.js';
import { ROPEWAY } from '/sunmere-play/shared/data.js';

const PI = Math.PI;
const TIMBER = '#4a3a2c', TIMBER_D = '#2e241c', IRON = '#34363a', ST = '#8a8a84';
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function beam(b, a, c, w, mat = 'beam', col = 0xffffff, d = w) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const L = _d.length(); _q.setFromUnitVectors(_up, _d.normalize());
  b.add(box(w, L, d), mat, { p: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], q: _q.clone(), c: col });
}

// the ropeway car: a square plank box with square windows and a flat roof, hung on one straight hanger from a small square
// carriage of two solid wheels on the rope (local z along the rope; the carriage's wheels at y = CAR_HANG)
export const CAR_HANG = 5.2;
function carBuilder(seed, worn = false) {
  const b = new Builder(seed), w = 2.0, d = 2.4, h = 2.0;
  b.add(box(w, h, d), 'wood', { p: [0, h / 2, 0], c: worn ? '#5a4a3a' : '#6a5440' });
  for (const sx of [-1, 1]) { b.add(box(0.06, 0.6, 1.4), worn ? 'wDark' : 'glassWarm', { p: [sx * (w / 2 + 0.01), h * 0.66, 0], c: worn ? '#2a2a28' : undefined }); b.add(box(0.08, 0.1, 1.6), 'beam', { p: [sx * (w / 2 + 0.03), h * 0.66 + 0.36, 0], c: TIMBER_D }); }
  b.add(box(w + 0.3, 0.14, d + 0.3), 'woodDark', { p: [0, h + 0.07, 0], c: TIMBER_D });
  b.add(box(0.16, 2.6, 0.16), 'wIron', { p: [0, h + 1.4, 0], c: IRON }); // the one straight hanger
  b.add(box(0.5, 0.95, 1.4), 'wIron', { p: [0, h + 3.12, 0], c: '#3a3c40' }); // (tall enough to hide the wheels: two round humps over the box read as ears)
  for (const sz of [-1, 1]) b.add(cyl(0.26, 0.26, 0.12, 14), 'wIron', { p: [0, h + 3.2, sz * 0.5], r: [0, 0, PI / 2], c: '#2e3034' });
  return b;
}
// the car for the ride (an Object3D, its origin at the car's floor)
export function ropeCarMesh(seed = 2590) { return carBuilder(seed).build(); }

// a square timber trestle tower: four straight legs, level ties at three heights (never X bracing), a solid square cap
// with the solid disc sheaves set on it along the rope's run (local z)
function tower(seed, Ht, gauge) {
  const b = new Builder(seed), s = 1.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.32, Ht + 1, 0.32), 'beam', { p: [sx * s, (Ht - 1) / 2, sz * s], c: TIMBER_D }); // (a metre into the slope)
  for (const y of [Ht * 0.3, Ht * 0.62, Ht - 0.3]) for (const sz of [-1, 1]) { b.add(box(s * 2 + 0.3, 0.22, 0.22), 'beam', { p: [0, y, sz * s], c: TIMBER }); b.add(box(0.22, 0.22, s * 2 + 0.3), 'beam', { p: [sz * s, y, 0], c: TIMBER }); }
  b.add(box(gauge + 1.4, 0.5, s * 2 + 0.6), 'wood', { p: [0, Ht + 0.25, 0], c: '#5e4a38' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.add(cyl(0.4, 0.4, 0.14, 14), 'wIron', { p: [sx * gauge / 2, Ht + 0.72, sz * 0.75], r: [0, 0, PI / 2], c: '#3a3c40' }); b.add(box(0.1, 0.5, 0.2), 'wIron', { p: [sx * gauge / 2 + 0.12, Ht + 0.6, sz * 0.75], c: IRON }); }
  return res(b, { colliders: [{ x: 0, z: 0, hw: s + 0.3, hd: s + 0.3 }] });
}

// the upper station: built in world coordinates (each post to its own ground), so it is placed at the origin and moved into
// the gorge's own group. Sets W.slipRope = { x, gauge, run: [[z, y], ...] } (the rope's run from the bull wheel north,
// the same shape as the Weald's W.wealdRope) and W.slipCar (the parked car)
export function buildSlipStation(W) {
  const P = ROPEWAY.slip.pad, g = ROPEWAY.slip.gauge, H = (x, z) => W.terrain.height(x, z);
  const hw = 3.6, hd = 3.4, cx = P.x, cz = P.z;
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [cx + sx * hw, cz + sz * hd]);
  const top = Math.max(...corners.map(([x, z]) => H(x, z))) + 6; // (the roof beams level, 6 m over the highest corner: the car hangs clear of the slope behind)
  const b = new Builder(2580);
  for (const [x, z] of corners) {
    const y0 = H(x, z) - 0.4;
    b.add(box(0.42, top - y0, 0.42), 'beam', { p: [x, (top + y0) / 2, z], c: TIMBER_D });
    b.add(box(0.8, 0.5, 0.8), 'stoneLarge', { p: [x, H(x, z) + 0.1, z], c: ST }); // a square stone footing
  }
  // level beams at the top, level ties a man's height over the highest ground (never X bracing)
  const tie = top - 2.4;
  for (const sz of [-1, 1]) for (const y of [top - 0.18, tie]) b.add(box(hw * 2 + 0.5, 0.32, 0.32), 'beam', { p: [cx, y, cz + sz * hd], c: TIMBER_D });
  for (const sx of [-1, 1]) for (const y of [top - 0.18, tie]) b.add(box(0.32, 0.32, hd * 2 + 0.5), 'beam', { p: [cx + sx * hw, y, cz], c: TIMBER_D });
  // the flat roof, its planks running one way, some fallen in at the back (laid parallel, never crossed)
  b.add(box(hw * 2 + 1.2, 0.26, hd * 2 + 1.2), 'woodDark', { p: [cx, top + 0.12, cz], c: '#3e3226' });
  for (let i = 0; i < 6; i++) b.add(box(hw * 2 + 1.0, 0.08, 0.9), 'wood', { p: [cx, top + 0.29, cz - hd + 0.6 + i * 1.12], c: i % 2 ? '#5e4a38' : '#54422e' });
  // the bull wheel lying flat under the roof (a solid disc, no spokes, no rim ring) on its iron king post from the roof
  const wy = top - 1.3;
  b.add(cyl(g / 2 + 0.2, g / 2 + 0.2, 0.36, 28), 'wIron', { p: [cx, wy, cz - 0.4], c: '#3a3c40' });
  b.add(box(0.36, 1.1, 0.36), 'wIron', { p: [cx, top - 0.65, cz - 0.4], c: IRON });
  // the brake lever box at the west side, its lever straight
  b.add(box(1.2, 1.0, 1.0), 'woodDark', { p: [cx - hw + 0.9, H(cx - hw + 0.9, cz + 1.6) + 0.5, cz + 1.6], c: '#4a3a2c' });
  b.add(box(0.12, 1.3, 0.12), 'wIron', { p: [cx - hw + 0.9, H(cx - hw + 0.9, cz + 1.6) + 1.6, cz + 1.6], r: [0.2, 0, 0], c: IRON });
  // the towers north up the slope to the cliff foot and on the cliff top, then the rope runs on over the ridge
  const towers = [];
  for (const [tz, th, sd] of [[-3066, 10, 2582], [-3101, 9, 2583]]) {
    const ty = H(cx, tz) - 0.2;
    const tw = tower(sd, th, g); const o = W.placeAt(tw, cx, ty, tz, 0); W.rainwardGroup.add(o);
    towers.push([tz, ty + th + 0.95]);
  }
  const wheel = [cz - 0.4, wy + 0.2];
  const run = [[cz - 0.4, wy + 0.2], ...towers, [-3150, towers[1][1] + 14]];
  for (const sx of [-1, 1]) for (let i = 0; i < run.length - 1; i++) beam(b, [cx + sx * g / 2, run[i][1], run[i][0]], [cx + sx * g / 2, run[i + 1][1], run[i + 1][0]], 0.07, 'wIron', '#2a2c30');
  const st = W.placeAt(res(b, { colliders: corners.map(([x, z]) => ({ x, z, r: 0.45 })).concat([{ x: cx - hw + 0.9, z: cz + 1.6, r: 0.8 }]) }), 0, 0, 0, 0);
  W.rainwardGroup.add(st);
  // the car that has hung at the top station all this while: on the east rope just north of the frame (its roof below the rope)
  const carZ = cz - hd - 2.2, ropeY = run[0][1] + ((run[1][1] - run[0][1]) * (carZ - run[0][0])) / (run[1][0] - run[0][0]);
  const car = W.placeAt(res(carBuilder(2584, true)), cx + g / 2, ropeY - CAR_HANG - 0.1, carZ, 0); W.rainwardGroup.add(car);
  W.slipRope = { x: cx, gauge: g, run, wheel };
  W.slipCar = car;
}
