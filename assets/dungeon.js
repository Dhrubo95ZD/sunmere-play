// Dungeon interiors and their overworld entrances, built from the shared 2 m cell grids (shared/dungeons.js).
//   mine    (Ironcliff Deepmine): rough rock walls, timber supports along the tunnels, rails, carts, ore, lanterns
//   vault   (Sandsunk Vault):     dressed sandstone halls, columns, braziers, red banners, sand drifts, urns
//   foundry (The Foundry Depths): brick halls, pipes along the walls, molten channels, furnaces, wall gears
// There are no ceilings (the camera looks down); the rock between passages is capped with a dark mass.
import * as THREE from 'three';
import { Builder, box, rbox, cyl, cone, sphere, torus, lathe, extrude, arcShape, gear, ico, taper } from './kit.js';
import { addRock } from './trees.js';
import { fire, glowSprite, lanternBuilder, smoke, assemble } from './dynamic.js';
import { mineCart, railTrack } from './dressing.js';
import { rubble, stoneStack, workTent } from './quarry.js';
import { crateStack, campfire, cart } from './props.js';
import { CELL, cellFloor, dungeonTide } from '/sunmere-play/shared/dungeons.js';
import { tideNow } from '/sunmere-play/shared/tidewater.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { getMat } from '../engine/materials.js';
import { G } from '../engine/globals.js';
// deep (The Deepway):      the Makers' undercity: grey dressed stone, lamp-lit water channels, light shafts, paddle wheels, counterweights
// ore (The Ore Galleries):  the Makers' mine under the Cinder Reach: rough dark basalt, glowing ore seams in the walls, timber and
//                           brass shoring, rails and ore carts, glowing slag pools, grading screens and sorting bins
// furnace (The Makers' First Furnace): the casting hall under the Old Works: dark basalt masonry and blackened brass, great
//                           bellows, pouring channels, casting pits, crane rails, pattern racks and the First Furnace's hall
// sluice (The Sluice Galleries): the Makers' tunnels inside the old dam on the Rime Steps: grey dressed stone and blackened
//                           bronze, running and frozen water channels, solid gate wheels on the walls, sluice gates, turbine
//                           pits, frost and icicles on everything, an ice tide-line round the Floodgate Hall
// dam (The Great Dam):      inside the Makers' greatest dam high in the glacier: tall halls of grey dressed stone, square piers
//                           and flat lintels, blackened bronze, the great penstocks, the stepped spillway, turbine pits, and the
//                           dam's master gate in the Dam Heart; frost, icicles and running water everywhere, well lit
// pump (The Pump Works):    the shafts under the Engine Rows on the Windward Heights: grey rock walls with a rising main
//                           along them, black timber staging, square shafts with rocking beam engines working the pump
//                           rods, stone cisterns of meltwater, the Great Shaft under its headframe; frost and drips, well lit
// mills (The Mill Races):   the wheel pits and race tunnels under the tide mills on Tidewater Sound: wet grey stone with tarred
//                           timber linings and a pale salt line, timber log races, square pits that flood and drain with
//                           the short tide in the races, stacked logs and sawn boards laid parallel, the Great Undershot's race
// workshop (The Makers' Rest): the Makers' last workshop under the hollow on the Windward Heights: a workshop, not a tomb.
//                           Whitewashed walls over timber skirting, a boarded floor, oiled timber posts, square frosted windows
//                           high up, lamps lit everywhere; tool racks with brass labels, workbenches, crane rails on corbels,
//                           racks of finished sail-boards, line shafting with flat belts down to small lathes, and the
//                           Governor Room with its rod channels, the clerk's desk and the day book

const PI = Math.PI;
const THEME = {
  mine: { floor: 'dFloorMine', wall: 'dWallMine', wallH: 3.6, light: 0xffb060 },
  warren: { floor: 'dFloorMine', wall: 'dWallMine', wallH: 3.2, light: 0xffb060, floorTint: '#b08a62', rock: '#a07a58' },
  vault: { floor: 'dFloorVault', wall: 'dWallVault', wallH: 3.8, light: 0xffa850 },
  foundry: { floor: 'dFloorFoundry', wall: 'dWallFoundry', wallH: 4.2, light: 0xff8a40 },
  storm: { floor: 'dFloorFoundry', wall: 'dWallFoundry', wallH: 4.4, light: 0x8ac8ff, floorTint: '#9aa8b8' },
  deep: { floor: 'dFloorDeep', wall: 'dWallDeep', wallH: 5.0, light: 0xffb060, floorUs: 0.15 },
  ore: { floor: 'dFloorMine', wall: 'dWallMine', wallH: 3.6, light: 0xffa050, floorTint: '#a8a094', rock: '#827c76' },
  furnace: { floor: 'dFloorFoundry', wall: 'dWallFoundry', wallH: 5.0, light: 0xff9040, floorTint: '#b4aca6', wallTint: '#8e827c' },
  sluice: { floor: 'dFloorDeep', wall: 'dWallDeep', wallH: 5.0, light: 0xffc890, floorTint: '#b4bcc2', wallTint: '#9aa2a8', floorUs: 0.15 },
  dam: { floor: 'dFloorDeep', wall: 'dWallDeep', wallH: 6.4, light: 0xffc890, floorTint: '#bcc4ca', wallTint: '#a2aab0', floorUs: 0.12 },
  pump: { floor: 'dFloorDeep', wall: 'dWallMine', wallH: 5.6, light: 0xffc890, floorTint: '#aeb2b4', wallTint: '#9a9ea2', floorUs: 0.14 },
  mills: { floor: 'dFloorDeep', wall: 'dWallDeep', wallH: 5.2, light: 0xffc890, floorTint: '#9a9890', wallTint: '#8a8a84', floorUs: 0.15 },
  seagate: { floor: 'dFloorDeep', wall: 'dWallDeep', wallH: 6.2, light: 0xffc890, floorTint: '#8e928c', wallTint: '#7e8480', floorUs: 0.15 },
  workshop: { floor: 'dFloorBoard', wall: 'plaster', wallH: 5.6, light: 0xffd8a0, floorTint: '#f4e8d4', wallTint: '#ece6d8', floorUs: 0.18 },
};

// brazier: a bronze bowl on a stone pedestal (fire added by the caller)
function brazier(b, x, z, s = 1) {
  b.add(rbox(0.7 * s, 0.25 * s, 0.7 * s, 0.04), 'dWallVault', { p: [x, 0.12 * s, z], uv: 'box', us: 0.4, c: '#e0d0b0' });
  b.add(cyl(0.18 * s, 0.24 * s, 0.9 * s, 10), 'dWallVault', { p: [x, 0.7 * s, z], uv: 'box', us: 0.4, c: '#e8d8bc' });
  b.add(lathe([[0.001, 0], [0.2, 0], [0.42, 0.18], [0.5, 0.32], [0.46, 0.36], [0.001, 0.2]].map(([r, y]) => [r * s, y * s]), 16), 'dBrass', { p: [x, 1.12 * s, z], c: 0xffffff });
}

export function buildDungeon(D) {
  const TH = THEME[D.theme], H = TH.wallH;
  const rng = mulberry32(D.ox * 3 + 11);
  const r = (a = 0, b = 1) => a + (b - a) * rng();
  const b = new Builder(D.ox);
  const group = new THREE.Group();
  group.position.set(D.ox, 0, D.oz);
  const dyn = [], torches = [], colliders = [];
  const F = (i, j) => cellFloor(D, i, j);
  const cx = (i) => (i + 0.5) * CELL, cz = (j) => (j + 0.5) * CELL;
  const isFloorL = (x, z) => F(Math.floor(x / CELL), Math.floor(z / CELL));
  const addDyn = (o, x, y, z) => { o.position.set(x, y, z); group.add(o); dyn.push(o); return o; };
  const torch = (x, y, z, scale = 0.6, color = TH.light) => {
    addDyn(fire(scale, { light: false }), x, y, z);
    torches.push({ x: D.ox + x, y: y + 0.5, z: D.oz + z, color });
  };
  const col = (x, z, rr) => colliders.push({ x: D.ox + x, z: D.oz + z, r: rr });
  const placeRes = (res, x, z, rot = 0, y = 0) => {
    if ((res.fires && res.fires.length) || (res.lanterns && res.lanterns.length) || (res.smokes && res.smokes.length) || (res.dynamics && res.dynamics.length) || (res.glows && res.glows.length)) {
      const o = assemble(res); o.rotation.y = rot; addDyn(o, x, y, z);
    } else b.addBuilder(res.builder, { p: [x, y, z], r: [0, rot, 0] });
  };

  // ---------------------------------------------------------------- floor
  b.add(box(D.w, 0.4, D.h), TH.floor, { p: [D.w / 2, -0.2, D.h / 2], uv: 'box', us: TH.floorUs || 0.2, c: TH.floorTint || 0xffffff });

  // ---------------------------------------------------------------- walls and the rock cap
  const edgeCells = [];
  for (let j = 0; j < D.nz; j++) for (let i = 0; i < D.nx; i++) {
    if (F(i, j)) continue;
    let near = false;
    for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) if (F(i + di, j + dj)) { near = true; break; }
    if (near) edgeCells.push([i, j]);
  }
  const cave = D.theme === 'mine' || D.theme === 'warren' || D.theme === 'ore';
  if (cave) {
    const ore = D.theme === 'ore';
    for (const [i, j] of edgeCells) {
      const h = r(2.4, 3.4);
      const tint = ore ? (rng() < 0.25 ? '#6e6864' : rng() < 0.5 ? '#948e88' : '#827c76') : TH.rock || (rng() < 0.15 ? '#c89870' : '#d8c8b0');
      addRock(b, [cx(i) + r(-0.4, 0.4), h * 0.42, cz(j) + r(-0.4, 0.4)], [r(1.35, 1.75), h, r(1.35, 1.75)], i * 131 + j * 7, { mat: 'dWallMine', moss: D.theme === 'warren' ? 0.25 : 0, tint, rot: r(0, 6) });
    }
  } else {
    // wall blocks: runs of edge cells along each row become one long block (far fewer triangles in the big regions)
    { const rows = new Map(); for (const [i, j] of edgeCells) (rows.get(j) || rows.set(j, []).get(j)).push(i);
      for (const [j, is] of rows) { is.sort((a, c) => a - c); let a = is[0], prev = a;
        for (let q = 1; q <= is.length; q++) { const i = is[q]; if (i === prev + 1) { prev = i; continue; }
          const n = prev - a + 1; b.add(box(CELL * n, H, CELL), TH.wall, { p: [(a + n / 2) * CELL, H / 2, cz(j)], uv: 'box', us: 0.32, c: TH.wallTint || 0xffffff }); a = prev = i; } } }
    const runs = new Map(); // straight runs of wall faces, for the plinth and cornice
    // trim on every wall face that looks into a room: a plinth, a cornice, a pilaster every few metres
    let k = 0;
    for (let j = 0; j < D.nz; j++) for (let i = 0; i < D.nx; i++) {
      if (!F(i, j)) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (F(i + di, j + dj)) continue;
        const fx = cx(i) + di * (CELL / 2), fz = cz(j) + dj * (CELL / 2), rot = di ? PI / 2 : 0;
        const deep = D.theme === 'deep', fur = D.theme === 'furnace', slu = D.theme === 'sluice', dam = D.theme === 'dam', pmp = D.theme === 'pump', wks = D.theme === 'workshop', plinthMat = D.theme === 'vault' ? 'dWallVault' : deep ? 'dWallDeep' : wks ? 'dTimber' : 'dIron';
        { const key = di ? `x${di}:${i}` : `z${dj}:${j}`; (runs.get(key) || runs.set(key, { di, dj, line: di ? fx : fz, mat: plinthMat, c1: D.theme === 'vault' ? '#c8b494' : deep ? '#a89e8a' : fur ? '#3e3a38' : slu || dam || pmp ? '#3a3632' : wks ? '#c8a888' : '#7a7a80', c2: D.theme === 'vault' ? '#f4e6cc' : deep ? '#c8c0ac' : fur ? '#8a6a3a' : slu ? '#6a5a40' : dam ? '#8a949a' : pmp ? '#4e3e30' : wks ? '#e0c8a4' : '#5a5a60', at: [] }).get(key)).at.push(di ? j : i); }
        // the casting hall: a dark basalt pilaster every few metres, banded in blackened brass
        if (fur && k % 3 === 0) { b.add(box(0.7, H - 0.4, 0.3), 'dWallFoundry', { p: [fx - di * 0.15, H / 2, fz - dj * 0.15], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#4a4442' }); b.add(box(0.8, 0.16, 0.36), 'dBrass', { p: [fx - di * 0.16, H - 0.9, fz - dj * 0.16], r: [0, rot, 0], c: '#7a5e34' }); }
        // the dam's galleries: a grey stone pilaster every few metres banded in blackened bronze, frost on its cap, icicles
        // off the cornice, and now and then a frozen seep down the wall
        if (slu && k % 3 === 0) {
          b.add(box(0.8, H - 0.4, 0.34), 'dWallDeep', { p: [fx - di * 0.17, H / 2, fz - dj * 0.17], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#8a9298' });
          for (const y of [1.0, H - 1.0]) b.add(box(0.9, 0.16, 0.4), 'dBrass', { p: [fx - di * 0.18, y, fz - dj * 0.18], r: [0, rot, 0], c: '#4e4236' });
          b.add(ico(0.22, 0), 'snowPack', { p: [fx - di * 0.2, H - 0.18, fz - dj * 0.2], s: [2.2, 0.5, 1.4], r: [0, rot, 0], c: 0xffffff });
        }
        if (slu && k % 2 === 1) for (let q = 0; q < 3; q++) { const l = 0.25 + ((k * 7 + q * 3) % 5) * 0.09, o = (q - 1) * 0.55; b.add(cone(0.06, l, 5), 'ice', { p: [fx - di * 0.22 + (di ? 0 : o), H - 0.26 - l / 2, fz - dj * 0.22 + (dj ? 0 : o)], r: [PI, 0, 0], c: 0xffffff }); }
        if (slu && k % 7 === 3) b.add(box(0.5, H - 1.2, 0.06), 'ice', { p: [fx - di * 0.05, (H - 1.2) / 2 + 0.3, fz - dj * 0.05], r: [0, rot, 0], c: 0xffffff });
        // the Great Dam: a tall square pier of grey dressed stone every few metres, stepped at the foot, banded twice in
        // blackened bronze, a flat stone cap with frost on it; icicles off the cornice, frozen seeps down the wall now and then
        if (dam && k % 3 === 0) {
          b.add(box(1.1, 0.5, 0.56), 'dWallDeep', { p: [fx - di * 0.28, 0.25, fz - dj * 0.28], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#7c848a' });
          b.add(box(0.9, H - 0.6, 0.42), 'dWallDeep', { p: [fx - di * 0.21, H / 2 - 0.1, fz - dj * 0.21], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#929aa0' });
          for (const y of [1.3, H - 1.4]) b.add(box(1.0, 0.18, 0.48), 'dBrass', { p: [fx - di * 0.22, y, fz - dj * 0.22], r: [0, rot, 0], c: '#463c34' });
          b.add(box(1.16, 0.26, 0.56), 'dWallDeep', { p: [fx - di * 0.28, H - 0.5, fz - dj * 0.28], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#a8b0b6' });
          b.add(ico(0.24, 0), 'snowPack', { p: [fx - di * 0.3, H - 0.32, fz - dj * 0.3], s: [2.2, 0.5, 1.4], r: [0, rot, 0], c: 0xffffff });
        }
        if (dam && k % 2 === 1) for (let q = 0; q < 3; q++) { const l = 0.3 + ((k * 7 + q * 3) % 5) * 0.1, o = (q - 1) * 0.55; b.add(cone(0.06, l, 5), 'ice', { p: [fx - di * 0.22 + (di ? 0 : o), H - 0.26 - l / 2, fz - dj * 0.22 + (dj ? 0 : o)], r: [PI, 0, 0], c: 0xffffff }); }
        if (dam && k % 9 === 4) b.add(box(0.6, H - 1.6, 0.06), 'ice', { p: [fx - di * 0.05, (H - 1.6) / 2 + 0.4, fz - dj * 0.05], r: [0, rot, 0], c: 0xffffff });
        // the Pump Works: a black timber upright shod in iron every few metres (the shaft lining), the rising main along the
        // wall high up, flanged every other face, icicles off it, and now and then a frozen seep down the rock
        if (pmp && k % 3 === 0) {
          b.add(box(0.5, H - 0.3, 0.3), 'dTimber', { p: [fx - di * 0.15, (H - 0.3) / 2, fz - dj * 0.15], r: [0, rot, 0], c: 0xffffff });
          for (const y of [0.8, H - 1.6]) b.add(box(0.56, 0.12, 0.36), 'dIron', { p: [fx - di * 0.16, y, fz - dj * 0.16], r: [0, rot, 0], c: '#3e4246' });
        }
        if (pmp) {
          b.add(cyl(0.2, 0.2, CELL, 10), 'dIron', { p: [fx - di * 0.42, H - 1.0, fz - dj * 0.42], r: di ? [PI / 2, 0, 0] : [0, 0, PI / 2], c: '#4a4e52' });
          if (k % 2 === 0) b.add(cyl(0.27, 0.27, 0.1, 10), 'dBrass', { p: [fx - di * 0.42, H - 1.0, fz - dj * 0.42], r: di ? [PI / 2, 0, 0] : [0, 0, PI / 2], c: '#8a6c42' });
          if (k % 2 === 1) for (let q = 0; q < 2; q++) { const l = 0.2 + ((k * 7 + q * 3) % 5) * 0.08, o = (q - 0.5) * 0.7; b.add(cone(0.05, l, 5), 'ice', { p: [fx - di * 0.42 + (di ? 0 : o), H - 1.22 - l / 2, fz - dj * 0.42 + (dj ? 0 : o)], r: [PI, 0, 0], c: 0xffffff }); }
          if (k % 7 === 3) b.add(box(0.5, H - 1.6, 0.06), 'ice', { p: [fx - di * 0.05, (H - 1.6) / 2 + 0.2, fz - dj * 0.05], r: [0, rot, 0], c: 0xffffff });
        }
        // the Makers' Rest: an oiled timber post every few metres, shod in iron, stopping under a flat timber cap below the
        // crane rails and line shafting (so nothing runs across a post), and now and then a square frosted window high on the
        // wall in a plain timber frame, never on a post (no glazing bars: they drew a + on every pane)
        if (wks && k % 3 === 0) {
          b.add(box(0.44, 3.9, 0.3), 'dTimber', { p: [fx - di * 0.15, 1.95, fz - dj * 0.15], r: [0, rot, 0], c: '#d8b088' });
          b.add(box(0.5, 0.12, 0.36), 'dIron', { p: [fx - di * 0.16, 0.55, fz - dj * 0.16], r: [0, rot, 0], c: '#3e4246' });
          b.add(box(0.62, 0.2, 0.42), 'dTimber', { p: [fx - di * 0.2, 3.95, fz - dj * 0.2], r: [0, rot, 0], c: '#b08860' });
        }
        if (wks && k % 7 === 5 && k % 3 !== 0) {
          b.add(box(1.4, 0.72, 0.1), 'dTimber', { p: [fx - di * 0.04, 5.06, fz - dj * 0.04], r: [0, rot, 0], c: '#c8a07a' });
          b.add(box(1.14, 0.5, 0.06), 'ice', { p: [fx - di * 0.08, 5.06, fz - dj * 0.08], r: [0, rot, 0], c: '#f4f8fa' });
        }
        // the Mill Races: a tarred timber lining post every few metres, shod in iron, and the pale salt line round the walls
        // where the races flood
        if (D.theme === 'mills' && k % 3 === 0) {
          b.add(box(0.46, H - 0.3, 0.28), 'dTimber', { p: [fx - di * 0.14, (H - 0.3) / 2, fz - dj * 0.14], r: [0, rot, 0], c: '#5a4c40' });
          for (const y of [0.7, H - 1.4]) b.add(box(0.52, 0.12, 0.34), 'dIron', { p: [fx - di * 0.15, y, fz - dj * 0.15], r: [0, rot, 0], c: '#3e4246' });
        }
        // the Sea Gate: a square pier of dressed grey stone every few metres, stepped at the foot, banded twice in salt-eaten
        // iron under a flat stone cap, and the pale salt line round every wall where the galleries flood
        if (D.theme === 'seagate' && k % 3 === 0) {
          b.add(box(1.1, 0.5, 0.56), 'dWallDeep', { p: [fx - di * 0.28, 0.25, fz - dj * 0.28], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#6e7470' });
          b.add(box(0.9, H - 0.6, 0.4), 'dWallDeep', { p: [fx - di * 0.2, H / 2 - 0.1, fz - dj * 0.2], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#8a908c' });
          for (const y of [1.4, H - 1.5]) b.add(box(1.0, 0.16, 0.46), 'dIron', { p: [fx - di * 0.21, y, fz - dj * 0.21], r: [0, rot, 0], c: '#3e4246' });
          b.add(box(1.16, 0.24, 0.56), 'dWallDeep', { p: [fx - di * 0.28, H - 0.5, fz - dj * 0.28], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#9aa09c' });
        }
        if (D.theme === 'seagate') b.add(box(CELL + 0.02, 0.14, 0.05), 'snowPack', { p: [fx - di * 0.03, 1.35, fz - dj * 0.03], r: [0, rot, 0], c: '#d8d4ca' });
        if (D.theme === 'mills') b.add(box(CELL + 0.02, 0.14, 0.05), 'snowPack', { p: [fx - di * 0.03, 1.15, fz - dj * 0.03], r: [0, rot, 0], c: '#d8d4ca' });
        if (deep && k % 4 === 0) b.add(box(0.6, H - 0.5, 0.22), 'dWallDeep', { p: [fx - di * 0.11, H / 2, fz - dj * 0.11], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#b8b09c' });
        k++;
        if (D.theme === 'vault' && k % 3 === 0) b.add(box(0.55, H - 0.4, 0.22), 'dWallVault', { p: [fx - di * 0.11, H / 2, fz - dj * 0.11], r: [0, rot, 0], uv: 'box', us: 0.4, c: '#f0e0c4' });
        if (D.theme === 'storm') {
          b.add(box(CELL + 0.02, 0.12, 0.08), 'dBrass', { p: [fx - di * 0.28, H - 0.9, fz - dj * 0.28], r: [0, rot, 0], c: '#d08050' });
          b.add(box(CELL + 0.02, 0.12, 0.08), 'dBrass', { p: [fx - di * 0.28, H - 1.25, fz - dj * 0.28], r: [0, rot, 0], c: '#d08050' });
          if (k % 4 === 0) b.add(box(0.26, 0.5, 0.14), 'dIron', { p: [fx - di * 0.28, H - 1.07, fz - dj * 0.28], r: [0, rot, 0], c: '#c8ccd0' });
        }
        if (D.theme === 'foundry') {
          // pipes run along every wall, flanged at each joint
          b.add(cyl(0.16, 0.16, CELL, 10), 'dBrass', { p: [fx - di * 0.3, H - 0.75, fz - dj * 0.3], r: di ? [PI / 2, 0, 0] : [0, 0, PI / 2], c: k % 7 === 0 ? '#c88a5a' : 0xffffff });
          if (k % 2 === 0) b.add(cyl(0.22, 0.22, 0.08, 10), 'dIron', { p: [fx - di * 0.3, H - 0.75, fz - dj * 0.3], r: di ? [PI / 2, 0, 0] : [0, 0, PI / 2], c: 0xffffff });
          if (k % 5 === 0) b.add(cyl(0.07, 0.07, H - 1.0, 8), 'dIron', { p: [fx - di * 0.42 + (di ? 0 : 0.5), (H - 1.0) / 2, fz - dj * 0.42 + (dj ? 0 : 0.5)], c: 0xffffff });
        }
      }
    }
    // the plinth and cornice: one box per straight run of faces
    for (const R of runs.values()) {
      R.at.sort((a, c) => a - c); let a = R.at[0], prev = a;
      for (let q = 1; q <= R.at.length; q++) {
        const t = R.at[q]; if (t === prev + 1) { prev = t; continue; }
        const n = prev - a + 1, mid = (a + n / 2) * CELL, L = CELL * n + 0.02, rot = R.di ? PI / 2 : 0;
        const px = R.di ? R.line : mid, pz = R.di ? mid : R.line;
        b.add(box(L, 0.45, 0.16), R.mat, { p: [px - R.di * 0.08, 0.22, pz - R.dj * 0.08], r: [0, rot, 0], uv: 'box', us: 0.4, c: R.c1 });
        b.add(box(L, 0.22, 0.3), R.mat, { p: [px - R.di * 0.15, H - 0.12, pz - R.dj * 0.15], r: [0, rot, 0], uv: 'box', us: 0.4, c: R.c2 });
        a = prev = t;
      }
    }
  }
  // cap: runs of rock cells per row, a dark mass at the top of the walls
  const capY = cave ? 3.0 : H + 0.02;
  for (let j = 0; j < D.nz; j++) {
    let i0 = -1;
    for (let i = 0; i <= D.nx; i++) {
      const rock = i < D.nx && !F(i, j);
      if (rock && i0 < 0) i0 = i;
      if (!rock && i0 >= 0) { const w = (i - i0) * CELL; b.add(box(w, 0.3, CELL), 'dCap', { p: [i0 * CELL + w / 2, capY, cz(j)], uv: 'box', us: 0.25 }); i0 = -1; }
    }
  }
  // a skirt of cap around the whole grid so the edges never show
  b.add(box(D.w + 80, 0.3, 40), 'dCap', { p: [D.w / 2, capY, -20], uv: 'box', us: 0.25 });
  b.add(box(D.w + 80, 0.3, 40), 'dCap', { p: [D.w / 2, capY, D.h + 20], uv: 'box', us: 0.25 });
  b.add(box(40, 0.3, D.h), 'dCap', { p: [-20, capY, D.h / 2], uv: 'box', us: 0.25 });
  b.add(box(40, 0.3, D.h), 'dCap', { p: [D.w + 20, capY, D.h / 2], uv: 'box', us: 0.25 });

  // ---------------------------------------------------------------- lights along the walls (spaced out)
  const wallSpots = [];
  for (let j = 0; j < D.nz; j++) for (let i = 0; i < D.nx; i++) {
    if (!F(i, j)) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!F(i + di, j + dj)) { wallSpots.push([i, j, di, dj]); break; }
  }
  for (let k = wallSpots.length - 1; k > 0; k--) { const q = Math.floor(rng() * (k + 1)); [wallSpots[k], wallSpots[q]] = [wallSpots[q], wallSpots[k]]; }
  const placed = [];
  const spacing = cave ? 11 : 10;
  for (const [i, j, di, dj] of wallSpots) {
    const x = cx(i) + di * 0.55, z = cz(j) + dj * 0.55;
    if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < spacing)) continue;
    placed.push([x, z]);
    if (cave) {
      // a lantern hung from a short timber post
      b.add(box(0.16, 2.4, 0.16), 'dTimber', { p: [x, 1.2, z], c: 0xffffff });
      b.add(box(0.12, 0.12, 0.7), 'dTimber', { p: [x - di * 0.3, 2.35, z - dj * 0.3], r: [0, di ? PI / 2 : 0, 0], c: 0xffffff });
      if (D.theme === 'ore') for (const y of [0.5, 1.9]) b.add(box(0.2, 0.08, 0.2), 'dBrass', { p: [x, y, z], c: '#c8a060' }); // brass bands on the post
      lanternBuilder('yellow', 0.9, b, [x - di * 0.6, 2.25, z - dj * 0.6]);
      addDyn(glowSprite(0xffc060, 1.8, 0.6), x - di * 0.6, 1.88, z - dj * 0.6);
      torches.push({ x: D.ox + x - di * 0.6, y: 1.9, z: D.oz + z - dj * 0.6, color: TH.light });
    } else if (D.theme === 'vault') {
      // a bronze sconce bowl on the wall
      b.add(lathe([[0.001, 0], [0.12, 0], [0.26, 0.12], [0.3, 0.2], [0.001, 0.12]], 12), 'dBrass', { p: [x - di * 0.2, 2.1, z - dj * 0.2], c: 0xffffff });
      b.add(box(0.08, 0.08, 0.4), 'dBrass', { p: [x, 2.05, z], r: [0, di ? PI / 2 : 0, 0], c: 0xffffff });
      torch(x - di * 0.2, 2.25, z - dj * 0.2, 0.45);
    } else {
      // a caged lamp on a bracket
      b.add(box(0.08, 0.08, 0.5), 'dIron', { p: [x - di * 0.1, 2.4, z - dj * 0.1], r: [0, di ? PI / 2 : 0, 0], c: 0xffffff });
      const storm = D.theme === 'storm';
      lanternBuilder(storm ? 'teal' : 'yellow', 1.0, b, [x - di * 0.35, 2.45, z - dj * 0.35]);
      addDyn(glowSprite(storm ? 0x8ac8ff : 0xffa040, 1.8, 0.65), x - di * 0.35, 2.03, z - dj * 0.35);
      torches.push({ x: D.ox + x - di * 0.35, y: 2.0, z: D.oz + z - dj * 0.35, color: storm ? 0x8ac8ff : 0xffa050 });
    }
  }

  // ---------------------------------------------------------------- theme dressing
  if (D.theme === 'mine') dressMine(D, b, { r, rng, isFloorL, torch, addDyn, col, placeRes, dyn });
  else if (D.theme === 'warren') dressWarren(D, b, { r, rng, isFloorL, torch, addDyn, col, placeRes });
  else if (D.theme === 'vault') dressVault(D, b, { r, rng, isFloorL, torch, addDyn, col, placeRes });
  else if (D.theme === 'storm') dressStorm(D, b, { r, rng, isFloorL, addDyn, col, torches });
  else if (D.theme === 'deep') dressDeep(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches });
  else if (D.theme === 'ore') dressOre(D, b, { F, cx, cz, r, rng, isFloorL, addDyn, col, placeRes, torches, edgeCells });
  else if (D.theme === 'furnace') dressFurnace(D, b, { r, rng, isFloorL, addDyn, col, placeRes, torches });
  else if (D.theme === 'sluice') dressSluice(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches });
  else if (D.theme === 'dam') dressDam(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches });
  else if (D.theme === 'pump') dressPump(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches });
  else if (D.theme === 'mills') dressMills(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches });
  else if (D.theme === 'seagate') dressSeaGate(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches });
  else if (D.theme === 'workshop') dressWorkshop(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches });
  else dressFoundry(D, b, { r, rng, isFloorL, torch, addDyn, col, placeRes, group, dyn, torches });
  if (D.theme === 'deep' || D.theme === 'foundry') wallClutter(D, b, { F, cx, cz, rng, r, col, colliders, placeRes });

  // ---------------------------------------------------------------- the way out (south end of the entry hall)
  const [ex, ez] = D.exit;
  let wz = ez;
  while (isFloorL(ex, wz + 0.5) && wz < D.h) wz += 0.5;
  exitDoor(D, b, ex, wz, addDyn);
  torches.push({ x: D.ox + ex, y: 2.2, z: D.oz + wz - 1.2, color: 0xfff0d0 });

  const mesh = b.build({ shadow: true });
  group.add(mesh);
  group.userData.update = (dt, t) => { for (const d of dyn) d.userData.update?.(dt, t); };
  return { group, torches, colliders, floor: mesh };
}

// ----------------------------------------------------------------------------------------- WALL CLUTTER
// so big rooms never read as empty floor: crates, brass pipe runs, gauge cabinets, barrels and rubble against the walls.
// Only in wide spots (the cell across from the wall and the one beyond are floor too, so corridors stay clear), away
// from anything already placed (colliders), the way out and the Deepway's water.
function wallClutter(D, b, { F, cx, cz, rng, r, col, colliders, placeRes }) {
  const deep = D.theme === 'deep';
  const metal = deep ? 'dBrass' : 'dIron', stoneMat = deep ? 'dWallDeep' : 'dIron';
  const taken = colliders.map((c) => [c.x - D.ox, c.z - D.oz]);
  const near = (x, z, d) => taken.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < d * d);
  const wet = (x, z) => (D._wet || []).some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const [ex, ez] = D.exit;
  let n = 0;
  for (let j = 1; j < D.nz - 1; j++) for (let i = 1; i < D.nx - 1; i++) {
    if (!F(i, j)) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (F(i + di, j + dj) || !F(i - di, j - dj) || !F(i - 2 * di, j - 2 * dj)) continue;
      if (rng() > 0.4) continue;
      // flush against the wall: the wall face is half a cell out from the cell centre
      const x = cx(i) + di * 0.55, z = cz(j) + dj * 0.55, rot = Math.atan2(-di, -dj);
      if (near(x, z, 2.2) || wet(x, z) || (x - ex) ** 2 + (z - ez) ** 2 < 36) continue;
      const k = rng(), ax = -dj, az = di; // along the wall
      if (k < 0.3) {
        // a run of two or three upright pipes with collars and an elbow into the wall
        const m = 2 + (rng() < 0.5 ? 1 : 0), h = r(2.2, 3.4);
        for (let q = 0; q < m; q++) {
          const px = x + ax * (q - (m - 1) / 2) * 0.32 + di * 0.25, pz = z + az * (q - (m - 1) / 2) * 0.32 + dj * 0.25, rr = r(0.07, 0.11);
          b.add(cyl(rr, rr, h, 10), metal, { p: [px, h / 2, pz], c: deep ? '#a88450' : '#6a6660' });
          for (const y of [0.35, h * 0.55]) b.add(cyl(rr * 1.45, rr * 1.45, 0.08, 10), metal, { p: [px, y, pz], c: deep ? '#c8a060' : '#8a8680' });
          b.add(box(rr * 2, rr * 2, 0.5), metal, { p: [px + di * 0.2, h - rr, pz + dj * 0.2], r: [0, rot, 0], c: deep ? '#a88450' : '#6a6660' });
        }
      } else if (k < 0.55) {
        placeRes(crateStack(n * 7 + 3), x - di * 0.35, z - dj * 0.35, rot + r(-0.2, 0.2));
        col(x - di * 0.35, z - dj * 0.35, 0.9);
      } else if (k < 0.75) {
        // a gauge cabinet: an iron box on short feet with two round dials and a lever
        const w = r(0.9, 1.3), hh = r(1.1, 1.6);
        b.add(rbox(w, hh, 0.5, 0.04), 'dIron', { p: [x, 0.12 + hh / 2, z], r: [0, rot, 0], c: deep ? '#4e5a5c' : '#4a4644' });
        b.add(box(w * 0.92, 0.08, 0.56), metal, { p: [x, 0.16 + hh, z], r: [0, rot, 0], c: deep ? '#b08850' : '#7a7670' });
        for (const s of [-1, 1]) b.add(cyl(0.11, 0.11, 0.04, 14), 'dBrass', { p: [x + ax * s * w * 0.22 - di * 0.27, 0.12 + hh * 0.68, z + az * s * w * 0.22 - dj * 0.27], r: [PI / 2, rot, 0], c: '#e8d8b0' });
        b.add(box(0.05, 0.38, 0.05), 'dIron', { p: [x - di * 0.3, 0.12 + hh * 0.35, z - dj * 0.3], r: [0, rot, 0.4], c: '#8a3a2a' });
        col(x, z, 0.6);
      } else if (k < 0.9) {
        // two or three barrels in a cluster
        const m = 2 + (rng() < 0.5 ? 1 : 0);
        for (let q = 0; q < m; q++) {
          const px = x + ax * (q - (m - 1) / 2) * 0.62 - di * 0.2, pz = z + az * (q - (m - 1) / 2) * 0.62 - dj * 0.2;
          b.add(lathe([[0.001, 0], [0.26, 0], [0.31, 0.22], [0.32, 0.45], [0.31, 0.68], [0.26, 0.9], [0.001, 0.9]], 12), 'dTimber', { p: [px, 0, pz], c: '#9a7a52', uv: 'box' });
          for (const y of [0.16, 0.74]) b.add(cyl(0.315, 0.315, 0.05, 12), 'dIron', { p: [px, y, pz], c: '#5a5450' });
        }
        col(x - di * 0.2, z - dj * 0.2, 0.75);
      } else {
        // a low heap of fallen stone or scrap
        for (let q = 0; q < 5; q++) b.add(rbox(r(0.25, 0.55), r(0.15, 0.35), r(0.25, 0.5), 0.04), stoneMat, { p: [x + r(-0.6, 0.6) * Math.abs(ax) - di * r(0, 0.4), r(0.06, 0.2), z + r(-0.6, 0.6) * Math.abs(az) - dj * r(0, 0.4)], r: [r(-0.3, 0.3), r(0, 3), r(-0.3, 0.3)], uv: 'box', us: 0.5, c: deep ? '#a49a86' : '#5a5654' });
      }
      taken.push([x, z]); n++;
      break;
    }
  }
}

// ----------------------------------------------------------------------------------------- STORMWORKS
// coil masts in the halls, capacitor banks along the walls, cable trays in straight runs, a ring of charged floor plates
// around the Thunderhead (a ring: no spokes)
function dressStorm(D, b, { r, rng, isFloorL, addDyn, col, torches }) {
  const mast = (x, z, h) => {
    b.add(rbox(0.9, 0.5, 0.9, 0.05), 'dIron', { p: [x, 0.25, z], c: '#8a92a0' });
    b.add(cyl(0.13, 0.16, h, 8), 'dIron', { p: [x, h / 2, z], c: '#7a8494' });
    for (let i = 0; i < 6; i++) b.add(torus(0.3 - i * 0.025, 0.05, 6, 14), 'dBrass', { r: [PI / 2, 0, 0], p: [x, h * (0.5 + i * 0.075), z], c: '#d08050' });
    b.add(cyl(0.34, 0.34, 0.08, 14), 'dIron', { p: [x, h + 0.04, z], c: '#9aa4b0' });
    addDyn(glowSprite(0x9ad8ff, 1.6, 0.8), x, h + 0.25, z);
    torches.push({ x: D.ox + x, y: h, z: D.oz + z, color: 0x8ac8ff });
    col(x, z, 0.6);
  };
  const bank = (x, z, rot) => {
    for (let i = -1; i <= 1; i++) {
      const ox = Math.cos(rot) * i * 0.7, oz = -Math.sin(rot) * i * 0.7;
      b.add(cyl(0.28, 0.28, 1.3, 14), 'dIron', { p: [x + ox, 0.65, z + oz], c: '#7a8494' });
      b.add(cyl(0.24, 0.24, 1.0, 14), 'dBrass', { p: [x + ox, 0.65, z + oz], c: '#5aa8e8' });
      b.add(cyl(0.3, 0.3, 0.06, 14), 'dBrass', { p: [x + ox, 1.33, z + oz] });
    }
    col(x, z, 1.2);
  };
  // halls get masts, walls get banks
  for (const [x, z, h] of [[44, 64, 4], [72, 64, 4], [44, 76, 3.5], [72, 76, 3.5], [10, 56, 3.5], [24, 46, 3.5], [96, 44, 3.5], [108, 60, 3.5], [12, 10, 3.5], [32, 22, 3.5], [90, 10, 3.5], [108, 18, 3.5]]) if (isFloorL(x, z)) mast(x, z, h);
  for (const [x, z, rot] of [[38, 70, PI / 2], [78, 70, PI / 2], [8, 64, PI / 2], [26, 52, PI / 2], [94, 52, PI / 2], [110, 44, PI / 2], [20, 8, 0], [98, 8, 0]]) if (isFloorL(x, z)) bank(x, z, rot);
  // cable trays: straight runs along the corridors
  for (const [x0, z0, x1, z1] of [[58, 90, 58, 81], [22, 75, 35, 75], [15, 38, 15, 28], [82, 60.5, 93, 60.5], [103, 34, 103, 24], [37, 16.5, 43, 16.5], [77, 12.5, 85, 12.5]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0);
    b.add(box(0.5, 0.08, L), 'dIron', { p: [(x0 + x1) / 2 + 1.6 * Math.cos(rot), 0.05, (z0 + z1) / 2 - 1.6 * Math.sin(rot)], r: [0, rot, 0], c: '#5a6270' });
    for (let k = 0; k < 3; k++) b.add(cyl(0.05, 0.05, L, 6), 'dIron', { p: [(x0 + x1) / 2 + (1.45 + k * 0.15) * Math.cos(rot), 0.14, (z0 + z1) / 2 - (1.45 + k * 0.15) * Math.sin(rot)], r: [PI / 2, 0, -rot], c: '#2a2a2a' });
  }
  // the Thunderhead Chamber: a ring of charged floor plates around the engine
  // two plain concentric rings (no radial lines: from above those read as a star)
  b.add(torus(8.6, 0.45, 4, 64), 'dIron', { r: [PI / 2, 0, 0], p: [60, 0.02, 15], s: [1, 0.86, 0.12], c: '#4a5260' });
  b.add(torus(8.6, 0.09, 4, 64), 'wGlowBlue', { r: [PI / 2, 0, 0], p: [60, 0.05, 15], s: [1, 0.86, 0.3] });
  b.add(torus(9.4, 0.06, 4, 64), 'wGlowBlue', { r: [PI / 2, 0, 0], p: [60, 0.05, 15], s: [1, 0.86, 0.3] });
  // the Coil Hall: scorched floor and scattered spare coils
  for (let i = 0; i < 10; i++) { const x = r(40, 76), z = r(60, 78); if (isFloorL(x, z)) b.add(torus(0.3, 0.06, 6, 14), 'dBrass', { r: [PI / 2, 0, r(0, 6)], p: [x, 0.06, z], c: '#c87848' }); }
}

// ----------------------------------------------------------------------------------------- light shafts
// Daylight falling through gaps in the Deepway roof. Each shaft is two ribbons that turn to face the camera around
// the beam's own (slightly tilted) axis, the second turned 60 degrees for depth, with soft edges across and along,
// slow dust streaks and a fade when the camera looks down the beam. A soft-edged pool lights the floor and a few
// dust motes drift inside. All shafts share three draw calls.
const SHAFT_TILT = new THREE.Vector3(Math.sin(0.17), 1, Math.sin(0.17) * 0.45).normalize(); // ~10 deg off vertical
function shaftField(group, cap) {
  const H = 8.5, MOTES = 28;
  const base = new THREE.PlaneGeometry(1, 1, 1, 8); base.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const iPos = new Float32Array(cap * 2 * 3), iSet = new Float32Array(cap * 2 * 2);
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3)); geo.setAttribute('iSet', new THREE.InstancedBufferAttribute(iSet, 2));
  geo.instanceCount = 0; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const uni = { uAxis: { value: SHAFT_TILT }, uTime: G.time, uH: { value: H } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: uni,
    vertexShader: /* glsl */ `
      attribute vec3 iPos; attribute vec2 iSet; uniform vec3 uAxis; uniform float uTime, uH;
      varying vec2 vUv; varying float vInt; varying float vSeed;
      void main() {
        vec3 wBase = (modelMatrix * vec4(iPos, 1.0)).xyz;
        vec3 mid = wBase + uAxis * uH * 0.5;
        vec3 toCam = normalize(cameraPosition - mid);
        vec3 side = cross(uAxis, toCam); float facing = length(side); side /= max(facing, 1e-3);
        // second ribbon: turned around the axis for a crossed, volumetric read
        float a = iSet.x * 1.05; vec3 s2 = cross(uAxis, side);
        side = normalize(side * cos(a) + s2 * sin(a));
        float widen = mix(1.05, 1.6, position.y);
        vec3 wp = wBase + uAxis * (position.y * uH) + side * position.x * 3.4 * widen * (1.0 - iSet.x * 0.3);
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        // fade when the camera looks straight down the beam (the ribbon would collapse to a sliver)
        vInt = smoothstep(0.18, 0.55, facing) * (1.0 - iSet.x * 0.35);
        vUv = uv; vSeed = iSet.y;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv; varying float vInt; varying float vSeed;
      float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
      float vn(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
      void main() {
        float u = vUv.x, v = vUv.y;
        float across = sin(u * 3.14159); across *= across;
        // brightest 1-3 m above the floor, thinning into the dark above
        float along = smoothstep(0.0, 0.1, v) * mix(1.0, 0.18, smoothstep(0.3, 0.95, v)) * (1.0 - smoothstep(0.9, 1.0, v));
        float st = vn(u * 7.0 + vSeed + uTime * 0.05 + v * 1.5) * 0.6 + vn(u * 19.0 - vSeed - uTime * 0.08) * 0.4;
        float a = across * along * (0.55 + 0.6 * st) * vInt;
        vec3 c = mix(vec3(1.0, 0.93, 0.78), vec3(1.0, 0.97, 0.9), v);
        gl_FragColor = vec4(c * a * 0.16, 1.0);
      }`,
  });
  const beams = new THREE.Mesh(geo, mat); beams.frustumCulled = false; beams.renderOrder = 6; group.add(beams);
  // the pool of light: alpha (1 - r/R)^2.5 with a noise-broken edge
  const pgeo = new THREE.PlaneGeometry(1, 1); pgeo.rotateX(-Math.PI / 2);
  const pg = new THREE.InstancedBufferGeometry(); pg.index = pgeo.index; pg.setAttribute('position', pgeo.attributes.position); pg.setAttribute('uv', pgeo.attributes.uv);
  const pPos = new Float32Array(cap * 3); pg.setAttribute('iPos', new THREE.InstancedBufferAttribute(pPos, 3)); pg.instanceCount = 0; pg.boundingSphere = geo.boundingSphere;
  const pmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: uni,
    vertexShader: /* glsl */ `attribute vec3 iPos; varying vec2 vUv; varying float vSeed;
      void main() { vUv = uv; vSeed = iPos.x * 0.37 + iPos.z * 0.11; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(iPos + position * vec3(6.4, 1.0, 6.4), 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv; varying float vSeed;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 q = (vUv - 0.5) * 2.0;
        float r = length(q) * (0.85 + 0.3 * vn2(q * 3.0 + vSeed + uTime * 0.04));
        float a = pow(max(0.0, 1.0 - r), 2.5);
        gl_FragColor = vec4(vec3(1.0, 0.94, 0.8) * a * 0.2, 1.0);
      }`,
  });
  const pools = new THREE.Mesh(pg, pmat); pools.frustumCulled = false; pools.renderOrder = 2; group.add(pools);
  // dust motes drifting slowly inside each beam
  const mPos = new Float32Array(cap * MOTES * 3), mSeed = new Float32Array(cap * MOTES);
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mPos, 3)); mg.setAttribute('seed', new THREE.BufferAttribute(mSeed, 1));
  mg.setDrawRange(0, 0); mg.boundingSphere = geo.boundingSphere;
  const mmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...uni, uPx: { value: 900 } },
    vertexShader: /* glsl */ `attribute float seed; uniform vec3 uAxis; uniform float uTime, uH, uPx; varying float vA;
      void main() {
        float t = uTime * 0.05 + seed * 13.7, h = fract(t * (0.4 + fract(seed * 7.3) * 0.5));
        vec3 p = position + uAxis * (0.3 + h * 4.2) + vec3(sin(uTime * 0.31 + seed * 5.0), 0.0, cos(uTime * 0.27 + seed * 3.0)) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uPx * 0.045 / -mv.z, 1.0, 5.0);
        vA = sin(h * 3.14159) * 0.4;
      }`,
    fragmentShader: /* glsl */ `varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(q)) * vA; gl_FragColor = vec4(vec3(1.0, 0.95, 0.82) * a, 1.0); }`,
  });
  const motes = new THREE.Points(mg, mmat); motes.frustumCulled = false; motes.renderOrder = 7; group.add(motes);
  const rnd = mulberry32(4242);
  let n = 0;
  return {
    add(x, z) {
      if (n >= cap) return;
      for (let k = 0; k < 2; k++) { iPos.set([x, 0.02, z], (n * 2 + k) * 3); iSet.set([k, rnd() * 50], (n * 2 + k) * 2); }
      pPos.set([x, 0.11, z], n * 3);
      for (let i = 0; i < MOTES; i++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 1.3, j = n * MOTES + i;
        mPos.set([x + Math.cos(a) * rr, 0, z + Math.sin(a) * rr], j * 3); mSeed[j] = rnd();
      }
      n++;
      geo.instanceCount = n * 2; pg.instanceCount = n; mg.setDrawRange(0, n * MOTES);
      for (const g of [geo.attributes.iPos, geo.attributes.iSet, pg.attributes.iPos, mg.attributes.position, mg.attributes.seed]) g.needsUpdate = true;
    },
  };
}

