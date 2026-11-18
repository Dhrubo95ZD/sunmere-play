// Overworld dressing for the zones beyond the village and the quarry, so every level band has somewhere to be:
//   Briarhold (bandit hideout, 3-5) · the Glade poachers' camp (6-8) · Brasswind Dig (12-14) · Sandsunk Ruins (13-14)
//   Dunewatch Post (hub, 10-15) · Foundry Watch (hub, 15-20) · the Old Sawmill in Rustwood (15-17)
// and signposts at every junction of the roads that connect them.
import * as THREE from 'three';
import * as P from '../assets/props.js';
import * as D from '../assets/dressing.js';
import * as B from '../assets/buildings.js';
import { derrick, scaffold, stoneStack, workTent, toolRack, rubble } from '../assets/quarry.js';
import { flagPost as bannerPost } from '../assets/village3.js'; // banners hang down the pole's side: no crossbar
import * as L from '../assets/village3.js';
import { spotFree, nearHouse } from './villageLayout.js';
import { Builder, box, rbox, cyl, cone, sphere, torus, lathe, gear, prism, tube as tubeGeo } from '../assets/kit.js';
import { addRock } from '../assets/trees.js';
import { CARAVANS, NPCS, ARENA, HOME_DECO, VALLEY } from '/sunmere-play/shared/data.js';
import { buildRunabout } from '../assets/runabout.js';
import { buildSteamship } from '../assets/steamship.js';
import { islandAt, ROADS, BRIDGES, roadDist, streamInfo, STREAM } from '/sunmere-play/shared/terrain.js';

const PI = Math.PI;
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });

// a farm silo: a stone drum with timber bands and one plain flat timber lid (local)
function silo(seed) {
  const b = new Builder(seed);
  b.add(lathe([[0.001, 0], [2.1, 0], [2.1, 0.5], [2.0, 6.5], [0.001, 6.5]], 20), 'stoneLarge', { uv: 'box', us: 0.34, c: '#e0d6c4' });
  for (const y of [2.2, 4.4]) b.add(torus(2.05, 0.08, 6, 28), 'beam', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  // one plain flat timber lid that overhangs the drum: a single colour from above, no lid-in-rim disc
  b.add(cyl(2.3, 2.3, 0.4, 20), 'beam', { p: [0, 6.7, 0], c: '#c8a478' });
  b.add(box(1.0, 1.8, 0.1), 'woodDark', { p: [0, 0.9, 2.08], uv: 'box', c: '#c8a070' });
  return res(b, { collider: { r: 2.3 } });
}

// a ruined keep wall run: blocks stacked to a broken, uneven top (local, along x)
function ruinWall(seed, len = 8, h = 3.6) {
  const b = new Builder(seed);
  const n = Math.round(len / 1.2);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * (len / n), top = h * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + seed)));
    for (let y = 0; y < top; y += 0.6) b.add(rbox(len / n - 0.04, 0.58, 1.1, 0.04), 'stoneDark', { p: [x + b.r(-0.03, 0.03), y + 0.3, b.r(-0.05, 0.05)], uv: 'box', c: y > top - 0.7 ? '#b8b0a0' : '#d0c8b8' });
  }
  for (let i = 0; i < 4; i++) b.add(rbox(b.r(0.6, 1.0), 0.5, b.r(0.6, 0.9), 0.05), 'stoneDark', { p: [b.r(-len / 2, len / 2), 0.25, b.r(1.0, 2.2) * (i % 2 ? 1 : -1)], r: [b.r(-0.3, 0.3), b.r(0, 3), b.r(-0.3, 0.3)], uv: 'box', c: '#c8c0b0' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: len / 2, hd: 0.6 }] });
}

// a broken round tower (local)
function ruinTower(seed, h = 5.5) {
  const b = new Builder(seed);
  b.add(cyl(2.8, 3.1, 1.0, 18), 'stoneLarge', { p: [0, 0.5, 0], uv: 'box', us: 0.34, c: '#c8c0b0' });
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * PI * 2, top = h * (0.4 + 0.6 * Math.abs(Math.sin(k * 0.9 + seed)));
    for (let y = 1; y < top; y += 0.7) b.add(rbox(0.95, 0.66, 0.9, 0.04), 'stoneDark', { p: [Math.cos(a) * 2.5, y + 0.33, Math.sin(a) * 2.5], r: [0, -a, 0], uv: 'box', c: '#d0c8b8' });
  }
  return res(b, { collider: { r: 3.0 } });
}

// a heap of sacks (local)
function sackPile(seed, n = 7, color = '#e8dcc0') {
  const b = new Builder(seed);
  for (let i = 0; i < n; i++) {
    const layer = i < 4 ? 0 : 1, x = layer ? (i - 5) * 0.5 : (i - 1.5) * 0.52, z = layer ? 0 : (i % 2) * 0.12;
    b.add(lathe([[0.001, 0], [0.2, 0.02], [0.27, 0.2], [0.25, 0.42], [0.14, 0.56], [0.001, 0.6]], 10), 'cloth', { p: [x, layer * 0.38, z], r: [PI / 2 - 0.2, b.r(-0.3, 0.3), 0], s: [1, 0.9, 0.8], c: i % 3 ? color : '#d8c8a0' });
  }
  return res(b, { collider: { r: 1.2 } });
}

// an open-sided sawmill shed: posts, a shingle roof, a saw bench with a great circular blade, log piles
function sawmillShed() {
  const b = new Builder(301);
  const W = 12, Dp = 7, H = 4.2;
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const z of [-Dp / 2, Dp / 2]) b.add(box(0.36, H, 0.36), 'beam', { p: [x, H / 2, z], c: 0xffffff });
  for (const z of [-Dp / 2, Dp / 2]) b.add(box(W + 0.6, 0.34, 0.4), 'beam', { p: [0, H, z], c: 0xffffff });
  // roof: two slopes, one half fallen in
  const rise = 2.2, ang = Math.atan2(rise, Dp / 2), L = Math.hypot(Dp / 2 + 0.6, rise + 0.3);
  b.add(box(W + 1.2, 0.18, L), 'shingleWood', { p: [0, H + rise / 2, -Dp / 4], r: [-ang, 0, 0], uv: 'box', c: '#b8a080' });
  b.add(box(W * 0.55, 0.18, L), 'shingleWood', { p: [-W * 0.22, H + rise / 2, Dp / 4], r: [ang, 0, 0], uv: 'box', c: '#a89070' });
  for (let i = 0; i < 5; i++) b.add(box(0.16, 0.2, L), 'beam', { p: [W * 0.08 + i * 1.3, H + rise / 2 - 0.15, Dp / 4], r: [ang, 0, 0], c: 0xffffff });
  for (const z of [-0.1, 0.1]) b.add(box(W * 0.3, 0.12, L * 0.9), 'shingleWood', { p: [W * 0.28 + z * 3, 0.5 + Math.abs(z) * 2, Dp / 2 + 1.0], r: [-0.2, 0.3, 0.15], uv: 'box', c: '#8a7458' });
  b.add(box(0.3, 0.3, W + 0.8), 'beam', { p: [0, H + rise, 0], r: [0, PI / 2, 0], c: 0xffffff });
  // saw bench and blade
  b.add(rbox(6.0, 0.9, 1.4, 0.04), 'woodDark', { p: [0, 0.45, 0], uv: 'box', c: '#8a6a4a' });
  b.add(gear(48, 1.15, 1.25, 0.05, { hole: 0.1, spokes: 0, bevel: 0 }), 'metal', { p: [0.4, 1.3, 0], r: [0, 0, 0], c: '#c8ccd0' });
  b.add(cyl(0.08, 0.08, 1.8, 10), 'iron', { p: [0.4, 1.3, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  b.add(cyl(0.35, 0.35, 5.6, 12), 'bark', { p: [-1.6, 1.25, 0.1], r: [0, 0, PI / 2], c: 0xffffff });
  // a drive wheel and belt to an old boiler
  b.add(rbox(1.6, 2.0, 1.6, 0.08), 'iron', { p: [4.6, 1.0, -2.2], c: '#7a6a5a' });
  b.add(cyl(0.18, 0.22, 2.2, 10), 'iron', { p: [4.6, 3.0, -2.2], c: '#4a4a4a' });
  b.add(torus(0.7, 0.08, 6, 20), 'iron', { p: [3.0, 1.4, -2.2], c: '#5a5a5a' });
  // sawdust heaps
  for (const [x, z, s] of [[-2.5, 1.6, 1.2], [2.6, 1.8, 0.9], [-4.6, -1.8, 1.0]]) b.add(sphere(1, 12, 8), 'dirtPlain', { p: [x, -0.1, z], s: [s * 1.4, s * 0.45, s * 1.1], uv: 'box', c: '#e0b878' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: 3.2, hd: 0.9 }, { x: 4.6, z: -2.2, hw: 0.9, hd: 0.9 }], smokes: [] });
}

