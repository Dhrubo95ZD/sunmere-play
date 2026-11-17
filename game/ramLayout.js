// The Ram Engine's ground (LF.6, shared/ramEngine.js): the old Makers' yard below the cliffs south of Harrowmouth that the
// Wall-Layer has walled in, the dressed-stone yard road to it, the piles of ram weights and steam coal by the road, and
// the gates (two leaves each, hinged; cracked and broken by the ram as the tally says). Built into the valley's group by
// World (buildRamYard, called after buildSettlements and before the scatter is planted, so no tree or rock grows on it).
//   the yard: a square of coursed stone walls with a flat coping, an inner wall across it; the yard gate in a square
//   gatehouse of two square towers under one flat stone lintel (no arch); the inner gate between two square posts under a
//   flat timber lintel; two square wicket doors in the north wall either side of the gatehouse (the Yard Menders come out
//   of them); dressed stone blocks stacked in square piles inside, laid parallel. Checked from straight above: squares and
//   parallel lines only, the road's slabs in straight courses.
import * as THREE from 'three';
import { Builder, box, rbox } from '../assets/kit.js';
import { RAM, ramWalls, ramGateBox } from '/sunmere-play/shared/ramEngine.js';
import { buildRamEngine, buildGateLeaves, buildWeightPile, buildCoalPile } from '../assets/ramEngine.js';
import { markDynamic } from './freeze.js';

const STONE = '#d2c8b4', STONE2 = '#c4baa4', CAP = '#e0d8c6', SLAB = '#d8ccb2';
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });

export function buildRamYard(W) {
  const T = W.terrain, Y = RAM.yard;
  // keep the scatter off the road, the park and the yard
  W.clearings?.push({ x: 360, z: 120, r: 16 }, { x: 360, z: 140, r: 16 }, { x: 360, z: 160, r: 16 }, { x: 360, z: 185, r: 24 });
  // the walls (each its own box, sunk 1.5 m so a slope never shows under it), the towers and posts taller
  for (const w of ramWalls()) {
    const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, hw = (w.x1 - w.x0) / 2, hd = (w.z1 - w.z0) / 2;
    const h = w.tower ? 6.2 : w.post ? 4.6 : Y.h, b = new Builder(4500 + Math.round(cx * 3 + cz));
    // ground under the wall's ends may sit higher or lower than at its middle: the wall runs down to the lowest
    let lo = 0; for (const [x, z] of [[w.x0, w.z0], [w.x1, w.z1], [w.x0, w.z1], [w.x1, w.z0]]) lo = Math.min(lo, T.height(x, z) - T.height(cx, cz));
    const base = lo - 1.5;
    b.add(box(hw * 2, h - base, hd * 2), 'stoneLarge', { p: [0, (h + base) / 2, 0], c: w.tower ? STONE2 : STONE, uv: 'box' });
    // a flat coping course, a little proud of both faces
    b.add(box(hw * 2 + 0.2, 0.22, hd * 2 + 0.2), 'stone', { p: [0, h + 0.11, 0], c: CAP });
    if (w.tower) b.add(box(hw * 2 + 0.3, 0.3, hd * 2 + 0.3), 'stone', { p: [0, h - 1.4, 0], c: CAP }); // (a string course)
    W.placeObject(res(b, { colliders: [{ hw, hd }] }), cx, cz, 0);
  }
  // the gatehouse's flat stone lintel over the yard gate (clear of the ram engine's stack), and the inner gate's timber one
  {
    const A = RAM.gates[0], b = new Builder(4520);
    b.add(box(A.w + 4.8, 0.9, Y.t + 2.0), 'stoneLarge', { p: [0, 5.75, 0], c: STONE2, uv: 'box' });
    b.add(box(A.w + 5.0, 0.2, Y.t + 2.2), 'stone', { p: [0, 6.3, 0], c: CAP });
    W.placeObject(res(b), A.x, A.z + Y.t / 2, 0);
    const B = RAM.gates[1], c = new Builder(4521);
    c.add(box(B.w + 2.6, 0.5, 0.6), 'wWood', { p: [0, 4.85, 0], c: '#5a4634' });
    W.placeObject(res(c), B.x, B.z + Y.t / 2, 0);
  }
  // the two wicket doors (square, shut) in the north wall's road face
  for (const [x] of RAM.defenders.spots) {
    const b = new Builder(4530 + x);
    b.add(box(1.5, 2.3, 0.12), 'wWood', { p: [0, 1.15, 0], c: '#4e3c2c' });
    b.add(box(1.8, 0.24, 0.2), 'stone', { p: [0, 2.42, 0.02], c: CAP }); // (a flat lintel)
    W.placeObject(res(b), x, Y.z0 - 0.07, 0);
  }
  // the gates: hinged leaves with a box collider each gate (turned off when the gate is broken)
  W.ramGates = RAM.gates.map((G, i) => {
    const L = buildGateLeaves(G.w - 0.1, i === 0 ? 4.6 : 3.6, 4450 + i * 10);
    const B = ramGateBox(i), cz = (B.z0 + B.z1) / 2;
    const obj = W.placeObject({ builder: new Builder(1), dynamics: [L.group], colliders: [{ hw: G.w / 2, hd: (B.z1 - B.z0) / 2 }] }, G.x, cz, 0);
    markDynamic(obj); markDynamic(L.group);
    return { obj, leaves: L.leaves, col: obj.userData.cols[0], hp: G.hp, max: G.hp, fall: 0 };
  });
  // the Wall-Layer's pit floor behind the inner gate
  {
    const b = new Builder(4540), Bz = RAM.boss;
    // (flagstones in running bond, each course half a stone off the next: the seams meet only at T's from above)
    for (let k = 0; k < 6; k++) { const off = k % 2 ? 1.2 : 0; for (let i = -1; i < 5; i++) { const x0 = -6 + off + i * 2.4, x1 = Math.min(6, x0 + 2.4), xa = Math.max(-6, x0); if (x1 - xa < 0.3) continue; b.add(box(x1 - xa - 0.06, 0.1, 1.54), 'sandstone', { p: [(xa + x1) / 2, 0.05, -4.6 + k * 1.6], c: (i + k) % 3 ? '#b8ae9c' : '#aaa08c' }); } }
    W.placeObject(res(b), Bz.x, Bz.z, 0);
  }
  // dressed blocks the Wall-Layer has cut and not yet laid, in square stacks (parallel), in the outer court
  for (const [x, z, n] of [[349, 176, 3], [371, 178, 2], [366, 194, 2]]) {
    const b = new Builder(4550 + x);
    for (let l = 0; l < n; l++) for (let i = 0; i < 3 - l; i++) b.add(rbox(1.2, 0.6, 0.8, 0.04), 'stoneLarge', { p: [-1.25 + i * 1.25 + l * 0.6, 0.3 + l * 0.6, 0], c: i % 2 ? STONE : STONE2, uv: 'box' });
    W.placeObject(res(b, { colliders: [{ hw: 1.9, hd: 0.5 }] }), x, z, 0);
  }
  // the yard road: dressed slabs in straight courses from the park to the yard gate and on through both courts, each
  // course set on the ground under it
  {
    const b = new Builder(4560), x0 = RAM.park.x, h0 = T.height(x0, 140);
    // (in running bond: each course's joints sit half a slab off the next, so from above the seams meet only at T's;
    // the road ends at the gatehouse, a T against the wall: no road on through the yard to cross the lintel from above)
    for (let z = 113, k = 0; z <= Y.z0 - 3.4; z += 2, k++) {
      const xs = k % 2 ? [-3.0, -1.2, 1.2, 3.0] : [-2.4, 0, 2.4], ws = k % 2 ? [1.2, 2.4, 2.4, 1.2] : [2.4, 2.4, 2.4];
      xs.forEach((dx, i) => {
        const x = x0 + dx, y = T.height(x, z + 1) - h0;
        b.add(box(ws[i] - 0.06, 0.1, 1.94), 'sandstone', { p: [dx, y + 0.03, z - 140 + 1], c: (i + k) % 3 ? SLAB : '#ccc0a6' });
      });
    }
    const o = W.placeObject(res(b), x0, 140, 0);
    o.position.y = h0;
  }
  // the engine itself, at its park (moved and animated by ramEvent.js; dynamic, so the world's freeze leaves it walking)
  W.ramEngine = buildRamEngine();
  markDynamic(W.ramEngine);
  W.ramEngine.position.set(RAM.park.x, T.height(RAM.park.x, RAM.park.z), RAM.park.z);
  W.groupAt(RAM.park.x, RAM.park.z).add(W.ramEngine);
  // the piles by the road
  for (const P of RAM.piles) W.placeObject(res(P.kind === 'weight' ? buildWeightPile(4600 + P.x) : buildCoalPile(4610 + P.x), { colliders: [{ r: 0.9 }] }), P.x, P.z, P.x < RAM.park.x ? 0.1 : -0.1);
}

// the gates as the tally says: hp left of each (cracked leaves lean further each blow; a broken gate's leaves lie flat in
// the gateway, falling over a second, and its collider is off)
export function setRamGates(W, hp, dt = 0) {
  for (let i = 0; i < (W.ramGates || []).length; i++) {
    const G = W.ramGates[i], h = hp?.[i] ?? G.max;
    G.hp = h;
    const broken = h <= 0, want = broken ? 1 : 0;
    G.fall = dt ? (want > G.fall ? Math.min(1, G.fall + dt) : want) : want;
    G.col.off = broken;
    const crack = broken ? 0 : (G.max - h) / G.max;
    G.leaves.forEach((L, k) => {
      const sx = k === 0 ? -1 : 1;
      L.rotation.y = sx * crack * 0.14; // (pushed in at the meeting edge)
      L.rotation.x = G.fall * (Math.PI / 2 - 0.04); // (falling into the yard, away from the road)
      L.position.y = G.fall * 0.12;
    });
  }
}