// ----------------------------------------------------------------------------------------- DEEPWAY
// the Makers' undercity: water channels lit by lamps sunk under the water, light shafts from the surface, the explorers'
// camp, paddle wheels turning in the wheelworks, counterweights rising and falling in the weigh galleries, the drafting
// halls' pillars and long tables. Plain square forms only (no domes, no arches, no radiating floor patterns).
function dressDeep(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches }) {
  const stone = '#b4ab98';
  // the water flows: one scroller per dungeon nudges the shared water normals along
  { const wm = getMat('dWaterDeep'), fl = new THREE.Group(); fl.userData.update = (dt) => { if (wm.normalMap) { wm.normalMap.offset.x += dt * 0.012; wm.normalMap.offset.y += dt * 0.035; } }; group.add(fl); dyn.push(fl); }
  // a straight channel along x or z: curbs either side, water between, a lamp under the water every 9 m
  const channel = (x0, z0, x1, z1, w = 2.2) => {
    const alongX = z0 === z1, L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    (D._wet ||= []).push([Math.min(x0, x1) - w, Math.min(z0, z1) - w, Math.max(x0, x1) + w, Math.max(z0, z1) + w]);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, rot = alongX ? PI / 2 : 0;
    b.add(box(w, 0.04, L), 'dWaterDeep', { p: [mx, 0.07, mz], r: [0, rot, 0], uv: 'box', us: 0.35 });
    for (const s of [-1, 1]) b.add(box(0.34, 0.22, L), 'dWallDeep', { p: [mx + (alongX ? 0 : s * (w / 2 + 0.17)), 0.11, mz + (alongX ? s * (w / 2 + 0.17) : 0)], r: [0, rot, 0], uv: 'box', us: 0.4, c: stone });
    for (let t = 4; t < L - 2; t += 9) {
      const x = alongX ? Math.min(x0, x1) + t : x0, z = alongX ? z0 : Math.min(z0, z1) + t;
      addDyn(glowSprite(0x6ae0d0, 2.0, 0.4), x, 0.22, z);
      torches.push({ x: D.ox + x, y: 0.7, z: D.oz + z, color: 0x5ad0c8, k: 0.5 });
    }
  };
  // a basin: water inside a stone curb
  const basin = (x0, z0, x1, z1) => {
    (D._wet ||= []).push([x0 - 1.2, z0 - 1.2, x1 + 1.2, z1 + 1.2]);
    b.add(box(x1 - x0, 0.04, z1 - z0), 'dWaterDeep', { p: [(x0 + x1) / 2, 0.07, (z0 + z1) / 2], uv: 'box', us: 0.35 });
    for (const [px, pz, w, d] of [[(x0 + x1) / 2, z0 - 0.17, x1 - x0 + 0.68, 0.34], [(x0 + x1) / 2, z1 + 0.17, x1 - x0 + 0.68, 0.34], [x0 - 0.17, (z0 + z1) / 2, 0.34, z1 - z0], [x1 + 0.17, (z0 + z1) / 2, 0.34, z1 - z0]]) {
      b.add(box(w, 0.28, d), 'dWallDeep', { p: [px, 0.14, pz], uv: 'box', us: 0.4, c: stone });
    }
    for (let x = x0 + 4; x < x1 - 2; x += 10) for (let z = z0 + 4; z < z1 - 2; z += 10) { addDyn(glowSprite(0x6ae0d0, 2.4, 0.4), x, 0.22, z); torches.push({ x: D.ox + x, y: 0.7, z: D.oz + z, color: 0x5ad0c8, k: 0.5 }); }
  };
  // a sluice plate where one channel runs under another's curb
  const sluice = (x, z, alongX) => b.add(box(alongX ? 0.5 : 2.6, 0.5, alongX ? 2.6 : 0.5), 'dBrass', { p: [x, 0.25, z], c: '#a07848' });
  // light shafts from the surface: soft crossed ribbons with drifting dust, and a soft pool of light on the floor
  const shafts = shaftField(group, 24);
  const shaft = (x, z) => {
    shafts.add(x, z);
    torches.push({ x: D.ox + x, y: 4.5, z: D.oz + z, color: 0xfff0d0, k: 0.8 });
  };
  // a bronze lamp post on a stone foot
  const post = (x, z, h = 2.6) => {
    b.add(rbox(0.5, 0.3, 0.5, 0.04), 'dWallDeep', { p: [x, 0.15, z], uv: 'box', us: 0.4, c: stone });
    b.add(cyl(0.07, 0.09, h, 8), 'dBrass', { p: [x, h / 2, z], c: '#b08850' });
    lanternBuilder('yellow', 1, b, [x, h + 0.05, z]);
    addDyn(glowSprite(0xffc070, 1.8, 0.6), x, h - 0.35, z);
    torches.push({ x: D.ox + x, y: h - 0.3, z: D.oz + z, color: 0xffb060 });
    col(x, z, 0.35);
  };
  // a plain square pillar up to the cap
  const pillar = (x, z, h = 5) => {
    b.add(rbox(1.5, 0.4, 1.5, 0.04), 'dWallDeep', { p: [x, 0.2, z], uv: 'box', us: 0.4, c: '#a49a86' });
    b.add(box(1.1, h - 0.8, 1.1), 'dWallDeep', { p: [x, h / 2, z], uv: 'box', us: 0.4, c: '#c4baa4' });
    b.add(rbox(1.5, 0.4, 1.5, 0.04), 'dWallDeep', { p: [x, h - 0.2, z], uv: 'box', us: 0.4, c: '#a49a86' });
    col(x, z, 0.85);
  };

  if (D.id === 'makershall') return dressMakersHall(D, b, { stone, channel, shaft, post, pillar, col, r });
  // ---- water: the aqueduct runs south from the cistern; branches run east under the square to the wheelworks
  basin(34, 40, 70, 64);
  channel(44, 64.5, 44, 195);
  channel(45.5, 146, 124.6, 146, 1.8); sluice(45.3, 146, true); sluice(124.8, 146, true);
  basin(143, 121, 157, 135);
  channel(175.4, 110, 253.6, 110, 1.8); sluice(175.2, 110, true); sluice(253.8, 110, true);
  channel(255, 93, 255, 189);
  // ---- light shafts
  for (const [x, z] of [[150, 224], [150, 198], [150, 128], [128, 110], [172, 146], [44, 110], [44, 170], [52, 52], [120, 63], [180, 63], [255, 140], [250, 46]]) shaft(x, z);

  // ---- the great stair: step lines flush with the floor, lamp posts down both sides
  for (let z = 213.5; z < 232; z += 1.4) b.add(box(11.4, 0.03, 0.14), 'dIron', { p: [150, 0.02, z], c: '#3a3630' });
  for (const z of [216, 224, 231]) { post(145, z); post(155, z); }
  for (const [x, z] of [[141, 238], [159, 238], [141, 249], [159, 249]]) post(x, z);

  // ---- the explorers' camp
  placeRes(campfire(31), 150, 198, 0); col(150, 198, 1.2);
  torches.push({ x: D.ox + 150, y: 1.2, z: D.oz + 198, color: 0xffa050, k: 1.2 });
  placeRes(workTent(7, '#b8ac90'), 131, 194, 1.3); col(131, 194, 2.2);
  placeRes(workTent(8, '#a8a088'), 169, 194, -1.3); col(169, 194, 2.2);
  placeRes(workTent(9, '#c0b498'), 140, 207, 0.25); col(140, 207, 2.2);
  for (const [x, z] of [[128, 201], [173, 186], [164.5, 208.5]]) { placeRes(crateStack(60 + x), x, z, x * 0.2); col(x, z, 1.0); }
  placeRes(cart(12), 176, 199, 1.6); col(176, 199, 1.6);
  // the map table: plans of the halls weighted down with stones
  b.add(rbox(2.6, 0.1, 1.4, 0.02), 'dTimber', { p: [154, 0.92, 190], c: 0xffffff });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(box(0.1, 0.9, 0.1), 'dTimber', { p: [154 + sx * 1.15, 0.45, 190 + sz * 0.58], c: 0xffffff });
  for (const [dx, dz, a] of [[-0.6, -0.1, 0.1], [0.5, 0.15, -0.2], [0.1, -0.3, 0.4]]) b.add(box(0.9, 0.01, 0.65), 'dFloorVault', { p: [154 + dx, 0.98, 190 + dz], r: [0, a, 0], c: '#f2e8d2' });
  col(154, 190, 1.4);
  // bedrolls by the fire
  for (const [x, z, a] of [[144, 196, 0.4], [156, 201, -0.3], [146, 202, 1.2]]) b.add(rbox(0.8, 0.12, 2.0, 0.05), 'cloth', { p: [x, 0.06, z], r: [0, a, 0], c: '#8a6a4a' });
  for (const [x, z] of [[134, 186], [166, 186], [137, 211], [163, 211]]) post(x, z, 2.4);

  // ---- the Makers' Square: lamp posts round the basin, stone benches
  for (const [x, z] of [[139, 117], [161, 117], [139, 139], [161, 139]]) post(x, z, 3.0);
  for (const [x, z, a] of [[150, 112, 0], [150, 144, 0], [132, 128, PI / 2], [168, 136, PI / 2]]) {
    b.add(rbox(3.0, 0.2, 0.7, 0.03), 'dWallDeep', { p: [x, 0.5, z], r: [0, a, 0], uv: 'box', us: 0.4, c: '#c0b8a4' });
    for (const s of [-1, 1]) b.add(box(0.5, 0.4, 0.6), 'dWallDeep', { p: [x + Math.cos(a) * s * 1.1, 0.2, z - Math.sin(a) * s * 1.1], uv: 'box', us: 0.4, c: '#a49a86' });
  }

  // ---- the aqueducts and the cistern: pillar rows
  for (let z = 98; z <= 190; z += 14) { if (Math.abs(z - 146) > 6) { pillar(34, z); pillar(54, z); } }
  for (const x of [40, 64]) for (const z of [46, 58]) pillar(x, z);

  // ---- the drafting halls: two rows of pillars, long tables of plans between
  for (let x = 104; x <= 196; x += 12) { pillar(x, 51); pillar(x, 75); }
  for (const x of [114, 132, 168, 186]) {
    b.add(rbox(5.0, 0.12, 1.6, 0.02), 'dTimber', { p: [x, 0.94, 63], c: '#c8a080' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(box(0.14, 0.92, 0.14), 'dTimber', { p: [x + sx * 2.3, 0.46, 63 + sz * 0.65], c: 0xffffff });
    for (let k = 0; k < 4; k++) b.add(box(0.8, 0.01, 0.6), 'dFloorVault', { p: [x - 1.8 + k * 1.2 + r(-0.15, 0.15), 1.01, 63 + r(-0.3, 0.3)], r: [0, r(-0.3, 0.3), 0], c: '#f0e6d0' });
    b.add(cyl(0.05, 0.05, 0.9, 6), 'dBrass', { p: [x + 1.6, 1.06, 63.3], r: [0, 0, PI / 2], c: '#c09050' });
    b.add(box(0.5, 0.2, 0.3), 'dBrass', { p: [x - 0.4, 1.1, 62.8], c: '#a07848' });
    for (const dx of [-1.7, 0, 1.7]) col(x + dx, 63, 0.95);
  }

  // ---- the wheelworks: paddle wheels in the channel (solid rims, paddles between), drive shafts into the east wall
  for (const [z, spin] of [[104, 0.55], [152, 0.5], [174, 0.6]]) {
    const R = 2.1, wb = new Builder(z * 7);
    for (const s of [-1, 1]) wb.add(cyl(R, R, 0.1, 28), 'dBrass', { p: [s * 0.75, 0, 0], r: [0, 0, PI / 2], c: '#a8804c' });
    wb.add(cyl(0.38, 0.38, 1.7, 12), 'dIron', { r: [0, 0, PI / 2], c: '#5a5650' });
    for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2; wb.add(box(1.5, 0.7, 0.08), 'dTimber', { p: [0, Math.cos(a) * (R - 0.25), Math.sin(a) * (R - 0.25)], r: [a, 0, 0], c: '#b08860' }); }
    const o = wb.build();
    const pv = new THREE.Group(); pv.add(o); pv.position.set(255, R - 0.35, z);
    pv.userData.update = (dt) => { o.rotation.x -= dt * spin; };
    group.add(pv); dyn.push(pv);
    b.add(cyl(0.16, 0.16, 18, 10), 'dIron', { p: [264.5, R - 0.35, z], r: [0, 0, PI / 2], c: '#6a6660' });
    for (const x of [252.4, 257.6]) { b.add(box(0.6, R - 0.35, 0.9), 'dWallDeep', { p: [x, (R - 0.35) / 2, z], uv: 'box', us: 0.4, c: stone }); col(x, z, 0.5); }
    b.add(rbox(1.6, 2.4, 1.6, 0.05), 'dBrass', { p: [272.6, 1.2, z], c: '#8a6a40' });
    col(255, z, 1.2);
  }
  // ---- the weigh galleries: stone counterweights on chains, rising and falling in their frames
  let wi = 0;
  for (const z of [33, 59]) for (const x of [234, 250, 266]) {
    for (const s of [-1, 1]) b.add(box(0.4, 5, 0.4), 'dIron', { p: [x + s * 1.4, 2.5, z], c: '#5a5650' });
    b.add(box(3.4, 0.4, 0.5), 'dIron', { p: [x, 4.8, z], c: '#5a5650' });
    b.add(cyl(0.45, 0.45, 0.3, 16), 'dBrass', { p: [x, 4.4, z], r: [PI / 2, 0, 0], c: '#a8804c' });
    const wb = new Builder(x * 3 + z);
    wb.add(rbox(1.7, 1.4, 1.7, 0.06), 'dWallDeep', { p: [0, 0.7, 0], uv: 'box', us: 0.4, c: '#8a8272' });
    wb.add(box(1.8, 0.14, 1.8), 'dIron', { p: [0, 1.45, 0], c: '#4a4640' });
    const blk = wb.build();
    const cb = new Builder(x + z * 5);
    cb.add(cyl(0.05, 0.05, 1, 6), 'dIron', { p: [0, 0.5, 0], c: '#3a3630' });
    const chain = cb.build();
    const g = new THREE.Group(); g.add(blk); g.add(chain); g.position.set(x, 0, z);
    const ph = wi++ * 1.3;
    g.userData.update = (dt, t) => { const y = 1.0 + Math.sin(t * 0.35 + ph) * 0.9; blk.position.y = y; chain.position.y = y + 1.5; chain.scale.y = Math.max(0.1, 4.25 - (y + 1.5)); };
    group.add(g); dyn.push(g);
    col(x, z, 1.4);
  }
  // ---- the first chamber: a plain square inlay on the floor, lamp posts at its corners (what stands here comes later)
  for (const [w, d, s] of [[26, 18, 0.5], [22, 14, 0.25]]) {
    for (const [px, pz, bw, bd] of [[150, 20 - d / 2, w, s], [150, 20 + d / 2, w, s], [150 - w / 2, 20, s, d], [150 + w / 2, 20, s, d]]) b.add(box(bw, 0.03, bd), 'dBrass', { p: [px, 0.02, pz], c: '#8a6a40' });
  }
  for (const [x, z] of [[135, 9], [165, 9], [135, 31], [165, 31]]) if (isFloorL(x, z)) post(x, z, 3.2);
  // the door of the Makers' Hall in the chamber's north wall: a plain bronze frame round the doorway
  for (const sx of [-1, 1]) { b.add(box(0.5, 3.6, 0.5), 'wBronze', { p: [150 + sx * 1.35, 1.8, 6.3], c: '#c89660' }); col(150 + sx * 1.35, 6.4, 0.3); }
  b.add(box(3.3, 0.5, 0.6), 'wBronze', { p: [150, 3.5, 6.3], c: '#c89660' });
  b.add(box(3.6, 0.12, 0.7), 'wVerdigris', { p: [150, 3.8, 6.3], c: '#8ab8a0' });
}

// ----------------------------------------------------------------------------------------- THE MAKERS' HALL
// the raid behind the First Engine: an entry hall, the Hall of Drawings (pillars, long tables, drawings pinned to the walls)
// and the Pattern Room (two channels, a square inlay, light from above)
function dressMakersHall(D, b, { stone, channel, shaft, post, pillar, col, r }) {
  for (const [x, z] of [[51, 88], [69, 88], [51, 97], [69, 97]]) post(x, z, 2.8);
  // the Hall of Drawings
  for (let x = 32; x <= 88; x += 8) { pillar(x, 50); pillar(x, 68); }
  for (let x = 30; x <= 90; x += 10) {
    b.add(box(3.2, 2.0, 0.06), 'dFloorVault', { p: [x, 2.6, 46.2], c: '#efe4cc' });
    for (let k = 0; k < 4; k++) b.add(box(2.4 * (0.4 + r() * 0.6), 0.04, 0.02), 'dIron', { p: [x - 0.6 + r() * 1.2, 1.9 + k * 0.4, 46.25], c: '#5a4a3a' });
    b.add(box(3.2, 2.0, 0.06), 'dFloorVault', { p: [x, 2.6, 71.8], c: '#efe4cc' });
  }
  for (const x of [38, 82]) {
    b.add(rbox(5.0, 0.12, 1.6, 0.02), 'dTimber', { p: [x, 0.94, 59], c: '#c8a080' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(box(0.14, 0.92, 0.14), 'dTimber', { p: [x + sx * 2.3, 0.46, 59 + sz * 0.65], c: 0xffffff });
    for (let k = 0; k < 4; k++) b.add(box(0.8, 0.01, 0.6), 'dFloorVault', { p: [x - 1.8 + k * 1.2, 1.01, 59 + r(-0.3, 0.3)], r: [0, r(-0.3, 0.3), 0], c: '#f0e6d0' });
    for (const dx of [-1.7, 0, 1.7]) col(x + dx, 59, 0.95);
  }
  shaft(60, 59);
  // the Pattern Room
  channel(36, 9, 36, 33); channel(84, 9, 84, 33);
  for (const [w, d, s] of [[30, 20, 0.5], [24, 14, 0.25]]) {
    for (const [px, pz, bw, bd] of [[60, 20 - d / 2, w, s], [60, 20 + d / 2, w, s], [60 - w / 2, 20, s, d], [60 + w / 2, 20, s, d]]) b.add(box(bw, 0.03, bd), 'dBrass', { p: [px, 0.02, pz], c: '#8a6a40' });
  }
  for (const [x, z] of [[42, 11], [78, 11], [42, 31], [78, 31]]) post(x, z, 3.4);
  shaft(60, 20);
}

// the exit: a lit doorway in the south wall with steps up toward daylight
function exitDoor(D, b, x, z, addDyn) {
  const mat = D.theme === 'mine' || D.theme === 'warren' || D.theme === 'ore' || D.theme === 'workshop' ? 'dTimber' : D.theme === 'vault' ? 'dWallVault' : 'dIron';
  for (const sx of [-1, 1]) b.add(box(0.4, 3.0, 0.4), mat, { p: [x + sx * 1.6, 1.5, z - 0.2], uv: 'box', us: 0.4, c: 0xffffff });
  b.add(box(3.8, 0.45, 0.5), mat, { p: [x, 3.1, z - 0.2], uv: 'box', us: 0.4, c: 0xffffff });
  for (let i = 0; i < 4; i++) b.add(box(2.8, 0.2, 0.5), D.theme === 'mine' || D.theme === 'warren' || D.theme === 'ore' ? 'dFloorMine' : D.theme === 'vault' ? 'dFloorVault' : 'dIron', { p: [x, 0.1 + i * 0.22, z - 0.5 + i * 0.45], uv: 'box', us: 0.4, c: '#c8c0b0' });
  addDyn(glowSprite(0xfff0c8, 6, 0.55), x, 2.0, z + 0.4);
  addDyn(glowSprite(0xfff0c8, 3, 0.8), x, 1.4, z + 0.2);
}

// ----------------------------------------------------------------------------------------- MINE
function dressMine(D, b, { r, rng, isFloorL, torch, addDyn, col, placeRes }) {
  // timber support sets along every tunnel: two posts and a cap beam across the passage
  for (const [pts, w] of D.paths) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx;
      for (let t = 4; t < L - 3; t += 6.5) {
        const px = ax + dx * t, pz = az + dz * t, half = w / 2 - 0.45;
        const p1 = [px + nx * half, pz + nz * half], p2 = [px - nx * half, pz - nz * half];
        if (!isFloorL(...p1) || !isFloorL(...p2)) continue;
        const rot = Math.atan2(dx, dz);
        // posts with cap blocks and a brace back into the rock (no beam across: from above it would cross the rails)
        for (const [qx, qz, sg] of [[...p1, 1], [...p2, -1]]) {
          b.add(box(0.26, 2.9, 0.26), 'dTimber', { p: [qx, 1.45, qz], r: [0, rot, 0], c: 0xffffff });
          b.add(box(0.5, 0.22, 0.42), 'dTimber', { p: [qx, 2.95, qz], r: [0, rot, 0], c: 0xffffff });
          b.add(box(0.12, 0.9, 0.12), 'dTimber', { p: [qx + nx * sg * 0.3, 2.45, qz + nz * sg * 0.3], r: [0, rot + PI / 2, sg * 0.7], c: 0xffffff });
          col(qx, qz, 0.25);
        }
      }
    }
  }
  // rails down the main spine, carts on them
  const rails = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az);
    for (const s of [-0.38, 0.38]) b.add(box(0.07, 0.08, L), 'dIron', { p: [(ax + bx) / 2 + Math.cos(rot) * s, 0.12, (az + bz) / 2 - Math.sin(rot) * s], r: [0, rot, 0], c: '#9a9aa0' });
    for (let t = 0.4; t < L; t += 0.9) b.add(box(1.1, 0.08, 0.2), 'dTimber', { p: [ax + (bx - ax) * t / L, 0.05, az + (bz - az) * t / L], r: [0, rot, 0], c: '#c8a080' });
  };
  rails(62, 92, 58, 66); rails(58, 66, 62, 38); rails(61, 60, 80, 57); rails(80, 57, 98, 54);
  for (const [x, z, rot] of [[60.5, 78, 0.15], [61, 48, 0.05], [89, 55.5, -1.4]]) placeRes(mineCart(70 + x), x, z, rot);
  // ore piles, stone stacks, crates and barrels
  for (const [x, z, k] of [[18, 54, 'r'], [30, 66, 'r'], [16, 64, 's'], [104, 48, 'r'], [92, 46, 's'], [106, 60, 'r'], [70, 10, 'r'], [52, 18, 'r'], [76, 20, 's'], [40, 36, 'r'], [50, 70, 'c'], [66, 86, 'c'], [24, 32, 'c'], [36, 22, 'c'], [102, 58, 'c']]) {
    if (!isFloorL(x, z)) continue;
    if (k === 'r') placeRes(rubble(80 + x), x, z, x);
    else if (k === 's') placeRes(stoneStack(90 + z), x, z, x * 0.3);
    else placeRes(crateStack(40 + x), x, z, z * 0.2);
    col(x, z, k === 'c' ? 1.0 : 1.6);
  }
  // copper veins in the ore cavern walls
  for (let k = 0; k < 26; k++) {
    const a = rng() * PI * 2, cxr = [24, 98, 64][k % 3], czr = [60, 54, 15][k % 3], rr = [13, 12, 17][k % 3];
    const x = cxr + Math.cos(a) * rr, z = czr + Math.sin(a) * rr * 0.75;
    addRock(b, [x, r(0.4, 1.6), z], [r(0.25, 0.5), r(0.2, 0.4), r(0.25, 0.5)], 700 + k, { mat: 'dWallMine', moss: 0, tint: '#e08a50' });
  }
  // the sappers' camp: tents and a fire
  placeRes(workTent(5, '#b8a888'), 22, 22, 0.6); col(22, 22, 2.2);
  placeRes(workTent(6, '#a89878'), 38, 24, -0.5); col(38, 24, 2.2);
  placeRes(campfire(9), 30, 30, 0);
  torch(30, 0.3, 30, 0.7, 0xff9a40);
  // the Grand Bore's cavern: a scaffold, scattered drill bits and spoil heaps
  for (const [x, z] of [[50, 10], [80, 12], [58, 22], [72, 22]]) { placeRes(rubble(120 + x), x, z, x); col(x, z, 1.4); }
  for (let k = 0; k < 4; k++) b.add(cone(0.25, 1.3, 10), 'dIron', { p: [56 + k * 4, 0.3, 26 - k], r: [PI / 2 - 0.2, k, 0], c: '#a0a4a8' });
}

