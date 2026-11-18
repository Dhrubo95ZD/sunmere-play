// Sunmere Village layout (after the concept map): fountain plaza in the middle, the guild hall up its grand
// staircase to the north, the market down the south avenue to the gate, the forge and waterwheel to the west,
// the ranger lodge and range to the north-west, cottages along the stream, gardens, trees and lanterns.
import { VILLAGE, STREAM, BRIDGES, roadDist, streamInfo, ROADS } from '/sunmere-play/shared/terrain.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { Builder as L_Builder } from '../assets/kit.js';
import * as B from '../assets/buildings.js';
import * as P from '../assets/props.js';
import * as D from '../assets/dressing.js';
import { hallTerrace, guildHall, crystalFountain, plazaPlanters, southGate, archBridge } from '../assets/village.js';
import { watermill } from '../assets/watermill.js';
import { marketStreet, forgeWorkshop, springFalls, cascadeStones, archeryTarget, trainingDummy } from '../assets/village2.js';
import * as L from '../assets/village3.js';
import { NPCS, OBJECTS, NODES } from '/sunmere-play/shared/data.js';
import { housesIn, allHouses } from '/sunmere-play/shared/houses.js';

const PI = Math.PI;

export function buildVillage(W) {
  const S = W.scatter, T = W.terrain;
  // the nine cottage sites and the ranger lodge are enterable houses now (shared/houses.js, the 'village' group): built
  // first, so their walls and yard props are in the colliders before anything else is placed round them
  W.buildHouses('village');
  const put = (key, x, z, r = 0, s = 1) => S.place(key, x, T.height(x, z) - 0.02, z, r, s);
  const withCol = (res, r) => ({ ...res, collider: { r } });
  // banners hang down the side of their poles (the old bannerPost carried a crossbar near the top)
  S.addPrefab('bannerPost', withCol(L.flagPost(3), 0.35));
  S.addPrefab('target', withCol(archeryTarget(4), 0.7));
  S.addPrefab('dummy', withCol(trainingDummy(5), 0.45));

  // ---- the hall on its terrace, the plaza, the bridges and the gate
  W.placeAbs(hallTerrace());
  W.placeAbs(guildHall());
  W.placeObject(crystalFountain(), VILLAGE.plaza.x, VILLAGE.plaza.z, 0);
  W.placeObject(plazaPlanters(), VILLAGE.plaza.x, VILLAGE.plaza.z, 0);
  BRIDGES.forEach((_, i) => W.placeAbs(archBridge(i)));
  W.placeObject(southGate(), VILLAGE.gate.x, VILLAGE.gate.z, 0);
  // plaza ring: lanterns and banners alternating, benches facing the fountain
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2 + PI / 12, r = 13.3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (i % 2) put('lantern', x, z, -a + PI); else put('bannerPost', x, z, -a + PI / 2);
  }
  for (const a of [PI * 0.17, PI * 0.83, PI * 1.17, PI * 1.83]) put('bench', Math.cos(a) * 10.6, Math.sin(a) * 10.6, -a - PI / 2);
  D.noticeBoard && W.placeObject(D.noticeBoard(2), -6.2, -16.5, 0.15);

  // ---- the stream: spring falls at its head, cascades, the forge's waterwheel
  W.placeAbs(springFalls());
  W.placeAbs(cascadeStones(110));
  // Sunmere Mill on the south-west bank: the wheel sits in the stream against the mill house wall
  {
    const at = pointAt(26), off = 2.2;
    const wx = at.x - at.dz * off, wz = at.z + at.dx * off;
    W.placeAt(watermill(wx, wz, Math.atan2(at.dx, at.dz)), wx, 0, wz, Math.atan2(at.dx, at.dz));
  }

  // ---- forge district (west)
  W.placeObject(forgeWorkshop(), -42, -8.5, 0.12);
  for (const [x, z, r] of [[-36.4, -6.2, 0.4], [-36.8, -2.6, 1.2]]) put('crates', x, z, r);
  put('coal', -47.8, -4.0, 0.6);
  put('signpost', -26.4, 3.8, 0.2);
  // sparring ring by the forge (open on the south side for onlookers)
  { const cx = -29.5, cz = -10.5;
    for (const x of [cx - 1.5, cx + 1.5]) put('fence', x, cz - 3, 0);
    for (const z of [cz - 1.5, cz + 1.5]) { put('fence', cx - 3, z, PI / 2); put('fence', cx + 3, z, PI / 2); }
    put('haystack', cx - 4.6, cz + 3.6, 0.5, 0.55); put('crates', cx + 4.4, cz - 2.2, 0.8); }

  // ---- market down the south avenue (north of the stream, and a pair by the gate)
  W.placeAbs(marketStreet([
    [-8.4, 16.4, PI / 2, 'fruit', 'canopyRed'], [8.4, 16.4, -PI / 2, 'cloth', 'canopyRed'],
    [-8.4, 21.6, PI / 2, 'pottery', 'canopyBlue'], [8.4, 21.6, -PI / 2, 'bread', 'canopyRed'],
    [-13.6, 18.6, PI / 2 - 0.5, 'herbs', 'canopyRed'], [13.6, 18.6, -PI / 2 + 0.5, 'lamps', 'canopyBlue'],
    [-8.2, 39.6, PI / 2, 'cloth', 'canopyBlue'], [8.2, 39.6, -PI / 2, 'fruit', 'canopyRed'],
  ]));
  for (const [x, z, r] of [[-11.6, 23.4, 0.3], [11.4, 23.6, 1.1], [-12, 41.5, 2.0]]) put('crates', x, z, r);
  W.placeObject(P.cart(4), 11.6, 42.4, 0.5);

  // ---- training range (north-west; the ranger lodge beside it is the village longhouse sv_lodge)
  for (const x of [-31, -27.4, -23.8]) put('target', x, -47.2, 0);
  // the two training dummies here are live targets now (MOBS.dummy)
  for (let i = 0; i < 5; i++) put('fence', -34.5 + i * 3, -49.6, 0);
  for (let i = 0; i < 3; i++) put('fence', -36.4, -48 + i * 3, PI / 2);
  for (let i = 0; i < 3; i++) put('fence', -20.2, -48 + i * 3, PI / 2);
  put('haystack', -21.8, -38.4, 0.4, 0.7);
  // (RF.7) at the T junctions where the lanes leave the west and east roads
  put('signpost', -23.6, -4.4, -0.6);
  put('signpost', 25.6, -3.4, 0.7);

  // ---- houses along the stream and at the village edges (built above); the well between the west houses
  W.placeObject(P.well(1), -37, 32, 0);
  dressVillage(W, put, housesIn('village'));

  // ---- gardens between the plaza and the terrace
  for (const sx of [-1, 1]) {
    put('flowerBed', sx * 12, -21, sx * 0.2);
    put('flowerBed', sx * 15.5, -26.5, 0);
    put('flowerBed', sx * 10.5, -27.5, 0);
    put('lilac' + (sx > 0 ? 0 : 1), sx * 14.5, -17.5, sx, 0.62);
    put('bushGreen' + (sx > 0 ? 1 : 2), sx * 18.2, -21.5, sx, 0.9);
    put('bushRed' + (sx > 0 ? 0 : 1), sx * 9.4, -22.8, sx, 0.75);
  }

  // ---- trees framing the village
  // (RF.7 review) the oak at (33, -6) moved to (39, -16): the valley's engine stands there now, off the re-routed north-east lane
  const oaks = [[16, -16], [-16, -16], [20, 9], [-21, 5], [25, -42], [39, -16], [-50, 32], [-36, 47], [18, 51], [42, 43]];
  oaks.forEach(([x, z], i) => put('oak' + (i % 3), x, z, i * 1.7, 0.9 + (i % 3) * 0.1));
  const pines = [[0, -66], [-12, -65], [12, -65], [-24, -64], [24, -63], [-50, -27], [-53, -40], [-47, -47], [-38, -53], [-27, -55], [-56, -18], [36, -50], [44, -40]];
  pines.forEach(([x, z], i) => put('pine' + (i % 3), x, z, i * 2.3, 1.05 + (i % 2) * 0.15));
  put('lilac0', 63, -13, 0.4, 0.8); // clear of the Proving Ring's entrance

  // ---- lanterns along the roads and avenues (bridges carry their own)
  for (const [x, z] of [[-4.6, -16], [4.6, -16], [-5.4, 13.4], [5.4, 13.4], [-5.4, 37], [5.4, 37], [-5.4, 43.4], [5.4, 43.4]]) put('lantern', x, z, x > 0 ? PI : 0);
  for (const road of ROADS.slice(2)) {
    let acc = 0, side = 1;
    for (let i = 0; i < road.length - 1; i++) {
      const [ax, az] = road[i], [bx, bz] = road[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      for (let t = 0; t < L; t += 1) {
        acc += 1;
        if (acc % 13 !== 0) continue;
        const x = ax + (bx - ax) * (t / L), z = az + (bz - az) * (t / L);
        const dc = Math.hypot(x, z);
        if (dc < 18 || dc > 80 || streamInfo(x, z).d < 7) continue;
        const nx = -(bz - az) / L, nz = (bx - ax) / L;
        if (streamInfo(x + nx * 3.3 * side, z + nz * 3.3 * side).d < 6) continue;
        put('lantern', x + nx * 3.3 * side, z + nz * 3.3 * side, Math.atan2(-nx * side, -nz * side));
        side = -side;
      }
    }
  }

  // ---- flowers everywhere there is open grass inside the village
  const rng = mulberry32(777);
  let placed = 0;
  for (let i = 0; i < 2600 && placed < 260; i++) {
    const x = VILLAGE.clear.x + (rng() * 2 - 1) * VILLAGE.clear.rx, z = VILLAGE.clear.z + (rng() * 2 - 1) * VILLAGE.clear.rz;
    if (!villageFree(W, x, z)) continue;
    put('flowerPatch' + (placed % 3), x, z, rng() * 6, 0.8 + rng() * 0.5);
    placed++;
  }
  // river stones and reeds along the banks
  for (let s = 6; s < 168; s += 3.1) {
    const at = pointAt(s), side = (Math.floor(s) % 2 ? 1 : -1), off = 3.2 + (s % 1.3);
    const x = at.x - at.dz * off * side, z = at.z + at.dx * off * side;
    if (nearBridge(x, z) || !freeOfBoxes(W, x, z, 0.8)) continue;
    if (Math.floor(s) % 3 === 0) put('reeds' + (Math.floor(s) % 2), x, z, s, 0.8);
    else put('rock' + (Math.floor(s) % 5), x, z, s, 0.35 + (s % 0.4));
  }
}