// stacked logs (local)
function logPile(seed, n = 9) {
  const b = new Builder(seed);
  let k = 0;
  for (let layer = 0; layer < 3 && k < n; layer++) for (let i = 0; i < 4 - layer && k < n; i++, k++) b.add(cyl(0.32, 0.34, 4.2, 10), 'bark', { p: [(i - (3 - layer) / 2) * 0.66, 0.32 + layer * 0.56, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  for (const z of [-1.6, 1.6]) for (const sx of [-1, 1]) b.add(box(0.12, 1.4, 0.12), 'beam', { p: [sx * 1.5, 0.7, z], c: 0xffffff });
  return res(b, { collider: { r: 2.2 } });
}

// a half-buried brass engine part from the old works (local): a great gear, a cylinder, pipes
function buriedWorks(seed) {
  const b = new Builder(seed);
  b.add(gear(28, 2.2, 2.6, 0.5, { hole: 0.5, spokes: 6 }), 'brass', { p: [0, 0.9, 0], r: [0.3, 0.2, 0.15], c: '#c8a070' });
  b.add(cyl(0.8, 0.8, 3.4, 16), 'copper', { p: [3.2, 0.2, 1.4], r: [0, 0.6, PI / 2 - 0.15], c: '#a87a5a' });
  for (let i = 0; i < 3; i++) b.add(cyl(0.18, 0.18, 2.6, 10), 'brass', { p: [-2.4 + i * 0.6, 0.6, -1.8], r: [0.5 + i * 0.1, 0, 0.3], c: '#b89060' });
  for (const [x, z, s] of [[-1.6, 1.2, 2.4], [2.0, -0.6, 2.0], [0.6, 2.4, 1.8]]) b.add(sphere(1, 12, 8), 'rockSand', { p: [x, -0.2, z], s: [s, 0.7, s * 0.8], uv: 'box', c: '#f4dcb0' });
  return res(b, { collider: { r: 3.0 } });
}

// a field table with papers, a lantern and a brass instrument (local)
function surveyTable(seed) {
  const b = new Builder(seed);
  b.add(rbox(1.8, 0.08, 0.9, 0.02), 'woodLight', { p: [0, 0.8, 0], uv: 'box', c: '#c8a070' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.07, 0.8, 0.07), 'woodDark', { p: [sx * 0.8, 0.4, sz * 0.38], c: 0xffffff });
  for (let i = 0; i < 4; i++) b.add(box(0.4, 0.005, 0.3), 'plaster', { p: [-0.5 + i * 0.25, 0.845 + i * 0.002, -0.1 + (i % 2) * 0.12], r: [0, i * 0.3, 0], c: '#f4ecd8' });
  b.add(cyl(0.05, 0.07, 0.25, 10), 'brass', { p: [0.55, 0.97, 0.1], c: 0xffffff });
  b.add(cyl(0.035, 0.035, 0.4, 8), 'brass', { p: [0.55, 1.12, 0.1], r: [0, 0, 1.1], c: 0xffffff });
  return res(b, { collider: { r: 1.0 }, lanterns: [] });
}

export function buildZones(W) {
  const S = W.scatter, T = W.terrain;
  // Gearwright Ottmar shows off a parked runabout beside his stand
  const gw = NPCS.find((n) => n.id === 'n_gearwright');
  if (gw) {
    const cart = buildRunabout();
    cart.position.set(gw.x + 2.4, T.height(gw.x + 2.4, gw.z + 0.6), gw.z + 0.6);
    cart.rotation.y = -0.7;
    cart.userData.update(0, 0, 0);
    cart.userData.shadowStatic = true; // (v116: it is never driven again: a static caster for the shadow cache)
    (W.valleyGroup || W.group).add(cart);
  }
  const put = (key, x, z, r = 0, s = 1) => S.place(key, x, T.height(x, z) - 0.02, z, r, s);
  const pre = (key, r2) => { if (!S.prefabs.has(key)) S.addPrefab(key, r2); };
  pre('tentGreen', P.raiderTent(31, 1, ['#4f6a34', '#3e5428', '#6a7e44', '#2e3e1e']));
  pre('tentTan', P.raiderTent(32, 1, ['#a08a5a', '#86704a', '#b8a070', '#5a4a30']));
  pre('tentSand', P.raiderTent(33, 1.1, ['#d8c098', '#c0a880', '#e8d4ac', '#8a7458']));
  pre('sacks', sackPile(34));
  // a ring of palisade with gaps (angles in radians, widths in radians)
  const palisadeRing = (cx, cz, R, gaps, squash = 1) => {
    const n = Math.round((PI * 2 * R) / 3.1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      if (gaps.some(([g, w]) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < w)) continue;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R * squash;
      // (a house built into the ring takes the place of its stakes, and its door gets a gap: Ledgerholm's doors face out)
      if (nearHouse(x, z, 0.9)) continue;
      put('palisade', x, z, -(a + PI / 2));
      S.colliders.push({ x, z, r: 1.5 });
    }
  };

  // ------------------------------------------------------------------ Briarhold: the bandit hideout west of the spring
  {
    const cx = -124, cz = -16;
    palisadeRing(cx, cz, 17, [[0.35, 0.22], [PI + 0.4, 0.16]]);
    for (const [x, z, r] of [[-132, -6, 0.4], [-116, -26, 2.2], [-136, -18, 1.4], [-120, -4, -0.6], [-128, -30, 2.9]]) put('tentGreen', x, z, r);
    W.placeObject(P.campfire(41), cx + 1, cz - 2, 0);
    W.placeObject(P.chiefPavilion(42), cx - 6, cz - 12, 0.3);
    for (const [x, z, r] of [[-118, -12, 0.3], [-130, -24, 2.0]]) put('weaponRack', x, z, r);
    for (const [x, z, r] of [[-114, -20, 0.6], [-134, -10, 1.8], [-122, -28, 0.2]]) put('crates', x, z, r);
    for (const [x, z, r] of [[-126, -8, 0.2], [-112, -14, 1.4], [-132, -14, 2.4]]) put('sacks', x, z, r);
    W.placeObject(P.cart(43), -108, -6, 2.6);
    for (const [x, z] of [[-110, -2], [-140, -20], [-124, -34]]) put('raiderBanner', x, z, 0);
    W.placeObject(B.watchtower(44), -138, -2, 0.8);
    for (const [x, z] of [[-107, -8], [-108, -24]]) put('lantern', x, z, 0);
  }

  // ------------------------------------------------------------------ the Glade poachers' camp (east side of the glade)
  {
    for (const [x, z, r] of [[176, -132, 0.6], [182, -124, -1.0], [172, -122, 2.4]]) put('tentTan', x, z, r);
    W.placeObject(P.campfire(45), 177, -126, 0);
    for (const [x, z, r] of [[184, -132, 0.4], [170, -132, 1.2]]) W.placeObject(logPile(46 + x), x, z, r);
    for (const [x, z, r] of [[168, -126, 0.4], [186, -120, 1.6]]) put('crates', x, z, r);
    put('weaponRack', 180, -118, 0.6);
  }

  // ------------------------------------------------------------------ Dunewatch Post: a proper hub
  {
    for (const [x, z, r] of [[-30, 160, 0.5], [-52, 176, 2.6], [-48, 158, 1.4]]) put('tentSand', x, z, r);
    // (no second campfire here: the watchtower has its own, and Sami's escort starts at -40,170)
    W.placeObject(P.marketStall(48, '#a3362a'), -45, 160, 0.9);
    for (const [x, z, r] of [[-26, 168, 0.4], [-54, 168, 1.6], [-44, 182, 0.2]]) put('crates', x, z, r);
    for (const [x, z] of [[-32, 156], [-56, 182], [-24, 176]]) put('lantern', x, z, 0);
    W.placeObject(P.well(49), -34, 182, 0);
    put('signpost', -36.6, 190, 1.8); // (RF.7 review) on the corner of the T where the raider road now leaves the south road (it stood in the new road)
  }

  // ------------------------------------------------------------------ Brasswind Dig: Halim's excavation of the old engine works
  {
    W.placeObject(buriedWorks(50), 200, 152, 0.3);
    W.placeObject(buriedWorks(51), 210, 140, 2.1);
    W.placeObject(derrick(52), 190, 160, -0.8);
    W.placeObject(scaffold(53, 5, 3.4), 206, 160, 0.4);
    for (const [x, z, r] of [[184, 136, 0.9], [176, 144, 2.2]]) W.placeObject(workTent(54 + x, '#e0cca4'), x, z, r);
    W.placeObject(surveyTable(55), 181, 141.5, 0.9);
    W.placeObject(P.campfire(56), 180, 146, 0);
    for (const [x, z, k] of [[194, 140, 's'], [214, 156, 'r'], [188, 152, 'r'], [204, 130, 's']]) W.placeObject(k === 's' ? stoneStack(57 + x) : rubble(58 + x), x, z, x);
    W.placeObject(toolRack(59), 186, 132, 0.4);
    W.placeObject(B.ruinArch(60), 220, 150, 1.2);
    for (const [x, z] of [[178, 132], [192, 130]]) put('lantern', x, z, 0);
    put('signpost', 194, 126, 0.3);
  }

  // ------------------------------------------------------------------ Sandsunk Ruins: the vault doorway and Idrees' camp
  {
    for (const [x, z, n, rot] of [[-166, 196, 5, 0.2], [-140, 216, 4, -0.4], [-160, 220, 3, 1.4]]) for (let i = 0; i < n; i++) put(i % 2 ? 'column2' : 'column', x + Math.cos(rot) * i * 3.2, z + Math.sin(rot) * i * 3.2, rot + i);
    W.placeObject(B.ruinArch(61), -164, 206, 0.6);
    W.placeObject(B.ruinArch(62), -136, 210, -0.3);
    put('pillar0', -172, 188, 0.4); put('pillar1', -126, 220, 1.1);
    W.placeObject(workTent(63, '#e8d8b4'), -128, 190, -1.2);
    W.placeObject(surveyTable(64), -132.5, 196.5, -2.0);
    W.placeObject(P.campfire(65), -126, 197, 0);
    for (const [x, z, r] of [[-124, 192, 0.4], [-138, 188, 1.6]]) put('crates', x, z, r);
    for (const [x, z] of [[-130, 202], [-142, 192]]) put('lantern', x, z, 0);
  }

  // ------------------------------------------------------------------ Foundry Watch: the last outpost before the foundry
  {
    const cx = -104, cz = -110;
    palisadeRing(cx, cz, 14, [[0.6, 0.3], [PI + 0.6, 0.25], [-1.6, 0.2]]);
    for (const [x, z, r, c] of [[-110, -116, 0.6, '#b8c0c8'], [-97, -104, 2.4, '#c8c8b8'], [-112, -103, 1.6, '#b8c0c8']]) W.placeObject(workTent(66 + x, c), x, z, r);
    W.placeObject(P.campfire(67), -104, -108, 0);
    for (const [x, z] of [[-100, -116], [-108, -104]]) W.placeObject(bannerPost(68 + x), x, z, PI / 4);
    put('weaponRack', -95, -110, 1.4);
    for (const [x, z, r] of [[-114, -110, 0.2], [-96, -118, 1.0]]) put('crates', x, z, r);
    W.placeObject(B.watchtower(69), -116, -122, 0.6);
    for (const [x, z] of [[-92, -112], [-116, -100], [-104, -124]]) put('lantern', x, z, 0);
    put('signpost', -88, -110, 0.9);
  }

  // ------------------------------------------------------------------ the Old Sawmill in the Rustwood
  {
    W.placeObject(sawmillShed(), -206, -64, 0.25);
    for (const [x, z, r] of [[-194, -56, 0.3], [-214, -52, 1.2], [-198, -76, 2.0], [-218, -70, 0.7]]) W.placeObject(logPile(70 + Math.abs(x + z)), x, z, r);
    for (let i = 0; i < 14; i++) { const a = i * 2.3, rr = 14 + (i % 4) * 4; put('stump' + (i % 2), -205 + Math.cos(a) * rr, -62 + Math.sin(a) * rr, a, 0.9 + (i % 3) * 0.15); }
    W.placeObject(D.railTrack(71, 16), -190, -66, PI / 2 + 0.2);
    put('mineCart', -192, -66.5, PI / 2 + 0.2);
    W.placeObject(derrick(72), -220, -60, 1.4);
    for (const [x, z, k] of [[-196, -46, 0], [-214, -80, 1]]) put('scrap' + k, x, z, x);
    put('signpost', -186, -62, 1.4);
    // scavengers' shelter in the trees to the north-east
    for (const [x, z, r] of [[-172, -42, 0.8], [-166, -50, 2.4]]) put('tentTan', x, z, r);
    W.placeObject(P.campfire(73), -169, -46, 0);
    put('scrap0', -175, -50, 1.0);
  }


  // ------------------------------------------------------------------ the Coilway (Part Three): the Wardens' camp and the Brass Concord's depot
  {
    // Coilway Camp: a small Warden outpost where the road meets the flats
    const cx = -184, cz = -188;
    palisadeRing(cx, cz, 9, [[1.5, 0.36], [-2.47, 0.34]]);
    for (const [x, z, r, c] of [[-190.5, -184.5, 0.9, '#c8ccd4'], [-188.5, -194.5, 2.0, '#b8c4d0']]) W.placeObject(workTent(140 + x, c), x, z, r);
    W.placeObject(P.campfire(141), -184, -187, 0);
    for (const [x, z] of [[-178, -183], [-190, -196]]) W.placeObject(bannerPost(142 + x), x, z, PI / 4);
    put('weaponRack', -191.5, -189.5, 1.5);
    put('crates', -178.5, -193, 0.4);
    for (const [x, z] of [[-179, -187], [-189.5, -181.5]]) put('lantern', x, z, 0);
    W.placeObject(P.cart(143), -172.5, -180.5, 2.4);
    put('signpost', -179, -171, 1.3);
    // the Concord depot: a fenced yard of crates and carts at the foot of the pass; a clear aisle runs corner to corner
    // (south-east gate to north-west gate, on to the Strongrooms door), so nothing stands within 4 m of the line x = z
    palisadeRing(-224, -224, 15, [[PI / 4, 0.24], [-PI * 0.75, 0.2]]);
    W.placeObject(D.barn(148), -218, -230, PI / 4); // long side along the aisle, 4 m clear of it
    for (const [x, z, r] of [[-231, -215, 0.4], [-238, -227, 2.6]]) put('tentSand', x, z, r);
    W.placeObject(P.campfire(144), -229, -218, 0);
    for (const [x, z, r] of [[-219, -211, 0.2], [-235, -219, 1.3], [-211, -222, 2.3], [-226, -239, 0.7], [-238, -232, 1.1]]) W.placeObject(P.crateStack(145 + Math.abs(x)), x, z, r);
    put('sacks', -233, -217, 0.6);
    W.placeObject(D.railTrack(146, 12), -236, -221, -PI / 4);
    put('mineCart', -236, -221, -PI / 4);
    for (const [x, z, r] of [[-211, -218, 2.5], [-232, -224, 0.2]]) W.placeObject(P.cart(150 + Math.abs(x)), x, z, r);
    W.placeObject(B.watchtower(147), -237, -213, 0.8);
    put('scrap0', -236, -224, 1.2);
    put('coal', -231, -221, 0.6);
    for (const [x, z] of [[-209, -215], [-236, -231], [-222, -239]]) put('lantern', x, z, 0);
  }

  // ------------------------------------------------------------------ the Far Vale (Part Four): Pass Watch and the Concord's town of Ledgerholm
  {
    pre('tentSlate', P.raiderTent(141, 1, ['#5a6a7a', '#46525e', '#7a8a98', '#2e363e']));
    // Pass Watch: the Wardens' camp at the top of the pass, gate towards the road
    const px = -338, pz = -318;
    palisadeRing(px, pz, 8.5, [[0.45, 0.42], [-2.2, 0.3]]);
    for (const [x, z, r, c] of [[-343, -323, 0.6, '#c8ccd4'], [-334, -324, 2.4, '#b8c4d0']]) W.placeObject(workTent(160 + x, c), x, z, r);
    W.placeObject(P.campfire(161), -338, -317.5, 0);
    for (const [x, z] of [[-344, -313], [-331, -321]]) W.placeObject(bannerPost(162 + x), x, z, PI / 4);
    put('weaponRack', -344.5, -318, 1.6);
    put('crates', -340, -324.5, 0.3);
    for (const [x, z] of [[-335, -313], [-342, -321]]) put('lantern', x, z, 0);
    put('signpost', -330, -326, 0.7);
    // Ledgerholm: the council town behind a palisade, the long hall at the back, houses and stores round a yard
    const lx = -378, lz = -380;
    palisadeRing(lx, lz, 20, [[PI / 4, 0.2]]);
    W.placeObject(B.councilHall(170), -385, -387, PI / 4);
    W.buildHouses('ledgerholm'); // two townhouses and two towerhouses, all enterable (shared/houses.js lh_1..lh_4)
    for (const [x, z, r] of [[-366, -378, 1.0], [-378, -366, 2.1]]) put('tentSlate', x, z, r);
    W.placeObject(P.campfire(176), -376, -378, 0);
    for (const [x, z, r] of [[-370, -372, 0.4], [-381.6, -370.1, 2.0], [-372, -383, 1.1]]) W.placeObject(P.crateStack(177 + Math.round(Math.abs(x))), x, z, r); // (one moved off the lh_2 door path when the houses turned to the yard)
    for (const [x, z, r] of [[-364, -385, 1.2], [-385, -364, 0.3]]) if (!nearHouse(x, z, 1.2)) W.placeObject(P.cart(180 + Math.abs(x)), x, z, r); // (not in a house)
    for (const [x, z, r] of [[-394, -394, 0.8], [-362, -398, 0.2]]) W.placeObject(B.watchtower(182 + Math.abs(z)), x, z, r);
    put('sacks', -381, -375, 0.5);
    for (const [x, z] of [[-366, -369], [-376.7, -388.7], [-388.5, -377.2], [-379, -381]]) put('lantern', x, z, 0); // (two moved off the lh_3 and lh_4 door paths when the houses turned to the yard)
    put('signpost', -358, -356, 0.8);
  }

  // ------------------------------------------------------------------ the Wildworks (Part Seven): Scrapway Watch, the Wardens' camp at the basin's edge
  {
    pre('tentSlate', P.raiderTent(141, 1, ['#5a6a7a', '#46525e', '#7a8a98', '#2e363e']));
    palisadeRing(322, -330, 9, [[2.3, 0.4], [-0.6, 0.3]]);
    for (const [x, z, r] of [[326, -336, 0.4], [318, -337, 2.2]]) put('tentSlate', x, z, r);
    W.placeObject(P.campfire(270), 322, -330, 0);
    W.placeObject(B.watchtower(271), 329, -326, 0.6);
    for (const [x, z] of [[316, -330], [326, -324]]) W.placeObject(bannerPost(272 + x), x, z, PI / 4);
    put('weaponRack', 327, -332, 1.4);
    for (const [x, z] of [[320, -326], [325, -334]]) put('lantern', x, z, 0);
    for (const [x, z, k] of [[312, -322, 0], [332, -340, 1]]) put('scrap' + k, x, z, x);
  }

  // ------------------------------------------------------------------ the valley's engine in Sunmere: five stages, shown by the shared project
  {
    // (RF.7 review) moved east and turned along the north-east lane: at (25, -7) it stood on the lane once that was re-routed
    // to leave the east road square-on at x 22 (VALLEY in shared/data.js keeps the same spot)
    const vx = VALLEY.x, vz = VALLEY.z, vr = -PI / 2, parts = [];
    const stage = (fn, seed) => { const b = new Builder(seed); fn(b); return W.placeObject(res(b), vx, vz, vr); };
    // 1: a dressed-stone platform, timber scaffold poles round it (the scaffold comes down at the end)
    parts.push([stage((b) => { b.add(rbox(7, 0.5, 5, 0.06), 'stoneLarge', { p: [0, 0.25, 0], uv: 'box', c: '#d8d0c0' }); b.add(rbox(7.4, 0.14, 5.4, 0.04), 'stoneLarge', { p: [0, 0.5, 0], uv: 'box', c: '#c8c0b0' }); }, 300)]);
    const scaffold = stage((b) => { for (const [x, z] of [[-3.3, -2.3], [3.3, -2.3], [-3.3, 2.3], [3.3, 2.3]]) b.add(box(0.16, 6, 0.16), 'beam', { p: [x, 3, z], c: 0xffffff }); for (const y of [2, 4]) { b.add(box(6.8, 0.12, 0.12), 'beam', { p: [0, y, -2.3], c: 0xffffff }); b.add(box(6.8, 0.12, 0.12), 'beam', { p: [0, y, 2.3], c: 0xffffff }); } }, 301);
    // 2: the frame: two bronze A-legs and a beam
    parts.push([stage((b) => { for (const sx of [-1, 1]) { b.add(box(0.4, 3.6, 0.4), 'wBronze', { p: [sx * 2.4, 2.3, -0.9], r: [0.2, 0, 0], c: 0xffffff }); b.add(box(0.4, 3.6, 0.4), 'wBronze', { p: [sx * 2.4, 2.3, 0.9], r: [-0.2, 0, 0], c: 0xffffff }); } b.add(box(5.4, 0.45, 0.5), 'wBronze', { p: [0, 4.1, 0], c: 0xffffff }); }, 302)]);
    // 3: the water tank between the legs
    parts.push([stage((b) => { b.add(cyl(1.1, 1.1, 3.4, 22), 'wBronze', { p: [0, 2.3, 0], r: [0, 0, PI / 2], c: '#c89660' }); for (const x of [-1.2, 0, 1.2]) b.add(torus(1.12, 0.06, 6, 26), 'wVerdigris', { r: [0, PI / 2, 0], p: [x, 2.3, 0], c: 0xffffff }); b.add(rbox(1.4, 0.16, 0.08, 0.03), 'wGlowBlue', { p: [0, 2.3, 1.13] }); }, 303)]);
    // 4: two solid paddle wheels at the ends (rims and paddles, no spokes)
    parts.push([stage((b) => { for (const sx of [-1, 1]) { for (const s2 of [-0.2, 0.2]) b.add(cyl(1.5, 1.5, 0.06, 28), 'wBronze', { p: [sx * 3.0 + s2, 1.9, 0], r: [0, 0, PI / 2], c: '#b88a52' }); for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2; b.add(box(0.4, 0.5, 0.06), 'woodDark', { p: [sx * 3.0, 1.9 + Math.cos(a) * 1.25, Math.sin(a) * 1.25], r: [a, 0, 0], c: 0xffffff }); } } }, 304)]);
    // 5: the stack, a square lamp and the drawing's plain bronze plate
    const top = { ...res(new Builder(305)), smokes: [{ p: [0, 6.6, 0], opts: { rate: 2, size: 1.0, rise: 1.4, color: 0xd8d4cc, opacity: 0.4 } }] };
    top.builder.add(cyl(0.3, 0.38, 2.6, 14), 'wIron', { p: [0, 5.2, 0], c: '#4a4640' }); top.builder.add(rbox(0.5, 0.5, 0.5, 0.04), 'wGlowAmber', { p: [0, 4.6, 1.2] }); top.builder.add(rbox(1.4, 0.9, 0.08, 0.03), 'wBronze', { p: [0, 1.2, 2.55], c: '#d8b070' });
    parts.push([W.placeObject(top, vx, vz, vr)]);
    W.valleyParts = { parts, scaffold };
    W.setValleyStage = (st) => { parts.forEach((list, i) => list.forEach((o) => { o.visible = i < st; for (const c of o.userData.cols || []) c.off = i >= st; })); scaffold.visible = st >= 1 && st < 5; };
    W.setValleyStage(0);
  }

  // ------------------------------------------------------------------ the Homestead south of Sunmere (Part Seven): trophies and furnishings
  {
    const hx = -32, hz = 90, H = (W.home = {});
    W.buildHouses('homestead'); // the lodge, now an enterable cottage (shared/houses.js hs_lodge)
    for (let i = 0; i < 6; i++) { put('fence', hx - 9 + i * 3, hz + 10.5, 0); put('fence', hx - 9 + i * 3, hz - 10.5, 0); }
    for (let i = 0; i < 6; i++) put('fence', hx + 10.5, hz - 7.5 + i * 3 + (i >= 3 ? 1.5 : 0), PI / 2);
    const stand = (seed, top) => { const b = new Builder(seed); b.add(rbox(1.0, 1.0, 1.0, 0.06), 'stoneLarge', { p: [0, 0.5, 0], c: '#d8d0c0' }); b.add(rbox(1.15, 0.12, 1.15, 0.03), 'stoneLarge', { p: [0, 1.06, 0], c: '#c8c0b0' }); top(b); return res(b); };
    const trophies = {
      trophy_gavel: (b) => { b.add(cyl(0.05, 0.05, 0.7, 8), 'woodDark', { p: [0, 1.2, 0], r: [0, 0, PI / 2], c: 0xffffff }); b.add(cyl(0.12, 0.12, 0.32, 12), 'wGold', { p: [0.32, 1.2, 0], c: 0xffffff }); },
      trophy_compass: (b) => { b.add(cyl(0.3, 0.3, 0.08, 24), 'wBrass', { p: [0, 1.17, 0], c: 0xffffff }); b.add(box(0.05, 0.02, 0.42), 'wIron', { p: [0, 1.22, 0], r: [0, 0.6, 0], c: '#a03020' }); },
      trophy_core: (b) => { b.add(cyl(0.22, 0.22, 0.5, 14), 'crystalTeal', { p: [0, 1.38, 0] }); b.add(cyl(0.26, 0.26, 0.06, 14), 'wBrass', { p: [0, 1.14, 0], c: 0xffffff }); },
    };
    const plaque = (seed, color, heroic) => (b) => { b.add(rbox(0.8, 0.55, 0.08, 0.03), heroic ? 'wGold' : 'wBrass', { p: [0, 1.42, 0], c: 0xffffff }); b.add(rbox(0.62, 0.38, 0.03, 0.02), 'wPaint', { p: [0, 1.42, 0.05], c: color }); };
    Object.assign(trophies, {
      plaque_council: plaque(1, '#c8a050'), plaque_docks: plaque(2, '#26405e'), plaque_kiln: plaque(3, '#2a9a94'),
      plaque_hcouncil: plaque(4, '#c8a050', true), plaque_hdocks: plaque(5, '#26405e', true), plaque_hkiln: plaque(6, '#2a9a94', true),
      plaque_line: plaque(7, '#8a4a2a'), plaque_hline: plaque(8, '#8a4a2a', true),
      plaque_makers: plaque(9, '#3a7a6a'), plaque_hmakers: plaque(10, '#3a7a6a', true), plaque_hcopy: plaque(11, '#6a6a72', true),
      trophy_drawings: (b) => { b.add(rbox(0.9, 0.62, 0.06, 0.02), 'wBronze', { p: [0, 1.45, 0], c: 0xffffff }); b.add(box(0.76, 0.48, 0.02), 'plaster', { p: [0, 1.45, 0.035], c: '#f0e6cc' }); for (let i = 0; i < 4; i++) b.add(box(0.5 - i * 0.08, 0.012, 0.01), 'wIron', { p: [-0.05, 1.32 + i * 0.08, 0.05], c: '#5a4a3a' }); b.add(box(0.012, 0.3, 0.01), 'wIron', { p: [0.24, 1.45, 0.05], c: '#5a4a3a' }); },
      trophy_pattern: (b) => { b.add(cyl(0.11, 0.11, 0.7, 14), 'wBronze', { p: [0, 1.26, 0], r: [0, 0, PI / 2], c: 0xffffff }); b.add(cyl(0.12, 0.12, 0.06, 14), 'wVerdigris', { p: [0.33, 1.26, 0], r: [0, 0, PI / 2], c: 0xffffff }); b.add(cyl(0.12, 0.12, 0.06, 14), 'wVerdigris', { p: [-0.33, 1.26, 0], r: [0, 0, PI / 2], c: 0xffffff }); },
      trophy_drum: (b) => { b.add(cyl(0.24, 0.24, 0.34, 16), 'wBrass', { p: [0, 1.3, 0], r: [0, 0, PI / 2], c: 0xffffff }); b.add(cyl(0.05, 0.05, 0.56, 8), 'wIron', { p: [0, 1.3, 0], r: [0, 0, PI / 2], c: 0xffffff }); },
    });
    // four columns of stands between the lodge and the east fence, clear of the well (north) and the garden (south-east)
    Object.entries(trophies).forEach(([k, top], i) => { const x = hx + 0.4 + (i % 4) * 2.3, z = hz - 4.2 + Math.floor(i / 4) * 2.4; H[k] = W.placeObject(stand(241 + i, top), x, z, -PI / 2); });
    // the First Furnace plaques (Part Ten raid): their own stands beside the fifth row, clear of the garden beds
    H.plaque_furnace = W.placeObject(stand(270, plaque(12, '#a04a1e')), hx + 2.7, hz + 5.4, -PI / 2);
    H.plaque_hfurnace = W.placeObject(stand(271, plaque(13, '#a04a1e', true)), hx + 2.7, hz + 7.8, -PI / 2);
    // the Great Dam plaques (Part Eleven raid): under the last row of stands, beside the First Furnace's, clear of the bench
    H.plaque_dam = W.placeObject(stand(272, plaque(14, '#3a7aaa')), hx + 0.4, hz + 7.8, -PI / 2);
    H.plaque_hdam = W.placeObject(stand(273, plaque(15, '#3a7aaa', true)), hx - 1.9, hz + 7.8, -PI / 2);
    H.home_bench = W.placeObject(P.bench(250), hx - 2, hz + 6, PI);
    const lamps = [[hx - 8, hz + 8], [hx + 8, hz + 8], [hx - 8, hz - 8], [hx + 8, hz - 8]].map(([x, z]) => W.placeObject(P.lanternPost(251 + x), x, z, 0));
    H.home_lanterns = lamps;
    const garden = new Builder(252);
    for (const sx of [-1, 1]) { garden.add(rbox(1.6, 0.4, 3.2, 0.05), 'woodDark', { p: [sx * 1.1, 0.2, 0], c: 0xffffff }); garden.add(rbox(1.4, 0.12, 3.0, 0.05), 'dirtPlain', { p: [sx * 1.1, 0.42, 0], c: '#6a4a30' }); }
    H.home_garden = W.placeObject(res(garden), hx + 6, hz + 6, 0);
    for (let i = 0; i < 6; i++) { const f = W.placeObject(D.flowerBed(253 + i, 1.8, 1.0), hx + 5 + (i % 2) * 2.2, hz + 4.8 + Math.floor(i / 2) * 1.2, 0); (H.home_garden_f ||= []).push(f); }
    H.home_well = W.placeObject(P.well(259), hx + 6, hz - 7, 0);
    H.home_rack = W.placeObject(D.weaponRack(260), hx - 2, hz - 8.5, 0);
    H.home_firepit = W.placeObject(P.campfire(261), hx - 2.5, hz + 3.6, 0);
    const shed = new Builder(262);
    shed.add(box(4.2, 0.15, 3.2), 'wood', { p: [0, 2.6, 0], r: [0.12, 0, 0], c: '#9a7a54' });
    for (const [sx, sz] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) shed.add(cyl(0.1, 0.1, 2.6, 6), 'woodDark', { p: [sx, 1.3, sz], c: 0xffffff });
    H.home_runabout = W.placeObject(res(shed), hx - 6, hz + 7.5, 0);
    H.home_banner = [[hx + 10.5, hz - 1.5], [hx + 10.5, hz + 1.5]].map(([x, z]) => W.placeObject(bannerPost(263 + z), x, z, PI / 2));
    // the Makers' lamp post: a bronze column on a dressed stone foot, a square lantern on top (Explorers' Guild, Revered)
    {
      const b = new Builder(290);
      b.add(rbox(0.7, 0.4, 0.7, 0.05), 'stoneLarge', { p: [0, 0.2, 0], c: '#b4ab98' });
      b.add(rbox(0.5, 0.18, 0.5, 0.04), 'wVerdigris', { p: [0, 0.49, 0], c: 0xffffff });
      b.add(cyl(0.09, 0.12, 2.8, 12), 'wBronze', { p: [0, 1.98, 0], c: 0xffffff });
      for (const y of [1.0, 2.2, 3.3]) b.add(torus(0.12, 0.03, 6, 14), 'wVerdigris', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
      b.add(rbox(0.46, 0.08, 0.46, 0.02), 'wBronze', { p: [0, 3.42, 0], c: 0xffffff });
      b.add(rbox(0.34, 0.42, 0.34, 0.03), 'wGlowAmber', { p: [0, 3.68, 0] });
      b.add(rbox(0.5, 0.08, 0.5, 0.02), 'wBronze', { p: [0, 3.93, 0], c: 0xffffff });
      b.add(cyl(0.02, 0.14, 0.16, 4), 'wVerdigris', { p: [0, 4.05, 0], r: [0, PI / 4, 0], c: 0xffffff });
      H.home_makerlamp = W.placeObject({ ...res(b, { colliders: [{ r: 0.4 }] }), glows: [{ p: [0, 3.68, 0], color: 0xffb060, size: 1.6, k: 0.7 }] }, hx + 8.5, hz - 3, 0);
    }
    // faction standards along the back fence: a pole and a plain hanging cloth in each faction's colour
    Object.entries(HOME_DECO).filter(([k]) => k.startsWith('std_')).forEach(([k, Dd], i) => {
      const b = new Builder(280 + i);
      b.add(cyl(0.06, 0.07, 3.4, 8), 'woodDark', { p: [0, 1.7, 0], c: 0xffffff });
      b.add(box(0.9, 0.06, 0.06), 'woodDark', { p: [0.42, 3.3, 0], c: 0xffffff });
      b.add(box(0.8, 1.3, 0.04), 'wCloth', { p: [0.42, 2.6, 0], c: Dd.color });
      b.add(box(0.8, 0.1, 0.05), 'wGold', { p: [0.42, 1.92, 0], c: '#c8a050' });
      H[k] = W.placeObject(res(b), hx - 9.5 + i * 2.2, hz + 9.6, 0);
    });
  }

  // ------------------------------------------------------------------ the Harrow Coast (Part Five): Harrowmouth and the Guild Yards
  {
    // a timber pier from the beach out over the water (walkable: PIERS in terrain.js), posts down into the sea
    const pier = new Builder(190);
    const L = 48, x0 = 404, top = 1.75;
    pier.add(box(L, 0.16, 4.8), 'wood', { p: [L / 2, top - 0.08, 0], c: '#b89a70', us: 1 });
    for (let x = 1; x < L; x += 4) for (const sz of [-2.3, 2.3]) pier.add(cyl(0.16, 0.18, 8, 8), 'woodDark', { p: [x, top - 4.1, sz], c: 0xffffff });
    // hand rails (the south rail has a gap between the posts at 38 and 42 for the steam ship's gangway)
    pier.add(box(L, 0.12, 0.14), 'woodDark', { p: [L / 2, top + 0.55, -2.35], c: 0xffffff });
    for (const [a, z] of [[0, 38], [42, L]]) pier.add(box(z - a, 0.12, 0.14), 'woodDark', { p: [(a + z) / 2, top + 0.55, 2.35], c: 0xffffff });
    for (let x = 2; x < L; x += 4) for (const sz of [-2.35, 2.35]) pier.add(cyl(0.06, 0.06, 0.6, 6), 'woodDark', { p: [x, top + 0.28, sz], c: 0xffffff });
    W.placeObject(res(pier), x0, 80, 0, top - T.height(x0, 80) - top);
    // the valley's steam ship (Part Ten), moored along the south side of the pier end: bow out to sea, the gangway down
    // to the pier at x 444 (foot at 444, 1.75, 80.6), lines to two bollards on the pier. Ship space: x = 87 - world z,
    // z = world x - 455, y = height above the sea.
    {
      const SX = 455, SZ = 87, loc = (wx, y, wz) => [SZ - wz, y, wx - SX];
      const ship = buildSteamship({
        gangway: loc(444, top, 80.6),
        bollards: [loc(440.6, top, 81.75), loc(451.3, top, 81.75)],
        ropes: [[-16.0, 0], [-12.6, 0], [-1.0, 1], [14.2, 1]], // both stern lines stay aft of the gangway (ship z -11)
        iceBow: true, // shown once the ship has its ice bow (m_c33_refit, game.js)
      });
      ship.userData.iceBow.visible = false;
      W.harrowIceBow = ship.userData.iceBow;
      // the hull is a box collider (8 m by 34.4 m, its north face 0.6 m off the pier edge); the bollards are small posts
      const obj = W.placeAt({ builder: new Builder(1), dynamics: [ship], colliders: [{ x: 0, z: 0, hw: 3.95, hd: 17.2 }, { x: 5.25, z: -14.4, r: 0.3 }, { x: 5.25, z: -3.7, r: 0.3 }] }, SX, 0, SZ, PI / 2);
      obj.name = 'steamship';
      obj.userData.steamship = true;
      W.steamship = obj;
    }
    // Harrowmouth: warehouses and houses round the market, the rope-walk along the north side, a watchtower on the beach
    W.buildHouses('harrowmouth'); // four houses and the chandler's shop where the bazaar stood (shared/houses.js hm_*)
    W.placeObject(D.barn(195), 400, 100, PI * 0.5);
    for (const [x, z, r, c] of [[389, 83, 0.2, '#2a6a8a'], [397, 82, 1.6, '#a3362a'], [384, 90, 2.9, '#c8a050']]) W.placeObject(P.marketStall(197 + Math.abs(x), c), x, z, r);
    // the rope-walk: a long low shed with coils at its end
    const walk = new Builder(198);
    walk.add(box(22, 0.2, 3), 'woodLight', { p: [0, 2.6, 0], c: 0xffffff });
    for (let x = -10.5; x <= 10.5; x += 3.5) for (const sz of [-1.4, 1.4]) walk.add(cyl(0.1, 0.1, 2.6, 6), 'woodDark', { p: [x, 1.3, sz], c: 0xffffff });
    walk.add(box(21, 0.06, 0.06), 'woodLight', { p: [0, 1.0, 0], c: '#d8c098' });
    W.placeObject(res(walk), 374, 106, 0);
    for (const [x, z] of [[386, 106], [362, 106]]) put('sacks', x, z, x);
    W.placeObject(B.watchtower(199), 404, 62, 0.4);
    for (const [x, z, r] of [[405, 74, 0.3], [405, 88, 1.4], [370, 64, 2.1]]) put('crates', x, z, r);
    for (const [x, z, r] of [[410, 92, 1.2], [412, 70, 2.6], [413, 96, 0.4]]) W.placeObject(P.cart(200 + Math.abs(z)), x, z, r);
    put('sacks', 398, 74, 0.6);
    W.placeObject(P.campfire(202), 384, 80, 0);
    for (const [x, z] of [[380, 72], [392, 76], [376, 90], [404, 80], [420, 80], [436, 80], [450, 80]]) put('lantern', x, z, 0);
    for (const [x, z] of [[366, 76], [402, 84]]) W.placeObject(bannerPost(203 + x), x, z, PI / 4);
    put('signpost', 372, 44, 1.2);
    // the Guild Yards: slipways down into the sea, a half-built hull on one, engine sheds, timber stacks, a jib crane
    const gx = 385, gz = -50;
    palisadeRing(gx, gz, 22, [[0.15, 0.3], [PI * 0.62, 0.22]]);
    for (const sz of [-58, -42]) {
      const slip = new Builder(210 + sz);
      slip.add(box(30, 0.2, 7), 'wood', { p: [15, 0, 0], r: [0, 0, -0.12], c: '#9a7a54', us: 1 });
      for (let x = 2; x < 30; x += 3) slip.add(box(0.3, 0.22, 7.2), 'woodDark', { p: [x, 0.18 - x * 0.12, 0], r: [0, 0, -0.12], c: 0xffffff });
      W.placeObject(res(slip), 400, gz + (sz - gz), 0, 0.3);
    }
    // a hull frame: a keel and a row of curved ribs (open on top, no crossing members)
    const hull = new Builder(215);
    hull.add(box(18, 0.5, 0.6), 'woodDark', { p: [0, 0.5, 0], c: 0xffffff });
    for (let x = -8; x <= 8; x += 2) { const k = 1 - (x / 10) ** 2; for (const s2 of [-1, 1]) hull.add(torus(2.4 * k + 0.6, 0.12, 5, 10, PI / 2), 'wood', { p: [x, 2.9 * k + 0.6, 0], r: [0, PI / 2, s2 > 0 ? PI : -PI / 2], c: '#b08a5a' }); }
    W.placeObject(res(hull), 408, -58, 0, 1.4);
    for (const [x, z, r] of [[372, -60, 0], [372, -38, 0]]) W.placeObject(D.barn(216 + Math.abs(z)), x, z, r);
    // a jib crane: one mast with an arm reaching out over the slipway (on one side only)
    const crane = new Builder(218);
    crane.add(cyl(0.3, 0.38, 11, 8), 'wIron', { p: [0, 5.5, 0], c: '#6a6a70' });
    crane.add(box(9, 0.45, 0.45), 'wIron', { p: [4.5, 10.6, 0], c: '#6a6a70' });
    crane.add(cyl(0.03, 0.03, 4, 4), 'woodDark', { p: [8.6, 8.6, 0], c: 0xffffff });
    crane.add(rbox(0.9, 0.6, 0.9, 0.05), 'wIron', { p: [8.6, 6.4, 0], c: '#4a4a50' });
    W.placeObject(res(crane), 396, -50, 0);
    for (const [x, z, r] of [[380, -66, 0.3], [390, -36, 1.4], [378, -50, 2.4]]) put('log0', x, z, r);
    for (const [x, z, r] of [[386, -64, 0.6], [394, -40, 2.1]]) W.placeObject(P.crateStack(219 + Math.abs(z)), x, z, r);
    put('coal', 376, -46, 0.4);
    for (const [x, z] of [[384, -30], [374, -68], [398, -64]]) put('lantern', x, z, 0);
  }

  // ------------------------------------------------------------------ the Glass Waste (Part Six): Saltpan Camp and the Kilnworks
  {
    // Saltpan Camp: tents round a fire, stacks of cut salt, sledges, the well
    for (const [x, z, r] of [[-48, 384, 0.6], [-34, 392, 2.4], [-46, 394, -0.8]]) put('tentSand', x, z, r);
    W.placeObject(P.campfire(230), -40, 386, 0);
    const salt = new Builder(231);
    for (let i = 0; i < 9; i++) salt.add(rbox(0.9, 0.45, 0.6, 0.04), 'stoneLarge', { p: [(i % 3) * 0.95 - 0.95, 0.23 + Math.floor(i / 3) * 0.46, 0], c: '#f4f0e6' });
    for (const [x, z, r] of [[-30, 386, 0.2], [-52, 389, 1.3], [-36, 377, 2.0]]) W.placeObject(res(salt), x, z, r);
    const sledge = new Builder(232);
    for (const sx of [-0.7, 0.7]) sledge.add(box(0.12, 0.12, 3.2), 'woodDark', { p: [sx, 0.1, 0], c: 0xffffff });
    sledge.add(box(1.7, 0.1, 2.6), 'wood', { p: [0, 0.32, 0], c: '#b89a70' });
    for (let i = 0; i < 4; i++) sledge.add(rbox(0.8, 0.4, 0.55, 0.04), 'stoneLarge', { p: [(i % 2) * 0.85 - 0.42, 0.6, (i < 2 ? -0.5 : 0.5)], c: '#f4f0e6' });
    for (const [x, z, r] of [[-28, 380, 0.9], [-50, 377, 2.6]]) W.placeObject(res(sledge), x, z, r);
    W.placeObject(P.well(233), -41, 379, 0);
    for (const [x, z] of [[-36, 384], [-44, 388], [-30, 392]]) put('lantern', x, z, 0);
    put('crates', -47, 386, 0.4);
    put('signpost', -14, 376, 1.1);
    // the Kilnworks: a fenced yard of squat brick kilns with glowing mouths and short flues, glass heaped to cool, a glassblowers' shed
    const kx = 70, kz = 412;
    palisadeRing(kx, kz, 22, [[PI * 1.15, 0.24]]);
    const kiln = (seed) => {
      const b = new Builder(seed);
      b.add(rbox(4.2, 2.6, 4.2, 0.2), 'stoneDark', { p: [0, 1.3, 0], c: '#b07858' });
      b.add(rbox(4.5, 0.3, 4.5, 0.06), 'stoneDark', { p: [0, 2.7, 0], c: '#8a5a44' });
      b.add(rbox(1.3, 1.1, 0.3, 0.1), 'wGlowOrange', { p: [0, 0.75, 2.05] });
      b.add(rbox(1.0, 1.4, 1.0, 0.06), 'stoneDark', { p: [0.9, 3.5, -0.9], c: '#8a5a44' });
      return res(b, { glows: [{ p: [0, 0.9, 2.4], color: 0xff8a30, size: 2.6, intensity: 0.5 }], smokes: [{ p: [0.9, 4.3, -0.9], opts: { rate: 1.2, size: 1.0 } }], colliders: [{ x: 0, z: 0, hw: 2.3, hd: 2.3 }] });
    };
    for (const [x, z, r] of [[64, 400, 0.3], [80, 404, -0.4], [74, 422, 2.8], [58, 418, 1.6]]) W.placeObject(kiln(234 + x + z), x, z, r);
    for (const [x, z] of [[70, 412], [62, 408], [84, 416]]) W.placeObject(P.crystals(235 + x, 'crystalTeal'), x, z, x);
    W.placeObject(B.forge(236), 86, 424, -PI / 2);
    for (const [x, z, r] of [[52, 410, 0.4], [88, 398, 1.9]]) W.placeObject(P.crateStack(237 + x), x, z, r);
    put('coal', 78, 396, 0.6);
    for (const [x, z] of [[54, 404], [70, 398], [86, 410], [66, 428]]) put('lantern', x, z, 0);
  }

  // ------------------------------------------------------------------ Brightfield: the tillers' broken fences, a burnt haystack
  {
    for (let i = 0; i < 4; i++) put('fence', 104 + i * 3, 30.6, 0.1 + (i % 2) * 0.25);
    W.placeObject(P.cart(74), 112, 34, 1.1);
  }

  // ------------------------------------------------------------------ Westfold Farmsteads: Hadley's farms, overrun by harvesters
  {
    W.buildHouses('westfold'); // Hadley's farmhouse (enterable; shared/houses.js wf_farm)
    W.placeObject(D.barn(82), -212, 30, 1.2);
    W.placeObject(silo(83), -204, 18, 0);
    for (const [x, z, w, d, r] of [[-196, 46, 12, 9, 0.1], [-178, 50, 10, 8, -0.2], [-210, 54, 9, 8, 0.3]]) W.placeObject(D.wheatField(84 + x, w, d), x, z, r);
    for (const [x, z, r] of [[-188, 36, 0.5], [-202, 38, 1.4], [-172, 40, 2.2]]) put('haystack', x, z, r);
    for (let i = 0; i < 6; i++) put('fence', -204 + i * 3, 41.2, 0.05 + (i === 3 ? 0.5 : 0));
    W.placeObject(P.cart(85), -190, 30, 2.0);
    put('hayBales', -216, 40, 0.6);
    W.placeObject(D.trough(86), -180, 32, 0.3);
    for (const [x, z] of [[-186, 26], [-176, 30]]) put('lantern', x, z, 0);
  }

  // ------------------------------------------------------------------ Northwatch Keep: a ruined fort deep in the woods
  {
    const cx = 6, cz = -208;
    for (const [x, z, r, len] of [[-9, -208, PI / 2, 14], [21, -208, PI / 2, 14], [6, -223, 0, 22], [-3, -193, 0, 8], [15, -193, 0, 8]]) W.placeObject(ruinWall(90 + x + z, len, 3.8), x, z, r);
    for (const [x, z, h] of [[-9, -223, 6.5], [21, -223, 5.0], [-9, -193, 4.2], [21, -193, 5.8]]) W.placeObject(ruinTower(95 + x, h), x, z, 0);
    for (const [x, z] of [[2, -210], [12, -202], [-2, -216], [16, -216]]) W.placeObject(rubble(100 + x), x, z, x);
    W.placeObject(P.campfire(104), 8, -204, 0);
    for (const [x, z, r] of [[0, -200, 0.6], [14, -206, 2.2]]) put('tentTan', x, z, r);
    for (const [x, z] of [[4, -198], [18, -212]]) put('scrap' + (x % 2 ? 1 : 0), x, z, x);
  }

  // ------------------------------------------------------------------ the Proving Ring east of the village
  {
    const A = ARENA;
    const floor = new Builder(171);
    floor.add(torus(A.r + 0.7, 0.12, 6, 64), 'stone', { r: [Math.PI / 2, 0, 0], p: [0, 0.08, 0], c: '#a89a88' });
    W.placeObject(res(floor), A.x, A.z, 0, -0.02);
    // a low fence round the ring with an opening to the south, toward the Arena Master
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.32) continue;
      put('fence', A.x + Math.cos(a) * (A.r + 1.6), A.z + Math.sin(a) * (A.r + 1.6), -(a + Math.PI / 2)); // along the circle, never radial (radial reads as a sunburst)
    }
    for (const [x, z] of [[A.x - 3, A.z + A.r + 2], [A.x + 3, A.z + A.r + 2]]) W.placeObject(bannerPost(172 + x), x, z, 0);
    put('weaponRack', A.x - 6, A.z + A.r + 3.5, 0.2);
    // the dummies beside the ring are live targets (MOBS.dummy)
    for (const [x, z] of [[A.x - A.r - 2, A.z + A.r - 1], [A.x + A.r + 2, A.z + A.r - 1]]) put('lantern', x, z, 0);
  }

  // ------------------------------------------------------------------ the Highreach: lookout, Cragborn camp, the Coilfields
  {
    pre('tentSlate', P.raiderTent(141, 1, ['#5a6a7a', '#46525e', '#7a8a98', '#2e363e']));
    pre('tentSlateBig', P.raiderTent(142, 1.35, ['#4a5868', '#3a4652', '#6a7a8a', '#262e36']));
    // Highreach Lookout: a palisade ring at the head of the climb, grey canvas, a tower over the cliff
    const lx = 108, lz = -210;
    palisadeRing(lx, lz, 12.5, [[PI * 0.92, 0.32], [0.1, 0.3], [-PI / 2, 0.22]]);
    for (const [x, z, r, c] of [[100, -216, 0.5, '#c8ccd0'], [116, -214, 2.6, '#b8c0c8'], [113, -203, 1.9, '#c8c8c0']]) W.placeObject(workTent(140 + x, c), x, z, r);
    W.placeObject(P.campfire(143), 108, -210.5, 0);
    for (const [x, z] of [[103, -203], [116, -219]]) W.placeObject(bannerPost(144 + x), x, z, PI / 4);
    W.placeObject(B.watchtower(145), 98, -200, 0.8);
    put('weaponRack', 104, -217, 0.3);
    for (const [x, z, r] of [[118, -209, 0.4], [99, -210, 1.2]]) put('crates', x, z, r);
    for (const [x, z] of [[100, -205], [116, -205], [108, -219]]) put('lantern', x, z, 0);
    put('signpost', 90, -202, 0.9);
    put('signpost', 126, -216, 2.2);
    // Cragborn Camp: slate-grey tents around a fire pit, the thane's big tent at the back
    for (const [x, z, r] of [[140, -228, 0.9], [156, -228, 2.3], [142, -238, -0.4], [160, -236, 3.1]]) put('tentSlate', x, z, r);
    put('tentSlateBig', 152, -243, 0.1);
    W.placeObject(P.campfire(146), 149, -232, 0);
    for (const [x, z, r] of [[136, -232, 1.2], [162, -230, 2.0]]) put('crates', x, z, r);
    for (let i = 0; i < 5; i++) put('fence', 136 + i * 3, -222.5, 0.05 + (i === 2 ? 0.4 : 0));
    put('weaponRack', 154, -238, 2.8);
    for (const [x, z, k] of [[144, -242, 0], [164, -240, 1]]) put('scrap' + k, x, z, x);
    // the Coilfields: coil masts, cable runs between the pylons, wrecked rollers and scorched scrap
    const mast = (seed, h) => {
      const b = new Builder(seed);
      b.add(cyl(0.12, 0.16, h, 8), 'wPaint', { p: [0, h / 2, 0], c: '#46505e' });
      for (let i = 0; i < 6; i++) b.add(torus(0.28 - i * 0.025, 0.045, 6, 14), 'wCopper', { r: [PI / 2, 0, 0], p: [0, h * (0.55 + i * 0.07), 0] });
      b.add(cyl(0.32, 0.32, 0.08, 14), 'wPaint', { p: [0, h + 0.05, 0], c: '#5c6c82' });
      b.add(cyl(0.24, 0.24, 0.04, 14), 'wGlowBlue', { p: [0, h + 0.11, 0] });
      b.add(rbox(0.7, 0.4, 0.7, 0.05), 'wPaint', { p: [0, 0.2, 0], c: '#46505e' }); // a squat footing (no guy-wires: from above they read as a star)
      return res(b, { glows: [{ p: [0, h + 0.25, 0], color: 0x9ad8ff, size: 1.6 }] });
    };
    for (const [x, z, h] of [[186, -214, 7], [168, -220, 5], [192, -238, 5.5], [206, -213, 4.5]]) W.placeObject(mast(150 + x, h), x, z, 0);
    for (const [x, z, k] of [[172, -214, 0], [196, -218, 1], [182, -232, 0], [204, -230, 1], [166, -230, 1]]) put('scrap' + k, x, z, x * 0.7);
    put('signpost', 160, -208, 1.6);
  }

  // ------------------------------------------------------------------ caravan stops: a loaded cart and crates by each Caravan Master
  for (const c of CARAVANS) {
    if (islandAt(c.x, c.z)) continue; // the islands' stops are dressed by reachLayout.js and rimeLayout.js
    W.placeObject(P.cart(120 + Math.round(c.x)), c.x - 1.8, c.z - 1.2, 0.5);
    put('crates', c.x + 3.4, c.z - 0.6, c.x);
    put('sacks', c.x + 2.6, c.z + 1.6, c.z);
  }

  // ------------------------------------------------------------------ signposts at the junctions
  for (const [x, z, r] of [[-114, -4, 1.0], [-92, -122, 0.4], [-47, 12, 0.4], [-60, -84, 0.8], [146, -136, -0.6], [176, -56, 0.2], [154, -4, 2.4], [-150, -64, 1.6], [-29, 175, 0]]) put('signpost', x, z, r);
  dressFirstZone(W, put);
}

// ------------------------------------------------------------------ the first zone, lived in (Brightfield and the roads)
// Brightfield gets vegetable plots, scarecrows, straw bales, a wind engine, a woodpile and washing by the farmhouse;
// the roads out of the village get stones along their edges and the odd puddle. All of it is scatter (batched per material)
// except the wind engine, and only where spotFree says the ground is open (roads, the stream, NPCs, quest objects).
function dressFirstZone(W, put) {
  const S = W.scatter;
  const pre = (key, r2) => { if (!S.prefabs.has(key)) S.addPrefab(key, r2); };
  pre('scarecrow0', L.scarecrow(1)); pre('scarecrow1', L.scarecrow(2));
  pre('strawBales', L.strawBales(1)); pre('roundBale', L.roundBale(1));
  pre('fenceGate', L.fenceGate(1, 0.9));
  pre('edge0', L.edgeStones(1)); pre('edge1', L.edgeStones(2)); pre('edge2', L.edgeStones(3));
  pre('puddle0', L.puddle(1)); pre('puddle1', L.puddle(2));
  pre('woodPile', L.woodPile(1)); pre('laundry1', L.laundryLine(2, 4.2));
  pre('barrels0', L.barrels(1, 3)); pre('sacks0', L.sacks(1, 6)); pre('vwell', P.well(2));
  const tryPut = (key, x, z, r = 0, pad = 0.6, road = 3.0) => { if (!spotFree(W, x, z, pad, road)) { (W.dressSkips ||= []).push(`${key}@${x.toFixed(1)},${z.toFixed(1)}`); return false; } put(key, x, z, r); return true; };
  // vegetable plots behind the farmhouse and east of the north field
  // (each plot is built for its own patch of ground, so the rows lie on the slope instead of sinking into its high side)
  const plot = (seed, w, d, x, z, r) => {
    if (!spotFree(W, x, z, 0.2, 2.5)) { (W.dressSkips ||= []).push(`veg${seed}@${x},${z}`); return; }
    const T = W.terrain, c = Math.cos(r), sn = Math.sin(r), h0 = T.height(x, z);
    W.placeObject(L.vegRows(seed, w, d, (lx, lz) => T.height(x + lx * c + lz * sn, z - lx * sn + lz * c) - h0 - 0.02), x, z, r);
    T.paintEarth?.(x, z, w / 2 + 0.3, d / 2 + 0.3, r); // tilled earth under it: the meadow grass no longer hides the beds
  };
  plot(1, 8, 5, 94, -14.5, 0.05);
  plot(2, 7, 4, 131, 18.5, -0.1);
  // scarecrows stand in the wheat and the plots (a pole, a peg and a hanging coat)
  for (const [k, x, z, r] of [['scarecrow0', 101.5, 3.2, 0.6], ['scarecrow1', 114.5, 21.2, -0.4], ['scarecrow1', 94.6, -14.4, 1.2], ['scarecrow0', 88.2, 25.4, 2.2], ['scarecrow0', 131.4, 18.7, -0.8]]) put(k, x, z, r);
  // bales: stacks by the barn and round bales in the stubble
  for (const [k, x, z, r] of [['strawBales', 118, -8.5, 0.3], ['strawBales', 127, 13.6, 1.2], ['strawBales', 96.5, 38.5, 2.0], ['roundBale', 108, 30.5, 0.4], ['roundBale', 110.6, 33.2, 1.7], ['roundBale', 82, 18.5, 2.6], ['roundBale', 128.5, 26.5, 0.2]]) tryPut(k, x, z, r, 0.4, 3);
  // the north field's open east end gets a gate (swung open)
  put('fenceGate', 113.6, 4.2, Math.PI / 2 + 0.08);
  // the farmhouse yard: a woodpile, washing, barrels and sacks at the barn door, a well
  tryPut('woodPile', 89.6, -6.2, Math.PI / 2, 0.3, 3);
  tryPut('laundry1', 78.5, -12.6, 0.2, 0.8, 3);
  tryPut('sacks0', 119.4, 1.8, 1.1, 0.3, 2.5);
  tryPut('barrels0', 119.2, -4.6, 0.4, 0.3, 2.5);
  tryPut('vwell', 101, -6.5, 0.2, 1.0, 3);
  // a wind engine on the rise west of the fields: five broad boards on a solid hub turning slowly
  if (spotFree(W, 63, 33, 2.6, 6)) { W.placeObject(L.windEngine(1), 63, 33, 0.5); W.clearings?.push({ x: 63, z: 33, r: 16 }); }
  else if (spotFree(W, 76, 36, 2.6, 6)) W.placeObject(L.windEngine(1), 76, 36, 0.6);
  else (W.dressSkips ||= []).push('windEngine');
  // drifting leaves over the fields
  W.placeAt({ builder: new Builder(1), dynamics: [L.driftingLeaves(W.terrain, 104, 12, 40, 110)] }, 104, 0, 12);
  // road edges: small stones every few metres on alternate sides, a puddle now and then on the dirt stretches
  const nearBridge = (x, z) => BRIDGES.some((b) => Math.hypot(x - (b.a[0] + b.b[0]) / 2, z - (b.a[1] + b.b[1]) / 2) < 8);
  let n = 0;
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      const [ax, az] = road[i], [bx, bz] = road[i + 1], Lseg = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / Lseg, nz = (bx - ax) / Lseg;
      for (let t = 2; t < Lseg; t += 4.3) {
        const x0 = ax + (bx - ax) * (t / Lseg), z0 = az + (bz - az) * (t / Lseg), dc = Math.hypot(x0, z0);
        if (x0 < -130 || x0 > 200 || z0 < -160 || z0 > 140 || dc < 17 || islandAt(x0, z0) || nearBridge(x0, z0)) continue;
        n++;
        const side = n % 2 ? 1 : -1, off = 3.4 + ((n * 7) % 5) * 0.12;
        const x = x0 + nx * off * side, z = z0 + nz * off * side;
        if (roadDist(x, z) < 2.6 || streamInfo(x, z).d < 4) continue;
        if (spotFree(W, x, z, 0.3, 2.6)) put('edge' + (n % 3), x, z, n * 1.3, 0.9 + (n % 4) * 0.1);
        if (dc > 45 && n % 9 === 0 && streamInfo(x0, z0).d > 6 && spotFree(W, x0 + nx * 0.6, z0 + nz * 0.6, 0.3, 0)) put('puddle' + (n % 2), x0 + nx * 0.6, z0 + nz * 0.6, Math.atan2(nx, nz), 1);
      }
    }
  }
}