// ----------------------------------------------------------------------------------------- ORE GALLERIES
// the Makers' mine under the Old Works: one winding gallery with a rail line down its length, timber and brass shoring,
// glowing ore seams in the dark basalt, slag pools, skips in the Skip Hall, drill spoil at the Bore Face and the grading
// screens and sorting bins of the Sorting Floor. Pools are irregular blobs and seams zigzag (nothing round and even).
const ORE_RAIL = [[62, 97], [62, 89], [52, 80], [40, 74], [32, 68], [30, 60], [36, 51], [48, 46], [58, 44], [68, 45], [80, 48], [86, 50], [96, 52], [94, 43], [88, 31], [76, 22], [64, 18]];
function dressOre(D, b, { F, cx, cz, r, rng, isFloorL, addDyn, col, placeRes, torches, edgeCells }) {
  const GLASS = '#2e2a2a';
  const [ex, ez] = D.exit;
  // timber shoring along the galleries (not the fresh bore off the Bore Face): posts with brass bands, cap blocks, braces
  D.paths.forEach(([pts, w], pi) => {
    if (pi === 3) return;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx;
      for (let t = 3; t < L - 2; t += 5.5) {
        const px = ax + dx * t, pz = az + dz * t, half = w / 2 - 0.35, rot = Math.atan2(dx, dz);
        for (const sg of [1, -1]) {
          const qx = px + nx * half * sg, qz = pz + nz * half * sg;
          if (!isFloorL(qx, qz)) continue;
          b.add(box(0.28, 2.8, 0.28), 'dTimber', { p: [qx, 1.4, qz], r: [0, rot + r(-0.06, 0.06), 0], c: 0xffffff });
          b.add(box(0.52, 0.22, 0.44), 'dTimber', { p: [qx, 2.85, qz], r: [0, rot, 0], c: 0xffffff });
          for (const y of [0.35, 1.6, 2.6]) b.add(box(0.33, 0.07, 0.33), 'dBrass', { p: [qx, y, qz], r: [0, rot, 0], c: '#c8a060' });
          b.add(box(0.12, 0.9, 0.12), 'dTimber', { p: [qx + nx * sg * 0.3, 2.4, qz + nz * sg * 0.3], r: [0, rot + PI / 2, sg * 0.7], c: 0xffffff });
          col(qx, qz, 0.25);
        }
      }
    }
  });
  // the rail line down the whole mine, ore carts standing on it
  const rails = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az);
    for (const s of [-0.38, 0.38]) b.add(box(0.07, 0.08, L + 0.3), 'dIron', { p: [(ax + bx) / 2 + Math.cos(rot) * s, 0.12, (az + bz) / 2 - Math.sin(rot) * s], r: [0, rot, 0], c: '#8a8a90' });
    for (let t = 0.4; t < L; t += 0.9) b.add(box(1.1, 0.08, 0.2), 'dTimber', { p: [ax + (bx - ax) * t / L, 0.05, az + (bz - az) * t / L], r: [0, rot, 0], c: '#a88060' });
  };
  for (let k = 0; k < ORE_RAIL.length - 1; k++) rails(...ORE_RAIL[k], ...ORE_RAIL[k + 1]);
  for (const [k, t] of [[2, 0.45], [8, 0.4], [11, 0.55], [14, 0.5]]) {
    const [ax, az] = ORE_RAIL[k], [bx, bz] = ORE_RAIL[k + 1];
    placeRes(mineCart(300 + k), ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bx - ax, bz - az));
    col(ax + (bx - ax) * t, az + (bz - az) * t, 0.9);
  }
  // ore seams in the walls: a zigzag of glowing strips across the rock face with lumps of ore beside it
  let seams = 0;
  for (const [i, j] of edgeCells) {
    let dir = null;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (F(i + di, j + dj) && F(i + 2 * di, j + 2 * dj)) { dir = [di, dj]; break; }
    if (!dir || rng() > 0.17) continue;
    const [di, dj] = dir, fx = cx(i) + di * 1.05, fz = cz(j) + dj * 1.05;
    if ((fx - ex) ** 2 + (fz - ez) ** 2 < 25) continue;
    const ax = -dj, az = di, y0 = r(0.6, 1.8), n = 3 + Math.floor(rng() * 3), rot = Math.atan2(di, dj);
    let o = r(-0.5, -0.1), y = y0;
    for (let q = 0; q < n; q++) {
      const len = r(0.35, 0.6), tilt = (q % 2 ? 1 : -1) * r(0.35, 0.7);
      b.add(box(len, 0.06, 0.08), 'wGlowOrange', { p: [fx + ax * (o + len * 0.4), y, fz + az * (o + len * 0.4)], r: [0, rot + PI / 2, tilt], c: 0xffffff });
      o += len * 0.8; y += Math.sin(tilt) * len * 0.8;
    }
    for (let q = 0; q < 2; q++) addRock(b, [fx + ax * r(-0.6, 0.6) - di * 0.1, y0 + r(-0.4, 0.4), fz + az * r(-0.6, 0.6) - dj * 0.1], [r(0.18, 0.3), r(0.14, 0.24), r(0.18, 0.3)], 900 + i * 7 + j + q, { mat: 'dWallMine', moss: 0, tint: q ? '#c87a48' : '#8a5a3a', rot: r(0, 6) });
    if (seams++ % 4 === 0) { addDyn(glowSprite(0xff7a30, 1.4, 0.35), fx + di * 0.25, y0, fz + dj * 0.25); torches.push({ x: D.ox + fx + di * 0.4, y: y0, z: D.oz + fz + dj * 0.4, color: 0xff7a30, k: 0.35 }); }
  }
  // glowing slag pools: irregular blobs of molten slag with a crust of dark glass, lumps on one side
  const pool = (x, z, rx, rz, rot) => {
    if (!isFloorL(x + rx, z) || !isFloorL(x - rx, z) || !isFloorL(x, z + rz) || !isFloorL(x, z - rz)) return;
    const blobs = [[0, 0, 1, 1], [rx * 0.55, rz * 0.3, 0.6, 0.7], [-rx * 0.5, -rz * 0.35, 0.55, 0.6]];
    const c = Math.cos(rot), s2 = Math.sin(rot);
    for (const [bx, bz, kx, kz] of blobs) {
      const wx = x + bx * c + bz * s2, wz = z - bx * s2 + bz * c;
      b.add(cyl(1, 1, 0.03, 11), 'dWallMine', { p: [wx, 0.012, wz], s: [rx * kx * 1.22, 1, rz * kz * 1.25], r: [0, rot + bx, 0], c: GLASS });
      b.add(cyl(1, 1, 0.04, 11), 'molten', { p: [wx, 0.03, wz], s: [rx * kx * 0.72, 1, rz * kz * 0.72], r: [0, rot + bx, 0], c: '#ff8a3a' });
    }
    for (let q = 0; q < 4; q++) { const a = rot + r(-0.9, 0.9), d = r(1.0, 1.25); addRock(b, [x + Math.cos(a) * rx * d, 0.08, z - Math.sin(a) * rz * d], [r(0.2, 0.42), r(0.12, 0.26), r(0.2, 0.4)], Math.round(x * 17 + z * 3 + q), { mat: 'dWallMine', moss: 0, tint: GLASS, rot: r(0, 6) }); }
    torches.push({ x: D.ox + x, y: 0.7, z: D.oz + z, color: 0xff6a20, k: 0.6 });
    col(x, z, Math.max(rx, rz) * 0.85);
  };
  for (const [x, z, rx, rz, rot] of [[21, 64, 2.2, 1.4, 0.4], [40, 62, 1.6, 1.1, 1.3], [52, 40, 2.6, 1.6, 0.3], [64, 49, 1.9, 1.2, 1.2], [61, 38, 1.5, 1.0, 2.0], [104, 59, 2.0, 1.3, 0.8], [46, 11, 2.2, 1.4, 0.2], [75, 10, 1.8, 1.2, 1.0]]) pool(x, z, rx, rz, rot);
  // ore heaps: a pile of rock with a few hot lumps in it
  const orePile = (x, z, s = 1) => {
    if (!isFloorL(x, z)) return;
    for (let q = 0; q < 6; q++) addRock(b, [x + r(-0.9, 0.9) * s, r(0.05, 0.3) * s, z + r(-0.8, 0.8) * s], [r(0.3, 0.6) * s, r(0.25, 0.45) * s, r(0.3, 0.55) * s], Math.round(x * 31 + z * 7 + q), { mat: 'dWallMine', moss: 0, tint: q % 3 ? '#6a5246' : '#3a3432', rot: r(0, 6) });
    for (let q = 0; q < 3; q++) b.add(ico(r(0.09, 0.15), 0), 'wGlowOrange', { p: [x + r(-0.7, 0.7) * s, r(0.25, 0.5) * s, z + r(-0.6, 0.6) * s], r: [r(0, 3), r(0, 3), 0], c: 0xffffff });
    col(x, z, 1.3 * s);
  };
  // the adit foot: crates of tools and a lamp-room bench by the way in
  for (const [x, z, a] of [[55, 96, 0.3], [69, 91, -0.4], [56, 89, 1.2]]) if (isFloorL(x, z)) { placeRes(crateStack(330 + x), x, z, a); col(x, z, 1.0); }
  if (isFloorL(68, 97)) {
    b.add(rbox(2.4, 0.12, 0.8, 0.03), 'dTimber', { p: [68, 0.85, 97], c: '#b08a62' });
    for (const sx of [-1, 1]) b.add(box(0.12, 0.85, 0.7), 'dTimber', { p: [68 + sx * 1.05, 0.42, 97], c: 0xffffff });
    for (let q = 0; q < 4; q++) b.add(cyl(0.12, 0.14, 0.32, 6), 'dBrass', { p: [67.2 + q * 0.5, 1.07, 97], c: '#d0a860' });
    col(68, 97, 1.3);
  }
  // the Skip Hall: slag skips (square bins) tipped over, slag spilled from them, ore heaps
  const skip = (x, z, rot, tip) => {
    if (!isFloorL(x, z)) return;
    b.add(taper(box(1.6, 1.0, 1.2), 1.15, 1.15, 'y'), 'dIron', { p: [x, 0.55, z], r: [tip, rot, 0], order: 'YXZ', c: '#5a5450' });
    b.add(box(1.86, 0.08, 1.4), 'dBrass', { p: [x, 1.06, z], r: [tip, rot, 0], order: 'YXZ', c: '#a88a52' });
    for (let q = 0; q < 4; q++) b.add(ico(r(0.15, 0.28), 0), q % 2 ? 'wGlowOrange' : 'dWallMine', { p: [x + Math.sin(rot) * (0.9 + q * 0.3), 0.12, z + Math.cos(rot) * (0.9 + q * 0.3)], s: [1.3, 0.5, 1.1], c: q % 2 ? 0xffffff : GLASS });
    col(x, z, 1.1);
  };
  skip(24, 72, 0.6, 0.35); skip(42, 65, -2.2, 0.5); skip(26, 61, 2.6, 0);
  orePile(38, 72); orePile(20, 68, 0.8);
  // the slag cavern: heaps of slag between the pools
  orePile(66, 40, 0.9); orePile(50, 49, 0.8);
  // the Bore Face: drill spoil, spare drill bits, and at the end of the fresh bore the old bit still stuck in the rock
  for (const [x, z] of [[90, 58], [102, 46], [86, 44]]) if (isFloorL(x, z)) { placeRes(rubble(340 + x), x, z, x); col(x, z, 1.5); }
  for (let k = 0; k < 4; k++) b.add(cone(0.3, 1.6, 10), 'dIron', { p: [99 + k * 1.6, 0.3, 60 - k * 0.6], r: [PI / 2 - 0.15, 0.4 + k * 0.3, 0], c: '#a0a4a8' });
  col(101, 59, 1.6);
  b.add(cone(0.9, 2.6, 12), 'dIron', { p: [114.5, 1.2, 38.5], r: [PI / 2, -2.4, 0], c: '#8a8a90' });
  b.add(cyl(0.95, 0.95, 0.5, 12), 'dIron', { p: [113.2, 1.2, 39.9], r: [PI / 2, -2.4, 0], c: '#5a5650' });
  addDyn(glowSprite(0xffb070, 2.0, 0.3), 113, 1.6, 40);
  for (let q = 0; q < 8; q++) addRock(b, [110 + r(-2, 2), 0.1, 42 + r(-2, 2)], [r(0.2, 0.45), r(0.15, 0.3), r(0.2, 0.45)], 960 + q, { mat: 'dWallMine', moss: 0, tint: '#5a524c', rot: r(0, 6) });
  // the Sorting Floor: two grading screens (sloped decks of parallel slats), a row of square sorting bins along the far wall
  const screen = (x, z, rot) => {
    const s = Math.sin(rot), c = Math.cos(rot);
    for (let t = 0; t < 3; t++) {
      const y = 1.6 - t * 0.45, oz = -1.2 + t * 1.2, px = x + oz * s, pz = z + oz * c;
      b.add(rbox(2.4, 0.1, 1.2, 0.02), 'dIron', { p: [px, y, pz], r: [0.2, rot, 0], order: 'YXZ', c: '#5a5652' });
      for (let k = 0; k < 7; k++) { const o = -1.05 + k * 0.35; b.add(box(0.07, 0.07, 1.14), 'dIron', { p: [px + c * o, y + 0.08, pz - s * o], r: [0.2, rot, 0], order: 'YXZ', c: '#a8a49c' }); }
      for (const e of [-1, 1]) b.add(box(0.16, y, 0.16), 'dTimber', { p: [px + c * e * 1.1, y / 2, pz - s * e * 1.1], c: 0xffffff });
    }
    col(x, z, 2.0);
  };
  screen(45, 20, 0.5); screen(76, 21, -0.5);
  for (let k = 0; k < 4; k++) {
    const x = 51 + k * 6, z = 8 + Math.abs(k - 1.5) * 0.6;
    if (!isFloorL(x, z)) continue;
    b.add(rbox(2.0, 1.3, 1.6, 0.04), 'dIron', { p: [x, 0.65, z], c: k % 2 ? '#4a4644' : '#5a5450' });
    b.add(box(2.1, 0.08, 1.7), 'dBrass', { p: [x, 1.32, z], c: '#a88a52' });
    for (let q = 0; q < 5; q++) b.add(ico(r(0.15, 0.25), 0), k === 2 && q % 2 ? 'wGlowOrange' : 'dWallMine', { p: [x + r(-0.7, 0.7), 1.35, z + r(-0.5, 0.5)], r: [r(0, 3), r(0, 3), 0], c: k === 2 && q % 2 ? 0xffffff : ['#3a3432', '#7a5a44', '#9a9690', '#6a5246'][k] });
    col(x, z, 1.2);
  }
  orePile(66, 24, 0.8);
}

// ----------------------------------------------------------------------------------------- WARRENS
function dressWarren(D, b, { r, rng, isFloorL, torch, addDyn, col, placeRes }) {
  // rough timber shoring along the tunnels (posts and cap blocks only)
  for (const [pts, w] of D.paths) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx;
      for (let t = 3; t < L - 3; t += 5.5) {
        const px = ax + dx * t, pz = az + dz * t, half = w / 2 - 0.4, rot = Math.atan2(dx, dz);
        for (const sg of [1, -1]) {
          const qx = px + nx * half * sg, qz = pz + nz * half * sg;
          if (!isFloorL(qx, qz)) continue;
          b.add(box(0.22, 2.5, 0.22), 'dTimber', { p: [qx, 1.25, qz], r: [0, rot + r(-0.1, 0.1), r(-0.05, 0.05)], c: 0xffffff });
          b.add(box(0.42, 0.18, 0.36), 'dTimber', { p: [qx, 2.55, qz], r: [0, rot, 0], c: 0xffffff });
          col(qx, qz, 0.2);
        }
      }
    }
  }
  // stolen goods everywhere: crates, sacks of flour, barrels, a whole cart
  const sack = (x, z, k) => b.add(lathe([[0.001, 0], [0.2, 0.02], [0.27, 0.2], [0.25, 0.42], [0.14, 0.56], [0.001, 0.6]], 10), 'cloth', { p: [x, 0, z], r: [k % 3 ? PI / 2 - 0.2 : 0, k, 0], s: [1, 0.9, 0.8], c: k % 2 ? '#efe4c8' : '#d8c8a0' });
  for (const [x, z, n] of [[20, 58, 7], [32, 66, 5], [80, 30, 6], [70, 24, 5], [44, 80, 3]]) for (let k = 0; k < n; k++) sack(x + (k % 3) * 0.55, z + Math.floor(k / 3) * 0.6, k);
  for (const [x, z] of [[18, 66], [30, 56], [66, 64], [80, 22], [84, 32], [58, 50], [56, 18], [44, 16]]) { if (isFloorL(x, z)) { placeRes(crateStack(70 + x + z), x, z, x * 0.3); col(x, z, 1.0); } }
  for (const [x, z] of [[24, 70], [74, 54], [28, 24], [80, 34]]) if (isFloorL(x, z)) { b.add(lathe([[0.001, 0], [0.3, 0], [0.34, 0.3], [0.33, 0.62], [0.3, 0.8], [0.001, 0.8]], 14), 'wood', { p: [x, 0, z], uv: 'box', us: 1.4, c: 0xffffff }); col(x, z, 0.4); }
  // the smugglers' den: bedrolls, a long table, a cookfire
  for (let k = 0; k < 5; k++) b.add(rbox(0.7, 0.12, 1.8, 0.05), 'cloth', { p: [66 + k * 2.2, 0.06, 66], r: [0, r(-0.2, 0.2), 0], c: ['#6a4a2a', '#4f6a34', '#7a5a3a'][k % 3] });
  b.add(rbox(3.6, 0.1, 1.1, 0.03), 'woodLight', { p: [74, 0.82, 56], uv: 'box', c: '#b89068' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.1, 0.8, 0.1), 'woodDark', { p: [74 + sx * 1.6, 0.4, 56 + sz * 0.45], c: 0xffffff });
  col(74, 56, 1.4);
  placeRes(campfire(19), 62, 58, 0);
  torch(62, 0.3, 58, 0.6, 0xff9a40);
  // Hollis' counting room: a desk heaped with ledgers and a strongbox
  b.add(rbox(2.2, 0.9, 1.0, 0.03), 'woodDark', { p: [22, 0.45, 22.5], uv: 'box', c: '#8a6a4a' });
  for (let k = 0; k < 4; k++) b.add(box(0.3, 0.05, 0.4), 'leather', { p: [21.4 + k * 0.35, 0.93 + (k % 2) * 0.05, 22.5], r: [0, k * 0.3, 0], c: '#6a3a1a' });
  b.add(rbox(0.8, 0.6, 0.5, 0.04), 'dIron', { p: [24.6, 0.3, 22], c: '#5a5a60' });
  col(22, 22.5, 1.3);
  // the Thresher's yard: chaff heaps and a broken stolen cart
  for (const [x, z, s] of [[40, 10, 1.4], [62, 9, 1.2], [44, 20, 1.0], [58, 20, 1.1]]) b.add(sphere(1, 12, 8), 'straw', { p: [x, -0.1, z], s: [s * 1.5, s * 0.5, s * 1.2], uv: 'box', c: '#d8b860' });
  placeRes(cart(58), 38, 14, 0.8); col(38, 14, 1.4);
}

// ----------------------------------------------------------------------------------------- VAULT
function dressVault(D, b, { r, rng, isFloorL, torch, addDyn, col, placeRes }) {
  const column = (x, z, h = 3.8) => {
    b.add(rbox(1.1, 0.4, 1.1, 0.04), 'dWallVault', { p: [x, 0.2, z], uv: 'box', us: 0.4, c: '#e0cfb0' });
    b.add(cyl(0.38, 0.44, h - 0.8, 14), 'dWallVault', { p: [x, 0.4 + (h - 0.8) / 2, z], uv: 'box', us: 0.4, c: '#f0e2c6' });
    for (const y of [1.0, 2.2]) b.add(torus(0.42, 0.04, 6, 18), 'dBrass', { p: [x, y, z], r: [PI / 2, 0, 0], c: 0xffffff });
    b.add(rbox(1.0, 0.4, 1.0, 0.04), 'dWallVault', { p: [x, h - 0.2, z], uv: 'box', us: 0.4, c: '#e0cfb0' });
    col(x, z, 0.55);
  };
  // the long gallery: paired columns and a red runner down the middle
  for (let z = 64; z <= 88; z += 6) { column(52.5, z); column(59.5, z); }
  b.add(box(2.4, 0.04, 30), 'carpetRed', { p: [56, 0.02, 76], uv: 'box', us: 0.5, c: 0xffffff });
  // courts and vaults: a ring of columns, braziers in the corners
  for (const [x0, z0, x1, z1] of [[14, 54, 40, 78], [72, 54, 98, 78], [14, 16, 38, 38], [44, 10, 64, 30], [44, 40, 68, 60]]) {
    for (const [x, z] of [[x0 + 4, z0 + 4], [x1 - 4, z0 + 4], [x0 + 4, z1 - 4], [x1 - 4, z1 - 4]]) column(x, z);
    for (const [x, z] of [[x0 + 2.2, (z0 + z1) / 2], [x1 - 2.2, (z0 + z1) / 2]]) { brazier(b, x, z); torch(x, 1.35, z, 0.6); col(x, z, 0.5); }
  }
  // the sanctum: a raised dais under a double colonnade
  // the dais is an inlay flush with the floor (floors are walked at y = 0)
  b.add(box(18, 0.04, 12), 'dFloorVault', { p: [88, 0.02, 19], uv: 'box', us: 0.3, c: '#fff0d4' });
  b.add(box(19, 0.03, 13), 'dFloorVault', { p: [88, 0.012, 19], uv: 'box', us: 0.3, c: '#b89c74' });
  for (let x = 76; x <= 100; x += 6) { column(x, 10); column(x, 28); }
  for (const [x, z] of [[79, 19], [97, 19]]) { brazier(b, x, z, 1.3); torch(x, 1.75, z, 0.8); col(x, z, 0.6); }
  // banners between the columns of the gallery and sanctum
  for (const [x, z, rot] of [[50.2, 70, PI / 2], [61.8, 70, -PI / 2], [50.2, 82, PI / 2], [61.8, 82, -PI / 2]]) b.add(new THREE.PlaneGeometry(1.1, 2.6, 2, 6), 'bannerRed', { p: [x, 2.2, z], r: [0, rot, 0], uv: 'keep', c: 0xffffff });
  // sand drifts against the walls, urns (some broken), fallen column drums
  for (let k = 0; k < 60; k++) {
    const x = r(4, D.w - 4), z = r(4, D.h - 4);
    if (!isFloorL(x, z)) continue;
    let nearWall = false;
    for (const [dx, dz] of [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]) if (!isFloorL(x + dx, z + dz)) nearWall = true;
    if (!nearWall) continue;
    b.add(sphere(1, 12, 8), 'dFloorVault', { p: [x, -0.15, z], s: [r(1.8, 3.0), r(0.2, 0.32), r(1.2, 2.2)], r: [r(-0.12, 0.12), r(0, 3), r(-0.12, 0.12)], uv: 'box', us: 0.3, c: '#f0dcb4' });
  }
  for (let k = 0; k < 30; k++) {
    const x = r(6, D.w - 6), z = r(6, D.h - 6);
    if (!isFloorL(x, z) || !isFloorL(x + 1.5, z) || !isFloorL(x - 1.5, z)) continue;
    const s = r(0.8, 1.2), broken = rng() < 0.3;
    if (broken) { for (let q = 0; q < 4; q++) b.add(box(0.25, 0.04, 0.2), 'dWallVault', { p: [x + r(-0.5, 0.5), 0.03, z + r(-0.5, 0.5)], r: [0, r(0, 3), 0], c: '#c88a5a' }); }
    else b.add(lathe([[0.001, 0], [0.2, 0], [0.3, 0.25], [0.28, 0.55], [0.14, 0.72], [0.16, 0.82], [0.001, 0.82]].map(([a, c]) => [a * s, c * s]), 14), 'dWallVault', { p: [x, 0, z], uv: 'box', us: 0.5, c: '#c88a5a' });
  }
  for (const [x, z, a] of [[30, 70, 0.4], [82, 60, 1.2], [60, 46, 2.0]]) { b.add(cyl(0.42, 0.42, 1.4, 14), 'dWallVault', { p: [x, 0.42, z], r: [0, a, PI / 2], uv: 'box', us: 0.4, c: '#e0cfb0' }); col(x, z, 0.8); }
}

// ----------------------------------------------------------------------------------------- FOUNDRY DEPTHS
function dressFoundry(D, b, { r, rng, isFloorL, torch, addDyn, col, placeRes, group, dyn, torches }) {
  // molten channels across the smelting floor, lit along their length
  for (const z of [68, 80]) {
    b.add(box(52, 0.06, 1.0), 'molten', { p: [62, 0.03, z], c: 0xffffff });
    for (const s of [-1, 1]) b.add(box(52.4, 0.18, 0.2), 'dIron', { p: [62, 0.09, z + s * 0.7], c: '#5a5a60' });
    for (let x = 40; x <= 86; x += 12) { addDyn(glowSprite(0xff6a20, 1.8, 0.28), x, 0.25, z); torches.push({ x: D.ox + x, y: 0.8, z: D.oz + z, color: 0xff7a30, k: 0.45 }); }
  }
  // furnaces: brick blocks with a glowing arched mouth and a fire inside
  const furnace = (x, z, rot) => {
    b.add(rbox(3.2, 3.4, 2.6, 0.08), 'dWallFoundry', { p: [x, 1.7, z], r: [0, rot, 0], uv: 'box', us: 0.32, c: 0xffffff });
    b.add(rbox(3.4, 0.3, 2.8, 0.05), 'dIron', { p: [x, 3.45, z], r: [0, rot, 0], c: 0xffffff });
    const fx = Math.sin(rot), fz = Math.cos(rot);
    b.add(extrude(arcShape(1.4, 1.5, 0.7), 0.1, 0.02, 12), 'molten', { p: [x + fx * 1.32, 0.15, z + fz * 1.32], r: [0, rot, 0], c: 0xffffff });
    b.add(cyl(0.4, 0.5, 2.2, 12), 'dWallFoundry', { p: [x - fx * 0.4, 4.4, z - fz * 0.4], uv: 'box', us: 0.4, c: 0xffffff });
    addDyn(fire(0.9, { light: false }), x + fx * 1.0, 0.25, z + fz * 1.0);
    addDyn(smoke({ rate: 2, life: 3, size: 1.2, rise: 1.4, color: 0x3a3432, opacity: 0.45 }), x - fx * 0.4, 5.6, z - fz * 0.4);
    torches.push({ x: D.ox + x + fx * 1.8, y: 1.0, z: D.oz + z + fz * 1.8, color: 0xff7a30 });
    col(x, z, 1.9);
  };
  furnace(12, 56, PI * 0.25); furnace(12, 70, PI * 0.75); furnace(112, 56, -PI * 0.25); furnace(112, 70, -PI * 0.75);
  furnace(46, 84, PI); furnace(88, 84, PI);
  // the crucible over the Forgemaster's floor
  b.add(lathe([[0.001, 0], [1.6, 0.1], [2.3, 1.2], [2.5, 2.6], [2.6, 2.8], [0.001, 2.6]], 24), 'dIron', { p: [62, 0.8, 8], c: '#6a6460' });
  b.add(cyl(2.35, 2.35, 0.05, 24), 'molten', { p: [62, 3.55, 8], c: 0xffffff });
  for (const sx of [-1, 1]) b.add(box(0.5, 4.2, 0.5), 'dIron', { p: [62 + sx * 3.1, 2.1, 8], c: 0xffffff });
  b.add(box(6.8, 0.4, 0.5), 'dIron', { p: [62, 4.2, 8], c: 0xffffff });
  addDyn(glowSprite(0xff7020, 4, 0.35), 62, 4.2, 8);
  torches.push({ x: D.ox + 62, y: 4.0, z: D.oz + 9, color: 0xff6a20 });
  col(62, 8, 2.8);
  // wall gears in the cog works, a few still turning
  for (const [x, z, R, spin] of [[12.6, 22, 2.2, 0.3], [12.6, 32, 1.4, -0.5], [39.4, 20, 1.6, 0.4], [28, 14.6, 2.4, 0], [84.6, 30, 1.8, -0.35], [111.4, 24, 2.0, 0.25]]) {
    const g = new Builder(Math.round(x * z));
    g.add(gear(Math.round(R * 10), R, R + 0.25, 0.25, { hole: 0, spokes: 0 }), 'dBrass', { c: x > 60 ? '#c8a080' : 0xffffff });
    g.add(cyl(0.3, 0.3, 0.5, 12), 'dIron', { r: [PI / 2, 0, 0], c: 0xffffff });
    const o = g.build();
    const ax = z < 16 ? 'z' : 'x';
    o.rotation.set(ax === 'x' ? 0 : 0, ax === 'x' ? PI / 2 : 0, 0);
    const pivotG = new THREE.Group(); pivotG.add(o); pivotG.position.set(x, R + 0.4, z);
    if (spin) pivotG.userData.update = (dt) => { o.rotateZ(dt * spin); };
    group.add(pivotG); dyn.push(pivotG);
  }
  // anvils, ingot crates, chains hanging from the cap
  for (const [x, z] of [[24, 30], [34, 22], [92, 30], [102, 20]]) {
    b.add(rbox(1.2, 0.5, 0.6, 0.04), 'dIron', { p: [x, 0.95, z], c: '#4a4a50' });
    b.add(cyl(0.22, 0.32, 0.7, 10), 'dIron', { p: [x, 0.35, z], c: '#3a3a40' });
    col(x, z, 0.7);
  }
  for (const [x, z] of [[22, 96], [38, 96], [34, 66], [92, 66], [60, 46], [100, 36]]) { if (isFloorL(x, z)) { placeRes(crateStack(60 + x), x, z, x * 0.1); col(x, z, 1.0); } }
  for (let k = 0; k < 14; k++) {
    const x = r(32, 92), z = r(64, 86);
    if (!isFloorL(x, z)) continue;
    const L = r(1.2, 2.6);
    for (let q = 0; q < L / 0.16; q++) b.add(torus(0.07, 0.02, 4, 8), 'dIron', { p: [x, 4.1 - q * 0.16, z], r: [0, q % 2 ? PI / 2 : 0, PI / 2], c: 0xffffff });
    b.add(cone(0.12, 0.25, 6), 'dIron', { p: [x, 4.1 - L - 0.1, z], r: [PI, 0, 0], c: 0xffffff });
  }
}