// ---- village life: market goods, laundry, woodpiles, planters, wells, benches, carts and drifting leaves.
// Everything goes through the scatter (batched per material, so no extra draw calls) and only where spotFree says the
// ground is open: off roads, the stream, buildings, NPCs and quest objects.
function dressVillage(W, put, cottageList) {
  const S = W.scatter;
  const pre = (key, res) => { if (!S.prefabs.has(key)) S.addPrefab(key, res); };
  pre('barrels0', L.barrels(1, 3)); pre('barrels1', L.barrels(2, 2)); pre('barrels2', L.barrels(3, 4));
  pre('sacks0', L.sacks(1, 6)); pre('sacks1', L.sacks(2, 5));
  pre('baskets0', L.baskets(1)); pre('baskets1', L.baskets(2));
  pre('goods0', L.goodsPile(1)); pre('goods1', L.goodsPile(2));
  pre('laundry0', L.laundryLine(1, 5)); pre('laundry1', L.laundryLine(2, 4.2));
  pre('woodPile', L.woodPile(1));
  pre('flowerTub', L.flowerTub(1)); pre('planter', L.planterBox(1, 1.8));
  pre('vwell', P.well(2));
  // keep: x, z, rotation, prefab, clearance (radius kept free of roads etc.), road clearance
  const tryPut = (key, x, z, r = 0, pad = 0.6, road = 3.2) => {
    if (!spotFree(W, x, z, pad, road)) { (W.dressSkips ||= []).push(`${key}@${x.toFixed(1)},${z.toFixed(1)}`); return false; }
    put(key, x, z, r); return true;
  };
  // market: barrels and sacks behind and between the stalls, baskets and goods at the stall ends
  for (const [k, x, z, r] of [
    ['barrels0', -10.2, 19.0, 0.4], ['barrels1', 11.0, 19.0, 2.1], ['sacks0', -15.9, 21.6, 1.4], ['sacks1', 15.8, 15.8, -1.2],
    ['baskets0', -8.6, 13.9, 0.1], ['baskets1', 8.6, 24.3, 3.0], ['goods0', -15.4, 15.6, 0.8], ['goods1', 15.6, 21.6, -0.6],
    ['barrels2', -11.2, 36.8, 0.9], ['sacks1', 10.6, 37.6, 2.4], ['baskets1', -7.0, 42.6, 1.2], ['goods0', 10.0, 40.2, -1.8],
  ]) tryPut(k, x, z, r, 0.2, 2.6);
  // houses (shared/houses.js specs): a planter along the front away from the door, a tub by the door's far side, a woodpile
  // or barrels off a side wall; spotFree keeps them off the walls, the yard props, the doorstep and the house itself
  cottageList.forEach((H, i) => {
    const rot = H.rot, c = Math.cos(rot), s = Math.sin(rot), w2 = H.w / 2, d2 = H.d / 2;
    const at = (lx, lz) => [H.x + lx * c + lz * s, H.z - lx * s + lz * c];
    const side = H.door.face === 'front' ? (H.door.lx > 0 ? -1 : 1) : (i % 2 ? 1 : -1);
    let [x, z] = at(side * w2 * 0.5, d2 + 0.9); tryPut('planter', x, z, rot, 0.2, 2.2);
    [x, z] = at(-side * (w2 + 0.9), d2 - 0.6); tryPut('flowerTub', x, z, rot, 0.2, 2.2);
    [x, z] = at(i % 2 ? w2 + 1.2 : -w2 - 1.2, -d2 * 0.4); tryPut(i % 3 === 2 ? 'barrels1' : 'woodPile', x, z, rot + PI / 2, 0.4, 3);
  });
  // washing lines in the cottage yards
  for (const [k, x, z, r] of [['laundry0', -46.5, 46.5, 0.3], ['laundry1', -60.5, 32, 1.3], ['laundry0', 28.5, 47.5, -0.2], ['laundry1', 40.5, 36.5, -0.9], ['laundry1', 36.5, -31.5, 0.3], ['laundry0', -25.5, 46.5, 0.12]])
    tryPut(k, x, z, r, 1.2, 3.4);
  // a second well for the east cottages, benches by the stream and the forge lane, a woodpile at the forge
  tryPut('vwell', 31, 42.5, 0.3, 1.2, 3.5) || tryPut('vwell', 37, 41, 0.3, 1.2, 3.5);
  for (const [x, z, r] of [[-8.5, 31.5, PI], [8.5, 32.8, PI], [-22, 4.2, PI], [21.5, 6.6, 0.1], [-46, 22, 2.4]]) tryPut('bench', x, z, r, 0.4, 2.6);
  tryPut('woodPile', -49.5, -11.5, 0.15, 0.6, 3) || tryPut('woodPile', -36.5, -14.5, 0.15, 0.6, 3);
  for (const [x, z, r] of [[-35.4, -10.5, 1.2], [-46.5, -2.6, 0.4], [-14.5, 8.2, 0.8], [16.2, -8.4, 2.0]]) tryPut(['barrels0', 'sacks0', 'flowerTub', 'flowerTub'][Math.abs(Math.round(x)) % 4], x, z, r, 0.4, 2.8);
  // flower tubs at the corners of the hall stairs and either side of the south gate
  for (const [x, z] of [[-5.6, -19.6], [5.6, -19.6], [-3.2, 49.2], [3.2, 49.2]]) tryPut('flowerTub', x, z, 0, 0.1, 1.6);
  // carts parked in the yards (solid disc wheels)
  W.placeObject(P.cart(11), -44.5, 2.2, 2.6);
  // drifting leaves over the village (one small particle cloud; fewer on Low and on phones)
  W.placeAt({ builder: new L_Builder(), dynamics: [L.driftingLeaves(W.terrain, 2, 4, 58, 220)] }, 2, 0, 4);
}