// ----------------------------------------------------------------------------------------- FURNACE (the Makers' First Furnace)
// The casting hall under the Old Works, south to north: the stair foot, the Bellows Hall (great fixed bellows along both
// walls, air ducts, glowing floor grates), the Casting Pits (two pouring channels along the hall, rows of square casting
// pits, the crane's floor rails down the middle), the Pattern Floor (pattern racks, flask stacks, sand heaps, a core oven)
// and the Furnace Hall (the pour channel from the First Furnace's spout turning east to the ingot beds, a charging ledge
// along the north wall, ore and coal bunkers, square pillars). Dark basalt and blackened brass; everything square from above.
function dressFurnace(D, b, { r, rng, isFloorL, addDyn, col, placeRes, torches }) {
  const BAS = '#4a4644', BAS2 = '#3a3634', BR = '#9a7a46', IR = '#4e4a46';
  const hot = (x, y, z, k = 0.5, c = 0xff7a30) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: c, k });
  // a pouring channel along x or z: a basalt kerb each side, molten metal in the bed, glow every few metres; gaps skip spans
  const channel = (x0, z0, x1, z1, gaps = []) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1), c = alongX ? z0 : x0;
    const runs = []; let s = a0;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) runs.push([s, g0]); s = Math.max(s, g1); }
    if (s < a1) runs.push([s, a1]);
    for (const [u0, u1] of runs) {
      const L = u1 - u0, m = (u0 + u1) / 2, P = (u, o = 0) => (alongX ? [u, c + o] : [c + o, u]), rot = alongX ? 0 : PI / 2; // a box's length runs along x
      for (const o of [-0.85, 0.85]) { const [px, pz] = P(m, o); b.add(box(L, 0.3, 0.4), 'dWallFoundry', { p: [px, 0.15, pz], r: [0, rot, 0], uv: 'box', us: 0.4, c: BAS }); }
      { const [px, pz] = P(m); b.add(box(L, 0.04, 1.3), 'dIron', { p: [px, 0.02, pz], r: [0, rot, 0], c: '#2a2626' }); b.add(box(L, 0.05, 0.9), 'molten', { p: [px, 0.06, pz], r: [0, rot, 0], c: 0xffffff }); }
      for (let u = u0 + 3; u < u1 - 1; u += 9) { const [px, pz] = P(u); addDyn(glowSprite(0xff6a20, 2.0, 0.3), px, 0.3, pz); hot(px, 0.8, pz, 0.45); }
    }
  };
  // a square casting pit: an iron-rimmed hole in the floor, molten metal in some, a cooling casting in others
  const pit = (x, z, w, full) => {
    if (!isFloorL(x - w / 2, z - w / 2) || !isFloorL(x + w / 2, z + w / 2)) return;
    for (const [px, pz, bw, bd] of [[x, z - w / 2, w + 0.3, 0.3], [x, z + w / 2, w + 0.3, 0.3], [x - w / 2, z, 0.3, w], [x + w / 2, z, 0.3, w]]) b.add(box(bw, 0.22, bd), 'dIron', { p: [px, 0.11, pz], c: IR });
    b.add(box(w - 0.1, 0.03, w - 0.1), 'dIron', { p: [x, 0.015, z], c: '#141212' });
    if (full) { b.add(box(w - 0.6, 0.04, w - 0.6), 'molten', { p: [x, 0.04, z], c: 0xffffff }); hot(x, 0.7, z, 0.35, 0xff6a20); }
    else { b.add(rbox(w * 0.6, 0.3, w * 0.45, 0.05), 'dIron', { p: [x, 0.15, z], r: [0, r(-0.2, 0.2), 0], c: '#2e2a28' }); b.add(box(w * 0.5, 0.02, 0.06), 'wGlowOrange', { p: [x, 0.31, z], c: 0xffffff }); }
  };
  // a great fixed bellows against a wall (rot turns its front toward the room): a basalt plinth, a pleated canvas body
  // under a weighted top board that rises and falls on its own, a square air duct back into the wall
  let bellowsN = 0;
  const bellows = (x, z, rot) => {
    const c = Math.cos(rot), s = Math.sin(rot), L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    b.add(rbox(5.2, 0.7, 3.6, 0.05), 'dWallFoundry', { p: [x, 0.35, z], r: [0, rot, 0], uv: 'box', us: 0.4, c: BAS });
    b.add(rbox(4.8, 0.16, 3.2, 0.03), 'dTimber', { p: [x, 0.78, z], r: [0, rot, 0], c: '#6a4e36' });
    for (let k = 0; k < 5; k++) b.add(box(k % 2 ? 4.3 : 4.7, 0.34, k % 2 ? 2.7 : 3.1), 'dTimber', { p: [x, 1.05 + k * 0.34, z], r: [0, rot, 0], c: k % 2 ? '#4a3e34' : '#5a4c40' });
    { const [dx, dz] = L(0, -2.4); b.add(box(1.2, 1.2, 1.6), 'dIron', { p: [dx, 1.4, dz], r: [0, rot, 0], c: IR }); }
    // the top board, on its own so it can breathe
    const lb = new Builder(900 + bellowsN);
    lb.add(rbox(5.0, 0.2, 3.4, 0.03), 'dTimber', { c: '#6a4e36' });
    lb.add(rbox(1.4, 0.5, 1.0, 0.04), 'dBrass', { p: [0, 0.34, 0.6], c: BR });
    for (const sx of [-1, 1]) lb.add(box(0.12, 0.24, 3.44), 'dIron', { p: [sx * 2.45, 0, 0], c: IR });
    const mesh = lb.build(); const g = new THREE.Group(); g.add(mesh); g.rotation.y = rot;
    const ph = bellowsN++ * 1.3;
    g.userData.update = (dt, t) => { mesh.position.y = 0.12 * Math.sin(t * 0.9 + ph); mesh.rotation.x = 0.02 * Math.sin(t * 0.9 + ph); };
    addDyn(g, x, 2.8, z);
    col(x, z, 2.5);
  };
  // a floor grate: a frame of iron round a bed of glowing cinders under parallel bars (one direction only)
  const grate = (x, z, w, d) => {
    for (const [px, pz, bw, bd] of [[x, z - d / 2, w, 0.2], [x, z + d / 2, w, 0.2], [x - w / 2, z, 0.2, d], [x + w / 2, z, 0.2, d]]) b.add(box(bw, 0.1, bd), 'dIron', { p: [px, 0.05, pz], c: IR });
    b.add(box(w - 0.2, 0.02, d - 0.2), 'wGlowOrange', { p: [x, 0.01, z], c: 0xffffff });
    for (let k = 0; k < Math.round(w / 0.4); k++) b.add(box(0.1, 0.08, d - 0.2), 'dIron', { p: [x - w / 2 + 0.3 + k * 0.4, 0.05, z], c: '#2a2626' });
    hot(x, 0.5, z, 0.3);
  };
  // a square pillar of dark basalt up to the cap, brass banded
  const pillar = (x, z, h = 5.0) => {
    b.add(rbox(1.7, 0.5, 1.7, 0.04), 'dWallFoundry', { p: [x, 0.25, z], uv: 'box', us: 0.4, c: BAS2 });
    b.add(box(1.25, h - 0.5, 1.25), 'dWallFoundry', { p: [x, h / 2, z], uv: 'box', us: 0.4, c: BAS });
    for (const y of [1.2, h - 0.6]) b.add(box(1.36, 0.16, 1.36), 'dBrass', { p: [x, y, z], c: BR });
    col(x, z, 0.95);
  };
  // a square air duct on short stands, at head height along a wall run
  const duct = (x0, z0, x1, z1, y = 4.2) => {
    const L = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0);
    b.add(box(0.9, 0.9, L), 'dIron', { p: [(x0 + x1) / 2, y, (z0 + z1) / 2], r: [0, rot, 0], c: '#3e3a38' });
    for (let t = 0; t <= L; t += 6) { const px = x0 + (x1 - x0) * t / L, pz = z0 + (z1 - z0) * t / L; b.add(box(1.04, 0.14, 0.2), 'dBrass', { p: [px, y, pz], r: [0, rot, 0], c: BR }); }
  };
  // a lamp post: a square iron post with a caged lamp
  const post = (x, z, h = 3.2) => {
    b.add(rbox(0.5, 0.3, 0.5, 0.04), 'dWallFoundry', { p: [x, 0.15, z], uv: 'box', us: 0.4, c: BAS2 });
    b.add(box(0.16, h, 0.16), 'dIron', { p: [x, h / 2, z], c: IR });
    lanternBuilder('yellow', 1, b, [x, h + 0.05, z]);
    addDyn(glowSprite(0xffc070, 1.8, 0.6), x, h - 0.35, z);
    torches.push({ x: D.ox + x, y: h - 0.3, z: D.oz + z, color: 0xffb060 });
    col(x, z, 0.3);
  };
  // heaps of ore or coal: a few dark lumps, some hot
  const heap = (x, z, s = 1, coal = false) => {
    if (!isFloorL(x, z)) return;
    for (let q = 0; q < 7; q++) addRock(b, [x + r(-1, 1) * s, r(0.05, 0.35) * s, z + r(-0.9, 0.9) * s], [r(0.35, 0.7) * s, r(0.3, 0.55) * s, r(0.35, 0.65) * s], Math.round(x * 31 + z * 7 + q), { mat: 'dWallMine', moss: 0, tint: coal ? '#1e1c1c' : q % 3 ? '#6a5246' : '#3a3432', rot: r(0, 6) });
    if (!coal) for (let q = 0; q < 2; q++) b.add(ico(r(0.1, 0.16), 0), 'wGlowOrange', { p: [x + r(-0.7, 0.7) * s, r(0.3, 0.5) * s, z + r(-0.6, 0.6) * s], c: 0xffffff });
    col(x, z, 1.4 * s);
  };

  // ---- the stair foot: tool crates, a bench of ladles, two lamp posts
  for (const [x, z, a] of [[63, 158, 0.3], [81, 157, -0.4]]) { placeRes(crateStack(410 + x), x, z, a); col(x, z, 1.0); }
  b.add(rbox(3.0, 0.14, 0.9, 0.03), 'dIron', { p: [80, 0.9, 165], c: IR });
  for (const sx of [-1, 1]) b.add(box(0.14, 0.9, 0.8), 'dIron', { p: [80 + sx * 1.3, 0.45, 165], c: '#3a3634' });
  for (let q = 0; q < 3; q++) { b.add(rbox(0.5, 0.4, 0.5, 0.04), 'dIron', { p: [79 + q * 1.0, 1.17, 165], c: '#2e2a28' }); b.add(box(0.06, 0.06, 1.0), 'dIron', { p: [79 + q * 1.0, 1.25, 165.7], c: IR }); }
  col(80, 165, 1.6);
  post(64, 168); post(80, 160);

  // ---- the Bellows Hall: three great bellows down each wall, ducts over them, glowing grates in the floor
  for (const z of [122, 131, 140]) { bellows(40, z, PI / 2); bellows(94, z, -PI / 2); }
  duct(38.6, 119, 38.6, 144); duct(95.4, 119, 95.4, 144);
  for (const [x, z] of [[56, 124], [76, 136], [58, 140], [80, 122]]) grate(x, z, 3.2, 1.8);
  for (const [x, z] of [[46, 144], [96, 118]]) post(x, z);
  heap(52, 118.5, 0.7, true); heap(84, 144, 0.7, true);

  // ---- the Casting Pits: two pouring channels along the hall (gaps where the passages come in), the crane's floor rails
  // down the middle, rows of pits between, a parked hot-metal ladle cart at the east end
  channel(30, 76.5, 110, 76.5, [[38, 56]]);
  channel(30, 103.5, 110, 103.5, [[78, 94]]);
  for (const s of [86.7, 93.3]) {
    b.add(box(80, 0.14, 0.24), 'dIron', { p: [70, 0.07, s], c: '#7a7672' });
    for (let x = 31; x < 110; x += 1.2) b.add(box(0.3, 0.06, 1.0), 'dTimber', { p: [x, 0.03, s], c: '#4a3a2c' });
  }
  for (let x = 34; x <= 106; x += 8) { pit(x, 81.5, 3.2, (x / 8) % 2 < 1); pit(x + 4, 98.5, 3.2, (x / 8) % 2 >= 1); }
  for (const [x, z] of [[30.5, 74], [109.5, 74], [30.5, 106], [109.5, 106]]) post(x, z, 3.6);
  {
    // the ladle cart: a square ladle on a low truck, parked on the rails at the east end
    const x = 104, z = 90;
    b.add(rbox(3.2, 0.6, 7.6, 0.05), 'dIron', { p: [x, 0.6, z], c: IR });
    for (const sz of [-2.6, 2.6]) for (const s of [86.7, 93.3]) b.add(cyl(0.45, 0.45, 0.3, 16), 'dIron', { p: [x + sz * 0.4, 0.45, s], r: [PI / 2, 0, 0], c: '#3a3634' });
    b.add(taper(box(2.4, 1.8, 2.4), 0.72, 0.72, 'y'), 'dIron', { p: [x, 1.8, z], c: '#2e2a28' });
    b.add(box(2.4, 0.12, 2.4), 'dBrass', { p: [x, 2.72, z], c: BR });
    b.add(box(2.0, 0.04, 2.0), 'molten', { p: [x, 2.66, z], c: 0xffffff });
    addDyn(glowSprite(0xff7a30, 3.0, 0.5), x, 3.2, z); hot(x, 3.0, z, 0.6);
    addDyn(smoke({ rate: 1.5, life: 3, size: 1.2, rise: 1.4, color: 0x5a5450, opacity: 0.35 }), x, 2.8, z);
    col(x, z - 2, 1.8); col(x, z + 2, 1.8);
  }

  // ---- the Pattern Floor: racks of wooden patterns on the walls, flask stacks, sand heaps, a core oven
  const rack = (x, z, rot, len) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const t of [-len / 2, 0, len / 2]) b.add(box(0.2, 3.2, 0.9), 'dTimber', { p: [x + t * c, 1.6, z - t * s], r: [0, rot, 0], c: '#5a4632' });
    for (const y of [0.6, 1.6, 2.6]) b.add(box(len + 0.2, 0.1, 0.9), 'dTimber', { p: [x, y, z], r: [0, rot, 0], c: '#6a5238' });
    for (const y of [0.6, 1.6, 2.6]) for (let k = 0; k < 4; k++) {
      const t = -len / 2 + 0.6 + k * (len - 1.2) / 3, w = r(0.4, 0.9), h = r(0.25, 0.6);
      b.add(rbox(w, h, 0.6, 0.04), 'dTimber', { p: [x + t * c, y + 0.05 + h / 2, z - t * s], r: [0, rot + r(-0.1, 0.1), 0], c: ['#b08a5a', '#9a7448', '#c8a070'][k % 3] });
    }
    col(x, z, Math.max(1.0, len * 0.35)); col(x + (len / 3) * c, z - (len / 3) * s, 0.8); col(x - (len / 3) * c, z + (len / 3) * s, 0.8);
  };
  rack(31.4, 48, PI / 2, 5); rack(31.4, 57, PI / 2, 5); rack(88.6, 50, -PI / 2, 5); rack(88.6, 59, -PI / 2, 5);
  const flasks = (x, z, n) => {
    for (let k = 0; k < n; k++) { b.add(box(1.6, 0.06, 1.6), 'dIron', { p: [x, 0.3 + k * 0.5, z], r: [0, k * 0.08, 0], c: IR }); for (const [px, pz, bw, bd] of [[0, -0.75, 1.6, 0.1], [0, 0.75, 1.6, 0.1], [-0.75, 0, 0.1, 1.6], [0.75, 0, 0.1, 1.6]]) b.add(box(bw, 0.44, bd), 'dIron', { p: [x + px, 0.06 + k * 0.5 + 0.22, z + pz], r: [0, k * 0.08, 0], c: '#3a3634' }); }
    col(x, z, 1.1);
  };
  flasks(36, 44.5, 3); flasks(38.4, 44.5, 2); flasks(86, 62, 3);
  for (const [x, z, s] of [[50, 45.5, 1.0], [76, 45, 1.0]]) { b.add(sphere(1, 12, 8), 'dirtPlain', { p: [x, 0, z], s: [1.8 * s, 0.7 * s, 1.4 * s], uv: 'box', us: 0.3, c: '#7a7466' }); col(x, z, 1.5 * s); }
  {
    // the core oven: a square brick oven with one louvred door, a short square flue
    const x = 84, z = 46;
    b.add(rbox(3.0, 2.6, 2.4, 0.05), 'dWallFoundry', { p: [x, 1.3, z], uv: 'box', us: 0.4, c: BAS });
    b.add(box(1.4, 1.0, 0.06), 'wGlowOrange', { p: [x - 1.52, 1.1, z], r: [0, PI / 2, 0], c: 0xffffff });
    for (let k = 0; k < 5; k++) b.add(box(1.5, 0.08, 0.12), 'dIron', { p: [x - 1.56, 0.7 + k * 0.2, z], r: [0, PI / 2, 0], c: '#2a2626' });
    b.add(box(0.7, 2.0, 0.7), 'dWallFoundry', { p: [x + 0.6, 3.6, z], uv: 'box', us: 0.4, c: BAS2 });
    addDyn(smoke({ rate: 1.2, life: 3, size: 0.9, rise: 1.2, color: 0x4a4644, opacity: 0.4 }), x + 0.6, 4.7, z);
    hot(x - 2, 1.0, z, 0.5); col(x, z, 1.9);
  }
  post(36, 62); post(84, 43);

  // ---- the Furnace Hall: the pour channel from the furnace spout south, then east to the ingot beds; a charging ledge
  // along the north wall either side of the furnace; ore and coal bunkers on the west; square pillars
  channel(70, 25, 70, 31);
  channel(69.2, 31.5, 108, 31.5);
  for (let i = 0; i < 5; i++) for (let k = 0; k < 2; k++) {
    // ingot moulds: small square iron trays in two rows, the near ones still hot
    const x = 92 + i * 4, z = 26.5 - k * 3.5;
    b.add(box(2.4, 0.3, 1.6), 'dIron', { p: [x, 0.15, z], c: '#2e2a28' });
    b.add(box(2.0, 0.04, 1.2), k === 0 && i % 2 === 0 ? 'molten' : 'dIron', { p: [x, 0.31, z], c: k === 0 && i % 2 === 0 ? 0xffffff : '#4a4440' });
    if (k === 0 && i % 2 === 0) hot(x, 0.6, z, 0.3);
  }
  for (const [x0, x1] of [[23, 58], [82, 117]]) {
    b.add(box(x1 - x0, 1.4, 4.6), 'dWallFoundry', { p: [(x0 + x1) / 2, 0.7, 6.4], uv: 'box', us: 0.4, c: BAS2 });
    b.add(box(x1 - x0, 0.14, 0.3), 'dBrass', { p: [(x0 + x1) / 2, 1.44, 8.8], c: BR });
    for (let x = x0 + 2; x < x1 - 1; x += 4) col(x, 6.4, 2.4);
  }
  for (const [x, z] of [[27, 14], [27, 24]]) {
    // bunkers: square bins of ore and coal on the west side
    for (const [px, pz, bw, bd] of [[0, -1.6, 3.4, 0.2], [0, 1.6, 3.4, 0.2], [-1.6, 0, 0.2, 3.4], [1.6, 0, 0.2, 3.4]]) b.add(box(bw, 1.4, bd), 'dIron', { p: [x + px, 0.7, z + pz], c: IR });
    heap(x, z, 0.85, z > 20);
    col(x, z, 1.9);
  }
  for (const [x, z] of [[40, 14], [40, 28], [100, 14]]) pillar(x, z);
  for (const [x, z] of [[24, 34], [116, 34], [60, 33.5], [86, 33.5]]) post(x, z, 3.6);
  heap(50, 20, 0.9, true); heap(112, 13, 0.8);
}

// ----------------------------------------------------------------------------------------- THE SLUICE GALLERIES
// the Makers' tunnels inside the old dam on the Rime Steps, south to north: the intake stair foot, the Gate Hall (two running
// channels across it, sluice gates where they come through the walls, solid gate wheels on the walls), the Turbine Hall
// (square turbine pits with a solid runner turning in each, the penstocks overhead, the tailrace along the north wall), and
// the Floodgate Hall (the dam's last gate set in the north wall, the spillway down the middle, an ice tide-line round the
// walls where the water has stood). Grey stone and blackened bronze, frost and icicles; everything square from above.
function dressSluice(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches }) {
  const ST = '#9aa2a8', ST2 = '#7c848a', BZ = '#4e4236', BZ2 = '#3a322c', TR = '#8a6c42', IR = '#4a4e54';
  const cool = (x, y, z, k = 0.5) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0x7ac8ff, k });
  // the water flows: one scroller nudges the shared water normals along
  { const wm = getMat('dWaterDeep'), fl = new THREE.Group(); fl.userData.update = (dt) => { if (wm.normalMap) { wm.normalMap.offset.x += dt * 0.02; wm.normalMap.offset.y += dt * 0.05; } }; group.add(fl); dyn.push(fl); }
  // a straight channel along x or z: grey stone kerbs, running water (or a sheet of ice with snow on it), cool glows
  const channel = (x0, z0, x1, z1, w = 2.4, frozen = false) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, rot = alongX ? PI / 2 : 0;
    b.add(box(w, 0.04, L), 'dIron', { p: [mx, 0.02, mz], r: [0, rot, 0], c: '#1e2226' });
    if (frozen) {
      b.add(box(w - 0.1, 0.08, L), 'ice', { p: [mx, 0.06, mz], r: [0, rot, 0], c: 0xffffff });
      for (let t = 1; t < L - 1; t += 1.6 + r(0, 2)) { const u = (alongX ? Math.min(x0, x1) : Math.min(z0, z1)) + t, o = r(-w / 3, w / 3); b.add(ico(r(0.2, 0.4), 0), 'snowPack', { p: [alongX ? u : mx + o, 0.1, alongX ? mz + o : u], s: [1.8, 0.3, 1.4], r: [0, r(0, 3), 0], c: 0xffffff }); }
    } else {
      b.add(box(w - 0.1, 0.04, L), 'dWaterDeep', { p: [mx, 0.08, mz], r: [0, rot, 0], uv: 'box', us: 0.35 });
      for (let t = 4; t < L - 2; t += 9) { const u = (alongX ? Math.min(x0, x1) : Math.min(z0, z1)) + t, x = alongX ? u : mx, z = alongX ? mz : u; addDyn(glowSprite(0x6ac8ff, 2.2, 0.42), x, 0.24, z); cool(x, 0.8, z, 0.5); }
    }
    for (const s of [-1, 1]) {
      b.add(box(0.36, 0.26, L + 0.36), 'dWallDeep', { p: [mx + (alongX ? 0 : s * (w / 2 + 0.18)), 0.13, mz + (alongX ? s * (w / 2 + 0.18) : 0)], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 });
      for (let t = 0.8; t < L; t += 2.2) { const u = (alongX ? Math.min(x0, x1) : Math.min(z0, z1)) + t; b.add(ico(r(0.1, 0.18), 0), 'snowPack', { p: [alongX ? u : mx + s * (w / 2 + 0.18), 0.27, alongX ? mz + s * (w / 2 + 0.18) : u], s: [1.8, 0.35, 1.2], c: 0xffffff }); }
    }
  };
  // a sluice gate where a channel comes through a wall (rot turns its face into the room): two square stone posts, a flat
  // head beam, a plank gate wound part way up on chains, water pouring out under it
  const sluiceGate = (x, z, rot, w = 2.6) => {
    const c = Math.cos(rot), s = Math.sin(rot), L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    for (const sx of [-1, 1]) { const [px, pz] = L(sx * (w / 2 + 0.35), 0); b.add(box(0.7, 4.2, 0.8), 'dWallDeep', { p: [px, 2.1, pz], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 }); b.add(box(0.8, 0.16, 0.9), 'dBrass', { p: [px, 1.3, pz], r: [0, rot, 0], c: BZ }); col(px, pz, 0.5); }
    b.add(box(w + 1.6, 0.6, 0.9), 'dWallDeep', { p: [x, 4.4, z], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST });
    b.add(box(w + 1.7, 0.1, 1.0), 'dBrass', { p: [x, 4.72, z], r: [0, rot, 0], c: BZ });
    // the gate, raised a little over half a metre
    const [gx, gz] = L(0, 0.15);
    b.add(box(w, 2.4, 0.18), 'dBrass', { p: [gx, 1.95, gz], r: [0, rot, 0], c: BZ2 });
    for (let i = 0; i < 5; i++) b.add(box(w - 0.1, 0.38, 0.08), 'dTimber', { p: [gx, 1.0 + i * 0.46, gz], r: [0, rot, 0], c: '#8a7458' });
    for (const y of [0.78, 3.12]) b.add(box(w + 0.1, 0.12, 0.26), 'dIron', { p: [gx, y, gz], r: [0, rot, 0], c: IR });
    for (const sx of [-0.6, 0.6]) { const [cx2, cz2] = L(sx, 0.15); b.add(cyl(0.04, 0.04, 1.2, 6), 'dIron', { p: [cx2, 3.8, cz2], c: '#2e3236' }); }
    for (let q = 0; q < 6; q++) { const [ix, iz] = L(-w / 2 + 0.2 + q * (w - 0.4) / 5, 0.3); const l = r(0.2, 0.45); b.add(cone(0.05, l, 5), 'ice', { p: [ix, 0.72 - l / 2, iz], r: [PI, 0, 0], c: 0xffffff }); }
    // the water out from under the gate: a bright sheet on the floor, spray
    const [wx, wz] = L(0, 0.9);
    b.add(box(w - 0.2, 0.05, 1.6), 'wGlowBlue', { p: [wx, 0.1, wz], r: [0, rot, 0], c: 0xffffff });
    addDyn(smoke({ rate: 3, life: 1.6, size: 0.8, rise: 0.7, color: 0xdcecf6, opacity: 0.38 }), wx, 0.4, wz);
    addDyn(glowSprite(0x7ac8ff, 3.0, 0.5), wx, 0.6, wz); cool(wx, 1.0, wz, 0.7);
  };
  // a solid gate wheel on a wall (rot turns its face into the room): a bracket of blackened bronze, a disc with square
  // lugs round the rim and an off-centre bolt plate, turning slowly
  let wheelN = 0;
  const wallWheel = (x, z, rot, R = 1.5) => {
    const wb = new Builder(2200 + wheelN);
    wb.add(cyl(R, R, 0.24, 30), 'dBrass', { r: [PI / 2, 0, 0], c: BZ2 });
    wb.add(cyl(R * 0.62, R * 0.62, 0.32, 24), 'dIron', { r: [PI / 2, 0, 0], c: IR });
    wb.add(cyl(R * 0.18, R * 0.18, 0.44, 12), 'dBrass', { r: [PI / 2, 0, 0], c: TR });
    wb.add(box(0.3, 0.46, 0.12), 'dBrass', { p: [0, R * 0.4, 0.2], c: TR });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; wb.add(box(0.26, 0.24, 0.3), 'dBrass', { p: [Math.cos(a) * (R + 0.1), Math.sin(a) * (R + 0.1), 0], r: [0, 0, a], c: TR }); }
    for (let i = 0; i < 4; i++) wb.add(ico(0.12, 0), 'snowPack', { p: [-0.6 + i * 0.4, R + 0.18, 0], s: [1.6, 0.4, 1.4], c: 0xffffff });
    const o = wb.build();
    const pv = new THREE.Group(); pv.add(o); pv.rotation.y = rot;
    const sp = 0.05 + (wheelN++ % 3) * 0.02;
    o.userData.update = (dt) => { o.rotation.z += dt * sp; };
    addDyn(pv, x, 2.4, z); dyn.push(o);
    const c = Math.cos(rot), s = Math.sin(rot);
    b.add(box(0.7, 0.7, 0.6), 'dBrass', { p: [x - s * 0.35, 2.4, z - c * 0.35], c: BZ });
    b.add(box(0.5, 2.0, 0.4), 'dWallDeep', { p: [x - s * 0.4, 1.0, z - c * 0.4], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 });
  };
  // a square pillar of grey stone, banded in blackened bronze, frost on its cap
  const pillar = (x, z, h = 5) => {
    b.add(box(1.7, 0.45, 1.7), 'dWallDeep', { p: [x, 0.22, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(1.25, h - 0.5, 1.25), 'dWallDeep', { p: [x, h / 2, z], uv: 'box', us: 0.4, c: ST });
    for (const y of [1.3, h - 0.7]) b.add(box(1.36, 0.16, 1.36), 'dBrass', { p: [x, y, z], c: BZ });
    for (let q = 0; q < 4; q++) b.add(ico(0.2, 0), 'snowPack', { p: [x + r(-0.4, 0.4), h + 0.02, z + r(-0.4, 0.4)], s: [1.8, 0.4, 1.6], c: 0xffffff });
    col(x, z, 0.95);
  };
  // a lamp post: a square bronze post, a caged lamp (the warm light against the cold water)
  const post = (x, z, h = 3.0) => {
    b.add(box(0.5, 0.3, 0.5), 'dWallDeep', { p: [x, 0.15, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(0.16, h, 0.16), 'dBrass', { p: [x, h / 2, z], c: BZ });
    lanternBuilder('yellow', 1, b, [x, h + 0.05, z]);
    addDyn(glowSprite(0xffc878, 2.0, 0.65), x, h - 0.35, z);
    torches.push({ x: D.ox + x, y: h - 0.3, z: D.oz + z, color: 0xffc890, k: 1.1 });
    col(x, z, 0.3);
  };
  // ice on the floor: a flat patch of pale lumps (where water stood and froze)
  const icePatch = (x, z, s = 1) => { if (!isFloorL(x, z)) return; for (let q = 0; q < 6; q++) b.add(ico(r(0.4, 0.8) * s, 0), q % 3 ? 'ice' : 'snowPack', { p: [x + r(-1.2, 1.2) * s, 0.0, z + r(-1, 1) * s], s: [1.6, 0.14, 1.3], r: [0, r(0, 3), 0], c: 0xffffff }); };
  // a stack of spare gate planks, frosted
  const planks = (x, z, rot) => {
    for (let k = 0; k < 4; k++) b.add(box(3.0, 0.16, 0.46), 'dTimber', { p: [x, 0.08 + k * 0.17, z], r: [0, rot + r(-0.06, 0.06), 0], c: k % 2 ? '#8a7458' : '#7a6448' });
    b.add(ico(0.3, 0), 'snowPack', { p: [x, 0.74, z], s: [3.0, 0.3, 1.1], r: [0, rot, 0], c: 0xffffff });
    col(x, z, 1.4);
  };
  // a turbine pit: a square stone-kerbed pit of dark water, a solid runner disc turning on a shaft across it, spray
  let pitN = 0;
  const pit = (x, z, w = 4.4) => {
    for (const [px, pz, bw, bd] of [[x, z - w / 2, w + 0.5, 0.5], [x, z + w / 2, w + 0.5, 0.5], [x - w / 2, z, 0.5, w], [x + w / 2, z, 0.5, w]]) b.add(box(bw, 0.5, bd), 'dWallDeep', { p: [px, 0.25, pz], uv: 'box', us: 0.4, c: ST2 });
    for (const [px, pz, bw, bd] of [[x, z - w / 2, w + 0.6, 0.6], [x, z + w / 2, w + 0.6, 0.6]]) b.add(box(bw, 0.08, bd), 'dBrass', { p: [px, 0.54, pz], c: BZ });
    b.add(box(w - 0.4, 0.04, w - 0.4), 'dWaterDeep', { p: [x, 0.12, z], uv: 'box', us: 0.35 });
    for (const sx of [-1, 1]) { b.add(box(0.6, 1.2, 0.6), 'dBrass', { p: [x + sx * (w / 2), 0.9, z], c: BZ2 }); b.add(box(0.4, 0.3, 0.4), 'dBrass', { p: [x + sx * (w / 2), 1.6, z], c: TR }); }
    b.add(cyl(0.14, 0.14, w + 0.4, 10), 'dIron', { p: [x, 1.4, z], r: [0, 0, PI / 2], c: IR });
    const rb2 = new Builder(2300 + pitN);
    rb2.add(cyl(1.3, 1.3, 0.3, 30), 'dBrass', { r: [0, 0, PI / 2], c: BZ2 });
    rb2.add(cyl(0.8, 0.8, 0.4, 24), 'dIron', { r: [0, 0, PI / 2], c: IR });
    rb2.add(box(0.5, 0.26, 0.36), 'dBrass', { p: [0, 0.5, 0], c: TR });
    rb2.add(box(0.5, 0.2, 0.5), 'dIron', { p: [0, -0.5, 0], c: '#2e3236' });
    rb2.add(box(0.06, 0.12, 1.8), 'wGlowBlue', { p: [0.17, 1.1, 0], c: 0xffffff });
    const o = rb2.build(); const sp = 0.9 + (pitN++ % 2) * 0.4;
    o.userData.update = (dt) => { o.rotation.x += dt * sp; };
    addDyn(o, x, 1.4, z); dyn.push(o);
    addDyn(smoke({ rate: 3, life: 1.8, size: 1.0, rise: 1.0, color: 0xdcecf6, opacity: 0.36 }), x, 0.6, z);
    addDyn(glowSprite(0x6ac8ff, 3.4, 0.45), x, 0.3, z); cool(x, 1.0, z, 0.8);
    col(x, z, w / 2 + 0.2);
  };
  // a penstock: a big bronze pipe along a run at head height, flanged every few metres, on square stands
  const penstock = (x0, z0, x1, z1, y = 3.8, R = 0.5) => {
    const L = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? [0, 0, PI / 2] : [PI / 2, 0, 0]; // along x or z (an Euler [PI / 2, rot, 0] always lies along z)
    b.add(cyl(R, R, L, 16), 'dBrass', { p: [(x0 + x1) / 2, y, (z0 + z1) / 2], r: ax, c: BZ });
    for (let t = 0; t <= L; t += 4) { const px = x0 + (x1 - x0) * t / L, pz = z0 + (z1 - z0) * t / L; b.add(cyl(R + 0.12, R + 0.12, 0.14, 16), 'dIron', { p: [px, y, pz], r: ax, c: IR }); b.add(ico(0.16, 0), 'snowPack', { p: [px, y + R + 0.05, pz], s: [1.6, 0.4, 1.6], c: 0xffffff }); }
  };

  // ---- the intake stair foot: two lamp posts, spare planks, ice in the corners
  post(55, 106); post(69, 106);
  planks(57.5, 112.5, 0.1); planks(68.5, 113.5, -0.15);
  icePatch(54, 104, 0.8); icePatch(70, 116, 0.7);
  channel(53.6, 103, 53.6, 117, 1.4, true);
  // the stair passage: icicles from its cornice are enough, and one seep frozen across the floor
  icePatch(62, 99, 0.6);

  // ---- the Gate Hall: two running channels across it, sluice gates where they come through the side walls, gate wheels
  // on the north and south walls, a square pillar in each corner
  channel(28.6, 79, 95.4, 79, 2.4);
  channel(28.6, 89.5, 95.4, 89.5, 2.4);
  sluiceGate(29.4, 79, PI / 2); sluiceGate(29.4, 89.5, PI / 2);
  for (const z of [79, 89.5]) { b.add(box(0.5, 1.4, 2.8), 'dIron', { p: [95.6, 0.5, z], c: '#1a1e22' }); addDyn(glowSprite(0x6ac8ff, 2.6, 0.4), 95.0, 0.4, z); } // the outflows under the east wall
  for (const x of [52, 82]) wallWheel(x, 66.9, 0);
  for (const x of [46, 80]) wallWheel(x, 93.1, PI);
  for (const [x, z] of [[31.5, 69.5], [92.5, 69.5], [92.5, 91.5]]) pillar(x, z);
  for (const [x, z] of [[58, 84.5], [70, 84.5]]) post(x, z, 3.2);
  icePatch(36, 70, 1.0); icePatch(64, 92, 0.8); icePatch(89, 92.5, 0.8);
  planks(93.5, 84, PI / 2);

  // ---- passage west: a frozen run down its east side
  channel(42.2, 55, 42.2, 67, 1.2, true);
  post(34, 62, 2.8);

  // ---- the Turbine Hall: three turbine pits, the penstocks over them from the south wall, the tailrace along the north wall
  pit(33, 47); pit(53, 46); pit(61, 34.5, 4.0);
  penstock(33, 55.5, 33, 49.8); penstock(53, 55.5, 53, 48.8); penstock(70.5, 34.5, 63.6, 34.5);
  for (const [x, z] of [[33, 49.8], [53, 48.8]]) b.add(cyl(0.5, 0.5, 2.3, 16), 'dBrass', { p: [x, 2.7, z], c: BZ }); // the drops into the pits
  b.add(cyl(0.5, 0.5, 2.3, 16), 'dBrass', { p: [63.6, 2.7, 34.5], c: BZ });
  penstock(14.6, 55.2, 71.4, 55.2, 3.8, 0.55); // the main along the south wall
  channel(15, 30.6, 71, 30.6, 2.0);
  for (const [x, z] of [[17.5, 53], [69, 53]]) pillar(x, z);
  for (const [x, z] of [[15.6, 37], [43, 52.5]]) post(x, z, 3.2);
  icePatch(26, 30, 0.9); icePatch(47, 54, 0.8); icePatch(16, 44, 0.8);
  wallWheel(16, 41, PI / 2, 1.3);

  // ---- passage east
  post(75, 41, 2.8); icePatch(79, 35, 0.6);

  // ---- the Floodgate Hall: the dam's last gate set in the north wall behind the Floodgate (two square stone piers, a flat
  // head beam, ice sheeted over it, water seeping through), the spillway running south down the hall from under it, frozen
  // side channels, and an ice tide-line round every wall where the water has stood before
  {
    for (const x of [84, 110]) { b.add(box(3.0, 5.0, 2.6), 'dWallDeep', { p: [x, 2.5, 5.3], uv: 'box', us: 0.4, c: ST2 }); for (const y of [1.4, 3.6]) b.add(box(3.1, 0.18, 2.7), 'dBrass', { p: [x, y, 5.3], c: BZ }); col(x, 5.3, 1.6); }
    b.add(box(29, 0.9, 1.6), 'dWallDeep', { p: [97, 4.6, 4.8], uv: 'box', us: 0.4, c: ST });
    b.add(box(23, 4.2, 0.4), 'dBrass', { p: [97, 2.2, 4.25], c: BZ2 });
    for (let i = 0; i < 8; i++) b.add(box(22.6, 0.4, 0.12), 'dTimber', { p: [97, 0.5 + i * 0.5, 4.5], c: '#6e5c46' });
    for (const y of [0.3, 2.2, 4.1]) b.add(box(23.2, 0.2, 0.3), 'dIron', { p: [97, y, 4.55], c: IR });
    for (const [x, y, w] of [[90, 1.75, 4], [99, 2.2, 3], [106, 1.3, 5], [94, 3.1, 2.5]]) b.add(box(w, 0.05, 0.04), 'wGlowBlue', { p: [x, y, 4.66], c: 0xffffff });
    for (let i = 0; i < 9; i++) b.add(box(r(1.2, 2.6), r(1.0, 3.2), 0.1), 'ice', { p: [87 + i * 2.6, r(1.2, 2.4), 4.75], c: 0xffffff });
    for (let q = 0; q < 16; q++) { const l = r(0.3, 0.8); b.add(cone(0.08, l, 5), 'ice', { p: [86 + q * 1.45, 4.15 - l / 2, 5.6], r: [PI, 0, 0], c: 0xffffff }); }
    for (const x of [91, 103]) { addDyn(smoke({ rate: 3, life: 1.6, size: 0.9, rise: 0.8, color: 0xdcecf6, opacity: 0.36 }), x, 1.0, 5.4); }
    addDyn(glowSprite(0x7ac8ff, 6, 0.4), 97, 1.5, 5.8); cool(97, 2.0, 6.5, 1.0);
  }
  channel(97, 6.2, 97, 45.4, 3.2);
  channel(81.5, 12, 81.5, 32, 1.6, true); channel(114, 12, 114, 45, 1.6, true);
  // the tide-line: a band of ice round the hall's walls a metre up, and frozen spray above it
  for (const [x0, z0, x1, z1] of [[76.2, 4, 76.2, 34], [76.2, 42, 76.2, 46], [117.8, 4, 117.8, 46], [76, 45.8, 118, 45.8], [76, 4.2, 82, 4.2], [112, 4.2, 118, 4.2]]) {
    const alongX = z0 === z1, L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (!L) continue;
    b.add(box(alongX ? L : 0.14, 0.26, alongX ? 0.14 : L), 'ice', { p: [mx, 1.15, mz], c: 0xffffff });
    b.add(box(alongX ? L : 0.08, 0.7, alongX ? 0.08 : L), 'iceBlue', { p: [mx, 0.62, mz], c: 0xffffff });
  }
  // the depth gauge on the east wall: a tall board, marks on one side only, the ice line on it
  b.add(box(0.12, 4.2, 0.7), 'dTimber', { p: [117.7, 2.3, 30], c: '#8a7458' });
  for (let i = 0; i < 8; i++) b.add(box(0.1, 0.06, i % 2 ? 0.25 : 0.4), 'dIron', { p: [117.6, 0.6 + i * 0.5, 29.75 - (i % 2 ? 0.05 : 0.12)], c: '#2a2e32' });
  for (const [x, z] of [[79.5, 8], [114.5, 8]]) pillar(x, z, 5);
  for (const [x, z] of [[79, 44], [116.6, 44], [88, 27], [106, 27]]) post(x, z, 3.4);
  icePatch(90, 40, 1.0); icePatch(104, 32, 1.1); icePatch(86, 12, 0.8); icePatch(110, 14, 0.9);
  planks(103, 43.5, 0.05);
}

// ----------------------------------------------------------------------------------------- THE GREAT DAM
// inside the Makers' greatest dam, south to north: the gate stair foot, the Gate Hall (rows of square piers, sluice gates in
// the side walls feeding a channel across the hall, solid gate wheels on the walls), the Penstock Gallery (two great pipes on
// stands down its walls and one down the middle overhead, valve wheels, leaking flanges), the Spillway (the stepped spillway
// channel running the length of the hall from the spillway gate in the north wall, broken ice heaped along it), the Turbine
// Hall (square turbine pits with solid runners turning, the penstock main along the north wall, the governor's floor inlaid
// in the middle), and the Dam Heart (the master gate's hall: the scour channel out from under the Heart, a gate gallery ledge
// along the north wall either side of it, an ice tide-line round the walls). Grey stone and blackened bronze, frost and
// icicles, square piers and flat lintels only; everything square from above. Lamp posts all through it, so it reads well.
function dressDam(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches }) {
  const ST = '#a2aab0', ST2 = '#848c92', BZ = '#463c34', BZ2 = '#362e28', TR = '#8a6c42', IR = '#4a4e54';
  const cool = (x, y, z, k = 0.5) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0x7ac8ff, k });
  // the water flows: one scroller nudges the shared water normals along
  { const wm = getMat('dWaterDeep'), fl = new THREE.Group(); fl.userData.update = (dt) => { if (wm.normalMap) { wm.normalMap.offset.x += dt * 0.02; wm.normalMap.offset.y += dt * 0.06; } }; group.add(fl); dyn.push(fl); }
  // a straight channel along x or z: grey stone kerbs, running water (or a sheet of ice with snow on it), cool glows
  const channel = (x0, z0, x1, z1, w = 2.4, frozen = false) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, rot = alongX ? PI / 2 : 0;
    b.add(box(w, 0.04, L), 'dIron', { p: [mx, 0.02, mz], r: [0, rot, 0], c: '#1e2226' });
    if (frozen) {
      b.add(box(w - 0.1, 0.08, L), 'ice', { p: [mx, 0.06, mz], r: [0, rot, 0], c: 0xffffff });
      for (let t = 1; t < L - 1; t += 1.6 + r(0, 2)) { const u = (alongX ? Math.min(x0, x1) : Math.min(z0, z1)) + t, o = r(-w / 3, w / 3); b.add(ico(r(0.2, 0.4), 0), 'snowPack', { p: [alongX ? u : mx + o, 0.1, alongX ? mz + o : u], s: [1.8, 0.3, 1.4], r: [0, r(0, 3), 0], c: 0xffffff }); }
    } else {
      b.add(box(w - 0.1, 0.04, L), 'dWaterDeep', { p: [mx, 0.08, mz], r: [0, rot, 0], uv: 'box', us: 0.35 });
      for (let t = 4; t < L - 2; t += 9) { const u = (alongX ? Math.min(x0, x1) : Math.min(z0, z1)) + t, x = alongX ? u : mx, z = alongX ? mz : u; addDyn(glowSprite(0x6ac8ff, 2.4, 0.42), x, 0.24, z); cool(x, 0.8, z, 0.5); }
    }
    for (const s of [-1, 1]) {
      b.add(box(0.4, 0.28, L + 0.4), 'dWallDeep', { p: [mx + (alongX ? 0 : s * (w / 2 + 0.2)), 0.14, mz + (alongX ? s * (w / 2 + 0.2) : 0)], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 });
      for (let t = 0.8; t < L; t += 2.4) { const u = (alongX ? Math.min(x0, x1) : Math.min(z0, z1)) + t; b.add(ico(r(0.1, 0.18), 0), 'snowPack', { p: [alongX ? u : mx + s * (w / 2 + 0.2), 0.29, alongX ? mz + s * (w / 2 + 0.2) : u], s: [1.8, 0.35, 1.2], c: 0xffffff }); }
    }
  };
  // a sluice gate in a wall (rot turns its face into the room): two square stone piers, a flat lintel, a plank gate wound
  // part way up on chains, water pouring out under it
  const sluiceGate = (x, z, rot, w = 2.8) => {
    const c = Math.cos(rot), s = Math.sin(rot), L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    for (const sx of [-1, 1]) { const [px, pz] = L(sx * (w / 2 + 0.4), 0); b.add(box(0.8, 5.0, 0.9), 'dWallDeep', { p: [px, 2.5, pz], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 }); for (const y of [1.4, 3.6]) b.add(box(0.9, 0.16, 1.0), 'dBrass', { p: [px, y, pz], r: [0, rot, 0], c: BZ }); col(px, pz, 0.55); }
    b.add(box(w + 1.9, 0.7, 1.0), 'dWallDeep', { p: [x, 5.2, z], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST });
    b.add(box(w + 2.0, 0.12, 1.1), 'dBrass', { p: [x, 4.82, z], r: [0, rot, 0], c: BZ });
    const [gx, gz] = L(0, 0.15);
    b.add(box(w, 2.6, 0.18), 'dBrass', { p: [gx, 2.05, gz], r: [0, rot, 0], c: BZ2 });
    for (let i = 0; i < 5; i++) b.add(box(w - 0.1, 0.42, 0.08), 'dTimber', { p: [gx, 1.0 + i * 0.5, gz], r: [0, rot, 0], c: '#8a7458' });
    for (const y of [0.78, 3.3]) b.add(box(w + 0.1, 0.12, 0.26), 'dIron', { p: [gx, y, gz], r: [0, rot, 0], c: IR });
    for (const sx of [-0.7, 0.7]) { const [cx2, cz2] = L(sx, 0.15); b.add(cyl(0.04, 0.04, 1.4, 6), 'dIron', { p: [cx2, 4.1, cz2], c: '#2e3236' }); }
    for (let q = 0; q < 6; q++) { const [ix, iz] = L(-w / 2 + 0.2 + q * (w - 0.4) / 5, 0.3); const l = r(0.2, 0.45); b.add(cone(0.05, l, 5), 'ice', { p: [ix, 0.72 - l / 2, iz], r: [PI, 0, 0], c: 0xffffff }); }
    const [wx, wz] = L(0, 0.9);
    b.add(box(w - 0.2, 0.05, 1.6), 'wGlowBlue', { p: [wx, 0.1, wz], r: [0, rot, 0], c: 0xffffff });
    addDyn(smoke({ rate: 3, life: 1.6, size: 0.8, rise: 0.7, color: 0xdcecf6, opacity: 0.38 }), wx, 0.4, wz);
    addDyn(glowSprite(0x7ac8ff, 3.0, 0.5), wx, 0.6, wz); cool(wx, 1.0, wz, 0.7);
  };
  // a solid gate wheel on a wall (rot turns its face into the room): a blackened bronze disc with square lugs round the rim
  // and an off-centre bolt plate on a stone bracket, turning slowly. Never spoked.
  let wheelN = 0;
  const wallWheel = (x, z, rot, R = 1.6, y = 2.6) => {
    const wb = new Builder(3200 + wheelN);
    wb.add(cyl(R, R, 0.26, 30), 'dBrass', { r: [PI / 2, 0, 0], c: BZ2 });
    wb.add(cyl(R * 0.62, R * 0.62, 0.34, 24), 'dIron', { r: [PI / 2, 0, 0], c: IR });
    wb.add(cyl(R * 0.18, R * 0.18, 0.46, 12), 'dBrass', { r: [PI / 2, 0, 0], c: TR });
    wb.add(box(0.32, 0.5, 0.12), 'dBrass', { p: [0, R * 0.4, 0.22], c: TR });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; wb.add(box(0.28, 0.26, 0.32), 'dBrass', { p: [Math.cos(a) * (R + 0.11), Math.sin(a) * (R + 0.11), 0], r: [0, 0, a], c: TR }); }
    for (let i = 0; i < 4; i++) wb.add(ico(0.12, 0), 'snowPack', { p: [-0.6 + i * 0.4, R + 0.2, 0], s: [1.6, 0.4, 1.4], c: 0xffffff });
    const o = wb.build();
    const pv = new THREE.Group(); pv.add(o); pv.rotation.y = rot;
    const sp = 0.05 + (wheelN++ % 3) * 0.02;
    o.userData.update = (dt) => { o.rotation.z += dt * sp; };
    addDyn(pv, x, y, z); dyn.push(o);
    const c = Math.cos(rot), s = Math.sin(rot);
    b.add(box(0.7, 0.7, 0.6), 'dBrass', { p: [x - s * 0.35, y, z - c * 0.35], c: BZ });
    b.add(box(0.6, y - 0.4, 0.44), 'dWallDeep', { p: [x - s * 0.4, (y - 0.4) / 2, z - c * 0.4], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 });
  };
  // a square pier of grey stone standing in a hall: a stepped foot, two bronze bands, a flat cap stone, frost on it
  const pier = (x, z, h = 6.4, w = 1.6) => {
    b.add(box(w + 0.6, 0.5, w + 0.6), 'dWallDeep', { p: [x, 0.25, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(w, h - 0.5, w), 'dWallDeep', { p: [x, h / 2, z], uv: 'box', us: 0.4, c: ST });
    for (const y of [1.5, h - 1.5]) b.add(box(w + 0.12, 0.18, w + 0.12), 'dBrass', { p: [x, y, z], c: BZ });
    b.add(box(w + 0.4, 0.3, w + 0.4), 'dWallDeep', { p: [x, h - 0.15, z], uv: 'box', us: 0.4, c: '#b0b8be' });
    for (let q = 0; q < 4; q++) b.add(ico(0.22, 0), 'snowPack', { p: [x + r(-0.5, 0.5), h + 0.02, z + r(-0.5, 0.5)], s: [1.8, 0.4, 1.6], c: 0xffffff });
    for (let q = 0; q < 4; q++) { const l = r(0.25, 0.5), side = q % 4, ox = side < 2 ? (side ? 1 : -1) * (w / 2 + 0.18) : r(-0.5, 0.5), oz = side >= 2 ? (side === 3 ? 1 : -1) * (w / 2 + 0.18) : r(-0.5, 0.5); b.add(cone(0.06, l, 5), 'ice', { p: [x + ox, h - 0.32 - l / 2, z + oz], r: [PI, 0, 0], c: 0xffffff }); }
    col(x, z, w * 0.62 + 0.2);
  };
  // a flat-lintelled gate frame flush against a wall (rot turns it into the room): two square piers, a flat lintel, the
  // plank gate shut behind them with frost on it (the dam's old inspection gates)
  const blindGate = (x, z, rot, w = 4.0) => {
    const c = Math.cos(rot), s = Math.sin(rot), L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    for (const sx of [-1, 1]) { const [px, pz] = L(sx * (w / 2 + 0.45), 0.2); b.add(box(0.9, 5.4, 0.8), 'dWallDeep', { p: [px, 2.7, pz], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 }); b.add(box(1.0, 0.16, 0.9), 'dBrass', { p: [px, 1.4, pz], r: [0, rot, 0], c: BZ }); col(px, pz, 0.55); }
    const [lx, lz] = L(0, 0.2); b.add(box(w + 2.2, 0.8, 0.9), 'dWallDeep', { p: [lx, 5.6, lz], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST });
    const [gx, gz] = L(0, -0.05);
    b.add(box(w, 5.0, 0.12), 'dBrass', { p: [gx, 2.6, gz], r: [0, rot, 0], c: BZ2 });
    for (let i = 0; i < 9; i++) b.add(box(w - 0.1, 0.46, 0.08), 'dTimber', { p: [gx, 0.4 + i * 0.54, gz], r: [0, rot, 0], c: i % 2 ? '#7a6650' : '#8a7458' });
    for (const y of [0.3, 2.6, 4.9]) b.add(box(w + 0.1, 0.16, 0.24), 'dIron', { p: [gx, y, gz], r: [0, rot, 0], c: IR });
    for (let q = 0; q < 3; q++) b.add(box(r(0.6, 1.4), r(0.8, 2.2), 0.06), 'ice', { p: [gx + c * r(-1.2, 1.2), r(1.0, 3.6), gz - s * r(-1.2, 1.2)], r: [0, rot, 0], c: 0xffffff });
  };
  // a lamp post: a square bronze post on a stone foot, a caged lamp (the warm light against the cold water)
  const post = (x, z, h = 3.2) => {
    b.add(box(0.56, 0.34, 0.56), 'dWallDeep', { p: [x, 0.17, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(0.18, h, 0.18), 'dBrass', { p: [x, h / 2, z], c: BZ });
    lanternBuilder('yellow', 1.05, b, [x, h + 0.05, z]);
    addDyn(glowSprite(0xffc878, 2.2, 0.7), x, h - 0.35, z);
    torches.push({ x: D.ox + x, y: h - 0.3, z: D.oz + z, color: 0xffc890, k: 1.25 });
    col(x, z, 0.32);
  };
  // ice on the floor: a flat patch of pale lumps (where water stood and froze)
  const icePatch = (x, z, s = 1) => { if (!isFloorL(x, z)) return; for (let q = 0; q < 6; q++) b.add(ico(r(0.4, 0.8) * s, 0), q % 3 ? 'ice' : 'snowPack', { p: [x + r(-1.2, 1.2) * s, 0.0, z + r(-1, 1) * s], s: [1.6, 0.14, 1.3], r: [0, r(0, 3), 0], c: 0xffffff }); };
  // a stack of spare gate planks, frosted
  const planks = (x, z, rot) => {
    for (let k = 0; k < 4; k++) b.add(box(3.0, 0.16, 0.46), 'dTimber', { p: [x, 0.08 + k * 0.17, z], r: [0, rot + r(-0.06, 0.06), 0], c: k % 2 ? '#8a7458' : '#7a6448' });
    b.add(ico(0.3, 0), 'snowPack', { p: [x, 0.74, z], s: [3.0, 0.3, 1.1], r: [0, rot, 0], c: 0xffffff });
    col(x, z, 1.4);
  };
  // broken ice: a heap of slabs and blocks (what the Ice Breaker broke out of the spillway)
  const iceHeap = (x, z, s = 1) => {
    for (let q = 0; q < 7; q++) b.add(box(r(0.6, 1.4) * s, r(0.2, 0.5) * s, r(0.5, 1.2) * s), q % 3 ? 'ice' : 'iceBlue', { p: [x + r(-1.2, 1.2) * s, r(0.1, 0.4) * s, z + r(-1.0, 1.0) * s], r: [r(-0.4, 0.4), r(0, 3), r(-0.4, 0.4)], c: 0xffffff });
    col(x, z, 1.2 * s);
  };
  // a great penstock pipe on square stands along x or z, flanged every few metres, leaking at a few joints
  const bigPipe = (x0, z0, x1, z1, y = 2.0, R = 1.0, block = true) => {
    const L = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? [0, 0, PI / 2] : [PI / 2, 0, 0]; // pipes run along x or z
    b.add(cyl(R, R, L, 20), 'dBrass', { p: [(x0 + x1) / 2, y, (z0 + z1) / 2], r: ax, c: BZ });
    let n = 0;
    for (let t = 0.5; t <= L - 0.5; t += 4.5) {
      const px = x0 + (x1 - x0) * t / L, pz = z0 + (z1 - z0) * t / L;
      b.add(cyl(R + 0.14, R + 0.14, 0.18, 20), 'dIron', { p: [px, y, pz], r: ax, c: IR });
      b.add(ico(0.18, 0), 'snowPack', { p: [px, y + R + 0.08, pz], s: [1.8, 0.4, 1.8], c: 0xffffff });
      if (y - R > 0.4) { b.add(box(R * 1.8, y - R + 0.1, 0.6), 'dWallDeep', { p: [px, (y - R + 0.1) / 2, pz], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 }); }
      if (n++ % 3 === 1) { addDyn(smoke({ rate: 2, life: 1.4, size: 0.6, rise: 0.8, color: 0xdcecf6, opacity: 0.34 }), px, y + R * 0.6, pz); cool(px, y, pz, 0.4); }
      if (block) col(px, pz, R + 0.2);
    }
    if (block) for (let t = 2.7; t < L - 1; t += 4.5) col(x0 + (x1 - x0) * t / L, z0 + (z1 - z0) * t / L, R + 0.15);
    for (let q = 0; q < Math.floor(L / 3); q++) { const t = r(0.5, L - 0.5), l = r(0.2, 0.45); b.add(cone(0.06, l, 5), 'ice', { p: [x0 + (x1 - x0) * t / L, y - R - l / 2 + 0.05, z0 + (z1 - z0) * t / L], r: [PI, 0, 0], c: 0xffffff }); }
  };
  // a turbine pit: a square stone-kerbed pit of dark water, a solid runner disc turning on a shaft across it, spray
  let pitN = 0;
  const pit = (x, z, w = 5.0) => {
    for (const [px, pz, bw, bd] of [[x, z - w / 2, w + 0.5, 0.5], [x, z + w / 2, w + 0.5, 0.5], [x - w / 2, z, 0.5, w], [x + w / 2, z, 0.5, w]]) b.add(box(bw, 0.5, bd), 'dWallDeep', { p: [px, 0.25, pz], uv: 'box', us: 0.4, c: ST2 });
    for (const [px, pz, bw, bd] of [[x, z - w / 2, w + 0.6, 0.6], [x, z + w / 2, w + 0.6, 0.6]]) b.add(box(bw, 0.08, bd), 'dBrass', { p: [px, 0.54, pz], c: BZ });
    b.add(box(w - 0.4, 0.04, w - 0.4), 'dWaterDeep', { p: [x, 0.12, z], uv: 'box', us: 0.35 });
    for (const sx of [-1, 1]) { b.add(box(0.7, 1.3, 0.7), 'dBrass', { p: [x + sx * (w / 2), 0.95, z], c: BZ2 }); b.add(box(0.46, 0.3, 0.46), 'dBrass', { p: [x + sx * (w / 2), 1.7, z], c: TR }); }
    b.add(cyl(0.16, 0.16, w + 0.4, 10), 'dIron', { p: [x, 1.5, z], r: [0, 0, PI / 2], c: IR });
    const rb2 = new Builder(3300 + pitN);
    rb2.add(cyl(1.5, 1.5, 0.32, 30), 'dBrass', { r: [0, 0, PI / 2], c: BZ2 });
    rb2.add(cyl(0.9, 0.9, 0.42, 24), 'dIron', { r: [0, 0, PI / 2], c: IR });
    rb2.add(box(0.52, 0.28, 0.38), 'dBrass', { p: [0, 0.56, 0], c: TR });
    rb2.add(box(0.52, 0.22, 0.52), 'dIron', { p: [0, -0.56, 0], c: '#2e3236' });
    rb2.add(box(0.06, 0.12, 2.0), 'wGlowBlue', { p: [0.18, 1.25, 0], c: 0xffffff });
    const o = rb2.build(); const sp = 0.9 + (pitN++ % 2) * 0.4;
    o.userData.update = (dt) => { o.rotation.x += dt * sp; };
    addDyn(o, x, 1.5, z); dyn.push(o);
    addDyn(smoke({ rate: 3, life: 1.8, size: 1.1, rise: 1.0, color: 0xdcecf6, opacity: 0.36 }), x, 0.6, z);
    addDyn(glowSprite(0x6ac8ff, 3.8, 0.45), x, 0.3, z); cool(x, 1.0, z, 0.8);
    col(x, z, w / 2 + 0.2);
  };
  // the ice tide-line: a band of ice round a hall's walls a metre up, frozen spray above it, along wall runs [x0, z0, x1, z1]
  const tideLine = (runs, y = 1.2) => {
    for (const [x0, z0, x1, z1] of runs) {
      const alongX = z0 === z1, L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (!L) continue;
      b.add(box(alongX ? L : 0.14, 0.28, alongX ? 0.14 : L), 'ice', { p: [mx, y, mz], c: 0xffffff });
      b.add(box(alongX ? L : 0.08, 0.7, alongX ? 0.08 : L), 'iceBlue', { p: [mx, y - 0.52, mz], c: 0xffffff });
    }
  };

  // ---- the gate stair foot: two lamp posts, spare planks, ice in the corners, a frozen run down the east side
  post(67, 206.5); post(85, 206.5); post(67, 215.5, 2.8); post(85, 215.5, 2.8);
  planks(68.5, 211, PI / 2);
  icePatch(66, 206, 0.8); icePatch(86, 216, 0.7);
  channel(86.6, 205, 86.6, 217, 1.2, true);
  icePatch(76, 199, 0.6);

  // ---- the Gate Hall: two rows of tall square piers, a sluice gate in the west wall feeding a channel across the hall to an
  // outflow under the east wall, old inspection gates shut in the side walls, solid gate wheels on the north and south walls
  for (const [x, z] of [[40, 166], [40, 190], [112, 166], [112, 190], [62, 177], [90, 177]]) pier(x, z);
  channel(35, 177, 117, 177, 2.6);
  sluiceGate(35.4, 177, PI / 2);
  b.add(box(0.5, 1.4, 3.0), 'dIron', { p: [117.6, 0.5, 177], c: '#1a1e22' }); addDyn(glowSprite(0x6ac8ff, 2.8, 0.42), 117.0, 0.4, 177);
  blindGate(117.0, 168, -PI / 2); blindGate(117.0, 187, -PI / 2);
  for (const x of [64, 88, 104]) wallWheel(x, 160.9, 0);
  for (const x of [50, 102]) wallWheel(x, 193.1, PI);
  for (const [x, z] of [[56, 180], [96, 180], [76, 170], [76, 184], [60, 166], [92, 166]]) post(x, z);
  icePatch(38, 162, 1.0); icePatch(80, 192, 0.8); icePatch(114, 192, 0.8); icePatch(66, 165, 0.7);
  planks(37.5, 191, PI / 2); planks(115, 162.5, 0);

  // ---- passage west: a frozen run down its east side, a lamp
  channel(50.6, 149, 50.6, 161, 1.0, true);
  post(40.5, 155, 2.8);

  // ---- the Penstock Gallery: two great pipes on stands down the side walls, one more overhead down the middle, valve wheels
  // on the walls by the pipes, leaking flanges
  bigPipe(15.4, 104.6, 15.4, 149.4, 1.9, 1.1);
  bigPipe(66.6, 104.6, 66.6, 149.4, 1.9, 1.1);
  bigPipe(41, 104.6, 41, 112, 5.2, 0.8, false); // the middle pipe comes out of the north wall high up and turns down into the floor
  b.add(cyl(0.8, 0.8, 5.2, 18), 'dBrass', { p: [41, 2.6, 112.2], c: BZ });
  for (const y of [1.0, 3.2]) b.add(cyl(0.94, 0.94, 0.18, 18), 'dIron', { p: [41, y, 112.2], c: IR });
  b.add(box(2.6, 0.5, 2.6), 'dWallDeep', { p: [41, 0.25, 112.2], uv: 'box', us: 0.4, c: ST2 }); col(41, 112.2, 1.3);
  wallWheel(18.0, 104.9, 0, 1.3); wallWheel(64.0, 104.9, 0, 1.3); wallWheel(28, 149.1, PI, 1.4); wallWheel(56, 149.1, PI, 1.4);
  for (const [x, z] of [[24, 132], [58, 132], [24, 118], [58, 118], [33, 145], [49, 108]]) post(x, z);
  icePatch(30, 140, 1.0); icePatch(52, 113, 0.9); icePatch(20, 125, 0.7); icePatch(62, 125, 0.7);

  // ---- passage east
  post(83, 124, 2.8); icePatch(72, 118, 0.6);

  // ---- the Spillway: the stepped spillway channel the length of the hall from the spillway gate in the north wall, broken
  // ice heaped along it, frozen side channels, lamp posts down both sides
  {
    // the spillway gate: two great square piers in the north wall, a flat lintel, the gate wound up, water sheeting under it
    for (const x of [106.5, 123.5]) { b.add(box(3.0, 6.4, 2.4), 'dWallDeep', { p: [x, 3.2, 85.4], uv: 'box', us: 0.4, c: ST2 }); for (const y of [1.6, 4.4]) b.add(box(3.1, 0.18, 2.5), 'dBrass', { p: [x, y, 85.4], c: BZ }); col(x, 85.4, 1.6); }
    b.add(box(20, 1.0, 1.6), 'dWallDeep', { p: [115, 5.9, 85.0], uv: 'box', us: 0.4, c: ST });
    b.add(box(14, 2.4, 0.3), 'dBrass', { p: [115, 4.0, 84.6], c: BZ2 });
    for (let i = 0; i < 4; i++) b.add(box(13.8, 0.44, 0.1), 'dTimber', { p: [115, 3.0 + i * 0.5, 84.8], c: '#6e5c46' });
    b.add(box(14.4, 0.2, 0.3), 'dIron', { p: [115, 2.78, 84.85], c: IR });
    for (let q = 0; q < 12; q++) { const l = r(0.3, 0.7); b.add(cone(0.07, l, 5), 'ice', { p: [109 + q * 1.1, 2.7 - l / 2, 85.0], r: [PI, 0, 0], c: 0xffffff }); }
    b.add(box(12.5, 0.06, 2.0), 'wGlowBlue', { p: [115, 0.12, 85.6], c: 0xffffff });
    for (const x of [110, 115, 120]) addDyn(smoke({ rate: 3, life: 1.6, size: 1.0, rise: 0.8, color: 0xdcecf6, opacity: 0.38 }), x, 0.6, 86.0);
    addDyn(glowSprite(0x7ac8ff, 6, 0.45), 115, 1.2, 86.5); cool(115, 1.8, 87, 1.0);
  }
  channel(115, 86.6, 115, 133.4, 6.0);
  for (let z = 92; z < 133; z += 6) { b.add(box(6.0, 0.14, 0.5), 'dWallDeep', { p: [115, 0.1, z], uv: 'box', us: 0.4, c: ST2 }); b.add(box(5.8, 0.05, 0.6), 'wGlowBlue', { p: [115, 0.13, z + 0.5], c: 0xffffff }); } // the steps' sills, white water over each
  channel(87.6, 90, 87.6, 132, 1.4, true); channel(138.4, 90, 138.4, 120, 1.4, true);
  for (const [x, z, s] of [[109, 96, 1.0], [121.5, 114, 1.1], [109, 128, 0.9], [121.5, 94, 0.8], [109, 116, 0.8]]) iceHeap(x, z, s);
  for (const [x, z] of [[100, 96], [100, 116], [126, 102], [126, 122], [92, 106], [136, 108]]) post(x, z);
  icePatch(94, 92, 1.0); icePatch(134, 130, 0.9); icePatch(90, 118, 0.8); icePatch(140, 100, 0.7);
  wallWheel(141.1, 112, -PI / 2, 1.5); wallWheel(84.9, 100, PI / 2, 1.4);

  // ---- passage west
  post(102.5, 76, 2.8); icePatch(94, 84, 0.6);

  // ---- the Turbine Hall: four square turbine pits with runners turning, the penstock main along the north wall with a drop
  // into each pit, the tailrace along the south wall, the governor's floor inlaid in the middle
  for (const x of [38, 52, 80, 94]) pit(x, 57, 5.0);
  bigPipe(20.6, 47.8, 111.4, 47.8, 4.2, 0.7, false);
  for (const x of [38, 52, 80, 94]) { b.add(cyl(0.6, 0.6, 4.2, 16), 'dBrass', { p: [x, 2.1, 49.4], c: BZ }); b.add(cyl(0.72, 0.72, 0.16, 16), 'dIron', { p: [x, 3.0, 49.4], c: IR }); b.add(cyl(0.5, 0.5, 4.8, 16), 'dBrass', { p: [x, 0.9, 51.8], r: [PI / 2, 0, 0], c: BZ }); col(x, 49.6, 0.9); col(x, 52.2, 0.6); }
  channel(20.6, 73.6, 111.4, 73.6, 2.0);
  // the governor's floor: a square of dark dressed stone with a bronze border, flush with the floor
  b.add(box(14, 0.03, 12), 'dWallDeep', { p: [66, 0.02, 61], uv: 'box', us: 0.4, c: '#6a7278' });
  for (const [px, pz, bw, bd] of [[66, 55, 14.2, 0.22], [66, 67, 14.2, 0.22], [59, 61, 0.22, 12.2], [73, 61, 0.22, 12.2]]) b.add(box(bw, 0.05, bd), 'dBrass', { p: [px, 0.03, pz], c: BZ });
  for (const [x, z] of [[24, 49.5], [108, 49.5]]) pier(x, z, 6.4, 1.4);
  for (const [x, z] of [[45, 66], [87, 66], [66, 51], [24, 61], [108, 61], [66, 71]]) post(x, z);
  icePatch(30, 72, 0.9); icePatch(102, 72, 0.9); icePatch(60, 49, 0.7); icePatch(72, 70, 0.7);
  wallWheel(20.9, 66, PI / 2, 1.4); wallWheel(111.1, 66, -PI / 2, 1.4);

  // ---- passage west
  post(43.5, 41, 2.8); icePatch(36, 37, 0.6);

  // ---- the Dam Heart: the scour channel out from under the Heart's gate to the south wall, a gate gallery ledge along the
  // north wall either side of the Heart, frozen side channels, square piers down the hall, an ice tide-line round the walls
  channel(75, 17.4, 75, 35.4, 5.0);
  for (const [x0, x1] of [[14.4, 63], [87, 135.6]]) {
    const mx = (x0 + x1) / 2, L = x1 - x0;
    b.add(box(L, 2.6, 2.6), 'dWallDeep', { p: [mx, 1.3, 3.4], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(L, 0.18, 2.8), 'dBrass', { p: [mx, 2.62, 3.4], c: BZ });
    for (let x = x0 + 1; x < x1; x += 2.2) b.add(box(0.12, 0.9, 0.12), 'dIron', { p: [x, 3.1, 4.6], c: IR }); // the gallery's rail posts
    b.add(box(L, 0.1, 0.1), 'dIron', { p: [mx, 3.55, 4.6], c: IR });
    for (let q = 0; q < L / 2.5; q++) { const l = r(0.25, 0.6); b.add(cone(0.06, l, 5), 'ice', { p: [x0 + 0.6 + q * 2.5, 2.5 - l / 2, 4.75], r: [PI, 0, 0], c: 0xffffff }); }
    for (let x = x0 + 1.5; x < x1 - 1; x += 3) col(x, 3.4, 1.4);
  }
  channel(18, 8, 18, 34, 1.6, true); channel(132, 8, 132, 34, 1.6, true);
  for (const [x, z] of [[46, 26], [104, 26]]) pier(x, z, 6.4, 1.8);
  tideLine([[14.4, 6, 14.4, 35.6], [135.6, 6, 135.6, 35.6], [14.4, 35.6, 32, 35.6], [46, 35.6, 135.6, 35.6]]);
  // the depth gauge on the east wall: a tall board, marks on one side only, the ice line on it
  b.add(box(0.12, 4.6, 0.8), 'dTimber', { p: [135.5, 2.5, 24], c: '#8a7458' });
  for (let i = 0; i < 9; i++) b.add(box(0.1, 0.06, i % 2 ? 0.25 : 0.45), 'dIron', { p: [135.4, 0.6 + i * 0.5, 23.7 - (i % 2 ? 0.05 : 0.12)], c: '#2a2e32' });
  for (const [x, z] of [[58, 22], [92, 22], [34, 30], [116, 30], [62, 33], [88, 33], [50, 8], [100, 8]]) post(x, z, 3.4);
  wallWheel(14.9, 14, PI / 2, 1.6); wallWheel(135.1, 14, -PI / 2, 1.6);
  icePatch(40, 14, 1.0); icePatch(110, 14, 1.0); icePatch(60, 30, 0.9); icePatch(92, 30, 0.9); icePatch(24, 24, 0.8); icePatch(126, 24, 0.8);
  planks(52, 33.5, 0.05); planks(98, 33.5, -0.05);
}

// ----------------------------------------------------------------------------------------- THE PUMP WORKS
// the shafts and galleries the Makers cut under the Engine Rows, where the wind engines drove the pumps that lifted meltwater
// up to the Heights, south to north: the Shaft Head (a small shaft with its pump rod, timber staging up the east wall), the
// Rod Hall (two square shafts, each with a rocking beam on a stone pier working its pump rod, staging along both long
// walls, the rising main overhead), the Cistern Gallery (square stone cisterns of meltwater, the pipes between them, valve
// wheels on the walls) and the Great Shaft (the deepest shaft across the north wall under a timber headframe, the rising
// mains up the wall beside it, an ice tide-line round the hall). Grey rock, black timber, iron and brass, frost and drips;
// everything square from above, beams and braces one way only (never an X), wheels solid with lugs, never spoked.
function dressPump(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches }) {
  const ST = '#8e9498', ST2 = '#70767a', TB = '#4e3e30', TB2 = '#6a5440', IR = '#3e4246', BR = '#8a6c42';
  const cool = (x, y, z, k = 0.5) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0x7ac8ff, k });
  const warm = (x, y, z, k = 1.0) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0xffc890, k });
  { const wm = getMat('dWaterDeep'), fl = new THREE.Group(); fl.userData.update = (dt) => { if (wm.normalMap) { wm.normalMap.offset.x += dt * 0.015; wm.normalMap.offset.y += dt * 0.03; } }; group.add(fl); dyn.push(fl); }
  // a lamp post: a square timber post shod in iron, a caged lamp on top (the warm light the halls are lit by)
  const post = (x, z, h = 3.2) => {
    b.add(box(0.5, 0.3, 0.5), 'dWallDeep', { p: [x, 0.15, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(0.2, h, 0.2), 'dTimber', { p: [x, h / 2, z], c: 0xffffff });
    for (const y of [0.6, h - 0.5]) b.add(box(0.26, 0.1, 0.26), 'dIron', { p: [x, y, z], c: IR });
    lanternBuilder('yellow', 1.05, b, [x, h + 0.05, z]);
    addDyn(glowSprite(0xffc878, 2.2, 0.7), x, h - 0.35, z);
    warm(x, h - 0.3, z, 1.2);
    col(x, z, 0.3);
  };
  // ice on the floor where water stood and froze
  const icePatch = (x, z, s = 1) => { if (!isFloorL(x, z)) return; for (let q = 0; q < 6; q++) b.add(ico(r(0.4, 0.8) * s, 0), q % 3 ? 'ice' : 'snowPack', { p: [x + r(-1.2, 1.2) * s, 0.0, z + r(-1, 1) * s], s: [1.6, 0.14, 1.3], r: [0, r(0, 3), 0], c: 0xffffff }); };
  // a stack of spare rod lengths or staging boards, frosted
  const boards = (x, z, rot) => {
    for (let k = 0; k < 4; k++) b.add(box(3.0, 0.16, 0.46), 'dTimber', { p: [x, 0.08 + k * 0.17, z], r: [0, rot + r(-0.06, 0.06), 0], c: k % 2 ? TB2 : '#5a4836' });
    b.add(ico(0.3, 0), 'snowPack', { p: [x, 0.74, z], s: [3.0, 0.3, 1.1], r: [0, rot, 0], c: 0xffffff });
    col(x, z, 1.4);
  };
  const rodStack = (x, z, rot) => {
    for (let k = 0; k < 3; k++) for (let q = 0; q < 3 - k; q++) b.add(box(4.0, 0.3, 0.3), 'dIron', { p: [x + Math.cos(rot) * 0, 0.15 + k * 0.3, z + (q - (2 - k) / 2) * 0.34], r: [0, rot, 0], c: '#4a4e52' });
    col(x, z, 1.6);
  };
  // a pipe run along x or z, flanged every few metres, frost on the flanges
  const pipe = (x0, z0, x1, z1, y = 3.8, R = 0.4) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? [0, 0, PI / 2] : [PI / 2, 0, 0];
    b.add(cyl(R, R, L, 14), 'dIron', { p: [(x0 + x1) / 2, y, (z0 + z1) / 2], r: ax, c: '#4a4e52' });
    for (let t = 0; t <= L; t += 3.5) { const px = x0 + (x1 - x0) * t / L, pz = z0 + (z1 - z0) * t / L; b.add(cyl(R + 0.1, R + 0.1, 0.14, 14), 'dBrass', { p: [px, y, pz], r: ax, c: BR }); b.add(ico(0.14, 0), 'snowPack', { p: [px, y + R + 0.04, pz], s: [1.6, 0.4, 1.6], c: 0xffffff }); }
  };
  // a vertical pipe up a wall to the cap, banded
  const riser = (x, z, R = 0.45, H = 5.6) => {
    b.add(cyl(R, R, H, 14), 'dIron', { p: [x, H / 2, z], c: '#4a4e52' });
    for (let y = 0.6; y < H; y += 1.6) b.add(cyl(R + 0.1, R + 0.1, 0.14, 14), 'dBrass', { p: [x, y, z], c: BR });
    col(x, z, R + 0.1);
  };
  // a square shaft in the floor: a black square well, a stone kerb, a square iron railing on posts, a timber headframe of
  // four posts and two flat head beams (both along z, side by side, parallel to the rocking beam that works the rod, so
  // from above nothing crosses). Returns the shaft's top for a rod.
  const shaft = (x, z, w = 5, d = w, headH = 4.6) => {
    b.add(box(w - 0.4, 0.04, d - 0.4), 'dCap', { p: [x, 0.03, z], c: '#040506' });
    for (const [px, pz, bw, bd] of [[x, z - d / 2, w + 0.4, 0.4], [x, z + d / 2, w + 0.4, 0.4], [x - w / 2, z, 0.4, d], [x + w / 2, z, 0.4, d]]) {
      b.add(box(bw, 0.45, bd), 'dWallDeep', { p: [px, 0.22, pz], uv: 'box', us: 0.4, c: ST2 });
      b.add(box(bw * 0.98, 0.06, bd * 0.98), 'snowPack', { p: [px, 0.48, pz], c: 0xffffff });
    }
    // the railing: square posts at the corners and between, one rail along each side at waist height
    for (const [px, pz] of [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2]]) {
      b.add(box(0.3, headH, 0.3), 'dTimber', { p: [px, headH / 2, pz], c: 0xffffff });
      for (const y of [0.7, headH - 0.6]) b.add(box(0.36, 0.1, 0.36), 'dIron', { p: [px, y, pz], c: IR });
      col(px, pz, 0.3);
    }
    for (const [px, pz, bw, bd] of [[x, z - d / 2, w, 0.1], [x, z + d / 2, w, 0.1], [x - w / 2, z, 0.1, d], [x + w / 2, z, 0.1, d]]) b.add(box(bw, 0.1, bd), 'dIron', { p: [px, 1.1, pz], c: IR });
    // the head beams, along z on both sides
    for (const s of [-1, 1]) b.add(box(0.36, 0.36, d + 0.6), 'dTimber', { p: [x + s * w / 2, headH, z], c: 0xffffff });
    for (const s of [-1, 1]) for (let q = 0; q < 4; q++) { const l = r(0.2, 0.5); b.add(cone(0.05, l, 5), 'ice', { p: [x + s * w / 2, headH - 0.2 - l / 2, z - d / 2 + 0.5 + q * (d - 1) / 3], r: [PI, 0, 0], c: 0xffffff }); }
    for (const s of [-1, 1]) b.add(ico(0.16, 0), 'snowPack', { p: [x + s * w / 2, headH + 0.2, z], s: [1.2, 0.4, 3.0], c: 0xffffff });
    addDyn(smoke({ rate: 2, life: 2.4, size: 1.2, rise: 1.2, color: 0xdcecf6, opacity: 0.3 }), x, 0.4, z);
    addDyn(glowSprite(0x6ac8ff, 3.0, 0.35), x, 0.3, z); cool(x, 1.0, z, 0.6);
    col(x, z, Math.min(w, d) / 2);
    return headH;
  };
  // a beam engine working a shaft: a square stone pier beside the shaft (dir: +1 to its south, -1 to its north), a flat
  // timber-and-iron beam from the pier's top out over the shaft, rocking slowly, its pump rod rising and falling in the shaft
  let bobN = 0;
  const bob = (x, z, dir, w = 5) => {
    const pz = z + dir * (w / 2 + 2.2), H = 4.2, L = w / 2 + 3.2;
    b.add(box(2.2, 0.4, 2.2), 'dWallDeep', { p: [x, 0.2, pz], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(1.7, H, 1.7), 'dWallDeep', { p: [x, H / 2, pz], uv: 'box', us: 0.4, c: ST });
    for (const y of [1.2, H - 0.5]) b.add(box(1.82, 0.14, 1.82), 'dIron', { p: [x, y, pz], c: IR });
    for (const sx of [-1, 1]) b.add(box(0.3, 0.6, 0.8), 'dIron', { p: [x + sx * 0.55, H + 0.3, pz], c: IR });
    b.add(ico(0.2, 0), 'snowPack', { p: [x, H + 0.02, pz], s: [3, 0.4, 3], c: 0xffffff });
    col(x, pz, 1.1);
    const g = new THREE.Group(), bm = new Builder(2700 + bobN);
    // the beam along the line from pier to shaft (local z points from the pier toward the shaft)
    bm.add(box(0.6, 0.7, L + 1.4), 'dTimber', { p: [0, 0, L / 2 - 0.5], c: 0xffffff });
    for (const y of [-0.38, 0.38]) bm.add(box(0.7, 0.08, L + 1.5), 'dIron', { p: [0, y, L / 2 - 0.5], c: IR });
    bm.add(box(0.9, 0.9, 0.7), 'dIron', { p: [0, 0, 0], c: IR });
    bm.add(box(0.8, 0.8, 0.6), 'dIron', { p: [0, -0.1, L], c: IR });
    bm.add(box(0.7, 0.7, 0.8), 'dIron', { p: [0, 0, -1.1], c: '#2e3236' }); // the counterweight box on the short end
    const beam = bm.build(); g.add(beam); g.rotation.y = dir > 0 ? PI : 0;
    addDyn(g, x, H + 0.75, pz);
    const rb2 = new Builder(2750 + bobN);
    rb2.add(box(0.34, 5.0, 0.34), 'dIron', { p: [0, -2.5, 0], c: '#5a5e62' });
    rb2.add(box(0.5, 0.3, 0.5), 'dBrass', { p: [0, -0.15, 0], c: BR });
    rb2.add(box(0.03, 3.4, 0.03), 'wGlowBlue', { p: [0.18, -3.0, 0.18] });
    const rod = rb2.build();
    const rp = new THREE.Group(); rp.add(rod); addDyn(rp, x, H + 0.75, z);
    const sp = 0.7 + (bobN % 3) * 0.12, off = bobN * 1.7; bobN++;
    beam.userData.update = (dt, t) => { const a = Math.sin(t * sp + off) * 0.16; beam.rotation.x = -a; rp.position.y = H + 0.75 + Math.sin(a) * L; };
    dyn.push(beam);
  };
  // timber staging along a wall: a plank deck on square posts every 3 m with one knee brace each (all leaning the same
  // way: never an X), a handrail on the room side, a ladder at one end. wall: the wall's line, side: +1/-1 toward the room
  const staging = (alongX, line, a0, a1, side, y = 2.6) => {
    const L = a1 - a0, mid = (a0 + a1) / 2, dw = 1.6, off = line + side * (dw / 2 + 0.05);
    const P = (u, o) => alongX ? [u, o] : [o, u];
    { const [x, z] = P(mid, off); b.add(box(alongX ? L : dw, 0.14, alongX ? dw : L), 'dTimber', { p: [x, y, z], c: TB2 }); }
    for (let u = a0 + 0.3; u <= a1 - 0.2; u += 3) {
      const [x, z] = P(u, line + side * (dw - 0.15));
      b.add(box(0.24, y, 0.24), 'dTimber', { p: [x, y / 2, z], c: 0xffffff });
      if (alongX) b.add(box(1.2, 0.12, 0.12), 'dTimber', { p: [x + 0.4, y - 0.5, z], r: [0, 0, 0.7], c: 0xffffff }); // one knee brace, all leaning the same way
      else b.add(box(0.12, 0.12, 1.2), 'dTimber', { p: [x, y - 0.5, z + 0.4], r: [-0.7, 0, 0], c: 0xffffff });
      b.add(box(0.12, 1.0, 0.12), 'dTimber', { p: [x, y + 0.5, z], c: 0xffffff });
      col(x, z, 0.2);
    }
    { const [x, z] = P(mid, line + side * (dw - 0.15)); b.add(box(alongX ? L : 0.1, 0.1, alongX ? 0.1 : L), 'dTimber', { p: [x, y + 0.95, z], c: 0xffffff }); }
    for (let u = a0 + 1; u < a1; u += 2.2) { const [x, z] = P(u, off); b.add(ico(r(0.12, 0.2), 0), 'snowPack', { p: [x, y + 0.08, z], s: [2.0, 0.3, 1.4], c: 0xffffff }); }
    // the ladder at the a0 end: two rails and rungs, leaning against the deck
    { const [x, z] = P(a0 + 0.9, line + side * (dw + 0.5));
      for (const s of [-0.3, 0.3]) b.add(box(0.08, y + 0.6, 0.08), 'dTimber', { p: alongX ? [x + s, (y + 0.6) / 2, z] : [x, (y + 0.6) / 2, z + s], r: alongX ? [side * -0.25, 0, 0] : [0, 0, side * 0.25], c: 0xffffff });
      for (let k = 0; k < 7; k++) b.add(box(alongX ? 0.6 : 0.06, 0.06, alongX ? 0.06 : 0.6), 'dTimber', { p: alongX ? [x, 0.3 + k * 0.4, z - side * k * 0.1] : [x - side * k * 0.1, 0.3 + k * 0.4, z], c: 0xffffff });
    }
  };
  // a square stone cistern of meltwater: a kerb a metre high, a thin skin of ice round the edge, frost on the kerb
  const cistern = (x, z, w = 5) => {
    for (const [px, pz, bw, bd] of [[x, z - w / 2, w + 0.6, 0.6], [x, z + w / 2, w + 0.6, 0.6], [x - w / 2, z, 0.6, w], [x + w / 2, z, 0.6, w]]) {
      b.add(box(bw, 1.1, bd), 'dWallDeep', { p: [px, 0.55, pz], uv: 'box', us: 0.4, c: ST2 });
      b.add(box(bw + 0.04, 0.1, bd + 0.04), 'dIron', { p: [px, 1.12, pz], c: IR });
      for (let q = 0; q < 3; q++) b.add(ico(r(0.12, 0.2), 0), 'snowPack', { p: [px + (bw > bd ? r(-bw / 2, bw / 2) : 0), 1.2, pz + (bd > bw ? r(-bd / 2, bd / 2) : 0)], s: [2, 0.35, 1.4], c: 0xffffff });
    }
    b.add(box(w - 0.6, 0.04, w - 0.6), 'dWaterDeep', { p: [x, 0.85, z], uv: 'box', us: 0.35 });
    for (const [px, pz, bw, bd] of [[x, z - w / 2 + 0.55, w - 0.6, 0.5], [x, z + w / 2 - 0.55, w - 0.6, 0.5], [x - w / 2 + 0.55, z, 0.5, w - 1.6], [x + w / 2 - 0.55, z, 0.5, w - 1.6]]) b.add(box(bw, 0.06, bd), 'ice', { p: [px, 0.89, pz], c: 0xffffff });
    addDyn(glowSprite(0x6ac8ff, 3.0, 0.32), x, 1.0, z); cool(x, 1.4, z, 0.5);
    col(x, z, w / 2 + 0.3);
  };
  // a solid valve wheel on a wall (rot turns its face into the room): a disc with square lugs and an off-centre bolt plate
  let wheelN = 0;
  const valveWheel = (x, z, rot, R = 1.2) => {
    const wb = new Builder(2800 + wheelN);
    wb.add(cyl(R, R, 0.22, 28), 'dIron', { r: [PI / 2, 0, 0], c: IR });
    wb.add(cyl(R * 0.6, R * 0.6, 0.3, 22), 'dIron', { r: [PI / 2, 0, 0], c: '#55595e' });
    wb.add(cyl(R * 0.18, R * 0.18, 0.42, 12), 'dBrass', { r: [PI / 2, 0, 0], c: BR });
    wb.add(box(0.26, 0.4, 0.12), 'dBrass', { p: [0, R * 0.4, 0.18], c: BR });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; wb.add(box(0.24, 0.22, 0.28), 'dBrass', { p: [Math.cos(a) * (R + 0.1), Math.sin(a) * (R + 0.1), 0], r: [0, 0, a], c: BR }); }
    const o = wb.build(), pv = new THREE.Group(); pv.add(o); pv.rotation.y = rot;
    const sp = 0.06 + (wheelN++ % 3) * 0.02; o.userData.update = (dt) => { o.rotation.z += dt * sp; };
    addDyn(pv, x, 2.3, z); dyn.push(o);
    const c = Math.cos(rot), s = Math.sin(rot);
    b.add(box(0.6, 0.6, 0.5), 'dIron', { p: [x - s * 0.3, 2.3, z - c * 0.3], c: IR });
  };
  // the ice tide-line round a hall: a band of ice a metre up the walls and frozen spray above it
  const tide = (segs, y = 1.1) => {
    for (const [x0, z0, x1, z1] of segs) {
      const alongX = z0 === z1, L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (!L) continue;
      b.add(box(alongX ? L : 0.14, 0.24, alongX ? 0.14 : L), 'ice', { p: [mx, y, mz], c: 0xffffff });
      b.add(box(alongX ? L : 0.08, y - 0.4, alongX ? 0.08 : L), 'iceBlue', { p: [mx, (y - 0.4) / 2 + 0.05, mz], c: 0xffffff });
    }
  };

  // ---- the Shaft Head: a small shaft with its beam in the west corner, staging up the east wall, the rising main overhead
  shaft(58, 129, 4, 4, 4.2); bob(58, 129, -1, 4);
  staging(false, 73.9, 120.5, 132.5, -1);
  post(60, 120.5, 3.0); post(70.5, 125, 3.0);
  pipe(54.6, 121, 73.4, 121, 4.3, 0.36);
  boards(69, 131.5, 0.08); icePatch(56, 120, 0.7); icePatch(71, 119, 0.6);
  // the stair passage: a frozen seep across the floor
  icePatch(64, 112, 0.6);

  // ---- the Rod Hall: two square shafts with their beam engines on piers to the south, staging along both long walls, the
  // rising main along the north wall, lamp posts down the middle
  shaft(54, 94, 5, 5, 4.6); bob(54, 94, 1);
  shaft(78, 94, 5, 5, 4.6); bob(78, 94, 1);
  staging(true, 76.1, 46, 98, 1);
  staging(true, 107.9, 28, 57, -1); staging(true, 107.9, 71, 100, -1);
  pipe(26.6, 77.4, 101.4, 77.4, 4.4, 0.45);
  riser(27, 77.6, 0.45, 4.4); riser(101, 77.6, 0.45, 4.4);
  for (const [x, z] of [[36, 92], [66, 100], [96, 92]]) post(x, z, 3.2);
  valveWheel(26.1, 90, PI / 2, 1.2); valveWheel(101.9, 96, -PI / 2, 1.2);
  rodStack(32, 104.5, 0); boards(97, 104.5, 0.05);
  icePatch(40, 80, 0.9); icePatch(66, 88, 0.8); icePatch(96, 80, 0.8); icePatch(30, 98, 0.8);

  // ---- passage west: a frozen run down its east side, one lamp
  post(32, 70, 2.8); icePatch(41, 72, 0.6);

  // ---- the Cistern Gallery: four square cisterns along the walls, the pipes between them overhead, valve wheels on the
  // end walls, lamp posts
  cistern(50, 60.5); cistern(71, 60.5); cistern(30, 36.5); cistern(62, 36.5);
  pipe(50, 60.5, 71, 60.5, 3.6, 0.32); pipe(30, 36.5, 62, 36.5, 3.6, 0.32);
  for (const [x, z] of [[50, 60.5], [71, 60.5], [30, 36.5], [62, 36.5]]) b.add(cyl(0.32, 0.32, 2.6, 12), 'dIron', { p: [x, 2.4, z], c: '#4a4e52' }); // the drops into the cisterns
  pipe(13, 48, 77, 48, 4.4, 0.4); // the main across the gallery overhead
  valveWheel(12.1, 56, PI / 2, 1.3); valveWheel(77.9, 54, -PI / 2, 1.1);
  for (const [x, z] of [[16, 48], [40, 52], [58, 48], [70, 52], [44, 34]]) post(x, z, 3.2);
  boards(15, 34.5, PI / 2); rodStack(24, 64.5, 0);
  icePatch(26, 50, 0.9); icePatch(46, 40, 0.8); icePatch(66, 44, 0.9); icePatch(16, 62, 0.8);

  // ---- passage east
  post(80, 39.5, 2.8); icePatch(84, 44, 0.6);

  // ---- the Great Shaft: the deepest shaft across the north wall under a tall timber headframe, the rising mains up the wall
  // either side, water spilling over its kerb, square stone piers, staging up the east wall, the ice tide-line
  {
    const x0 = 94, x1 = 110, z0 = 4.4, z1 = 9.6, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    b.add(box(w - 0.4, 0.04, d - 0.4), 'dCap', { p: [mx, 0.03, mz], c: '#040506' });
    for (const [px, pz, bw, bd] of [[mx, z1, w + 0.6, 0.6], [x0, mz, 0.6, d], [x1, mz, 0.6, d]]) { b.add(box(bw, 0.6, bd), 'dWallDeep', { p: [px, 0.3, pz], uv: 'box', us: 0.4, c: ST2 }); b.add(box(bw, 0.08, bd), 'dIron', { p: [px, 0.62, pz], c: IR }); }
    for (let x = x0; x <= x1 + 0.01; x += 4) { b.add(box(0.2, 1.2, 0.2), 'dTimber', { p: [x, 0.6, z1], c: 0xffffff }); }
    b.add(box(w, 0.1, 0.1), 'dIron', { p: [mx, 1.15, z1], c: IR });
    // the headframe: four tall square posts, two flat head beams along x, the sheave block on them (a solid drum)
    for (const x of [x0 + 0.4, x1 - 0.4]) for (const z of [z0 + 0.2, z1]) { b.add(box(0.5, 5.4, 0.5), 'dTimber', { p: [x, 2.7, z], c: 0xffffff }); for (const y of [1.0, 4.6]) b.add(box(0.58, 0.12, 0.58), 'dIron', { p: [x, y, z], c: IR }); col(x, z, 0.4); }
    for (const z of [z0 + 0.2, z1]) b.add(box(w + 0.4, 0.5, 0.5), 'dTimber', { p: [mx, 5.3, z], c: 0xffffff });
    b.add(cyl(0.9, 0.9, 3.0, 22), 'dIron', { p: [mx, 5.9, mz], r: [0, 0, PI / 2], c: IR });
    for (const s of [-1, 1]) b.add(cyl(1.0, 1.0, 0.14, 22), 'dBrass', { p: [mx + s * 1.5, 5.9, mz], r: [0, 0, PI / 2], c: BR });
    for (let q = 0; q < 14; q++) { const l = r(0.3, 0.7); b.add(cone(0.07, l, 5), 'ice', { p: [x0 + 0.6 + q * (w - 1.2) / 13, 5.0 - l / 2, z1 + 0.2], r: [PI, 0, 0], c: 0xffffff }); }
    // water spilling over the kerb's south face, sheeting across the floor
    b.add(box(8, 0.05, 3.0), 'wGlowBlue', { p: [mx, 0.06, z1 + 1.8], c: 0xffffff });
    // spray off the shaft in three uneven places (an even pair over the black well read as two lit eyes from above)
    for (const [x, z, sz] of [[mx - 4.6, mz - 0.9, 1.4], [mx + 1.3, mz + 1.0, 1.1], [mx + 5.2, mz - 0.4, 1.3]]) addDyn(smoke({ rate: 2.4, life: 2.2, size: sz, rise: 1.4, color: 0xdcecf6, opacity: 0.32 }), x, 0.6, z);
    addDyn(glowSprite(0x7ac8ff, 7, 0.4), mx, 0.8, mz); cool(mx, 1.6, mz + 3, 1.0);
    col(mx, mz, 2.6); col(mx - 5, mz, 2.6); col(mx + 5, mz, 2.6);
  }
  for (const x of [88, 91, 113, 116]) riser(x, 5.2, 0.5, 5.6);
  pipe(91, 5.2, 94, 5.2, 3.0, 0.5); pipe(110, 5.2, 113, 5.2, 3.0, 0.5);
  for (const [x, z] of [[85, 10], [119, 10]]) {
    b.add(box(1.7, 0.45, 1.7), 'dWallDeep', { p: [x, 0.22, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(1.25, 5.1, 1.25), 'dWallDeep', { p: [x, 2.8, z], uv: 'box', us: 0.4, c: ST });
    for (const y of [1.3, 4.6]) b.add(box(1.36, 0.16, 1.36), 'dIron', { p: [x, y, z], c: IR });
    col(x, z, 0.95);
  }
  staging(false, 121.9, 14, 36, -1);
  for (const [x, z] of [[84, 34], [120, 40], [102, 48], [88, 20], [116, 20]]) post(x, z, 3.4);
  tide([[82.2, 4, 82.2, 38], [82.2, 46, 82.2, 52], [121.8, 4, 121.8, 52], [82, 51.8, 122, 51.8], [82, 4.2, 93.6, 4.2], [110.4, 4.2, 122, 4.2]]);
  valveWheel(82.1, 26, PI / 2, 1.3);
  icePatch(92, 36, 1.0); icePatch(112, 34, 1.0); icePatch(100, 26, 0.9); icePatch(88, 12, 0.8);
  boards(110, 50, 0.05); rodStack(95, 50, 0);
}

// ----------------------------------------------------------------------------------------- THE MILL RACES
// the wheel pits and race tunnels under the tide mills, south to north: the Hatch Foot (the ladder down from the hatch, a
// landing of planks), the Log Way (a timber log race down the hall on iron rails, logs stacked parallel along the walls,
// two log sumps), the Saw Pit (three crank pits, stacks of sawn boards, sawdust) and the Wheel Race (the race channel along
// the north wall, square timber piers, three tail pits). The pits (D.pits) are square: a stone kerb round a silted floor,
// and sea water that rises in them on the flood and drains on the ebb with the races' own short tide (shared/dungeons.js
// dungeonTide, on the server's clock, the same water the bosses' strikes follow). Wet grey stone, tarred timber, salt-eaten
// iron, a pale salt line; everything square from above, timber laid one way only, never crossed.
function dressMills(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches }) {
  const ST = '#8a8c88', ST2 = '#6e706c', TB = '#4a3e32', TB2 = '#5e4c3a', IR = '#3e4246', SALT = '#dcd8ce', MUD = '#4e483e';
  const cool = (x, y, z, k = 0.5) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0x7ac8ff, k });
  const warm = (x, y, z, k = 1.0) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0xffc890, k });
  const wm = getMat('dWaterDeep');
  // a lamp post: a square tarred post shod in iron, a caged lamp on top
  const post = (x, z, h = 3.2) => {
    b.add(box(0.5, 0.3, 0.5), 'dWallDeep', { p: [x, 0.15, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(0.22, h, 0.22), 'dTimber', { p: [x, h / 2, z], c: '#5a4c40' });
    for (const y of [0.6, h - 0.5]) b.add(box(0.28, 0.1, 0.28), 'dIron', { p: [x, y, z], c: IR });
    lanternBuilder('yellow', 1.05, b, [x, h + 0.05, z]);
    addDyn(glowSprite(0xffc878, 2.2, 0.7), x, h - 0.35, z);
    warm(x, h - 0.3, z, 1.2);
    col(x, z, 0.3);
  };
  // a stack of logs laid parallel (along x when rot 0), squared ends, silt on top
  const logs = (x, z, rot, n = 3, L = 5) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * 0.72; b.add(rbox(L, 0.62, 0.62, 0.14), 'dTimber', { p: [x - s * o, 0.31, z + c * o], r: [0, rot, 0], c: k % 2 ? TB2 : '#544434' }); }
    if (n > 2) b.add(rbox(L * 0.9, 0.6, 0.62, 0.14), 'dTimber', { p: [x, 0.86, z], r: [0, rot, 0], c: TB });
    b.add(ico(0.3, 0), 'snowPack', { p: [x, n > 2 ? 1.2 : 0.66, z], s: [L * 0.3, 0.2, 0.8], r: [0, rot, 0], c: SALT });
    col(x, z, Math.max(1.2, Math.min(L / 2, 2.4)));
  };
  // a stack of sawn boards, parallel
  const boards = (x, z, rot) => { for (let k = 0; k < 5; k++) b.add(box(3.2, 0.14, 0.5), 'dTimber', { p: [x, 0.07 + k * 0.15, z], r: [0, rot + r(-0.04, 0.04), 0], c: k % 2 ? TB2 : '#6a5644' }); col(x, z, 1.4); };
  // sawdust and silt heaps (low, lopsided)
  const heap = (x, z, s = 1, c = '#b8a888') => { if (!isFloorL(x, z)) return; for (let q = 0; q < 4; q++) b.add(ico(r(0.4, 0.8) * s, 0), 'snowPack', { p: [x + r(-0.9, 0.9) * s, 0.0, z + r(-0.8, 0.8) * s], s: [1.6, 0.2, 1.3], r: [0, r(0, 3), 0], c }); };
  // wet floor where the races spilled
  const wet = (x, z, w, d) => b.add(box(w, 0.02, d), 'dWaterDeep', { p: [x, 0.03, z], uv: 'box', us: 0.35 });
  // the pits: a stone kerb round a silted floor, with water rising and falling in them on the races' tide
  const waters = [];
  for (const [px, pz, pr] of D.pits || []) {
    const s = pr * 0.8;
    for (const [qx, qz, bw, bd] of [[px, pz - s, 2 * s + 0.5, 0.5], [px, pz + s, 2 * s + 0.5, 0.5], [px - s, pz, 0.5, 2 * s], [px + s, pz, 0.5, 2 * s]]) {
      b.add(box(bw, 0.55, bd), 'dWallDeep', { p: [qx, 0.27, qz], uv: 'box', us: 0.4, c: ST2 });
      b.add(box(bw + 0.02, 0.08, bd + 0.02), 'dIron', { p: [qx, 0.57, qz], c: IR });
    }
    b.add(box(2 * s - 0.4, 0.03, 2 * s - 0.4), 'dCap', { p: [px, 0.025, pz], c: MUD });
    for (let q = 0; q < 5; q++) b.add(ico(r(0.2, 0.4), 0), 'snowPack', { p: [px + r(-s + 0.6, s - 0.6), 0.03, pz + r(-s + 0.6, s - 0.6)], s: [1.6, 0.25, 1.2], c: '#6a6256' });
    const wtr = new THREE.Mesh(new THREE.BoxGeometry(2 * s - 0.45, 0.04, 2 * s - 0.45), wm);
    wtr.position.set(px, 0.05, pz); wtr.receiveShadow = true; group.add(wtr); waters.push(wtr);
    cool(px, 0.9, pz, 0.45);
  }
  { const fl = new THREE.Group(); fl.userData.update = (dt) => {
      if (wm.normalMap) { wm.normalMap.offset.x += dt * 0.02; wm.normalMap.offset.y += dt * 0.04; }
      const T = dungeonTide(D, tideNow());
      const y = 0.05 + 0.47 * (T ? T.k : 0);
      for (const w of waters) { w.position.y = y; w.visible = !T || T.k > 0.04; }
    }; group.add(fl); dyn.push(fl); }

  // ---- the Hatch Foot: the ladder down from the hatch against the south wall, a plank landing, two lamps
  { const x = 70, z = 136.6;
    for (const s of [-0.4, 0.4]) b.add(box(0.1, 5.0, 0.1), 'dTimber', { p: [x + s, 2.5, z], c: '#5a4c40' });
    for (let k = 0; k < 11; k++) b.add(box(0.8, 0.07, 0.07), 'dTimber', { p: [x, 0.3 + k * 0.44, z], c: '#6a5644' });
    for (let k = 0; k < 6; k++) b.add(box(3.4, 0.08, 0.5), 'dTimber', { p: [x, 0.04, z - 1.2 - k * 0.52], c: k % 2 ? TB2 : '#6a5644' });
  }
  post(63, 126, 3.0); post(77, 130, 3.0);
  logs(63.5, 133, PI / 2, 2, 4); wet(72, 118, 1.4, 6);

  // ---- the Log Way: a timber log race down the middle of the hall, two iron rails along it (no sleepers across), logs stacked along the walls, the two
  // log sumps (pits), lamp posts down the sides
  for (const z of [91.2, 92.8]) b.add(box(92, 0.1, 0.14), 'dIron', { p: [70, 0.06, z], c: '#5a5e62' });
  for (const s of [-1, 1]) b.add(box(92, 0.4, 0.3), 'dTimber', { p: [70, 0.2, 92 + s * 2.4], c: TB });
  wet(70, 92, 88, 4.4);
  logs(30, 109, 0, 3, 6); logs(60, 109.5, 0, 2, 5); logs(110, 109, 0, 3, 6); logs(30, 83, 0, 2, 5); logs(110, 83, 0, 3, 6);
  for (const [x, z] of [[26, 96], [62, 84], [78, 100], [114, 96], [82, 106], [94, 84]]) post(x, z, 3.2);
  heap(52, 86, 0.8, '#6a6256'); heap(84, 86, 0.8, '#6a6256');

  // ---- passage west
  post(32, 75, 2.8); wet(37, 72, 4, 6);

  // ---- the Saw Pit: three crank pits, square timber saw-frame footings, stacks of sawn boards along the walls, sawdust
  for (const [x, z] of [[34, 52], [58, 52]]) { b.add(box(3.0, 0.8, 1.2), 'dTimber', { p: [x, 0.4, z], c: TB }); b.add(box(3.1, 0.1, 1.3), 'dIron', { p: [x, 0.82, z], c: IR }); col(x, z, 1.4); }
  boards(16, 67, 0); boards(32, 67.5, 0); boards(76, 36.5, PI / 2); boards(13, 52, PI / 2);
  logs(60, 37, 0, 3, 6);
  for (const [x, z] of [[14, 40], [34, 66], [58, 66], [78, 56], [34, 37]]) post(x, z, 3.2);
  heap(40, 38, 1.0); heap(56, 44, 0.8); heap(30, 58, 0.8); heap(62, 58, 1.0); heap(18, 50, 0.8);

  // ---- passage east
  post(84, 41, 2.8); wet(85, 44, 6, 3);

  // ---- the Wheel Race: the race channel along the north wall where the Great Undershot stands (a wet square channel with
  // timber kerbs), square stone piers, three tail pits, lamp posts, logs and boards
  b.add(box(44, 0.03, 9), 'dWaterDeep', { p: [110, 0.04, 12], uv: 'box', us: 0.35 });
  for (const z of [7.2, 24.6]) b.add(box(44, 0.5, 0.36), 'dTimber', { p: [110, 0.25, z], c: TB });
  for (const [x, z] of [[89, 8], [131, 8], [89, 26], [131, 26]]) {
    b.add(box(1.7, 0.45, 1.7), 'dWallDeep', { p: [x, 0.22, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(1.25, 4.8, 1.25), 'dWallDeep', { p: [x, 2.6, z], uv: 'box', us: 0.4, c: ST });
    for (const y of [1.15, 4.4]) b.add(box(1.36, 0.14, 1.36), 'snowPack', { p: [x, y, z], c: y < 2 ? SALT : '#3e4246' });
    col(x, z, 0.95);
  }
  addDyn(smoke({ rate: 3, life: 2.2, size: 1.4, rise: 1.0, color: 0xdce8ee, opacity: 0.3 }), 104, 0.4, 6); addDyn(smoke({ rate: 2, life: 2.0, size: 1.1, rise: 0.9, color: 0xdce8ee, opacity: 0.28 }), 119, 0.4, 7.5);
  addDyn(glowSprite(0x7ac8ff, 7, 0.35), 110, 0.6, 12); cool(110, 1.4, 14, 1.0);
  for (const [x, z] of [[90, 40], [130, 40], [104, 52], [118, 52], [90, 18], [130, 18]]) post(x, z, 3.4);
  logs(97, 51.5, 0, 2, 5); boards(125, 51, 0); heap(112, 34, 0.8, '#6a6256');
}


// ----------------------------------------------------------------------------------------- THE SEA GATE (raid 'barrage')
// The galleries inside the Makers' barrage across the mouth of Tidewater Sound: five halls of wet grey dressed stone, south
// to north. The Gatehouse Stair (stone steps down from the gatehouse door, a landing), the Winch Gallery (square winch
// housings along the side walls, straight chains down into the chain wells), the Silt Culvert (a wet culvert channel down
// the hall between timber kerbs, square dark culvert mouths in the east wall, silt heaps), the Sluice Gallery (the Sluice
// Carriage's two iron rails the length of the hall, no sleepers across, square sluice wells) and the Engine Hall (the gate
// guides: square iron uprights up the north wall behind the Tide Engine, a wet tide channel along it, square stone piers).
// The wells (D.pits) are square: a stone kerb round a silted floor, sea water rising in them on the flood and draining on
// the ebb with the barrage's own short tide (shared/dungeons.js dungeonTide, on the server's clock). Everything square from
// above, every rail, chain and timber one way, never crossed; lamps on square posts, never in pairs on a face.
function dressSeaGate(D, b, { r, rng, isFloorL, addDyn, col, placeRes, group, dyn, torches }) {
  const ST = '#8a8e8a', ST2 = '#6a6e6a', TB = '#4a3e32', IR = '#3e4246', SALT = '#dcd8ce', MUD = '#4e483e';
  const cool = (x, y, z, k = 0.5) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0x7ac8ff, k });
  const warm = (x, y, z, k = 1.0) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0xffc890, k });
  const wm = getMat('dWaterDeep');
  const post = (x, z, h = 3.4) => {
    b.add(box(0.55, 0.3, 0.55), 'dWallDeep', { p: [x, 0.15, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(0.26, h, 0.26), 'dIron', { p: [x, h / 2, z], c: '#4a4e52' });
    for (const y of [0.6, h - 0.5]) b.add(box(0.32, 0.1, 0.32), 'dBrass', { p: [x, y, z], c: '#6a5a3a' });
    lanternBuilder('yellow', 1.05, b, [x, h + 0.05, z]);
    addDyn(glowSprite(0xffc878, 2.2, 0.7), x, h - 0.35, z);
    warm(x, h - 0.3, z, 1.2);
    col(x, z, 0.3);
  };
  const heap = (x, z, s = 1, c = '#6a6256') => { if (!isFloorL(x, z)) return; for (let q = 0; q < 4; q++) b.add(ico(r(0.4, 0.8) * s, 0), 'snowPack', { p: [x + r(-0.9, 0.9) * s, 0.0, z + r(-0.8, 0.8) * s], s: [1.6, 0.2, 1.3], r: [0, r(0, 3), 0], c }); };
  const wet = (x, z, w, d) => b.add(box(w, 0.02, d), 'dWaterDeep', { p: [x, 0.03, z], uv: 'box', us: 0.35 });
  // a square winch housing against a wall (rot 0: its back to the north), a solid drum along x, a straight chain down the front
  const winch = (x, z, rot) => {
    const c = Math.cos(rot), sn = Math.sin(rot), P = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
    let [px, pz] = P(0, 0); b.add(box(3.0, 2.6, 1.6), 'dWallDeep', { p: [px, 1.3, pz], r: [0, rot, 0], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(3.2, 0.2, 1.8), 'dIron', { p: [px, 2.7, pz], r: [0, rot, 0], c: IR });
    [px, pz] = P(0, 0.4); b.add(cyl(0.55, 0.55, 2.2, 16), 'dIron', { p: [px, 3.3, pz], r: [0, rot, PI / 2], order: 'YXZ', c: '#4a4e52' });
    [px, pz] = P(0, 1.0); for (let i = 0; i < 8; i++) b.add(box(0.14, 0.26, i % 2 ? 0.05 : 0.14), 'dIron', { p: [px, 3.0 - i * 0.34, pz], r: [0, rot, 0], c: '#5a5e62' });
    col(x, z, 1.6);
  };
  // the wells: a stone kerb round a silted floor, water rising and falling in them on the barrage's tide
  const waters = [];
  for (const [px, pz, pr] of D.pits || []) {
    const s = pr * 0.8;
    for (const [qx, qz, bw, bd] of [[px, pz - s, 2 * s + 0.5, 0.5], [px, pz + s, 2 * s + 0.5, 0.5], [px - s, pz, 0.5, 2 * s], [px + s, pz, 0.5, 2 * s]]) {
      b.add(box(bw, 0.55, bd), 'dWallDeep', { p: [qx, 0.27, qz], uv: 'box', us: 0.4, c: ST2 });
      b.add(box(bw + 0.02, 0.08, bd + 0.02), 'dIron', { p: [qx, 0.57, qz], c: IR });
    }
    b.add(box(2 * s - 0.4, 0.03, 2 * s - 0.4), 'dCap', { p: [px, 0.025, pz], c: MUD });
    for (let q = 0; q < 5; q++) b.add(ico(r(0.2, 0.4), 0), 'snowPack', { p: [px + r(-s + 0.6, s - 0.6), 0.03, pz + r(-s + 0.6, s - 0.6)], s: [1.6, 0.25, 1.2], c: '#6a6256' });
    const wtr = new THREE.Mesh(new THREE.BoxGeometry(2 * s - 0.45, 0.04, 2 * s - 0.45), wm);
    wtr.position.set(px, 0.05, pz); wtr.receiveShadow = true; group.add(wtr); waters.push(wtr);
    cool(px, 0.9, pz, 0.45);
  }
  { const fl = new THREE.Group(); fl.userData.update = (dt) => {
      if (wm.normalMap) { wm.normalMap.offset.x += dt * 0.02; wm.normalMap.offset.y += dt * 0.04; }
      const T = dungeonTide(D, tideNow());
      const y = 0.05 + 0.47 * (T ? T.k : 0);
      for (const w of waters) { w.position.y = y; w.visible = !T || T.k > 0.04; }
    }; group.add(fl); dyn.push(fl); }

  // ---- the Gatehouse Stair: stone steps down from the door at the south wall to a landing, two lamps
  for (let k = 0; k < 4; k++) b.add(box(5.0, 0.2 + k * 0.2, 0.6), 'dWallDeep', { p: [76, (0.2 + k * 0.2) / 2, 214.3 + k * 0.6], uv: 'box', us: 0.4, c: k % 2 ? ST : ST2 });
  post(66, 207, 3.2); post(86, 207, 3.2);
  wet(76, 199, 1.6, 10);

  // ---- the Winch Gallery: winch housings on the north and south walls, chain wells, lamp posts, silt
  winch(40, 162.2, 0); winch(110, 162.2, 0); winch(58, 191.8, PI); winch(94, 191.8, PI);
  for (const [x, z] of [[28, 176], [122, 176], [62, 168], [88, 168], [62, 184], [88, 184]]) post(x, z, 3.6);
  heap(30, 190, 0.9); heap(120, 165, 0.8); wet(75, 180, 40, 3);

  // ---- passage east
  post(106, 155, 3.0); wet(111, 152, 4, 8);

  // ---- the Silt Culvert: the culvert channel down the hall between timber kerbs, culvert mouths in the east wall
  wet(110, 127, 6, 40);
  for (const sx of [-1, 1]) b.add(box(0.36, 0.5, 40), 'dTimber', { p: [110 + sx * 3.3, 0.25, 127], c: TB });
  for (const z of [118, 136]) { b.add(box(0.3, 2.4, 2.8), 'dCap', { p: [139.8, 1.2, z], c: '#060606' }); b.add(box(0.4, 0.36, 3.6), 'dWallDeep', { p: [139.6, 2.6, z], uv: 'box', us: 0.4, c: ST }); }
  for (const [x, z] of [[82, 146], [138, 146], [82, 110], [138, 110], [100, 136], [120, 118]]) post(x, z, 3.4);
  heap(96, 128, 1.1); heap(124, 130, 1.0); heap(110, 147, 0.8); heap(84, 118, 0.8);

  // ---- passage west
  post(87, 100, 3.0); wet(91, 98, 4, 8);

  // ---- the Sluice Gallery: the carriage's two iron rails the length of the hall (no sleepers across), sluice wells
  for (const z of [72.6, 75.4]) b.add(box(86, 0.12, 0.16), 'dIron', { p: [60, 0.07, z], c: '#5a5e62' });
  for (const z of [71.2, 76.8]) b.add(box(86, 0.04, 0.5), 'dWallDeep', { p: [60, 0.03, z], uv: 'box', us: 0.4, c: ST2 });
  for (const x of [17.6, 102.4]) { b.add(box(1.2, 0.8, 4.0), 'dWallDeep', { p: [x, 0.4, 74], uv: 'box', us: 0.4, c: ST }); col(x, 74, 1.2); } // the rail stops
  for (const [x, z] of [[16, 92], [104, 58], [50, 92], [50, 58], [98, 90], [16, 58]]) post(x, z, 3.4);
  heap(38, 90, 0.8); heap(62, 60, 0.8); wet(50, 66, 30, 2);

  // ---- passage east
  post(89, 50, 3.0); wet(93, 46, 4, 8);

  // ---- the Engine Hall: the gate guides up the north wall behind the Tide Engine (square iron uprights, all upright, a
  // flat lintel beam over them), the tide channel along the wall, square stone piers, lamp posts
  b.add(box(70, 0.03, 6), 'dWaterDeep', { p: [75, 0.04, 5.5], uv: 'box', us: 0.35 });
  for (const z of [8.6]) b.add(box(70, 0.5, 0.36), 'dTimber', { p: [75, 0.25, z], c: TB });
  for (const x of [60, 68, 82, 90]) b.add(box(0.8, 5.6, 0.6), 'dIron', { p: [x, 2.8, 2.5], c: '#4a4e52' });
  b.add(box(34, 0.7, 0.8), 'dWallDeep', { p: [75, 5.9, 2.5], uv: 'box', us: 0.4, c: ST });
  for (const [x, z] of [[30, 14], [120, 14], [30, 40], [120, 40]]) {
    b.add(box(1.8, 0.45, 1.8), 'dWallDeep', { p: [x, 0.22, z], uv: 'box', us: 0.4, c: ST2 });
    b.add(box(1.3, 5.6, 1.3), 'dWallDeep', { p: [x, 3.0, z], uv: 'box', us: 0.4, c: ST });
    for (const y of [1.35, 5.2]) b.add(box(1.42, 0.14, 1.42), 'snowPack', { p: [x, y, z], c: y < 2 ? SALT : IR });
    col(x, z, 1.0);
  }
  addDyn(smoke({ rate: 3, life: 2.2, size: 1.4, rise: 1.0, color: 0xdce8ee, opacity: 0.3 }), 62, 0.4, 5); addDyn(smoke({ rate: 2, life: 2.0, size: 1.1, rise: 0.9, color: 0xdce8ee, opacity: 0.28 }), 90, 0.4, 6);
  addDyn(glowSprite(0x7ac8ff, 8, 0.35), 75, 0.6, 6); cool(75, 1.4, 8, 1.0);
  for (const [x, z] of [[16, 26], [134, 26], [52, 40], [100, 40], [52, 20], [100, 20]]) post(x, z, 3.6);
  heap(40, 12, 0.9); heap(112, 12, 0.9); heap(22, 40, 0.8);
}

// ----------------------------------------------------------------------------------------- THE MAKERS' REST (workshop)
// The Makers' last workshop: lit, tidy, labelled, still half at work. Nothing here is a tomb: no graves, no remains. Plain
// square shapes only: racks are solid end panels with boards or shelves between them, braces never cross, belts hang straight.
function dressWorkshop(D, b, { r, rng, isFloorL, addDyn, col, torches }) {
  const IR = '#3e4246', BR = '#c8a060', PALE = '#e8d4a8', SHOP = '#7e8a7e';
  const warm = (x, y, z, k = 1.0) => torches.push({ x: D.ox + x, y, z: D.oz + z, color: 0xffd8a0, k });
  // a brass label: a small plain plate (no marks), facing along rot
  const label = (x, y, z, rot = 0, s = 1) => b.add(box(0.36 * s, 0.24 * s, 0.03), 'dBrass', { p: [x, y, z], r: [0, rot, 0], c: BR });
  const P = (x, z, rot, u, v) => [x + Math.cos(rot) * u + Math.sin(rot) * v, z - Math.sin(rot) * u + Math.cos(rot) * v]; // local (u along, v out) -> world
  // a square lantern: iron cap and foot, four brass corner bars, a lit square glass between
  const sqLamp = (x, y, z, k = 1.0) => {
    b.add(box(0.44, 0.08, 0.44), 'dIron', { p: [x, y + 0.32, z], c: IR });
    b.add(box(0.38, 0.06, 0.38), 'dIron', { p: [x, y - 0.32, z], c: IR });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.05, 0.6, 0.05), 'dBrass', { p: [x + sx * 0.17, y, z + sz * 0.17], c: BR });
    b.add(box(0.28, 0.5, 0.28), 'glowYellow', { p: [x, y, z], c: 0xffffff });
    addDyn(glowSprite(0xffd090, 2.0, 0.7), x, y, z); warm(x, y, z, k);
  };
  // a lamp post: a square timber post shod in iron with a square lantern on a short arm
  const post = (x, z, h = 3.4) => {
    b.add(box(0.5, 0.25, 0.5), 'dIron', { p: [x, 0.12, z], c: IR });
    b.add(box(0.22, h, 0.22), 'dTimber', { p: [x, h / 2, z], c: '#d8b088' });
    b.add(box(0.7, 0.1, 0.1), 'dIron', { p: [x + 0.3, h - 0.1, z], c: IR });
    sqLamp(x + 0.6, h - 0.55, z, 1.1);
    col(x, z, 0.3);
  };
  // a workbench along rot: a thick boarded top on four square legs, a shelf under it, a vice block at one end, a few tools
  // laid parallel on it, a brass label on its front edge
  const bench = (x, z, rot = 0, L = 3.0) => {
    b.add(box(L, 0.16, 1.0), 'woodLight', { p: [x, 0.92, z], r: [0, rot, 0], uv: 'box', c: '#e0c8a0' });
    b.add(box(L - 0.2, 0.08, 0.8), 'woodLight', { p: [x, 0.3, z], r: [0, rot, 0], uv: 'box', c: '#c8a880' });
    for (const u of [-L / 2 + 0.15, L / 2 - 0.15]) for (const v of [-0.38, 0.38]) { const [px, pz] = P(x, z, rot, u, v); b.add(box(0.14, 0.84, 0.14), 'dTimber', { p: [px, 0.42, pz], c: '#c8a07a' }); }
    { const [px, pz] = P(x, z, rot, L / 2 - 0.35, 0.3); b.add(box(0.3, 0.26, 0.36), 'dIron', { p: [px, 1.13, pz], r: [0, rot, 0], c: IR }); }
    for (let i = 0; i < 3; i++) { const [px, pz] = P(x, z, rot, -L / 2 + 0.5 + i * 0.35, -0.1 + (i % 2) * 0.12); b.add(box(0.06, 0.04, 0.5), i === 1 ? 'dIron' : 'woodLight', { p: [px, 1.02, pz], r: [0, rot, 0], c: i === 1 ? '#6a6e74' : '#8a6040' }); }
    { const [px, pz] = P(x, z, rot, -L * 0.2, 0.51); label(px, 0.9, pz, rot); }
    col(x, z, Math.max(0.8, L * 0.45));
  };
  // a tool rack against a wall (rot turns its face into the room): a backboard, tools hung upright side by side (never
  // crossed), a plain brass label under each
  const toolRack = (x, z, rot, L = 2.8) => {
    b.add(box(L, 1.6, 0.08), 'woodLight', { p: [x, 1.9, z], r: [0, rot, 0], uv: 'box', c: '#d8bc94' });
    b.add(box(L + 0.1, 0.1, 0.12), 'dTimber', { p: [x, 2.75, z], r: [0, rot, 0], c: '#a07a58' });
    const n = Math.floor(L / 0.4);
    for (let i = 0; i < n; i++) {
      const u = -L / 2 + 0.3 + i * ((L - 0.6) / (n - 1)), kind = (i * 5 + Math.floor(z)) % 4, [px, pz] = P(x, z, rot, u, 0.08);
      if (kind === 0) { b.add(box(0.05, 0.8, 0.04), 'woodLight', { p: [px, 1.85, pz], r: [0, rot, 0], c: '#8a6040' }); b.add(box(0.1, 0.22, 0.08), 'dIron', { p: [px, 2.3, pz], r: [0, rot, 0], c: '#55585e' }); } // a mallet, its head in line with the handle
      else if (kind === 1) b.add(box(0.2, 0.9, 0.02), 'dIron', { p: [px, 1.85, pz], r: [0, rot, 0], c: '#9aa0a6' }); // a saw blade
      else if (kind === 2) { b.add(box(0.04, 0.6, 0.04), 'dIron', { p: [px, 1.8, pz], r: [0, rot, 0], c: '#7a7e84' }); b.add(box(0.07, 0.24, 0.06), 'woodLight', { p: [px, 2.2, pz], r: [0, rot, 0], c: '#8a6040' }); } // a chisel
      else b.add(box(0.06, 0.7, 0.03), 'dBrass', { p: [px, 1.9, pz], r: [0, rot, 0], c: '#b08a50' }); // a brass rule
      label(px, 1.3, pz, rot, 0.6);
    }
    col(...P(x, z, rot, 0, 0.1), 0.3);
  };
  // a labelled crate: slats on each face between corner battens (no brace across a face)
  const crate = (x, z, s = 1, rot = 0) => {
    const w = 1.1 * s, h = 0.9 * s;
    b.add(box(w, h, w), 'woodLight', { p: [x, h / 2, z], r: [0, rot, 0], uv: 'box', c: '#c8a07a' });
    for (const y of [h * 0.25, h * 0.75]) b.add(box(w + 0.04, 0.1, w + 0.04), 'woodLight', { p: [x, y, z], r: [0, rot, 0], c: '#a07a58' });
    const [px, pz] = P(x, z, rot, -w * 0.2, w / 2 + 0.02); label(px, h * 0.5, pz, rot, s);
    col(x, z, w * 0.7);
  };
  // pale shavings drifted on the boards
  const drift = (x, z, s = 1) => { if (!isFloorL(x, z)) return; for (let q = 0; q < 7; q++) b.add(ico(r(0.25, 0.5) * s, 0), 'woodLight', { p: [x + r(-1.2, 1.2) * s, 0.02, z + r(-0.9, 0.9) * s], s: [1.7, 0.22, 1.3], r: [0, r(0, 3), 0], c: q % 2 ? PALE : '#dcc494' }); };
  // a square trestle pair carrying a part to be fitted (a casting, or a plain hub drum lying on its side)
  const trestles = (x, z, rot, kind = 0) => {
    for (const u of [-1.1, 1.1]) { const [px, pz] = P(x, z, rot, u, 0); b.add(box(0.2, 0.9, 1.2), 'dTimber', { p: [px, 0.45, pz], r: [0, rot, 0], c: '#c8a07a' }); b.add(box(0.3, 0.12, 1.3), 'woodLight', { p: [px, 0.96, pz], r: [0, rot, 0], c: '#b08a64' }); }
    if (kind === 0) b.add(box(2.8, 0.7, 1.0), 'dIron', { p: [x, 1.38, z], r: [0, rot, 0], c: '#4a4e54' });
    else b.add(cyl(0.65, 0.65, 2.6, 20), 'dBrass', { p: [x, 1.66, z], r: [0, rot, PI / 2], c: '#8a6c42' });
    const [px, pz] = P(x, z, rot, 0.6, 0.52); label(px, 1.4, pz, rot);
    col(x, z, 1.6);
  };
  // a crane rail along a wall on square corbels: wall at `line`, side +1/-1 toward the room
  const craneRail = (alongX, line, a0, a1, side, y = 4.4) => {
    const L = a1 - a0, mid = (a0 + a1) / 2, off = line + side * 0.55;
    b.add(box(alongX ? L : 0.5, 0.5, alongX ? 0.5 : L), 'dIron', { p: alongX ? [mid, y, off] : [off, y, mid], c: '#4a5250' });
    b.add(box(alongX ? L : 0.14, 0.12, alongX ? 0.14 : L), 'dIron', { p: alongX ? [mid, y + 0.31, off] : [off, y + 0.31, mid], c: '#8a8e94' });
    for (let u = a0 + 1; u < a1; u += 4) { const ox = alongX ? u : line + side * 0.4, oz = alongX ? line + side * 0.4 : u; if (!isFloorL(ox, oz)) continue; b.add(box(alongX ? 0.5 : 0.8, 0.6, alongX ? 0.8 : 0.5), 'dTimber', { p: alongX ? [u, y - 0.55, line + side * 0.4] : [line + side * 0.4, y - 0.55, u], c: '#a07a58' }); }
  };
  // a rack of finished sail-boards: two solid end panels, straight pale boards lying on pegs between them at four heights
  const boardRack = (x, z, rot, L = 4.4) => {
    for (const u of [-L / 2, L / 2]) { const [px, pz] = P(x, z, rot, u, 0); b.add(box(0.16, 2.4, 1.2), 'dTimber', { p: [px, 1.2, pz], r: [0, rot, 0], c: '#c8a07a' }); }
    for (let k = 0; k < 4; k++) for (let q = 0; q < 2; q++) { const [px, pz] = P(x, z, rot, 0, -0.25 + q * 0.5); b.add(box(L - 0.18, 0.08, 0.42), 'woodLight', { p: [px, 0.35 + k * 0.6 + q * 0.09, pz], r: [0, rot, 0], c: (k + q) % 2 ? PALE : '#dcc494' }); }
    { const [px, pz] = P(x, z, rot, -L / 2 + 0.5, 0.62); label(px, 1.0, pz, rot); }
    col(x, z, Math.max(0.9, L * 0.45));
  };
  // line shafting along a wall: wall brackets (an arm out of the wall and a hanger down to the bearing) carrying the shaft,
  // a wide drum pulley over each small lathe and a flat belt hanging straight down to its headstock
  const shafting = (line, x0, x1, side, lathes, y = 4.4) => {
    const off = line + side * 1.4;
    b.add(cyl(0.1, 0.1, x1 - x0, 8), 'dIron', { p: [(x0 + x1) / 2, y, off], r: [0, 0, PI / 2], c: '#7a7e84' });
    for (let x = x0 + 1; x < x1; x += 6) { if (!isFloorL(x, line + side * 0.4)) continue; b.add(box(0.24, 0.24, 1.5), 'dTimber', { p: [x, y + 0.7, line + side * 0.75], c: '#a07a58' }); b.add(box(0.16, 0.6, 0.16), 'dIron', { p: [x, y + 0.3, off], c: IR }); b.add(box(0.34, 0.3, 0.34), 'dIron', { p: [x, y, off], c: IR }); }
    for (const lx of lathes) {
      b.add(cyl(0.38, 0.38, 0.5, 18), 'dIron', { p: [lx - 0.8, y, off], r: [0, 0, PI / 2], c: '#4a4c50' });
      for (const dz of [-0.36, 0.36]) b.add(box(0.36, y - 1.7, 0.04), 'leather', { p: [lx - 0.8, (y + 1.7) / 2, off + dz], c: '#5a3a22' });
      // the small lathe: a cabinet, a bed, a square headstock under the belt, a tailstock
      b.add(box(2.6, 0.9, 0.8), 'wPaint', { p: [lx, 0.45, off], c: SHOP });
      b.add(box(2.8, 0.2, 0.5), 'dIron', { p: [lx, 1.0, off], c: '#4a4e54' });
      b.add(box(0.6, 0.6, 0.7), 'wPaint', { p: [lx - 0.8, 1.4, off], c: SHOP });
      b.add(box(0.4, 0.45, 0.5), 'wPaint', { p: [lx + 1.0, 1.32, off], c: SHOP });
      b.add(cyl(0.06, 0.06, 1.4, 8), 'dIron', { p: [lx + 0.1, 1.4, off], r: [0, 0, PI / 2], c: '#9aa0a6' });
      label(lx - 0.2, 0.55, off - side * 0.41, side > 0 ? PI : 0);
      col(lx, off, 1.4);
    }
  };
  // a swarf bin: a square iron bin with curls of turned iron heaped in it
  const swarfBin = (x, z) => {
    b.add(box(1.2, 0.7, 1.2), 'dIron', { p: [x, 0.35, z], c: '#4a4e54' });
    for (let q = 0; q < 10; q++) b.add(ico(r(0.06, 0.1), 0), 'dIron', { p: [x + r(-0.45, 0.45), 0.73, z + r(-0.45, 0.45)], s: [r(1.2, 1.8), 0.4, r(0.8, 1.2)], r: [0, r(0, 3), 0], c: q % 2 ? '#9a6a3a' : '#7a7e84' }); // (flattened chips: part-ring curls read as crescents)
    label(x - 0.2, 0.4, z + 0.61);
    col(x, z, 0.8);
  };
  // coat pegs on a wall with leather aprons hung flat (no figures)
  const pegs = (x, z, rot, n = 4) => {
    b.add(box(n * 0.7, 0.14, 0.08), 'dTimber', { p: [x, 2.1, z], r: [0, rot, 0], c: '#a07a58' });
    for (let i = 0; i < n; i++) { const [px, pz] = P(x, z, rot, -n * 0.35 + 0.35 + i * 0.7, 0.08); b.add(box(0.06, 0.06, 0.14), 'dBrass', { p: [px, 2.05, pz], r: [0, rot, 0], c: BR }); if (i % 3 !== 2) b.add(box(0.5, 0.9, 0.03), 'leather', { p: [px, 1.55, pz], r: [0, rot, 0], c: i % 2 ? '#6a4a2e' : '#5a3e26' }); }
  };
  // shelves of ledgers: two solid end panels, four plain shelves, closed books standing on them
  const shelves = (x, z, rot, L = 3.0) => {
    for (const u of [-L / 2, L / 2]) { const [px, pz] = P(x, z, rot, u, 0); b.add(box(0.1, 2.4, 0.5), 'woodLight', { p: [px, 1.2, pz], r: [0, rot, 0], c: '#c8a07a' }); }
    for (let k = 0; k < 4; k++) {
      b.add(box(L, 0.06, 0.5), 'woodLight', { p: [x, 0.3 + k * 0.6, z], r: [0, rot, 0], c: '#b08a64' });
      let u = -L / 2 + 0.15;
      while (u < L / 2 - 0.25) { const w = r(0.06, 0.12), [px, pz] = P(x, z, rot, u, 0); b.add(box(w, r(0.32, 0.42), 0.34), 'leather', { p: [px, 0.52 + k * 0.6, pz], r: [0, rot, 0], c: ['#6a3a22', '#4e5a42', '#5a4632', '#3e4a5a'][Math.floor(rng() * 4)] }); u += w + 0.02; }
    }
    col(x, z, L * 0.5);
  };

  // ---- the Tool Store: tool racks on both side walls, benches, coat pegs by the way out, labelled crates, the ramp down
  // with a timber handrail each side (one rail on square posts, nothing crossing)
  for (const z of [207.5, 213.5]) { toolRack(64.2, z, PI / 2); toolRack(87.8, z, -PI / 2); }
  bench(67.5, 210.5, PI / 2, 2.6); bench(84.5, 210.5, -PI / 2, 2.6);
  pegs(69, 217.8, PI, 4); pegs(83, 217.8, PI, 3);
  crate(66, 216, 1.0, 0.1); crate(86, 205.5, 0.9, -0.08); crate(65.8, 205.2, 0.8, 0.05);
  for (const x of [72.4, 79.6]) {
    for (let z = 193; z <= 205; z += 2) { b.add(box(0.14, 1.0, 0.14), 'dTimber', { p: [x, 0.5, z], c: '#c8a07a' }); col(x, z, 0.15); }
    b.add(box(0.12, 0.1, 12.2), 'dTimber', { p: [x, 1.02, 199], c: '#c8a07a' });
  }
  for (let z = 193.5; z < 205; z += 1.2) b.add(box(7.0, 0.04, 0.12), 'woodLight', { p: [76, 0.02, z], c: '#b08a64' }); // battens across the ramp boards for footing
  post(70, 215, 3.2); post(82, 202, 3.2);

  // ---- the Fitting Shop: crane rails along both long walls on corbels, parts on trestles, benches along the south wall,
  // crates in the corners, lamp posts
  craneRail(true, 160, 30.5, 119.5, 1); craneRail(true, 194, 30.5, 119.5, -1);
  trestles(36, 172, 0.05, 0); trestles(114, 176, -0.04, 1); trestles(58, 164, 0, 1); trestles(92, 166, 0.03, 0);
  bench(56, 192.2, 0, 3.2); bench(95, 192.2, 0, 3.2); bench(32, 186, PI / 2, 2.8);
  crate(33, 191, 1.1, 0.06); crate(117, 191, 1.0, -0.1); crate(33, 163, 0.9, 0.2); crate(118, 163, 1.0, 0.04); crate(116.6, 164.8, 0.7, 0.4);
  for (const [x, z] of [[40, 178], [110, 186], [64, 182], [88, 186]]) post(x, z, 3.4);
  drift(50, 176, 0.7); drift(100, 178, 0.6);

  // ---- passage east
  crate(112.5, 151, 0.8, 0.1); post(101.5, 156, 3.0);

  // ---- the Board Loft: racks of finished sail-boards along the walls, shavings drifts, a bench with glue tins, lamp posts
  for (const x of [108, 120, 132]) boardRack(x, 107.4, 0);
  for (const x of [86, 124, 134]) boardRack(x, 148.6, PI);
  boardRack(138.6, 128, -PI / 2); boardRack(81.4, 120, PI / 2);
  bench(84.5, 138, PI / 2, 2.8);
  for (const [x, z] of [[84.4, 137], [84.6, 138.7]]) b.add(box(0.3, 0.26, 0.3), 'dIron', { p: [x, 1.13, z], c: '#5a5450' }); // glue tins
  for (const [x, z, s] of [[104, 118, 1.0], [124, 136, 1.1], [90, 128, 0.8], [128, 124, 0.9], [112, 140, 0.8], [96, 112, 0.7]]) drift(x, z, s);
  for (const [x, z] of [[94, 122], [126, 116], [118, 138]]) post(x, z, 3.4);

  // ---- passage west
  post(88, 100, 3.0); drift(95, 96, 0.5);

  // ---- the Turning Shop: line shafting along both long walls with belts down to small lathes, swarf bins, lamp posts
  shafting(94, 15, 103, -1, [36, 50, 66]);
  shafting(56, 15, 83, 1, [40, 56]);
  swarfBin(20, 74); swarfBin(100, 72); swarfBin(74, 90.5); swarfBin(30, 58.5);
  bench(100.5, 82, -PI / 2, 2.8); crate(17, 91, 0.9, 0.1);
  for (const [x, z] of [[38, 75], [70, 76], [90, 66]]) post(x, z, 3.4);

  // ---- passage east
  post(95.5, 50, 3.0);

  // ---- the Governor Room: the rods' floor channels running away along the north wall to west and east (four a side), the
  // clerk's desk with the day book, shelves of ledgers, crates, lamp posts all round (it is a working room, lit)
  for (const [x0, x1] of [[13, 64], [86, 137]]) for (let q = 0; q < 4; q++) {
    const z = 3.4 + q * 0.75, L = x1 - x0;
    b.add(box(L, 0.03, 0.34), 'dCap', { p: [(x0 + x1) / 2, 0.015, z], c: '#0a0a0a' });
    for (const s of [-1, 1]) b.add(box(L, 0.05, 0.08), 'dIron', { p: [(x0 + x1) / 2, 0.025, z + s * 0.21], c: '#4a4e54' });
  }
  // the clerk's desk: a plain table, a stool, the day book closed on it, a square lamp at its corner
  b.add(box(2.2, 0.12, 1.1), 'woodLight', { p: [20, 0.86, 39.5], uv: 'box', c: '#d8bc94' });
  for (const [dx, dz] of [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]]) b.add(box(0.1, 0.8, 0.1), 'dTimber', { p: [20 + dx, 0.4, 39.5 + dz], c: '#c8a07a' });
  b.add(box(0.5, 0.5, 0.5), 'woodLight', { p: [20, 0.25, 40.6], c: '#b08a64' });
  b.add(box(0.5, 0.1, 0.38), 'leather', { p: [19.9, 0.97, 39.4], r: [0, 0.12, 0], c: '#5a3a22' });
  col(20, 39.5, 1.2);
  sqLamp(20.9, 1.25, 39.2, 0.8);
  shelves(12.4, 36, PI / 2, 3.2); shelves(12.4, 40, PI / 2, 3.2);
  crate(16, 20, 1.0, 0.05); crate(134, 40, 1.1, -0.1); crate(135, 20, 0.9, 0.2); crate(16.2, 21.8, 0.7, -0.3);
  for (const [x, z] of [[44, 22], [106, 22], [56, 36], [94, 36], [20, 30], [130, 30]]) post(x, z, 3.6);
}