// a spot is free for a prop when it is off the roads, off the stream, clear of buildings and colliders, and well away from
// NPCs and quest objects (so no prop ever stands where a player must click or walk)
export function spotFree(W, x, z, pad = 0.6, road = 3.2) {
  if (roadDist(x, z) < road) return false;
  if (nearHouse(x, z, pad)) return false;
  if (streamInfo(x, z).d < 4.5) return false;
  for (const n of NPCS) if (Math.abs(n.x - x) < 3.2 && Math.abs(n.z - z) < 3.2 && Math.hypot(n.x - x, n.z - z) < 3.2) return false;
  for (const o of OBJECTS || []) if (o.x !== undefined && Math.hypot(o.x - x, o.z - z) < 2.8) return false;
  for (const o of NODES || []) if (Math.hypot(o.x - x, o.z - z) < 2.4) return false;
  return freeOfBoxes(W, x, z, pad);
}

// a point on the stream polyline at arc length s, with the flow direction
export function pointAt(s0) {
  const P = STREAM.pts;
  let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const L = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
    if (acc + L >= s0 || i === P.length - 2) {
      const t = Math.min(1, (s0 - acc) / L);
      return { x: P[i][0] + (P[i + 1][0] - P[i][0]) * t, z: P[i][1] + (P[i + 1][1] - P[i][1]) * t, dx: (P[i + 1][0] - P[i][0]) / L, dz: (P[i + 1][1] - P[i][1]) / L };
    }
    acc += L;
  }
}
// on a house (its footprint and eaves, plus pad) or on the way to its door (the doorstep and 2.5 m out in front of it)?
export function nearHouse(x, z, pad = 0) {
  for (const H of allHouses()) {
    if (Math.abs(x - H.x) > 16 || Math.abs(z - H.z) > 16) continue;
    const c = Math.cos(H.rot), s = Math.sin(H.rot), dx = x - H.x, dz = z - H.z, lx = dx * c - dz * s, lz = dx * s + dz * c, R = H.cutRect;
    if (lx > R.x0 - pad && lx < R.x1 + pad && lz > R.z0 - pad && lz < R.z1 + pad) return true;
    const D = H.door, u = (lx - D.lx) * D.nx + (lz - D.lz) * D.nz, t = (lx - D.lx) * -D.nz + (lz - D.lz) * D.nx;
    if (u > 0 && u < (H.stepLen || 0.9) + 2.8 + pad && Math.abs(t) < 1.4 + pad) return true;
  }
  return false;
}
function nearBridge(x, z) {
  return BRIDGES.some((b) => Math.hypot(x - (b.a[0] + b.b[0]) / 2, z - (b.a[1] + b.b[1]) / 2) < 7.5);
}
function freeOfBoxes(W, x, z, pad) {
  for (const b of W.boxes) {
    const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0), dx = x - b.x, dz = z - b.z;
    if (Math.abs(dx * c - dz * s) < b.hw + pad && Math.abs(dx * s + dz * c) < b.hd + pad) return false;
  }
  for (const c of W.scatter.colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
  return true;
}
// open grass inside the village: off roads, plaza, stream, terrace and buildings
export function villageFree(W, x, z) {
  const T = VILLAGE.terrace;
  if (roadDist(x, z) < 3.4) return false;
  if (Math.hypot(x - VILLAGE.plaza.x, z - VILLAGE.plaza.z) < VILLAGE.plaza.r + 2) return false;
  if (x > T.x0 - 3 && x < T.x1 + 3 && z > T.z0 - 3 && z < T.z1 + 11) return false;
  if (z > 12 && z < 50 && Math.abs(x) < 16) return false; // market street
  if (streamInfo(x, z).d < 5.5) return false;
  return freeOfBoxes(W, x, z, 1.4);
}