// ======================================================================================== OVERWORLD ENTRANCES
// local, front (the way in) faces +z
export function dungeonEntrance(D) {
  const b = new Builder(D.ox + 3);
  const res = { builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [] };
  const dark = (w, h, d, y, z) => b.add(box(w, h, d), 'dCap', { p: [0, y, z], c: '#050505' });
  // a door that belongs to a building already standing there: only the open doorway (the council hall's front door)
  // the Makers' Rest: the workshop's own plank door (heightsLayout stoneBlock, 2.4 x 2.3 from the ground, its face 0.27 m
  // behind the door point) shows as an open dark doorway, kept behind the iron bar and under the painted board
  if (D.theme === 'workshop') { dark(2.3, 2.22, 0.012, 1.11, -0.255); return res; }
  // the Sea Gate: the north gatehouse's own plank door (tidewaterLayout stoneBlock, 2.2 x 2.3 from the ground, its face
  // 0.27 m behind the door point) shows as an open dark doorway
  if (D.theme === 'seagate') { dark(2.1, 2.2, 0.012, 1.1, -0.22); return res; }
  if (D.door.bare) { dark(1.75, 2.95, 0.12, 0.9 + 1.48, 0.06); return res; }
  if (D.theme === 'warren') {
    // a bolt-hole dug into a grassy bank: timber frame, a plank door hanging open, crates of stolen goods
    for (const [x, z, sx, sy, sz] of [[0, -2.0, 5.2, 2.4, 3.6], [-3.6, -0.8, 2.4, 1.6, 2.4], [3.8, -1.0, 2.6, 1.7, 2.4]]) b.add(sphere(1, 16, 10), 'dirtPlain', { p: [x, -0.3, z], s: [sx, sy, sz], uv: 'box', us: 0.3, c: '#7a8a4a' });
    dark(2.2, 2.2, 1.6, 1.0, -0.9);
    for (const sx of [-1, 1]) { b.add(box(0.26, 2.5, 0.26), 'beam', { p: [sx * 1.25, 1.1, 0.1], c: 0xffffff }); res.colliders.push({ x: sx * 1.25, z: 0.1, r: 0.3 }); }
    b.add(box(3.0, 0.3, 0.32), 'beam', { p: [0, 2.35, 0.1], c: 0xffffff });
    b.add(box(1.1, 2.0, 0.08), 'woodDark', { p: [1.7, 1.0, 0.9], r: [0, -1.1, 0], uv: 'box', c: '#a07850' });
    for (const [x, z] of [[-2.6, 1.2], [2.8, 1.6]]) b.add(rbox(0.6, 0.6, 0.6, 0.03), 'woodLight', { p: [x, 0.3, z], r: [0, x, 0], uv: 'box', c: 0xffffff });
    res.lanterns.push({ p: [-0.8, 2.15, 0.35], len: 0.3, color: 'yellow', scale: 0.9 });
    res.colliders.push({ x: -3.6, z: -0.8, r: 2.0 }, { x: 3.8, z: -1.0, r: 2.0 });
  } else if (D.theme === 'mine') {
    // an adit in a rock face: a heavy timber frame, rails running out, a lantern on the lintel
    for (const [x, y, z, sx, sy, sz] of [[-3.4, 1.6, -1.5, 1.9, 3.2, 1.4], [3.5, 1.6, -1.6, 2.0, 3.3, 1.5], [0, 4.0, -1.9, 3.4, 1.3, 1.6], [-2.0, 3.2, -2.4, 2.0, 2.4, 1.6], [2.3, 3.3, -2.5, 2.0, 2.4, 1.6], [-5.2, 0.9, -1.0, 1.6, 2.0, 1.3], [5.4, 1.0, -1.1, 1.7, 2.1, 1.3]]) addRock(b, [x, y, z], [sx, sy, sz], Math.round(x * 13 + z * 7 + 50), { moss: 0.05, tint: '#c8b49a' });
    dark(2.8, 2.8, 2.0, 1.4, -1.2);
    for (const sx of [-1, 1]) { b.add(box(0.34, 3.2, 0.34), 'beam', { p: [sx * 1.6, 1.6, 0], c: 0xffffff }); res.colliders.push({ x: sx * 1.6, z: 0, r: 0.35 }); }
    b.add(box(4.0, 0.4, 0.45), 'beam', { p: [0, 3.2, 0], c: 0xffffff });
    b.add(box(0.16, 1.1, 0.16), 'beam', { p: [-1.25, 2.75, 0.05], r: [0, 0, 0.75], c: 0xffffff });
    for (const s of [-0.38, 0.38]) b.add(box(0.07, 0.08, 6), 'iron', { p: [s, 0.1, 1.4], c: '#9a9aa0' });
    for (let t = -1.4; t < 4.4; t += 0.9) b.add(box(1.1, 0.08, 0.2), 'beam', { p: [0, 0.04, t], c: '#c8a080' });
    b.add(box(1.4, 0.6, 0.06), 'woodLight', { p: [2.3, 1.7, 0.4], r: [0, -0.2, 0.05], uv: 'box', c: '#d8c098' });
    b.add(box(0.1, 1.6, 0.1), 'beam', { p: [2.3, 0.8, 0.36], c: 0xffffff });
    res.lanterns.push({ p: [0.9, 2.95, 0.3], len: 0.35, color: 'yellow', scale: 1 });
    res.colliders.push({ x: -3.8, z: -1.2, r: 1.9 }, { x: 3.8, z: -1.4, r: 1.9 });
  } else if (D.theme === 'ore') {
    // an adit cut into a low bank of dark basalt on the plateau: a timber frame bound in brass, the rails running out past a
    // tipped ore cart, a lantern on the lintel, ash drifted against the rock
    for (const [x, y, z, sx, sy, sz] of [[-3.4, 1.5, -1.5, 1.9, 3.0, 1.5], [3.5, 1.5, -1.6, 2.0, 3.1, 1.5], [0, 3.8, -1.9, 3.4, 1.3, 1.7], [-2.0, 3.0, -2.6, 2.0, 2.4, 1.7], [2.3, 3.1, -2.6, 2.0, 2.4, 1.7], [-5.2, 0.8, -1.0, 1.6, 1.8, 1.3], [5.3, 0.9, -1.1, 1.7, 2.0, 1.3], [0, 1.6, -4.0, 4.2, 2.4, 1.8]]) addRock(b, [x, y, z], [sx, sy, sz], Math.round(x * 13 + z * 7 + 70), { moss: 0, tint: '#4a4644' });
    dark(2.8, 2.8, 2.0, 1.4, -1.2);
    for (const sx of [-1, 1]) {
      b.add(box(0.36, 3.2, 0.36), 'beam', { p: [sx * 1.6, 1.6, 0], c: 0xffffff });
      for (const y of [0.4, 1.6, 2.8]) b.add(box(0.42, 0.08, 0.42), 'copper', { p: [sx * 1.6, y, 0], c: '#d0a860' });
      res.colliders.push({ x: sx * 1.6, z: 0, r: 0.35 });
    }
    b.add(box(4.0, 0.42, 0.46), 'beam', { p: [0, 3.2, 0], c: 0xffffff });
    b.add(box(4.1, 0.08, 0.5), 'copper', { p: [0, 3.0, 0], c: '#d0a860' });
    for (const s of [-0.38, 0.38]) b.add(box(0.07, 0.08, 6), 'iron', { p: [s, 0.1, 1.4], c: '#8a8a90' });
    for (let t = -1.4; t < 4.4; t += 0.9) b.add(box(1.1, 0.08, 0.2), 'beam', { p: [0, 0.04, t], c: '#a88060' });
    b.addBuilder(mineCart(77).builder, { p: [2.7, 0, 3.4], r: [0.1, 0.6, 0.3] });
    for (let q = 0; q < 5; q++) addRock(b, [3.5 + q * 0.32, 0.05, 4.2 + q * 0.15], [0.3, 0.2, 0.3], 80 + q, { moss: 0, tint: q % 2 ? '#6a5246' : '#3a3432' });
    for (const [x, z, sx, sz] of [[-4.6, 1.2, 1.6, 1.0], [4.8, 1.0, 1.4, 1.0]]) b.add(sphere(1, 12, 8), 'dirtPlain', { p: [x, -0.25, z], s: [sx, 0.45, sz], uv: 'box', us: 0.3, c: '#8a8680' });
    res.lanterns.push({ p: [0.9, 2.95, 0.3], len: 0.35, color: 'yellow', scale: 1 });
    res.colliders.push({ x: -3.8, z: -1.2, r: 1.9 }, { x: 3.8, z: -1.4, r: 1.9 }, { x: 2.7, z: 3.4, r: 0.9 }, { x: 0, z: -3.6, r: 2.2 });
  } else if (D.theme === 'furnace') {
    // the pit-head of the First Furnace, sunk in the plateau: a square basalt enclosure open to the front, two square posts
    // under a flat iron lintel, a flight of steps down into the dark, a square stack breathing smoke behind, one glowing
    // grate in the ground to the side, a slack chain hanging off the right-hand post, slag heaped against the walls
    const BAS = '#4a4644', BAS2 = '#3a3634';
    for (const sx of [-1, 1]) { b.add(rbox(1.4, 2.2, 6.0, 0.05), 'stoneDark', { p: [sx * 3.3, 1.1, -1.8], uv: 'box', c: BAS }); res.colliders.push({ x: sx * 3.3, z: -1.8, hw: 0.7, hd: 3.0 }); }
    b.add(rbox(8.0, 2.2, 1.4, 0.05), 'stoneDark', { p: [0, 1.1, -5.0], uv: 'box', c: BAS });
    res.colliders.push({ x: 0, z: -5.0, hw: 4.0, hd: 0.7 });
    for (const sx of [-1, 1]) {
      b.add(rbox(0.8, 3.6, 0.8, 0.04), 'stoneDark', { p: [sx * 2.0, 1.8, 0.4], uv: 'box', c: BAS2 });
      for (const y of [0.5, 2.0, 3.3]) b.add(box(0.92, 0.12, 0.92), 'brass', { p: [sx * 2.0, y, 0.4], c: '#7a5e34' });
      res.colliders.push({ x: sx * 2.0, z: 0.4, r: 0.5 });
    }
    b.add(box(5.4, 0.5, 1.0), 'iron', { p: [0, 3.85, 0.4], c: '#3a3634' });
    b.add(box(5.5, 0.1, 1.06), 'brass', { p: [0, 3.6, 0.4], c: '#7a5e34' });
    for (let i = 0; i < 7; i++) b.add(box(3.0, 0.3, 0.6), 'stoneDark', { p: [0, 0.05 - i * 0.3, -0.2 - i * 0.6], uv: 'box', c: '#5a5450' });
    dark(3.2, 3.4, 4.6, 1.0, -2.6);
    b.add(rbox(8.0, 0.5, 5.4, 0.05), 'stoneDark', { p: [0, 2.45, -2.6], uv: 'box', c: BAS2 });
    // the stack behind
    b.add(box(1.6, 5.0, 1.6), 'stoneDark', { p: [2.2, 2.5, -6.4], uv: 'box', c: BAS2 });
    for (const y of [2.0, 4.0]) b.add(box(1.76, 0.14, 1.76), 'brass', { p: [2.2, y, -6.4], c: '#7a5e34' });
    b.add(box(2.0, 0.2, 2.0), 'iron', { p: [2.2, 5.1, -6.4], c: '#3a3634' });
    res.smokes.push({ p: [2.2, 5.4, -6.4], opts: { rate: 2, life: 3.5, size: 1.4, rise: 1.4, color: 0x4a4644, opacity: 0.45 } });
    res.colliders.push({ x: 2.2, z: -6.4, r: 1.1 });
    // one glowing grate in the ground to the left of the steps
    for (const [px, pz, bw, bd] of [[-4.6, 1.4, 1.8, 0.16], [-4.6, 2.6, 1.8, 0.16], [-5.42, 2.0, 0.16, 1.2], [-3.78, 2.0, 0.16, 1.2]]) b.add(box(bw, 0.1, bd), 'iron', { p: [px, 0.05, pz], c: '#3a3634' });
    b.add(box(1.6, 0.02, 1.0), 'wGlowOrange', { p: [-4.6, 0.02, 2.0], c: 0xffffff });
    for (let k = 0; k < 4; k++) b.add(box(0.08, 0.08, 1.0), 'iron', { p: [-5.2 + k * 0.4, 0.06, 2.0], c: '#2a2626' });
    // a slack chain hanging off the right-hand post (the pit-head stayed chained shut until the crew left the works alone)
    for (let q = 0; q < 9; q++) b.add(torus(0.07, 0.022, 4, 8), 'iron', { p: [2.45, 2.6 - q * 0.13, 0.9 + Math.sin(q * 0.35) * 0.1], r: [0, q % 2 ? PI / 2 : 0, PI / 2], c: '#5a5652' });
    res.lanterns.push({ p: [-2.0, 3.4, 1.0], len: 0.3, color: 'yellow', scale: 1 });
    for (const [x, z, sx, sz] of [[-4.6, -3.6, 1.0, 0.6], [4.8, -3.2, 0.9, 0.6], [3.6, 1.6, 0.6, 0.45]]) addRock(b, [x, 0.1, z], [sx, 0.4, sz], Math.round(x * 9 + z * 5 + 300), { moss: 0, tint: '#5a5654' });
  } else if (D.theme === 'sluice') {
    // the intake gatehouse at the head of the frozen lake: a square house of grey dressed stone with a flat roof under its
    // snow, its back into the glacier's foot; a wide doorway between two square piers under a flat bronze-banded lintel,
    // the old sluice gate wound up into the head of it on its chains, steps going down into the dark; a solid winding wheel
    // on the right-hand wall, one lantern on a bracket, ice spilt out over the threshold and drifted against the walls
    const ST = '#a4acb2', ST2 = '#848c92', BZ = '#4e4236';
    b.add(rbox(8.6, 4.6, 6.0, 0.05), 'stoneCold', { p: [0, 2.0, -3.4], uv: 'box', c: ST2 });
    res.colliders.push({ x: 0, z: -3.6, hw: 4.3, hd: 2.8 });
    for (const sx of [-1, 1]) {
      b.add(rbox(1.5, 4.6, 1.4, 0.05), 'stoneCold', { p: [sx * 2.55, 2.3, 0.1], uv: 'box', c: ST });
      for (const y of [0.4, 2.2, 3.9]) b.add(box(1.6, 0.14, 1.5), 'brass', { p: [sx * 2.55, y, 0.1], c: BZ });
      res.colliders.push({ x: sx * 2.55, z: 0.1, r: 0.85 });
    }
    b.add(rbox(6.8, 0.8, 1.6, 0.05), 'stoneCold', { p: [0, 4.4, 0.1], uv: 'box', c: ST });
    b.add(box(6.9, 0.14, 1.7), 'brass', { p: [0, 4.0, 0.1], c: BZ });
    // the flat roof and its snow, icicles off the front edge
    b.add(rbox(9.2, 0.4, 7.4, 0.04), 'stoneColdDark', { p: [0, 5.0, -2.6], uv: 'box', c: '#7a8288' });
    b.add(rbox(8.8, 0.36, 7.0, 0.15), 'snowPack', { p: [0, 5.34, -2.6], c: 0xffffff });
    for (let q = 0; q < 12; q++) { const l = 0.3 + ((q * 5) % 7) * 0.08; b.add(cone(0.07, l, 5), 'ice', { p: [-4.2 + q * 0.76, 4.78 - l / 2, 1.0], r: [PI, 0, 0], c: 0xffffff }); }
    // the doorway, dark inside, steps going down
    dark(3.6, 3.6, 3.6, 1.6, -1.8);
    for (let i = 0; i < 6; i++) b.add(box(3.4, 0.3, 0.6), 'stoneCold', { p: [0, 0.05 - i * 0.3, -0.2 - i * 0.6], uv: 'box', c: '#8a9298' });
    // the sluice gate wound up into the head of the doorway, on two chains
    b.add(box(3.6, 0.9, 0.2), 'brass', { p: [0, 3.5, 0.55], c: '#3a322c' });
    for (let i = 0; i < 2; i++) b.add(box(3.5, 0.34, 0.08), 'woodDark', { p: [0, 3.27 + i * 0.42, 0.68], c: '#8a7458' });
    b.add(box(3.7, 0.12, 0.3), 'iron', { p: [0, 3.06, 0.6], c: '#4a4e54' });
    for (let q = 0; q < 6; q++) { const l = 0.18 + (q % 3) * 0.1; b.add(cone(0.05, l, 5), 'ice', { p: [-1.5 + q * 0.6, 3.0 - l / 2, 0.62], r: [PI, 0, 0], c: 0xffffff }); }
    // the winding wheel on the right-hand wall: a solid disc with square lugs round its rim and an off-centre bolt plate
    b.add(cyl(1.15, 1.15, 0.2, 28), 'brass', { p: [4.45, 2.4, -2.4], r: [0, 0, PI / 2], c: '#3a322c' });
    b.add(cyl(0.7, 0.7, 0.28, 24), 'iron', { p: [4.45, 2.4, -2.4], r: [0, 0, PI / 2], c: '#4a4e54' });
    b.add(cyl(0.2, 0.2, 0.4, 12), 'brass', { p: [4.45, 2.4, -2.4], r: [0, 0, PI / 2], c: '#8a6c42' });
    b.add(box(0.14, 0.4, 0.26), 'brass', { p: [4.6, 2.85, -2.4], c: '#8a6c42' });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; b.add(box(0.24, 0.22, 0.22), 'brass', { p: [4.45, 2.4 + Math.cos(a) * 1.24, -2.4 + Math.sin(a) * 1.24], r: [a, 0, 0], c: '#8a6c42' }); }
    // one lantern on a bracket on the left pier
    b.add(box(0.1, 0.1, 0.6), 'iron', { p: [-2.55, 3.1, 1.0], c: '#4a4e54' });
    res.lanterns.push({ p: [-2.55, 2.95, 1.25], len: 0.25, color: 'yellow', scale: 1 });
    // ice spilt over the threshold, drifts and ice blocks against the walls
    b.add(rbox(3.2, 0.12, 2.6, 0.05), 'ice', { p: [0, 0.02, 1.6], r: [0, 0.08, 0], c: 0xffffff });
    for (const [x, z, sx, sz] of [[-4.6, 0.6, 1.4, 1.0], [4.8, 0.4, 1.2, 1.0], [-4.8, -4.5, 1.2, 1.6], [3.2, 1.6, 0.6, 0.5]]) b.add(sphere(1, 12, 8), 'snowPack', { p: [x, -0.25, z], s: [sx, 0.55, sz], c: 0xffffff });
    for (const [x, z, s] of [[-5.4, -1.2, 0.8], [5.5, -0.6, 0.6], [-3.6, 1.5, 0.45]]) b.add(ico(s, 0), 'ice', { p: [x, s * 0.4, z], s: [1.2, 0.8, 1.0], r: [0, x, 0], c: 0xffffff });
    res.colliders.push({ x: -5.4, z: -1.2, r: 0.9 }, { x: 5.5, z: -0.6, r: 0.7 }, { x: 4.45, z: -2.4, r: 0.6 });
  } else if (D.theme === 'dam') {
    // the gatehouse of the Great Dam, cut into the foot of the glacier on the east shore of the lake: a tall square house of
    // grey dressed stone with a flat roof under its snow, its back sunk in the ice; a short run of the dam's own wall either
    // side with square buttresses, stepping down into the glacier; a wide doorway between two square piers under a flat
    // bronze-banded lintel, the old gate wound up into the head of it on its chains, steps going down into the dark; a solid
    // gate wheel on the left-hand wall (lugs round the rim, never spoked), one lantern on a bracket, ice drifted everywhere
    const ST = '#a8b0b6', ST2 = '#8a9298', BZ = '#463c34';
    b.add(rbox(10.4, 6.4, 7.0, 0.05), 'stoneCold', { p: [0, 2.9, -3.9], uv: 'box', c: ST2 });
    res.colliders.push({ x: 0, z: -4.0, hw: 5.2, hd: 3.4 });
    for (const y of [1.6, 4.6]) b.add(box(10.6, 0.16, 7.2), 'brass', { p: [0, y, -3.9], c: BZ });
    // the dam's wall either side of the house, stepping down into the glacier ice, with a square buttress on each
    for (const sx of [-1, 1]) {
      b.add(rbox(6.0, 4.4, 2.6, 0.05), 'stoneCold', { p: [sx * 8.0, 1.9, -5.2], uv: 'box', c: ST });
      b.add(rbox(4.0, 2.6, 2.4, 0.05), 'stoneCold', { p: [sx * 12.2, 1.0, -5.6], uv: 'box', c: ST2 });
      b.add(rbox(1.4, 4.8, 1.6, 0.04), 'stoneColdDark', { p: [sx * 7.6, 2.1, -3.6], uv: 'box', c: '#7a8288' });
      b.add(rbox(6.2, 0.3, 2.8, 0.12), 'snowPack', { p: [sx * 8.0, 4.2, -5.2], c: 0xffffff });
      b.add(rbox(4.2, 0.3, 2.6, 0.12), 'snowPack', { p: [sx * 12.2, 2.4, -5.6], c: 0xffffff });
      res.colliders.push({ x: sx * 9.6, z: -5.3, hw: 4.6, hd: 1.3 }, { x: sx * 7.6, z: -3.6, r: 0.9 });
    }
    // the doorway's piers and the flat lintel
    for (const sx of [-1, 1]) {
      b.add(rbox(1.7, 5.4, 1.6, 0.05), 'stoneCold', { p: [sx * 2.9, 2.7, 0.1], uv: 'box', c: ST });
      for (const y of [0.5, 2.6, 4.6]) b.add(box(1.8, 0.16, 1.7), 'brass', { p: [sx * 2.9, y, 0.1], c: BZ });
      res.colliders.push({ x: sx * 2.9, z: 0.1, r: 0.95 });
    }
    b.add(rbox(7.6, 0.9, 1.8, 0.05), 'stoneCold', { p: [0, 5.1, 0.1], uv: 'box', c: ST });
    b.add(box(7.7, 0.16, 1.9), 'brass', { p: [0, 4.66, 0.1], c: BZ });
    // the flat roof and its snow, icicles off the front edge
    b.add(rbox(11.0, 0.45, 7.8, 0.04), 'stoneColdDark', { p: [0, 6.3, -3.4], uv: 'box', c: '#7a8288' });
    b.add(rbox(10.6, 0.4, 7.4, 0.16), 'snowPack', { p: [0, 6.68, -3.4], c: 0xffffff });
    for (let q = 0; q < 14; q++) { const l = 0.3 + ((q * 5) % 7) * 0.09; b.add(cone(0.07, l, 5), 'ice', { p: [-5.1 + q * 0.78, 6.06 - l / 2, 0.5], r: [PI, 0, 0], c: 0xffffff }); }
    // the doorway, dark inside, steps going down
    dark(4.0, 4.2, 4.2, 1.9, -2.1);
    for (let i = 0; i < 7; i++) b.add(box(3.8, 0.3, 0.6), 'stoneCold', { p: [0, 0.05 - i * 0.3, -0.2 - i * 0.6], uv: 'box', c: '#8a9298' });
    // the old gate wound up into the head of the doorway, on two chains
    b.add(box(4.0, 1.0, 0.2), 'brass', { p: [0, 4.0, 0.6], c: '#362e28' });
    for (let i = 0; i < 2; i++) b.add(box(3.9, 0.38, 0.08), 'woodDark', { p: [0, 3.75 + i * 0.46, 0.73], c: '#8a7458' });
    b.add(box(4.1, 0.12, 0.3), 'iron', { p: [0, 3.5, 0.65], c: '#4a4e54' });
    for (let q = 0; q < 7; q++) { const l = 0.18 + (q % 3) * 0.1; b.add(cone(0.05, l, 5), 'ice', { p: [-1.8 + q * 0.6, 3.44 - l / 2, 0.67], r: [PI, 0, 0], c: 0xffffff }); }
    // the gate wheel on the left-hand wall of the house: a solid disc with square lugs round its rim and an off-centre bolt plate
    b.add(cyl(1.3, 1.3, 0.22, 28), 'brass', { p: [-5.3, 3.0, -2.6], r: [0, 0, PI / 2], c: '#362e28' });
    b.add(cyl(0.8, 0.8, 0.3, 24), 'iron', { p: [-5.3, 3.0, -2.6], r: [0, 0, PI / 2], c: '#4a4e54' });
    b.add(cyl(0.22, 0.22, 0.42, 12), 'brass', { p: [-5.3, 3.0, -2.6], r: [0, 0, PI / 2], c: '#8a6c42' });
    b.add(box(0.14, 0.44, 0.28), 'brass', { p: [-5.46, 3.5, -2.6], c: '#8a6c42' });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; b.add(box(0.26, 0.24, 0.24), 'brass', { p: [-5.3, 3.0 + Math.cos(a) * 1.4, -2.6 + Math.sin(a) * 1.4], r: [a, 0, 0], c: '#8a6c42' }); }
    // one lantern on a bracket on the right pier
    b.add(box(0.1, 0.1, 0.6), 'iron', { p: [2.9, 3.6, 1.0], c: '#4a4e54' });
    res.lanterns.push({ p: [2.9, 3.45, 1.25], len: 0.25, color: 'yellow', scale: 1.1 });
    // ice spilt over the threshold, drifts and ice blocks against the walls
    b.add(rbox(3.6, 0.12, 2.8, 0.05), 'ice', { p: [0, 0.02, 1.8], r: [0, -0.06, 0], c: 0xffffff });
    for (const [x, z, sx, sz] of [[-5.0, 0.6, 1.4, 1.0], [5.2, 0.5, 1.3, 1.0], [-10.2, -3.4, 2.0, 1.4], [10.4, -3.2, 2.0, 1.4], [3.8, 1.8, 0.6, 0.5]]) b.add(sphere(1, 12, 8), 'snowPack', { p: [x, -0.25, z], s: [sx, 0.55, sz], c: 0xffffff });
    for (const [x, z, s] of [[-6.4, -1.0, 0.8], [6.2, -0.8, 0.7], [-4.0, 1.6, 0.45]]) b.add(ico(s, 0), 'ice', { p: [x, s * 0.4, z], s: [1.2, 0.8, 1.0], r: [0, x, 0], c: 0xffffff });
    res.colliders.push({ x: -6.4, z: -1.0, r: 0.9 }, { x: 6.2, z: -0.8, r: 0.8 }, { x: -5.3, z: -2.6, r: 0.6 });
  } else if (D.theme === 'pump') {
    // the pump house over the shafts, in the trough between the first two ridges of the Engine Rows: a square house with a
    // course of grey cold stone at the foot and black plank walls above, a flat plank roof under its snow; a wide doorway
    // between two square timber posts under a flat iron-shod lintel, steps going down into the dark; a square timber
    // headframe standing up out of the back of the roof (four posts, two flat head beams side by side, never crossed),
    // the rising main coming out of the right-hand wall and down into a square stone trough, iced over; one lantern
    const ST = '#a4a8ac', TB = '#4e3e30', IR = '#3e4246';
    // the house: stone foot, plank walls (boards run one way), corner posts
    b.add(rbox(9.0, 1.3, 6.8, 0.05), 'stoneCold', { p: [0, 0.55, -3.65], uv: 'box', c: ST });
    b.add(box(8.7, 3.2, 6.7), 'woodDark', { p: [0, 2.8, -3.5], uv: 'box', c: '#6a5644' });
    for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) b.add(box(0.05, 3.1, 0.62), 'woodDark', { p: [sx * 4.38, 2.8, -6.4 + i * 0.72], c: i % 2 ? '#5a4836' : '#64503c' });
    for (const sx of [-1, 1]) for (const sz of [0, -7]) b.add(box(0.36, 4.4, 0.36), 'beam', { p: [sx * 4.4, 2.2, sz], c: '#4a3a2c' });
    for (const y of [1.25, 4.3]) for (const sx of [-1, 1]) b.add(box(2.3, 0.16, 0.12), 'iron', { p: [sx * 3.25, y, -0.12], c: IR }); // iron straps either side of the doorway
    res.colliders.push({ x: 0, z: -3.6, hw: 4.6, hd: 3.6 });
    // the flat roof and its snow, icicles off the front edge
    b.add(box(9.6, 0.3, 7.8), 'woodDark', { p: [0, 4.55, -3.5], uv: 'box', c: '#4e3e30' });
    b.add(rbox(9.2, 0.32, 7.4, 0.14), 'snowPack', { p: [0, 4.84, -3.5], c: 0xffffff });
    for (let q = 0; q < 12; q++) { const l = 0.3 + ((q * 5) % 7) * 0.08; b.add(cone(0.07, l, 5), 'ice', { p: [-4.4 + q * 0.8, 4.4 - l / 2, 0.35], r: [PI, 0, 0], c: 0xffffff }); }
    // the doorway: two square posts, a flat lintel shod in iron, dark inside, steps going down
    for (const sx of [-1, 1]) { b.add(box(0.5, 3.4, 0.5), 'beam', { p: [sx * 1.85, 1.7, 0.15], c: TB }); for (const y of [0.5, 2.9]) b.add(box(0.56, 0.1, 0.56), 'iron', { p: [sx * 1.85, y, 0.15], c: IR }); res.colliders.push({ x: sx * 1.85, z: 0.15, r: 0.35 }); }
    b.add(box(4.4, 0.5, 0.6), 'beam', { p: [0, 3.55, 0.15], c: TB });
    b.add(box(4.5, 0.1, 0.66), 'iron', { p: [0, 3.3, 0.15], c: IR });
    dark(3.2, 3.2, 3.6, 1.5, -1.8);
    for (let i = 0; i < 6; i++) b.add(box(3.0, 0.3, 0.6), 'stoneCold', { p: [0, 0.05 - i * 0.3, -0.2 - i * 0.6], uv: 'box', c: '#8a9298' });
    // the headframe up out of the back of the roof: four square posts, two flat head beams along x, the rod housing between
    for (const sx of [-1, 1]) for (const z of [-4.6, -6.6]) { b.add(box(0.36, 4.2, 0.36), 'beam', { p: [sx * 1.6, 6.8, z], c: TB }); b.add(box(0.42, 0.1, 0.42), 'iron', { p: [sx * 1.6, 6.0, z], c: IR }); }
    for (const z of [-4.6, -6.6]) b.add(box(3.8, 0.4, 0.4), 'beam', { p: [0, 8.9, z], c: TB });
    b.add(box(1.0, 0.8, 2.4), 'iron', { p: [0, 9.3, -5.6], c: IR });
    b.add(box(0.36, 3.6, 0.36), 'iron', { p: [0, 7.2, -5.6], c: '#5a5e62' }); // the pump rod coming up into it
    b.add(rbox(3.6, 0.22, 2.4, 0.08), 'snowPack', { p: [0, 9.2, -5.6], c: 0xffffff });
    // the rising main out of the right-hand wall, down into a square stone trough, iced over
    b.add(cyl(0.3, 0.3, 1.4, 12), 'iron', { p: [5.1, 3.0, -3.0], r: [0, 0, PI / 2], c: IR });
    b.add(box(0.7, 0.7, 0.7), 'iron', { p: [5.8, 3.0, -3.0], c: IR });
    b.add(cyl(0.3, 0.3, 1.8, 12), 'iron', { p: [5.8, 1.9, -3.0], c: IR });
    for (const y of [2.5, 1.4]) b.add(cyl(0.4, 0.4, 0.12, 12), 'brass', { p: [5.8, y, -3.0], c: '#8a6c42' });
    for (const [px, pz, bw, bd] of [[5.8, -4.3, 2.0, 0.3], [5.8, -1.7, 2.0, 0.3], [4.95, -3.0, 0.3, 2.6], [6.65, -3.0, 0.3, 2.6]]) b.add(box(bw, 0.8, bd), 'stoneCold', { p: [px, 0.4, pz], uv: 'box', c: ST });
    b.add(box(1.5, 0.08, 2.2), 'ice', { p: [5.8, 0.72, -3.0], c: 0xffffff });
    res.colliders.push({ x: 5.8, z: -3.0, r: 1.2 });
    // one lantern on a bracket on the left post
    b.add(box(0.1, 0.1, 0.6), 'iron', { p: [-1.85, 2.9, 0.6], c: IR });
    res.lanterns.push({ p: [-1.85, 2.75, 0.85], len: 0.25, color: 'yellow', scale: 1 });
    // snow drifted against the walls, a crate of spare rod pins by the door
    for (const [x, z, sx, sz] of [[-4.9, -1.0, 1.0, 1.6], [-4.8, -5.4, 1.0, 1.8], [3.6, 1.4, 0.6, 0.5], [0, -7.6, 3.0, 0.8]]) b.add(sphere(1, 12, 8), 'snowPack', { p: [x, -0.25, z], s: [sx, 0.55, sz], c: 0xffffff });
    b.add(rbox(0.8, 0.6, 0.8, 0.03), 'woodLight', { p: [3.1, 0.3, 1.0], r: [0, 0.3, 0], uv: 'box', c: 0xffffff });
    res.colliders.push({ x: 3.1, z: 1.0, r: 0.5 });
  } else if (D.theme === 'mills') {
    // the wheel-pit hatch, opened, over the square stone hatch the Sound's layout already lays on the races pad
    // (client/game/tidewaterLayout.js, axis-aligned at the pad's centre: the door's ry is a quarter turn so this lines up):
    // the well dark under a square iron rim over the old lid, the ladder's rails showing over it, the square iron lid swung
    // up on its hinges against two square timber posts at the back, a flat timber windlass frame (two posts and a flat beam,
    // a solid drum) beside it for the ropes, one lantern on a post, the stop-board stack in a square bin. Square from above,
    // nothing crossed.
    const TB = '#4a3e32', IR = '#3e4246';
    b.add(box(2.7, 0.04, 2.7), 'dCap', { p: [0, 0.5, 0], c: '#050505' });
    for (const [x, z, w, d] of [[0, -1.42, 3.0, 0.16], [0, 1.42, 3.0, 0.16], [-1.42, 0, 0.16, 2.7], [1.42, 0, 0.16, 2.7]]) b.add(box(w, 0.14, d), 'iron', { p: [x, 0.52, z], c: IR });
    for (const s of [-0.4, 0.4]) b.add(box(0.1, 1.1, 0.1), 'woodDark', { p: [s, 0.9, -1.15], c: '#5a4c40' });
    b.add(box(0.9, 0.07, 0.07), 'woodDark', { p: [0, 1.3, -1.15], c: '#6a5644' });
    // the lid, swung up against its two posts at the back
    for (const sx of [-1, 1]) { b.add(box(0.3, 2.8, 0.3), 'beam', { p: [sx * 1.45, 1.5, -2.0], c: TB }); res.colliders.push({ x: sx * 1.45, z: -2.0, r: 0.3 }); }
    b.add(box(2.6, 2.5, 0.16), 'iron', { p: [0, 1.75, -1.75], r: [-0.12, 0, 0], c: '#4e5254' });
    for (const y of [1.0, 1.8, 2.6]) b.add(box(2.7, 0.1, 0.2), 'iron', { p: [0, y, -1.71 + (y - 1.75) * 0.12], r: [-0.12, 0, 0], c: IR });
    // the windlass for the ropes on the right, off the stone: two square posts, a flat beam, a solid drum
    for (const z of [-1.2, 1.2]) { b.add(box(0.3, 1.9, 0.3), 'beam', { p: [3.1, 0.95, z], c: TB }); res.colliders.push({ x: 3.1, z, r: 0.3 }); }
    b.add(box(0.36, 0.3, 2.8), 'beam', { p: [3.1, 2.0, 0], c: TB });
    b.add(cyl(0.36, 0.36, 2.0, 16), 'woodDark', { p: [3.1, 1.3, 0], r: [PI / 2, 0, 0], c: '#6a5644' });
    // the stop-boards in a square bin on the left, a lantern on a post at the front corner
    b.add(rbox(1.0, 0.6, 1.2, 0.03), 'woodDark', { p: [-3.0, 0.3, -1.2], uv: 'box', c: '#5a4c40' });
    for (let k = 0; k < 3; k++) b.add(box(0.8, 0.1, 0.18), 'woodLight', { p: [-3.0, 0.64, -1.5 + k * 0.3], c: '#9a8662' });
    res.colliders.push({ x: -3.0, z: -1.2, r: 0.6 });
    b.add(box(0.2, 2.8, 0.2), 'beam', { p: [-2.6, 1.4, 1.9], c: TB });
    res.lanterns.push({ p: [-2.6, 2.85, 1.9], len: 0.25, color: 'yellow', scale: 1 });
    res.colliders.push({ x: -2.6, z: 1.9, r: 0.25 });
  } else if (D.theme === 'vault') {
    // a sandstone doorway half buried by the dunes, steps going down into the dark, braziers either side
    for (const sx of [-1, 1]) {
      b.add(rbox(1.2, 4.2, 1.2, 0.06), 'sandstone', { p: [sx * 2.3, 2.1, 0], uv: 'box', c: '#f0dcb8' });
      b.add(rbox(1.5, 0.4, 1.5, 0.05), 'sandstone', { p: [sx * 2.3, 0.2, 0], uv: 'box', c: '#e0c8a0' });
      res.colliders.push({ x: sx * 2.3, z: 0, r: 0.8 });
      brazier(b, sx * 3.9, 1.0);
      res.fires.push({ p: [sx * 3.9, 1.3, 1.0], scale: 0.6, light: false });
      res.colliders.push({ x: sx * 3.9, z: 1.0, r: 0.5 });
    }
    b.add(rbox(6.0, 0.9, 1.6, 0.06), 'sandstone', { p: [0, 4.6, 0], uv: 'box', c: '#f4e2c2' });
    b.add(rbox(6.4, 0.25, 1.8, 0.04), 'sandstone', { p: [0, 5.15, 0], uv: 'box', c: '#e8d0aa' });
    for (let i = 0; i < 5; i++) b.add(box(3.4, 0.3, 0.6), 'sandstone', { p: [0, 0.1 - i * 0.28, -0.2 - i * 0.55], uv: 'box', c: '#d8c4a0' });
    dark(3.4, 4.0, 2.4, 1.6, -2.2);
    for (const [x, z, sx, sz] of [[-4.4, -1.4, 3.0, 2.4], [4.6, -1.2, 3.2, 2.2], [0, -3.4, 5.2, 2.6], [-6.2, 0.8, 2.0, 1.6], [6.0, 1.0, 2.2, 1.6]]) { // low, lopsided sand drifts (no dome shapes, content rules)
      b.add(sphere(1, 14, 10), 'sandstone', { p: [x, -0.25, z], s: [sx, 0.55, sz], r: [0.12, x * 0.3, -0.1], uv: 'box', us: 0.3, c: '#fff4e0' });
      b.add(sphere(1, 12, 8), 'sandstone', { p: [x + sx * 0.45, -0.2, z + sz * 0.3], s: [sx * 0.55, 0.35, sz * 0.6], r: [0, x, 0.1], uv: 'box', us: 0.3, c: '#f4e8d0' }); }
  } else if (D.theme === 'deep') {
    // the great stair: a wide flight going down between two plain stone blocks under a flat lintel, bronze lamp posts
    for (const sx of [-1, 1]) {
      b.add(rbox(1.6, 3.6, 7.0, 0.06), 'stoneDark', { p: [sx * 4.3, 1.5, -2.8], uv: 'box', c: '#c8bea8' });
      res.colliders.push({ x: sx * 4.3, z: -2.8, hw: 0.8, hd: 3.5 });
      b.add(cyl(0.08, 0.1, 3.0, 8), 'iron', { p: [sx * 5.6, 1.5, 1.0], c: '#b08850' });
      res.lanterns.push({ p: [sx * 5.6, 3.0, 1.0], len: 0.25, color: 'yellow', scale: 1 });
      res.colliders.push({ x: sx * 5.6, z: 1.0, r: 0.3 });
    }
    b.add(rbox(10.2, 0.8, 1.6, 0.05), 'stoneDark', { p: [0, 3.7, -0.2], uv: 'box', c: '#d0c6b0' });
    for (let i = 0; i < 9; i++) b.add(box(7.0, 0.3, 0.7), 'stoneDark', { p: [0, 0.05 - i * 0.32, -0.1 - i * 0.66], uv: 'box', c: '#b0a690' });
    dark(7.0, 3.4, 5.6, 1.6, -3.6);
    b.add(rbox(10.2, 0.5, 7.0, 0.05), 'stoneDark', { p: [0, 3.55, -3.4], uv: 'box', c: '#bcb29c' });
    b.add(rbox(10.2, 1.2, 1.4, 0.05), 'stoneDark', { p: [0, 0.4, -6.6], uv: 'box', c: '#a89e88' });
    for (const [x, z, sx, sz] of [[-6.6, -2.0, 2.4, 3.2], [6.6, -2.4, 2.4, 3.0], [0, -8.0, 6.0, 2.0]]) b.add(sphere(1, 14, 10), 'sandstone', { p: [x, -0.3, z], s: [sx, 1.2, sz], uv: 'box', c: '#e0c8a0' });
    res.colliders.push({ x: 0, z: -4.2, hw: 3.5, hd: 3.4 });
  } else {
    // a brick hatchway over iron stairs, two lamp posts, pipes running into the ground
    b.add(rbox(6.0, 1.2, 5.0, 0.06), 'stoneDark', { p: [0, 0.4, -1.4], uv: 'box', c: '#a88a7a' });
    for (const sx of [-1, 1]) { b.add(rbox(0.9, 3.4, 0.9, 0.05), 'stoneDark', { p: [sx * 2.2, 1.7, 0.2], uv: 'box', c: '#b08070' }); res.colliders.push({ x: sx * 2.2, z: 0.2, r: 0.6 }); }
    b.add(rbox(5.4, 0.7, 1.0, 0.05), 'stoneDark', { p: [0, 3.5, 0.2], uv: 'box', c: '#b08070' });
    b.add(extrude(arcShape(3.4, 3.1, 1.2), 0.12, 0.02, 14), 'iron', { p: [0, 0, 0.75], r: [0, 0, 0], c: '#2a2a2e' });
    dark(3.2, 3.0, 4.2, 1.2, -1.6);
    for (let i = 0; i < 6; i++) b.add(box(3.0, 0.12, 0.5), 'iron', { p: [0, 0.3 - i * 0.3, 0.3 - i * 0.55], c: '#5a5a60' });
    for (const sx of [-1, 1]) {
      b.add(cyl(0.08, 0.1, 3.2, 8), 'iron', { p: [sx * 3.6, 1.6, 1.6], c: 0xffffff });
      res.lanterns.push({ p: [sx * 3.6, 3.15, 1.6], len: 0.25, color: 'yellow', scale: 1 });
      b.add(cyl(0.25, 0.25, 4, 10), 'copper', { p: [sx * 3.0, 0.3, -2.4], r: [PI / 2, 0, 0], c: 0xffffff });
    }
    res.smokes.push({ p: [0, 1.0, -1.0], opts: { rate: 2, life: 3, size: 1.4, rise: 1.0, color: 0x5a5450, opacity: 0.35 } });
    res.colliders.push({ x: 0, z: -2.0, hw: 3.0, hd: 1.4 });
  }
  return res;
}
