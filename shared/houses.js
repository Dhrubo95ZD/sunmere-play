// Enterable houses: one shared model for the client (art, collision, camera) and the server (walls, floors, NPC spots).
// Pure and deterministic: every number comes from the site and mulberry32 streams of its seed. Nothing is worked out at
// import time (terrain.js imports this file and this file imports terrain.js), so the module state below is `var` and the
// first query builds every spec and the spatial hash.
//
// Conventions (read before using a Spec):
//   * Local space: the house centre is (0, 0) and the front faces +z. The site's rot turns it like placeObject does:
//     world = (x + lx*cos(rot) + lz*sin(rot), z - lx*sin(rot) + lz*cos(rot)). Wall boxes are {x, z, hw, hd, rot} in world.
//   * Every local number in a Spec already has the mirror applied (mirror is kept only as a hint for trims). Builders
//     never mirror anything themselves.
//   * Heights in a Spec (window y, door h, wallTop, ext h, chimney) are above spec.floorY unless named as absolute.
//   * Window y is the centre of the opening. Openings are square-headed.
//   * Spot ry and world rot follow three.js rotation.y: facing (sin ry, cos ry). World ry = local ry + rot.
//   * Spot order is fixed for every enterable house: 0 'npc', 1 'work', 2 'sit', 3 'bed', then 0-2 'stand'.
//   * Random streams: houseRng(seed, 1) shapes (shared), houseRng(seed, 2) palette/looks (shared and client art).
//     Client-only clutter may use houseRng(seed, 3) and up so it never moves anything shared.
//
// Additions to the design spec's Spec shape (all extra fields, nothing removed): door {face, nx, nz} and window
// {face, lx, lz, nx, nz}; ext {face, solid, open, posts}; spec.parts (local partition rects), spec.wallTop, spec.attic,
// spec.accent, spec.variant, spec.job, spec.area, spec.role, spec.doorAt / doorIn / doorOut (world points), spec.stepY,
// spec.foot (local footprint rect), spec.stepLen (doorstep ramp length), spec.wallRects / cutRect (local twins of walls / cutBox) and spec.chimney {at, lx, lz, w, h}. Sites may carry w/d/h/wins/sideWins/porch/chimney
// overrides (the island works keep their old sizes) and a variant (shop: bakery, weaver, clerk, chandler).
import { mulberry32 } from './noise.js';
import { heightAt, islandAt } from './terrain.js';

const PI = Math.PI;
export const HOUSE_CELL = 32;
export const ARCHES = ['cottage', 'townhouse', 'longhouse', 'smithy', 'shop', 'farmhouse', 'towerhouse', 'works'];
// settlement groups, one merged shell builder each. area: where the group lives (the valley or an island area id)
export const HOUSE_GROUPS = ['village', 'fields', 'westfold', 'homestead', 'ledgerholm', 'harrowmouth', 'reach', 'rime', 'heights', 'dunewatch', 'brasswind', 'raidercamp', 'vaultruins', 'saltcamp', 'kilnworks'];
export const HOUSE_GROUP_AREA = { village: 'valley', fields: 'valley', westfold: 'valley', homestead: 'valley', ledgerholm: 'valley', harrowmouth: 'valley', reach: 'reach', rime: 'rime', heights: 'heights', dunewatch: 'valley', brasswind: 'valley', raidercamp: 'valley', vaultruins: 'valley', saltcamp: 'valley', kilnworks: 'valley' };
export const WALL_T = 0.3, PART_T = 0.2, DOOR_W = 1.5, DOOR_H = 2.2, WALL_H = 2.9, STEP = 0.9, PART_GAP = 1.2;

// the island camps turn their fronts toward the middle of the square (as the old layouts did)
const face = (cx, cz, x, z) => Math.atan2(cx - x, cz - z);
const RIME_C = { x: 458, z: -1650 }, HEIGHTS_C = { x: 456, z: -2100 };
const rr = (v) => Math.round(v * 1e4) / 1e4;

// ------------------------------------------------------------------ the sites (today's layout coordinates)
// Village cottages were (x, z, rot) in villageLayout.js:86; the ranger lodge villageLayout.js:75; farms world.js:235 and
// zonesLayout.js:534; Ledgerholm zonesLayout.js:296; the homestead zonesLayout.js:345; Harrowmouth zonesLayout.js:443-445;
// the Reach reachLayout.js:425-433; the Rime rimeLayout.js:334-340; the Heights heightsLayout.js:479-482.
// A longhouse's door is on its long (+x) side, so its rot is the old front's rot - PI/2 (the door faces the same way).
// Moved from the old spots so nothing overlaps (tools/check_houses.mjs): sv_c1 (-42,35) -> (-41,36.5) off the end of the
// cottage lane; sv_c7 (44,27) -> (44.5,27.5) off the stream bank; sv_c8 (30,-27) -> (29.5,-21) off the north-east road and
// the training dummy at (34,-26); bf_farm (84,-8) -> (85,-7) off the pond bank; wf_farm (-184,22) -> (-184.5,21) off the
// Westfold graveyard; lh_1 (-367,-390) -> (-366,-388) and lh_2 (-390,-369) -> (-388.5,-366.5) apart from their neighbours; lh_3 (-372,-394) -> (-373.5,-394.3) when it turned to the yard;
// rm_office (445,-1642.5) -> (444,-1643) apart from the bunkhouse and off the camp track (rot unchanged); rm_bunk
// (450.8,-1634.6) -> (450.8,-1634.1); rc_store (465,-1220) -> (463,-1220) and rc_shop (465,-1181, PI) -> (463,-1179, PI+0.15)
// off the island tracks (REACH.paths, RIME.paths), which used to run through the old solid blocks.
export const HOUSE_SITES = [
  // Sunmere Village (10)
  { id: 'sv_c1', arch: 'cottage', group: 'village', x: -41, z: 36.5, rot: 0.45, seed: 70, style: 'sunmere', enter: true, role: 'home', shell: 'thatched_cottage' },
  { id: 'sv_c2', arch: 'shop', variant: 'weaver', group: 'village', x: -31, z: 41, rot: 0.12, seed: 71, style: 'sunmere', enter: true, role: 'work' },
  { id: 'sv_c3', arch: 'cottage', group: 'village', x: -55, z: 25, rot: 0.95, seed: 72, style: 'sunmere', enter: true, role: 'home', shell: 'thatched_cottage' },
  { id: 'sv_c4', arch: 'longhouse', group: 'village', x: -52, z: 40, rot: rr(0.3 - PI / 2), seed: 73, style: 'sunmere', enter: true, role: 'home' },
  { id: 'sv_c5', arch: 'shop', variant: 'bakery', group: 'village', x: 22, z: 41, rot: -0.2, seed: 74, style: 'sunmere', enter: true, role: 'work' },
  { id: 'sv_c6', arch: 'townhouse', group: 'village', x: 34, z: 33, rot: -0.65, seed: 75, style: 'sunmere', enter: true, role: 'home', shell: 'red_cottage' },
  { id: 'sv_c7', arch: 'cottage', group: 'village', x: 44.5, z: 27.5, rot: -0.9, seed: 76, style: 'sunmere', enter: true, role: 'home', shell: 'thatched_cottage' },
  { id: 'sv_c8', arch: 'townhouse', group: 'village', x: 29.5, z: -21, rot: 0.3, seed: 77, style: 'sunmere', enter: true, role: 'work', shell: 'red_cottage' },
  { id: 'sv_c9', arch: 'towerhouse', group: 'village', x: -30, z: -61, rot: 0.2, seed: 78, style: 'sunmere', enter: true, role: 'work' },
  { id: 'sv_lodge', arch: 'longhouse', group: 'village', x: -45, z: -35.5, rot: rr(0.35 - PI / 2), seed: 79, style: 'sunmere', enter: true, role: 'work' },
  // the farms (2)
  { id: 'bf_farm', arch: 'farmhouse', group: 'fields', x: 85, z: -7, rot: 0, seed: 80, style: 'farmland', enter: true, role: 'home', shell: 'thatched_farm' },
  { id: 'wf_farm', arch: 'farmhouse', group: 'westfold', x: -184.5, z: 21, rot: 0.4, seed: 81, style: 'farmland', enter: true, role: 'home', shell: 'thatched_farm' },
  // the homestead (1)
  { id: 'hs_lodge', arch: 'cottage', group: 'homestead', x: -38, z: 88, rot: rr(PI / 2), seed: 240, style: 'farmland', enter: true, role: 'home' },
  // Ledgerholm (4): backs in the palisade line, doors on the yard (each turned PI from its first rot, same footprint)
  { id: 'lh_1', flip: true, arch: 'townhouse', group: 'ledgerholm', x: -366, z: -388, rot: rr(-PI * 0.25), seed: 171, style: 'ledgerholm', enter: true, role: 'home' },
  { id: 'lh_2', flip: true, arch: 'towerhouse', group: 'ledgerholm', x: -388.5, z: -366.5, rot: rr(PI * 0.75), seed: 172, style: 'ledgerholm', enter: true, role: 'work' },
  { id: 'lh_3', flip: true, arch: 'towerhouse', group: 'ledgerholm', x: -373.5, z: -394.3, rot: rr(-PI * 0.05), seed: 173, style: 'ledgerholm', enter: true, role: 'work' },
  { id: 'lh_4', flip: true, arch: 'townhouse', group: 'ledgerholm', x: -394, z: -374, rot: rr(PI * 0.55), seed: 174, style: 'ledgerholm', enter: true, role: 'home' },
  // Harrowmouth (5)
  { id: 'hm_1', arch: 'cottage', group: 'harrowmouth', x: 374, z: 72, rot: rr(PI * 0.5), seed: 191, style: 'harrowmouth', enter: true, role: 'home' },
  { id: 'hm_2', arch: 'longhouse', group: 'harrowmouth', x: 372, z: 84, rot: 0, seed: 192, style: 'harrowmouth', enter: true, role: 'work' },
  { id: 'hm_3', arch: 'townhouse', group: 'harrowmouth', x: 396, z: 68, rot: rr(PI), seed: 193, style: 'harrowmouth', enter: true, role: 'home' },
  { id: 'hm_4', arch: 'cottage', group: 'harrowmouth', x: 384, z: 100, rot: rr(PI * 1.5), seed: 194, style: 'harrowmouth', enter: true, role: 'home' },
  { id: 'hm_shop', arch: 'shop', variant: 'chandler', group: 'harrowmouth', x: 392, z: 92, rot: rr(-PI * 0.75), seed: 196, style: 'harrowmouth', enter: true, role: 'work' },
  // the Cinder Reach (5): the old stoneBlock sizes
  { id: 'rc_office', arch: 'works', group: 'reach', x: 444, z: -1211, rot: 0, seed: 321, style: 'reach', enter: true, role: 'work', w: 7, d: 5.5, h: 3.8, wins: 2, sideWins: 1, porch: true },
  { id: 'rc_store', arch: 'works', group: 'reach', x: 463, z: -1220, rot: 0, seed: 323, style: 'reach', enter: true, role: 'work', w: 12, d: 6, h: 4.4, wins: 4, sideWins: 2 },
  { id: 'rc_bunk', arch: 'works', group: 'reach', x: 451, z: -1186, rot: rr(PI), seed: 325, style: 'reach', enter: true, role: 'home', w: 9, d: 6, h: 4.2, wins: 3, sideWins: 1 },
  { id: 'rc_shop', arch: 'works', group: 'reach', x: 463, z: -1179, rot: rr(PI + 0.15), seed: 326, style: 'reach', enter: true, role: 'work', w: 8, d: 7, h: 4.6, wins: 2, sideWins: 2, chimney: 3.5 },
  { id: 'rc_pump', arch: 'works', group: 'reach', x: 440, z: -1190, rot: rr(PI / 2), seed: 329, style: 'reach', enter: true, role: 'work', w: 5, d: 4.5, h: 3.4, wins: 1, sideWins: 1 },
  // the Rime Steps (4)
  { id: 'rm_office', arch: 'works', group: 'rime', x: 444, z: -1643, rot: rr(face(RIME_C.x, RIME_C.z, 445, -1642.5)), seed: 421, style: 'rime', enter: true, role: 'work', w: 7, d: 5.5, h: 3.8, wins: 2, sideWins: 1, porch: true },
  { id: 'rm_store', arch: 'works', group: 'rime', x: 444, z: -1658.5, rot: rr(face(RIME_C.x, RIME_C.z, 444, -1658.5)), seed: 423, style: 'rime', enter: true, role: 'work', w: 10, d: 6, h: 4.4, wins: 3, sideWins: 1 },
  { id: 'rm_bunk', arch: 'works', group: 'rime', x: 450.8, z: -1634.1, rot: rr(face(RIME_C.x, RIME_C.z, 450.8, -1634.6)), seed: 425, style: 'rime', enter: true, role: 'home', w: 9, d: 6, h: 4.2, wins: 3, sideWins: 1 },
  { id: 'rm_shop', arch: 'works', group: 'rime', x: 478, z: -1652, rot: rr(face(RIME_C.x, RIME_C.z, 478, -1652)), seed: 426, style: 'rime', enter: true, role: 'work', w: 8, d: 7, h: 4.6, wins: 2, sideWins: 2, chimney: 3.5 },
  // the Windward Heights (3)
  { id: 'wh_bunk', arch: 'works', group: 'heights', x: 443, z: -2087.5, rot: rr(face(HEIGHTS_C.x, HEIGHTS_C.z, 443, -2087.5)), seed: 780, style: 'heights', enter: true, role: 'home', w: 9, d: 6, h: 4.0, wins: 3, sideWins: 1, chimney: 2.8 },
  { id: 'wh_store', arch: 'works', group: 'heights', x: 472, z: -2113.5, rot: rr(face(HEIGHTS_C.x, HEIGHTS_C.z, 472, -2113.5)), seed: 781, style: 'heights', enter: true, role: 'work', w: 8, d: 6, h: 4.2, wins: 2, sideWins: 1 },
  { id: 'wh_house', arch: 'works', group: 'heights', x: 474.5, z: -2091, rot: rr(face(HEIGHTS_C.x, HEIGHTS_C.z, 474.5, -2091)), seed: 782, style: 'heights', enter: true, role: 'work', w: 7, d: 6, h: 3.8, wins: 2, sideWins: 1 },
  // background houses (v109, not enterable): CGTrader models (CGT_SHELLS) standing whole, walls solid. The village, the
  // farms and Dunewatch Post (the desert houses, fronts toward the camp's middle)
  { id: 'bg_sv_shed', arch: 'cottage', group: 'village', x: -19, z: 37, rot: 0.2, seed: 901, style: 'sunmere', enter: false, shell: 'wooden_shed' },
  { id: 'bg_sv_red', arch: 'cottage', group: 'village', x: 59, z: 14, rot: rr(PI - 0.35), seed: 902, style: 'sunmere', enter: false, shell: 'red_cottage_bg' },
  { id: 'bg_bf_shed', arch: 'cottage', group: 'fields', x: 113, z: -9, rot: -0.2, seed: 903, style: 'farmland', enter: false, shell: 'wooden_shed' },
  { id: 'bg_wf_shed', arch: 'cottage', group: 'westfold', x: -198, z: 32, rot: 0.4, seed: 904, style: 'farmland', enter: false, shell: 'wooden_shed' },
  { id: 'bg_wf_farm', arch: 'cottage', group: 'westfold', x: -176, z: 42, rot: 0.4, seed: 905, style: 'farmland', enter: false, shell: 'farmhouse' },
  { id: 'bg_dw_1', arch: 'cottage', group: 'dunewatch', x: -20, z: 150, rot: rr(face(-40, 172, -20, 150)), seed: 906, style: 'sunmere', enter: false, shell: 'desert_house' },
  { id: 'bg_dw_2', arch: 'cottage', group: 'dunewatch', x: -14, z: 172, rot: rr(face(-40, 172, -14, 172)), seed: 907, style: 'sunmere', enter: false, shell: 'egypt_house_002' },
  { id: 'bg_dw_3', arch: 'cottage', group: 'dunewatch', x: -68, z: 165, rot: rr(face(-40, 172, -68, 165)), seed: 908, style: 'sunmere', enter: false, shell: 'egypt_house_005' },
  { id: 'bg_dw_4', arch: 'cottage', group: 'dunewatch', x: -64, z: 203, rot: rr(face(-40, 172, -64, 203)), seed: 909, style: 'sunmere', enter: false, shell: 'egypt_house_007' },
  // (v110) the rest of the Egyptian pack in the other desert towns and camps, fronts toward each place's middle: Brasswind
  // Dig (the dig office and a digger's house), Dustcloak Camp (an old house behind the palisade), the Sandsunk Ruins, Saltpan
  // Camp and the Kilnworks (outside the yard by the road's end)
  { id: 'bg_bw_1', arch: 'cottage', group: 'brasswind', x: 212, z: 168, rot: rr(face(196, 148, 212, 168)), seed: 910, style: 'sunmere', enter: false, shell: 'egypt_house_008' },
  { id: 'bg_bw_2', arch: 'cottage', group: 'brasswind', x: 172, z: 158, rot: rr(face(196, 148, 172, 158)), seed: 911, style: 'sunmere', enter: false, shell: 'egypt_house_001' },
  { id: 'bg_dc_1', arch: 'cottage', group: 'raidercamp', x: 112, z: 203.5, rot: rr(face(112, 232, 112, 203.5)), seed: 912, style: 'sunmere', enter: false, shell: 'egypt_house_004' },
  { id: 'bg_ss_1', arch: 'cottage', group: 'vaultruins', x: -150, z: 183, rot: rr(face(-148, 202, -150, 183)), seed: 913, style: 'sunmere', enter: false, shell: 'egypt_house_009' },
  { id: 'bg_sp_1', arch: 'cottage', group: 'saltcamp', x: -40, z: 402, rot: rr(face(-40, 385, -40, 402)), seed: 914, style: 'sunmere', enter: false, shell: 'egypt_house_006' },
  { id: 'bg_kw_1', arch: 'cottage', group: 'kilnworks', x: 38.5, z: 425, rot: rr(face(48, 406, 38.5, 425)), seed: 915, style: 'sunmere', enter: false, shell: 'egypt_house_003' },
];

// ------------------------------------------------------------------ CGTrader house shells (v109)
// Free Royalty Free models (tools/cgtrader/SOURCES.md), made game-ready by tools/cgtrader/finalize.py into
// client/assets/models/houses/<name>.glb: door to the front (+z), centred on the wall box, floor at y = 0. A site with
// `shell` takes the model's wall box as its footprint (w, d), its door (lx on the front wall; enterable shells have a
// 1.5 m door hole there and the game draws the open door, frame and steps), storeys, wall top and roof top (top, over
// the floor), and grows its cut box over the model's bounds (bx0..bz1, house space). mirror: the layout's mirror (the
// door's room on the door's side). rects: solid wall rects for a background house that is not a plain box (L-shapes).
export const CGT_SHELLS = {
  thatched_farm: { w: 7.614, d: 5.288, door: -1.774, mirror: -1, storeys: 1, wallTop: 2.9, top: 6.08, bx0: -4.123, bx1: 4.175, bz0: -2.985, bz1: 3.02 },
  thatched_cottage: { w: 6.7, d: 4.654, door: -1.561, mirror: -1, storeys: 1, wallTop: 2.6, top: 5.35, bx0: -3.629, bx1: 3.674, bz0: -2.627, bz1: 2.658 },
  red_cottage: { w: 4.39, d: 4.4, door: -0.765, mirror: 1, storeys: 2, wallTop: 5.8, top: 8.39, bx0: -2.897, bx1: 2.947, bz0: -3.255, bz1: 3.535 },
  red_cottage_bg: { w: 4.39, d: 4.4, storeys: 2, wallTop: 5.8, top: 8.39, bx0: -2.897, bx1: 2.947, bz0: -3.255, bz1: 3.535 },
  farmhouse: { w: 3.645, d: 5.993, storeys: 1, wallTop: 3.0, top: 5.757, bx0: -2.12, bx1: 4.746, bz0: -3.486, bz1: 3.462,
    rects: [[-1.85, -3.0, 1.85, 3.0], [4.13, -2.27, 4.43, -1.97], [4.13, 0.39, 4.43, 0.69]] }, // (v110) the house and the open porch's two outer posts
  wooden_shed: { w: 4.505, d: 5.477, storeys: 1, wallTop: 2.2, top: 4.326, bx0: -2.295, bx1: 2.295, bz0: -2.968, bz1: 2.848 },
  desert_house: { w: 6.719, d: 7.48, storeys: 2, wallTop: 5.6, top: 5.922, bx0: -3.61, bx1: 3.598, bz0: -3.952, bz1: 3.954,
    rects: [[-3.4, -3.75, 3.4, -1.2], [-1.0, -1.2, 3.4, 3.75], [-3.05, -1.2, -1.0, 1.1]] },
  egypt_house_002: { w: 7.84, d: 4.703, storeys: 1, wallTop: 3.0, top: 3.515, bx0: -4.06, bx1: 4.048, bz0: -2.352, bz1: 2.352 },
  egypt_house_005: { w: 8.569, d: 8.891, storeys: 1, wallTop: 2.9, top: 3.542, bx0: -4.285, bx1: 4.285, bz0: -4.445, bz1: 4.472,
    rects: [[-4.15, -4.3, 4.2, -0.8], [-0.4, -0.8, 4.2, 4.3]] },
  egypt_house_007: { w: 9.918, d: 9.43, storeys: 1, wallTop: 3.0, top: 3.706, bx0: -4.959, bx1: 4.959, bz0: -4.734, bz1: 4.715,
    rects: [[-4.85, -4.6, -0.6, 4.65], [-0.6, -1.1, 4.85, 4.65]] },
  // (v110) houses 1, 3, 4, 6, 8, 9 of the pack: w / d the main wall block, rects the solid walls with the roof stairs
  egypt_house_001: { w: 4.216, d: 5.458, storeys: 1, wallTop: 2.9, top: 3.416, bx0: -3.335, bx1: 2.257, bz0: -2.804, bz1: 4.36,
    rects: [[-3.45, -2.75, 2.25, 2.75], [-3.25, 2.75, -1.5, 4.3]] },
  egypt_house_003: { w: 8.642, d: 8.355, storeys: 1, wallTop: 2.9, top: 3.695, bx0: -4.321, bx1: 4.405, bz0: -4.178, bz1: 5.79,
    rects: [[-4.3, -4.15, 4.4, 0.5], [-4.3, 0.5, 1.0, 4.25], [-0.75, 4.25, 1.0, 5.75]] },
  egypt_house_004: { w: 8.877, d: 5.632, storeys: 1, wallTop: 2.9, top: 3.353, bx0: -4.438, bx1: 4.562, bz0: -2.816, bz1: 2.816,
    rects: [[-4.4, -2.8, 4.5, 1.75], [-4.4, 1.75, -0.25, 2.8]] },
  egypt_house_006: { w: 8.791, d: 5.601, storeys: 2, wallTop: 5.6, top: 6.074, bx0: -4.396, bx1: 4.409, bz0: -2.8, bz1: 2.807,
    rects: [[-4.4, -2.8, 4.4, 1.6], [-4.4, 1.6, 0.0, 2.8]] },
  egypt_house_008: { w: 7.425, d: 9.197, storeys: 2, wallTop: 5.8, top: 6.316, bx0: -3.891, bx1: 3.872, bz0: -4.599, bz1: 4.833,
    rects: [[-3.7, -4.6, 3.7, -0.5], [-3.25, -0.5, 3.55, 4.6]] },
  egypt_house_009: { w: 8.452, d: 8.593, storeys: 2, wallTop: 5.6, top: 6.098, bx0: -5.285, bx1: 4.226, bz0: -5.366, bz1: 4.296,
    rects: [[-4.25, -4.3, 4.2, 4.0], [-5.25, -5.35, 0.6, -4.3], [-5.25, -4.3, -4.25, -1.25]] },
};

// ------------------------------------------------------------------ region palettes (weighted [value, weight] lists)
// roof mats: slate, thatch, shingle, mossTile, terracotta, iron. forms: gableX, gableZ, hip, halfHip, flat.
// lower: stone, brick, none. upper: plaster, plank, ashlar, rubble. frame: none, posts, braced.
const DOORS = ['#4f6a4a', '#6e2e2a', '#4a5a72', '#8a6a48', '#a8843a', '#3a3a3c']; // green, oxblood, slate blue, natural, ochre, charcoal
const PLASTER = ['#efe6d2', '#e8d8b8', '#f2e2c8', '#ddd2bc', '#e6cfae', '#d8dcd0'];
export const STYLES = {
  sunmere: {
    roof: [[['slate', '#4a5a6e'], 3], [['slate', '#5a5e62'], 2], [['slate', '#4e6458'], 1], [['thatch', '#b89a62'], 3], [['shingle', '#7a5a40'], 3]],
    form: [['gableX', 4], ['halfHip', 3], ['hip', 2], ['gableZ', 2]],
    lower: [['stone', 4], ['brick', 1], ['none', 1]], upper: [['plaster', 6], ['plank', 1]],
    tint: PLASTER, frame: [['braced', 3], ['posts', 3], ['none', 2]], doors: DOORS, accent: ['#4a6a8a', '#5e7a4e', '#8a4a3a', '#6a6a72', '#8a7448'],
  },
  farmland: {
    roof: [[['thatch', '#b0925a'], 4], [['mossTile', '#5e6a46'], 3], [['shingle', '#6e5038'], 2], [['slate', '#545c60'], 1]],
    form: [['gableX', 4], ['halfHip', 3], ['hip', 2]],
    lower: [['stone', 5], ['none', 1]], upper: [['rubble', 3], ['plaster', 3], ['plank', 2]],
    tint: ['#d8ccb4', '#cbbfa8', '#e0d4bc', '#c8b898', '#d4c8b0', '#bfb4a0'], frame: [['posts', 3], ['none', 3], ['braced', 1]], doors: DOORS, accent: ['#5e7a4e', '#8a6a48', '#6e2e2a', '#7a6a50'],
  },
  ledgerholm: {
    roof: [[['slate', '#4a5260'], 5], [['slate', '#3e4650'], 3], [['shingle', '#5a4a3c'], 1]],
    form: [['gableX', 3], ['hip', 3], ['gableZ', 2], ['halfHip', 1]],
    lower: [['stone', 6]], upper: [['ashlar', 6], ['plaster', 1]],
    tint: ['#b8b4ac', '#a8a49c', '#c4beb2', '#9e9a94', '#b0aaa0', '#bcb8b0'], frame: [['none', 6], ['posts', 1]], doors: DOORS, accent: ['#4a5a72', '#3a3a3c', '#6e2e2a', '#5a6a5a'],
  },
  harrowmouth: {
    roof: [[['shingle', '#6a4a34'], 4], [['terracotta', '#a85a3a'], 3], [['terracotta', '#b8704a'], 2], [['slate', '#4a5660'], 1]],
    form: [['gableX', 4], ['gableZ', 2], ['hip', 2], ['halfHip', 1]],
    lower: [['stone', 3], ['none', 2]], upper: [['plank', 5], ['plaster', 2]],
    tint: ['#4a3e34', '#3e3630', '#5a4c40', '#e8e0d0', '#d8d0c0', '#6a5a4a'], frame: [['posts', 4], ['none', 2]], doors: DOORS, accent: ['#4a6a7a', '#8a4a3a', '#a8843a', '#4f6a4a'],
  },
  reach: {
    roof: [[['iron', '#4a4846'], 3], [['slate', '#5a5854'], 3]],
    form: [['flat', 5], ['gableX', 2], ['hip', 2]],
    lower: [['stone', 6]], upper: [['ashlar', 6]],
    tint: ['#9a948c', '#8e8880', '#a49e94', '#948e88'], frame: [['none', 6]], doors: ['#7a6450', '#5a4a3a', '#3a3a3c', '#6a5a48'], accent: ['#b08a3a', '#8a7a5a', '#6a6a6a'],
  },
  rime: {
    roof: [[['slate', '#4a5058'], 3], [['iron', '#4a4c50'], 2], [['shingle', '#5a4a3a'], 2]],
    form: [['flat', 3], ['gableX', 3], ['gableZ', 2], ['hip', 1]],
    lower: [['stone', 6]], upper: [['ashlar', 4], ['plank', 2]],
    tint: ['#a8acb0', '#9ca0a4', '#b4b6b8', '#8e9296'], frame: [['none', 5], ['posts', 1]], doors: ['#6a5a4a', '#4a5a72', '#3a3a3c', '#7a6450'], accent: ['#8a7a5a', '#6a7a8a', '#b08a3a'],
  },
  heights: {
    roof: [[['slate', '#4a5058'], 3], [['iron', '#4a4c50'], 2]],
    form: [['hip', 3], ['flat', 3], ['gableX', 2]],
    lower: [['stone', 6]], upper: [['ashlar', 4], ['rubble', 2]],
    tint: ['#b0aca4', '#a4a098', '#bcb6ac', '#9a968e'], frame: [['none', 6]], doors: ['#6a5a4a', '#3a3a3c', '#4a5a72'], accent: ['#b08a3a', '#6a6a6a'],
  },
};

// ------------------------------------------------------------------ random streams
export function houseRng(seed, stream = 1) {
  return mulberry32((Math.imul(seed | 0, 2654435761 | 0) + Math.imul(stream | 0, 0x9e3779b9 | 0)) >>> 0);
}
const between = (r, a, b) => a + (b - a) * r();
const pickW = (r, list) => {
  let t = 0; for (const [, w] of list) t += w;
  let u = r() * t;
  for (const [v, w] of list) { u -= w; if (u <= 0) return v; }
  return list[list.length - 1][0];
};
const pick = (r, list) => list[Math.min(list.length - 1, Math.floor(r() * list.length))];
const q = (v) => Math.round(v * 1000) / 1000; // keep the JSON tidy and stable

// ------------------------------------------------------------------ rect helpers (local, {x0, z0, x1, z1})
const rect = (x0, z0, x1, z1) => ({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
const rectC = (cx, cz, w, d) => rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
const inRect = (R, x, z, pad = 0) => x > R.x0 - pad && x < R.x1 + pad && z > R.z0 - pad && z < R.z1 + pad;
const rectDist = (R, x, z) => { const dx = Math.max(R.x0 - x, 0, x - R.x1), dz = Math.max(R.z0 - z, 0, z - R.z1); return Math.hypot(dx, dz); };
const area = (R) => (R.x1 - R.x0) * (R.z1 - R.z0);
// a partition along z at x = px (from z0 to z1) with a gap centred on gc, or along x at z = pz
function partAlongZ(px, z0, z1, gc) {
  const out = [], a = gc - PART_GAP / 2, b = gc + PART_GAP / 2;
  if (a - z0 > 0.05) out.push(rect(px - PART_T / 2, z0, px + PART_T / 2, a));
  if (z1 - b > 0.05) out.push(rect(px - PART_T / 2, b, px + PART_T / 2, z1));
  return out;
}
function partAlongX(pz, x0, x1, gc) {
  const out = [], a = gc - PART_GAP / 2, b = gc + PART_GAP / 2;
  if (a - x0 > 0.05) out.push(rect(x0, pz - PART_T / 2, a, pz + PART_T / 2));
  if (x1 - b > 0.05) out.push(rect(b, pz - PART_T / 2, x1, pz + PART_T / 2));
  return out;
}

// ------------------------------------------------------------------ archetype shape rules (canonical, before the mirror)
// Each returns { w, d, storeys, wallTop, attic, door, rooms, parts, ext, winRows, chimney, forms, gaps } in local space.
// door: { face: 'front' | 'side', t } where t is the offset along the wall (x for the front, z for the +x side).
function frontWindows(G, r, faceName, rows) {
  // windows on one face, kept clear of the door, the corners and where partitions meet the wall
  const out = [], len = faceName === 'front' || faceName === 'back' ? G.w : G.d;
  const half = len / 2 - 0.75;
  const blocked = []; // [centre along the face, half width, blocks the upper rows too]
  if (G.door.face === 'front' && faceName === 'front') blocked.push([G.door.t, DOOR_W / 2 + 0.45, false]);
  if (G.door.face === 'side' && faceName === 'right') blocked.push([G.door.t, DOOR_W / 2 + 0.45, false]);
  for (const P of G.parts) { // partition ends touching this face
    if (faceName === 'front' && P.z1 > G.d / 2 - WALL_T - 0.05) blocked.push([(P.x0 + P.x1) / 2, 0.6, true]);
    if (faceName === 'back' && P.z0 < -G.d / 2 + WALL_T + 0.05) blocked.push([(P.x0 + P.x1) / 2, 0.6, true]);
    if (faceName === 'left' && P.x0 < -G.w / 2 + WALL_T + 0.05) blocked.push([(P.z0 + P.z1) / 2, 0.6, true]);
    if (faceName === 'right' && P.x1 > G.w / 2 - WALL_T - 0.05) blocked.push([(P.z0 + P.z1) / 2, 0.6, true]);
  }
  const C = G.chimney; // a wall stack runs the full height of its wall
  if (C && C.face === faceName) blocked.push([C.lz, C.w / 2 + 0.3, true]);
  const doorHere = (G.door.face === 'front' && faceName === 'front') || (G.door.face === 'side' && faceName === 'right');
  for (const row of rows) {
    const ww = row.w, n = Math.max(1, Math.floor((len - 1.2) / (ww + 1.3)));
    const want = Math.min(n, row.n ?? n);
    const rowOut = [];
    for (let i = 0; i < want; i++) {
      const t = want === 1 ? (r() - 0.5) * 0.4 * half : -half + ww / 2 + (i / (want - 1)) * (2 * half - ww);
      if (Math.abs(t) > half - ww / 2 + 0.01) continue;
      if (blocked.some(([c, h, all]) => (all || row.y < DOOR_H + 0.3) && Math.abs(t - c) < h + ww / 2)) continue;
      rowOut.push({ face: faceName, t, y: row.y, w: ww, h: row.h });
    }
    // content rule (review fix): two upper windows evenly either side of the door read as a face (eyes over a mouth).
    // Add a third window straight over the door when it fits, otherwise drop one of the pair. No random draws here.
    if (doorHere && row.y >= DOOR_H + 0.3 && rowOut.length === 2) {
      const dt = G.door.t, [a, b] = rowOut;
      if ((a.t - dt) * (b.t - dt) < 0 && Math.abs((a.t + b.t) / 2 - dt) < 1.2 && Math.min(Math.abs(a.t - dt), Math.abs(b.t - dt)) > 0.8) {
        const fits = Math.min(Math.abs(a.t - dt), Math.abs(b.t - dt)) >= ww + 0.35 && !blocked.some(([c, h, all]) => all && Math.abs(dt - c) < h + ww / 2);
        if (fits) rowOut.splice(1, 0, { face: faceName, t: dt, y: row.y, w: ww, h: row.h });
        else rowOut.splice(Math.abs(a.t - dt) < Math.abs(b.t - dt) ? 0 : 1, 1);
      }
    }
    out.push(...rowOut);
  }
  return out;
}

// the chimney (canonical local space): a stack straddling the left or right wall, or (ridge) a hearth pit in the main hall
function placeChimney(G, wide = 0.9) {
  const C = G.chimney; if (!C) return;
  const w = G.w, d = G.d, X0 = -w / 2 + WALL_T, X1 = w / 2 - WALL_T;
  const din = G.door.face === 'front' ? [G.door.t, d / 2 - 1.2] : [w / 2 - 1.2, G.door.t];
  const main = G.rooms.find((R) => inRect(R, din[0], din[1])) || G.rooms[0];
  C.w = wide;
  if (C.at === 'ridge') {
    const mcz = (main.z0 + main.z1) / 2, off = G.door.t > mcz ? -1.7 : 1.7;
    C.face = null; C.lx = -0.5; C.lz = Math.max(main.z0 + 1.3, Math.min(main.z1 - 1.3, mcz + off)); C.w = 1.3;
    return;
  }
  const sx = C.at === 'gableL' ? -1 : C.at === 'gableR' ? 1 : C.side || (G.door.face === 'front' ? (G.door.t >= 0 ? -1 : 1) : -1);
  const touch = G.rooms.filter((R) => (sx < 0 ? R.x0 <= X0 + 0.01 : R.x1 >= X1 - 0.01));
  const pref = C.at === 'side' ? ['back', 'work', 'main', 'shop', 'bed'] : ['main', 'back', 'work', 'shop', 'bed'];
  touch.sort((a, b) => pref.indexOf(a.kind) - pref.indexOf(b.kind));
  const R = touch[0] || main;
  C.face = sx < 0 ? 'left' : 'right'; C.lx = sx * (w / 2 - WALL_T / 2);
  const lo = R.z0 + wide / 2 + 0.35, hi = R.z1 - wide / 2 - 0.35;
  C.lz = C.at === 'side' && lo <= hi ? Math.max(lo, Math.min(hi, R.z0 + 0.9)) : (R.z0 + R.z1) / 2;
}

const ov = (drawn, size) => size || drawn; // (v109) a site's size wins, after the draw (the stream never moves)
function shapeOf(site, r) {
  const A = site.arch;
  const G = { w: 6, d: 5, storeys: 1, attic: false, door: { face: 'front', t: 0 }, rooms: [], parts: [], ext: [], windows: [], chimney: null, forms: null };
  const X0 = () => -G.w / 2 + WALL_T, X1 = () => G.w / 2 - WALL_T, Z0 = () => -G.d / 2 + WALL_T, Z1 = () => G.d / 2 - WALL_T;
  const gw = (y) => ({ y, w: 0.9, h: 1.1 }); // a ground-storey window row (centre y)
  // the door on the front, kept inside [lo, hi] (along x) and clear of the corners
  const frontDoor = (lo, hi) => {
    const a = Math.max(lo + 0.85, X0() + 0.4 + DOOR_W / 2), b = Math.min(hi - 0.85, X1() - 0.4 - DOOR_W / 2);
    G.door = { face: 'front', t: a <= b ? between(r, a, b) : (lo + hi) / 2 };
  };
  if (A === 'cottage') {
    G.w = ov(between(r, 5.5, 6.8), site.w); G.d = ov(between(r, 4.4, 5.2), site.d); G.attic = true;
    const iw = X1() - X0(), id = Z1() - Z0();
    const bedW = Math.max(2.4, 9.3 / id), mainW = iw - bedW - PART_T;
    if (mainW >= 3.2 && mainW * id >= 12) {
      const px = X0() + bedW + PART_T / 2; // bed room on -x, main on +x
      G.parts.push(...partAlongZ(px, Z0(), Z1(), Z0() + 0.35 + PART_GAP / 2 + r() * Math.max(0, id - PART_GAP - 0.7 - 1.7)));
      G.rooms.push({ kind: 'main', ...rect(px + PART_T / 2, Z0(), X1(), Z1()) }, { kind: 'bed', ...rect(X0(), Z0(), px - PART_T / 2, Z1()) });
      frontDoor(px + PART_T / 2, X1());
    } else { G.rooms.push({ kind: 'main', ...rect(X0(), Z0(), X1(), Z1()) }); frontDoor(X0(), X1()); }
    G.forms = ['gableX', 'halfHip'];
    if (r() < 0.5) G.ext.push({ kind: 'dormer', face: 'front', lx: between(r, -G.w * 0.2, G.w * 0.2), lz: G.d * 0.22, w: 1.3, d: 1.2, h: 1.1 });
    if (r() < 0.4) { const lw = G.d * 0.7; G.ext.push({ kind: 'leanTo', face: 'left', lx: -G.w / 2 - 0.9, lz: -G.d / 2 + lw / 2 + 0.2, w: 1.8, d: lw, h: 2.2, solid: true }); }
    if (r() < 0.35) G.ext.push({ kind: 'porch', face: 'front', lx: G.door.t, lz: G.d / 2 + 0.7, w: 2.4, d: 1.4, h: 2.45, open: true });
    G.chimney = { at: r() < 0.5 ? 'gableL' : 'gableR' }; placeChimney(G);
    G.windows.push(...frontWindows(G, r, 'front', [gw(1.55)]), ...frontWindows(G, r, 'back', [{ ...gw(1.55), n: 1 }]), ...frontWindows(G, r, 'right', [{ ...gw(1.55), n: 1 }]));
    // content rule (review fix): a dormer straight over the door, between two windows, reads as a face; slide it to the
    // far side of the roof (no random draw, so nothing else moves)
    const dm = G.ext.find((E) => E.kind === 'dormer');
    if (dm && Math.abs(dm.lx - G.door.t) < 0.9) dm.lx = G.door.t >= 0 ? -G.w * 0.2 : G.w * 0.2;
  } else if (A === 'townhouse') {
    G.w = ov(between(r, 5, 6), site.w); G.d = ov(between(r, 6, 7.5), site.d); G.storeys = 2;
    const iw = X1() - X0(), id = Z1() - Z0();
    const backD = Math.max(2.3, 9.3 / iw), frontD = id - backD - PART_T;
    if (frontD >= 2.9) {
      const pz = Z0() + backD + PART_T / 2;
      G.parts.push(...partAlongX(pz, X0(), X1(), (r() < 0.5 ? -1 : 1) * Math.max(0, iw / 2 - PART_GAP / 2 - 0.45) * between(r, 0.4, 1)));
      G.rooms.push({ kind: 'shop', ...rect(X0(), pz + PART_T / 2, X1(), Z1()) }, { kind: 'back', ...rect(X0(), Z0(), X1(), pz - PART_T / 2) });
    } else G.rooms.push({ kind: 'shop', ...rect(X0(), Z0(), X1(), Z1()) });
    frontDoor(X0(), X1());
    G.forms = ['gableX', 'gableZ', 'hip'];
    G.ext.push({ kind: 'jetty', face: 'front', lx: 0, lz: G.d / 2 + 0.25, w: G.w, d: 0.5, h: WALL_H });
    const stair = r() < 0.4;
    G.chimney = { at: 'side', side: 1 }; placeChimney(G); // the kitchen hearth in the back room, on the wall away from any outside stair
    const upper = { y: WALL_H + 1.45, w: 0.85, h: 1.0 };
    G.windows.push(...frontWindows(G, r, 'front', [gw(1.55), upper]), ...frontWindows(G, r, 'back', [{ ...gw(1.55), n: 1 }, { ...upper, n: 2 }]));
    if (stair) { const L = Math.min(3.2, G.d - 1.2); G.ext.push({ kind: 'outStair', face: 'left', lx: -G.w / 2 - 0.5, lz: -G.d / 2 + L / 2 + 0.3, w: 1.0, d: L, h: WALL_H, solid: true }); }
    else G.windows.push(...frontWindows(G, r, 'left', [{ ...upper, n: 1 }]));
    // a bay on one ground-floor front window (that window goes)
    const gwins = G.windows.filter((W) => W.face === 'front' && W.y < 2);
    if (gwins.length && r() < 0.35) { const W = gwins[0]; G.windows.splice(G.windows.indexOf(W), 1); G.ext.push({ kind: 'bay', face: 'front', lx: W.t, lz: G.d / 2 + 0.3, w: 1.6, d: 0.6, h: 2.2, solid: true }); }
  } else if (A === 'longhouse') {
    G.w = 4.8; G.d = between(r, 9, 12);
    const iw = X1() - X0(), id = Z1() - Z0();
    const endD = Math.max(2.4, 9.3 / iw);
    const pz = Z0() + endD + PART_T / 2;
    G.parts.push(...partAlongX(pz, X0(), X1(), between(r, -0.6, 0.6)));
    G.rooms.push({ kind: 'main', ...rect(X0(), pz + PART_T / 2, X1(), Z1()) }, { kind: 'bed', ...rect(X0(), Z0(), X1(), pz - PART_T / 2) });
    const lo = pz + PART_T / 2 + 0.85, hi = Z1() - 0.85;
    G.door = { face: 'side', t: lo <= hi ? between(r, lo + (hi - lo) * 0.3, hi - (hi - lo) * 0.3) : (lo + hi) / 2 };
    G.forms = ['hip', 'gableZ'];
    G.ext.push({ kind: 'porch', face: 'right', lx: G.w / 2 + 0.8, lz: G.door.t, w: 1.6, d: Math.min(G.d * 0.6, 6), h: 2.4, open: true });
    G.chimney = { at: 'ridge' }; placeChimney(G);
    G.windows.push(...frontWindows(G, r, 'right', [gw(1.5)]), ...frontWindows(G, r, 'left', [gw(1.5)]), ...frontWindows(G, r, 'front', [{ ...gw(1.5), n: 1 }]));
  } else if (A === 'smithy') {
    G.w = 6; G.d = 5;
    G.rooms.push({ kind: 'work', ...rect(X0(), Z0(), X1(), Z1()) }); frontDoor(X0(), X1());
    G.forms = ['gableX', 'halfHip'];
    G.ext.push({ kind: 'leanTo', face: 'right', lx: G.w / 2 + 2, lz: 0, w: 4, d: G.d, h: 2.6, open: true });
    G.chimney = { at: 'side' }; placeChimney(G, 1.2);
    G.windows.push(...frontWindows(G, r, 'front', [{ ...gw(1.55), n: 1 }]), ...frontWindows(G, r, 'back', [{ ...gw(1.55), n: 1 }]));
  } else if (A === 'shop') {
    G.w = between(r, 6, 7); G.d = between(r, 6, 6.8); G.attic = true;
    const iw = X1() - X0(), id = Z1() - Z0();
    const backD = Math.max(2.2, 9.3 / iw), pz = Z0() + backD + PART_T / 2;
    G.parts.push(...partAlongX(pz, X0(), X1(), (r() < 0.5 ? -1 : 1) * between(r, 0.4, Math.max(0.5, iw / 2 - PART_GAP / 2 - 0.45))));
    G.rooms.push({ kind: 'shop', ...rect(X0(), pz + PART_T / 2, X1(), Z1()) }, { kind: site.variant === 'bakery' ? 'work' : 'back', ...rect(X0(), Z0(), X1(), pz - PART_T / 2) });
    // the door off to one side; the shopfront counter takes the other side of the front
    frontDoor(X0(), X0() + iw * 0.55);
    G.forms = ['gableX', 'halfHip', 'hip'];
    const sc = (G.door.t + DOOR_W / 2 + X1()) / 2 + 0.1, sw = Math.min(2.4, X1() - (G.door.t + DOOR_W / 2) - 0.7);
    if (sw > 1.2) G.ext.push({ kind: 'shopfront', face: 'front', lx: sc, lz: G.d / 2 + 0.25, w: sw, d: 0.5, h: 1.0, solid: true });
    G.chimney = { at: site.variant === 'bakery' ? 'side' : r() < 0.5 ? 'gableL' : 'gableR' }; placeChimney(G, site.variant === 'bakery' ? 1.3 : 0.9);
    G.windows.push(...frontWindows(G, r, 'back', [{ ...gw(1.55), n: 1 }]), ...frontWindows(G, r, 'left', [{ ...gw(1.55), n: 1 }]));
    if (sw > 1.2) G.windows.push({ face: 'front', t: sc - 0.1, y: 1.65, w: sw, h: 1.0 }); // the opening above the counter
  } else if (A === 'farmhouse') {
    G.w = ov(between(r, 7, 8), site.w); G.d = ov(between(r, 5, 5.6), site.d); G.storeys = r() < 0.4 ? 2 : 1; G.attic = G.storeys === 1;
    const iw = X1() - X0(), id = Z1() - Z0();
    const bedW = Math.max(2.4, 9.3 / id), px = X0() + bedW + PART_T / 2;
    G.parts.push(...partAlongZ(px, Z0(), Z1(), Z0() + 0.35 + PART_GAP / 2 + r() * Math.max(0, id - PART_GAP - 0.7 - 1.7)));
    G.rooms.push({ kind: 'main', ...rect(px + PART_T / 2, Z0(), X1(), Z1()) }, { kind: 'bed', ...rect(X0(), Z0(), px - PART_T / 2, Z1()) });
    frontDoor(px + PART_T / 2, X1());
    G.forms = ['gableX', 'halfHip', 'hip'];
    const back = r() < 0.5;
    if (back) G.ext.push({ kind: 'leanTo', face: 'back', lx: between(r, -G.w * 0.15, G.w * 0.15), lz: -G.d / 2 - 1.0, w: G.w * 0.6, d: 2.0, h: 2.3, solid: true });
    else G.ext.push({ kind: 'leanTo', face: 'right', lx: G.w / 2 + 1.0, lz: -G.d * 0.12, w: 2.0, d: G.d * 0.7, h: 2.3, solid: true });
    if (r() < 0.4) G.ext.push({ kind: 'porch', face: 'front', lx: G.door.t, lz: G.d / 2 + 0.7, w: 2.4, d: 1.4, h: 2.45, open: true });
    const rows = G.storeys === 2 ? [gw(1.55), { y: WALL_H + 1.45, w: 0.85, h: 1.0 }] : [gw(1.55)];
    G.chimney = { at: r() < 0.5 ? 'gableL' : 'gableR' }; placeChimney(G);
    G.windows.push(...frontWindows(G, r, 'front', rows), ...frontWindows(G, r, back ? 'left' : 'back', [{ ...gw(1.55), n: 1 }]));
  } else if (A === 'towerhouse') {
    G.w = 4.5; G.d = 4.5; G.storeys = 3;
    G.rooms.push({ kind: 'main', ...rect(X0(), Z0(), X1(), Z1()) });
    G.door = { face: 'front', t: between(r, -0.25, 0.25) };
    G.forms = ['hip'];
    G.ext.push({ kind: 'outStair', face: 'left', lx: -G.w / 2 - 0.8, lz: -G.d / 2 + 0.8, w: 1.6, d: 1.6, h: WALL_H * 3 + 1.2, solid: true }); // the stair turret
    G.ext.push({ kind: 'porch', face: 'front', lx: G.door.t, lz: G.d / 2 + 0.65, w: 2.3, d: 1.3, h: 2.5, open: true });
    G.chimney = { at: 'side', side: 1 }; placeChimney(G);
    const slit = (y) => ({ y, w: 0.35, h: 0.9 });
    G.windows.push(...frontWindows(G, r, 'front', [{ ...slit(WALL_H + 1.45), n: 1 }, { ...slit(WALL_H * 2 + 1.45), n: 1 }]));
    for (const f of ['back', 'right']) G.windows.push(...frontWindows(G, r, f, [{ ...slit(1.6), n: 1 }, { ...slit(WALL_H + 1.45), n: 1 }, { ...slit(WALL_H * 2 + 1.45), n: 1 }]));
  } else { // works: the island stone blocks, at their old sizes
    G.w = site.w || between(r, 6, 9); G.d = site.d || between(r, 5, 6.5);
    const iw = X1() - X0(), id = Z1() - Z0();
    if (iw >= 7.5) {
      const backW = Math.max(2.6, 9.3 / id), px = X0() + backW + PART_T / 2;
      G.parts.push(...partAlongZ(px, Z0(), Z1(), Z0() + 0.35 + PART_GAP / 2 + r() * Math.max(0, id - PART_GAP - 0.7 - 1.7)));
      G.rooms.push({ kind: 'main', ...rect(px + PART_T / 2, Z0(), X1(), Z1()) }, { kind: 'back', ...rect(X0(), Z0(), px - PART_T / 2, Z1()) });
      frontDoor(px + PART_T / 2, X1());
    } else { G.rooms.push({ kind: 'main', ...rect(X0(), Z0(), X1(), Z1()) }); frontDoor(X0(), X1()); }
    G.forms = ['flat', 'gableX', 'hip'];
    if (site.porch) G.ext.push({ kind: 'porch', face: 'front', lx: G.door.t, lz: G.d / 2 + 1.1, w: 3.4, d: 2.2, h: 2.8, open: true });
    else if (r() < 0.25) { const lw = G.d * 0.6; G.ext.push({ kind: 'leanTo', face: 'left', lx: -G.w / 2 - 0.9, lz: -G.d / 2 + lw / 2 + 0.2, w: 1.8, d: lw, h: 2.4, solid: true }); }
    G.chimney = site.chimney ? { at: 'side', h: site.chimney } : null; placeChimney(G, 1.2);
    G.windows.push(...frontWindows(G, r, 'front', [{ ...gw(1.75), n: site.wins || 2 }]));
    for (const f of ['left', 'right']) G.windows.push(...frontWindows(G, r, f, [{ y: 1.75, w: 0.8, h: 1.1, n: site.sideWins || 1 }]));
  }
  G.wallTop = A === 'works' ? site.h || 4.2 : G.storeys * WALL_H;
  return G;
}

// ------------------------------------------------------------------ the full spec
var SPEC_BY_ID = null, SPEC_BY_KEY = null, ALL = null, HASH = null, _ready = false;

function localToWorld(S, lx, lz) { const c = Math.cos(S.rot), s = Math.sin(S.rot); return [S.x + lx * c + lz * s, S.z - lx * s + lz * c]; }
function worldToLocal(S, x, z) { const c = Math.cos(S.rot), s = Math.sin(S.rot), dx = x - S.x, dz = z - S.z; return [dx * c - dz * s, dx * s + dz * c]; }
function rectToBox(S, R) { const [x, z] = localToWorld(S, (R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2); return { x: q(x), z: q(z), hw: q((R.x1 - R.x0) / 2), hd: q((R.z1 - R.z0) / 2), rot: S.rot }; }

function buildSpec(site) {
  const r = houseRng(site.seed, 1), look = houseRng(site.seed, 2);
  const SH = site.shell ? CGT_SHELLS[site.shell] : null;
  if (SH) site = { ...site, w: SH.w, d: SH.d };
  const G = shapeOf(site, r);
  if (SH) { G.ext = []; G.windows = []; G.storeys = SH.storeys || 1; G.attic = false; G.wallTop = SH.wallTop; } // (a model: no extensions, its own windows)
  // mirror: front-door houses flip x, side-door houses (the longhouse) flip z so the door stays on the +x side
  // (site.flip turns the draw over without drawing another number: Ledgerholm's turned houses keep their stairs on the old side)
  const mirror0 = (r() < 0.5 ? -1 : 1) * (site.flip ? -1 : 1), mirror = SH?.mirror || mirror0;
  if (SH && SH.door != null) G.door = { face: 'front', t: SH.door * mirror }; // (lx = t * mirror: the model's door)
  const mx = G.door.face === 'side' ? 1 : mirror, mz = G.door.face === 'side' ? mirror : 1;
  const fr = (R) => rect(R.x0 * mx, R.z0 * mz, R.x1 * mx, R.z1 * mz);
  const ff = (f) => (mx < 0 && f === 'left' ? 'right' : mx < 0 && f === 'right' ? 'left' : mz < 0 && f === 'front' ? 'back' : mz < 0 && f === 'back' ? 'front' : f);
  const normal = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] };
  const { w, d } = G;
  // door: centre on the wall's middle line
  const door = G.door.face === 'front'
    ? { lx: G.door.t * mx, lz: d / 2 - WALL_T / 2, w: DOOR_W, h: DOOR_H, face: 'front', nx: 0, nz: 1 }
    : { lx: w / 2 - WALL_T / 2, lz: G.door.t * mz, w: DOOR_W, h: DOOR_H, face: 'side', nx: 1, nz: 0 };
  const windows = G.windows.map((W) => {
    const f = ff(W.face), [nx, nz] = normal[f];
    const along = W.face === 'front' || W.face === 'back' ? W.t * mx : W.t * mz;
    const lx = nx ? nx * (w / 2 - WALL_T / 2) : along, lz = nz ? nz * (d / 2 - WALL_T / 2) : along;
    return { face: f, lx: q(lx), lz: q(lz), nx, nz, y: q(W.y), w: q(W.w), h: q(W.h) };
  });
  const ext = G.ext.map((E) => {
    const o = { kind: E.kind, face: ff(E.face), lx: q(E.lx * mx), lz: q(E.lz * mz), w: q(E.w), d: q(E.d), h: q(E.h) };
    if (E.solid) o.solid = true;
    if (E.open) { o.open = true; const R = rectC(o.lx, o.lz, o.w, o.d), [nx, nz] = normal[o.face]; o.posts = []; // posts on the outer corners
      if (nx) for (const zz of [R.z0 + 0.12, R.z1 - 0.12]) o.posts.push([q(nx > 0 ? R.x1 - 0.12 : R.x0 + 0.12), q(zz)]);
      else for (const xx of [R.x0 + 0.12, R.x1 - 0.12]) o.posts.push([q(xx), q(nz > 0 ? R.z1 - 0.12 : R.z0 + 0.12)]); }
    return o;
  });
  const rooms = G.rooms.map((R) => ({ kind: R.kind, ...roundR(fr(R)) }));
  const parts = G.parts.map((R) => roundR(fr(R)));
  const inner = roundR(rect(-w / 2 + WALL_T, -d / 2 + WALL_T, w / 2 - WALL_T, d / 2 - WALL_T));
  const foot = roundR(rect(-w / 2, -d / 2, w / 2, d / 2));
  // the 1.6 m square kept clear inside the door
  const doorZone = roundR(door.face === 'front' ? rect(door.lx - 0.8, inner.z1 - 1.6, door.lx + 0.8, inner.z1) : rect(inner.x1 - 1.6, door.lz - 0.8, inner.x1, door.lz + 0.8));
  // palette (stream 2)
  const P = STYLES[site.style] || STYLES.sunmere;
  const forms = G.forms.filter((f) => P.form.some(([v]) => v === f));
  const formList = forms.length ? P.form.filter(([v]) => forms.includes(v)) : [[G.forms[0], 1]];
  const [rmat, rtint] = pickW(look, P.roof);
  const form = pickW(look, formList);
  const span = form === 'gableZ' ? w : Math.min(w, d);
  const steep = site.style === 'rime' ? 0.68 : site.style === 'heights' ? 0.55 : rmat === 'thatch' ? 0.6 : 0.46;
  const roof = { form, mat: form === 'flat' ? (rmat === 'thatch' ? 'slate' : rmat) : rmat, tint: rtint, rise: q(SH ? SH.top - SH.wallTop : form === 'flat' ? 0 : span * steep) };
  const wall = { lower: pickW(look, P.lower), upper: pickW(look, P.upper), tint: pick(look, P.tint), frame: site.arch === 'towerhouse' || site.arch === 'works' ? 'none' : pickW(look, P.frame) };
  if (wall.upper === 'ashlar' || wall.upper === 'rubble') wall.frame = 'none';
  const doorColor = pick(look, P.doors), accent = pick(look, P.accent);
  // chimney position (local, already mirrored)
  let chimney = null;
  if (G.chimney) {
    const C = G.chimney, at = C.at === 'gableL' ? (mx < 0 ? 'gableR' : 'gableL') : C.at === 'gableR' ? (mx < 0 ? 'gableL' : 'gableR') : C.at;
    // face: the wall it stands in ('left' | 'right'; null for a hearth pit under the ridge); w: the stack's square side
    chimney = { at, face: C.face ? ff(C.face) : null, lx: q(C.lx * mx), lz: q(C.lz * mz), w: q(C.w), h: q(C.h || 1.4) };
  }
  const S = {
    id: site.id, arch: site.arch, group: site.group, style: site.style || 'sunmere', x: site.x, z: site.z, rot: site.rot, seed: site.seed, mirror, enter: site.enter !== false, shell: site.shell || null,
    role: site.role || 'home', variant: site.variant || null, job: site.job || null, area: islandAt(site.x, site.z)?.id || 'valley',
    w: q(w), d: q(d), storeys: G.storeys, attic: G.attic, wallH: WALL_H, wallTop: q(G.wallTop), floorY: 0, cutY: 0,
    roof, wall, doorColor, accent, chimney, door: { ...door, lx: q(door.lx), lz: q(door.lz) }, windows, ext, rooms, parts, inner, foot, doorZone,
    walls: [], cutBox: null, spots: [], doorAt: null, doorIn: null, doorOut: null, stepY: 0, stepLen: STEP,
  };
  // floor: the highest ground under the house (a 5 x 5 grid over the footprint and the doorstep) + 0.3
  let top = -Infinity;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const [x, z] = localToWorld(S, -w / 2 + (w * i) / 4, -d / 2 + (d * j) / 4); top = Math.max(top, heightAt(x, z)); }
  S.floorY = q(top + 0.3); S.cutY = q(S.floorY + 2.75);
  const dw = (u) => localToWorld(S, door.lx + door.nx * u, door.lz + door.nz * u);
  { const [x, z] = dw(0); S.doorAt = { x: q(x), z: q(z) }; }
  { const [x, z] = dw(-WALL_T / 2 - 0.9); S.doorIn = { x: q(x), z: q(z) }; }
  { const [x, z] = dw(WALL_T / 2 + 1.2); S.doorOut = { x: q(x), z: q(z) }; }
  // the doorstep ramp: 0.9 m, longer where the ground falls away more than 0.55 m (at most 2.4 m, about 1 in 1.4)
  { const g = (u) => { const [x, z] = dw(u); return heightAt(x, z); };
    const drop = S.floorY - g(WALL_T / 2 + STEP);
    S.stepLen = q(Math.min(2.4, Math.max(STEP, drop / 0.6)));
    S.stepY = q(g(WALL_T / 2 + S.stepLen)); }
  // walls: four outer walls (the door's wall in two pieces), partitions, solid extensions and porch posts
  const L = [];
  const front = rect(-w / 2, d / 2 - WALL_T, w / 2, d / 2), back = rect(-w / 2, -d / 2, w / 2, -d / 2 + WALL_T);
  const left = rect(-w / 2, -d / 2 + WALL_T, -w / 2 + WALL_T, d / 2 - WALL_T), right = rect(w / 2 - WALL_T, -d / 2 + WALL_T, w / 2, d / 2 - WALL_T);
  if (!S.enter) L.push(...(SH?.rects ? SH.rects.map(([a, b, c, e]) => rect(a, b, c, e)) : [foot]));
  else if (door.face === 'front') { L.push(rect(-w / 2, front.z0, door.lx - DOOR_W / 2, front.z1), rect(door.lx + DOOR_W / 2, front.z0, w / 2, front.z1), back, left, right); }
  else { L.push(front, back, left, rect(right.x0, right.z0, right.x1, door.lz - DOOR_W / 2), rect(right.x0, door.lz + DOOR_W / 2, right.x1, right.z1)); }
  if (S.enter) L.push(...parts);
  for (const E of ext) {
    if (E.solid) L.push(rectC(E.lx, E.lz, E.w, E.d));
    for (const [px, pz] of E.posts || []) L.push(rectC(px, pz, 0.24, 0.24));
  }
  S.walls = L.filter((R) => R.x1 - R.x0 > 0.02 && R.z1 - R.z0 > 0.02).map((R) => rectToBox(S, R));
  S.wallRects = L.filter((R) => R.x1 - R.x0 > 0.02 && R.z1 - R.z0 > 0.02).map(roundR); // the same boxes in local space (for builders and tests)
  // cut-away box: the footprint, the extensions and 0.6 m of eaves
  let B = { ...foot };
  for (const E of ext) { const R = rectC(E.lx, E.lz, E.w, E.d); B = rect(Math.min(B.x0, R.x0), Math.min(B.z0, R.z0), Math.max(B.x1, R.x1), Math.max(B.z1, R.z1)); }
  B = rect(B.x0 - 0.6, B.z0 - 0.6, B.x1 + 0.6, B.z1 + 0.6);
  if (SH) B = rect(Math.min(B.x0, SH.bx0 - 0.1), Math.min(B.z0, SH.bz0 - 0.1), Math.max(B.x1, SH.bx1 + 0.1), Math.max(B.z1, SH.bz1 + 0.1)); // (the model's eaves and porch)
  S.cutBox = rectToBox(S, B);
  S.cutRect = roundR(B);
  if (S.enter) S.spots = placeSpots(S, r);
  return S;
}
const roundR = (R) => ({ x0: q(R.x0), z0: q(R.z0), x1: q(R.x1), z1: q(R.z1) });

// ------------------------------------------------------------------ spots: 0 npc, 1 work, 2 sit, 3 bed, then up to 2 stand
const ROOM_PREF = { npc: ['shop', 'main', 'work'], work: ['work', 'shop', 'main', 'back'], sit: ['back', 'main', 'bed', 'shop', 'work'], bed: ['bed', 'back', 'main', 'shop', 'work'] };
function placeSpots(S, r) {
  const I = S.inner, n = { x: S.door.nx, z: S.door.nz };
  const rects = S.chimney ? [...S.wallRects, rectC(S.chimney.lx, S.chimney.lz, S.chimney.w, S.chimney.w)] : S.wallRects; // spots keep clear of the hearth too
  const dIn = [S.door.lx - n.x * (WALL_T / 2 + 0.9), S.door.lz - n.z * (WALL_T / 2 + 0.9)];
  const roomOf = (x, z) => S.rooms.find((R) => inRect(R, x, z)) || null;
  const mainRoom = roomOf(dIn[0], dIn[1]) || S.rooms[0];
  const mc = [(mainRoom.x0 + mainRoom.x1) / 2, (mainRoom.z0 + mainRoom.z1) / 2];
  // corridors kept clear: the door to the main room's centre, and through each partition gap
  const corr = [[dIn, mc]];
  for (let i = 0; i < S.parts.length; i++) for (let j = i + 1; j < S.parts.length; j++) {
    const A = S.parts[i], B = S.parts[j];
    if (Math.abs(A.x0 - B.x0) < 1e-3 && Math.abs(A.x1 - B.x1) < 1e-3) { const zc = A.z1 < B.z0 ? (A.z1 + B.z0) / 2 : (B.z1 + A.z0) / 2, xc = (A.x0 + A.x1) / 2; corr.push([[xc - 0.9, zc], [xc + 0.9, zc]]); }
    if (Math.abs(A.z0 - B.z0) < 1e-3 && Math.abs(A.z1 - B.z1) < 1e-3) { const xc = A.x1 < B.x0 ? (A.x1 + B.x0) / 2 : (B.x1 + A.x0) / 2, zc = (A.z0 + A.z1) / 2; corr.push([[xc, zc - 0.9], [xc, zc + 0.9]]); }
  }
  // a single partition piece (the gap against an outer wall)
  if (S.parts.length === 1) { const A = S.parts[0]; const vert = A.z1 - A.z0 > A.x1 - A.x0; const P = vert ? (A.z0 - I.z0 > I.z1 - A.z1 ? [(A.x0 + A.x1) / 2, (I.z0 + A.z0) / 2] : [(A.x0 + A.x1) / 2, (A.z1 + I.z1) / 2]) : (A.x0 - I.x0 > I.x1 - A.x1 ? [(I.x0 + A.x0) / 2, (A.z0 + A.z1) / 2] : [(A.x1 + I.x1) / 2, (A.z0 + A.z1) / 2]); corr.push(vert ? [[P[0] - 0.9, P[1]], [P[0] + 0.9, P[1]]] : [[P[0], P[1] - 0.9], [P[0], P[1] + 0.9]]); }
  const segD = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]); };
  const wallD = (x, z) => { let m = 1e9; for (const R of rects) m = Math.min(m, rectDist(R, x, z)); return m; };
  const cands = [];
  for (let x = I.x0 + 0.62; x <= I.x1 - 0.62 + 1e-9; x += 0.1) for (let z = I.z0 + 0.62; z <= I.z1 - 0.62 + 1e-9; z += 0.1) {
    if (inRect(S.doorZone, x, z, 0.15)) continue;
    const wd = wallD(x, z); if (wd < 0.62) continue;
    const cd = Math.min(...corr.map(([a, b]) => segD([x, z], a, b)));
    const room = roomOf(x, z); if (!room) continue;
    cands.push({ x, z, wd, cd, room });
  }
  // the distance to each outer wall face, and which way that face looks
  const faces = [['front', I.z1, (x, z) => I.z1 - z, 0], ['back', I.z0, (x, z) => z - I.z0, PI], ['left', I.x0, (x, z) => x - I.x0, -PI / 2], ['right', I.x1, (x, z) => I.x1 - x, PI / 2]];
  const doorFace = S.door.face === 'front' ? 'front' : 'right';
  const nearestFace = (c, skipDoor) => { let best = null; for (const [f, , fn, ry] of faces) { if (skipDoor && f === doorFace) continue; const v = fn(c.x, c.z); if (!best || v < best.v) best = { f, v, ry }; } return best; };
  const prefPen = (kind, room) => { const L = ROOM_PREF[kind], i = L.indexOf(room.kind); return i < 0 ? 4 : i * 1.5; };
  const chosen = [];
  const free = (c) => chosen.every((s) => Math.hypot(s.x - c.x, s.z - c.z) >= 0.95);
  const toWorldX1 = (c) => { // questbot-style approach (1 m to world +x) stays inside the same room
    const [wx, wz] = localToWorld(S, c.x, c.z), [lx, lz] = worldToLocal(S, wx + 1, wz);
    return inRect(I, lx, lz, -0.15) && rects.every((R) => !inRect(R, lx, lz, 0.1));
  };
  const score = {
    npc: (c) => Math.abs(Math.hypot(c.x - dIn[0], c.z - dIn[1]) - 2.0) + prefPen('npc', c.room) * (c.room === mainRoom ? 0 : 1) + (c.room === mainRoom ? 0 : 3) + (toWorldX1(c) ? 0 : 2.5) + (c.cd < 0.6 ? 2 : 0),
    work: (c) => { const F = nearestFace(c, true); return Math.abs(F.v - 1.0) + prefPen('work', c.room) + (c.cd < 0.6 ? 1.5 : 0); },
    sit: (c) => { const F = nearestFace(c, false); return Math.abs(F.v - 1.2) * 0.8 + prefPen('sit', c.room) + (c.cd < 0.6 ? 1.5 : 0); },
    bed: (c) => { const F = nearestFace(c, true); return Math.abs(F.v - 1.3) + prefPen('bed', c.room) - 0.25 * Math.hypot(c.x - dIn[0], c.z - dIn[1]) / Math.max(S.w, S.d) + (c.cd < 0.6 ? 1.5 : 0); },
  };
  for (const c of cands) c.j = r(); // one jitter per candidate, so the choice is stable
  const ryOf = {
    npc: (c) => Math.atan2(dIn[0] - c.x, dIn[1] - c.z),
    work: (c) => nearestFace(c, true).ry,
    sit: (c) => { const R = c.room, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2; return Math.hypot(cx - c.x, cz - c.z) > 0.3 ? Math.atan2(cx - c.x, cz - c.z) : nearestFace(c, false).ry + PI; },
    bed: (c) => nearestFace(c, true).ry,
  };
  for (const k of ['npc', 'work', 'sit', 'bed']) {
    let best = null, bs = 1e9;
    for (const c of cands) { if (!free(c)) continue; const s = score[k](c) + c.j * 0.35; if (s < bs) { bs = s; best = c; } }
    if (!best) break;
    chosen.push({ k, x: best.x, z: best.z, ry: ryOf[k](best), room: best.room.kind });
  }
  // extra standing spots in roomy houses, as far as possible from the others
  const innerArea = area(I);
  for (let e = 0; e < (innerArea >= 30 ? 2 : innerArea >= 22 ? 1 : 0); e++) {
    let best = null, bs = -1;
    for (const c of cands) { if (!free(c) || c.cd < 0.6) continue; const m = Math.min(...chosen.map((s) => Math.hypot(s.x - c.x, s.z - c.z))); if (m > bs) { bs = m; best = c; } }
    if (!best) break;
    chosen.push({ k: 'stand', x: best.x, z: best.z, ry: Math.atan2(mc[0] - best.x, mc[1] - best.z), room: best.room.kind });
  }
  return chosen.map((s) => { const [x, z] = localToWorld(S, s.x, s.z); return { k: s.k, x: q(x), z: q(z), ry: q(s.ry + S.rot), lx: q(s.x), lz: q(s.z), room: s.room }; });
}

// ------------------------------------------------------------------ lookups
function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); } return o; }
function ensure() {
  if (ALL) return;
  SPEC_BY_ID = new Map(); SPEC_BY_KEY = new Map(); ALL = []; HASH = new Map();
  for (const site of HOUSE_SITES) { const S = deepFreeze(buildSpec(site)); SPEC_BY_ID.set(S.id, S); ALL.push(S); }
  for (const S of ALL) {
    const B = S.cutBox, ex = Math.abs(B.hw * Math.cos(B.rot)) + Math.abs(B.hd * Math.sin(B.rot)) + 2.5, ez = Math.abs(B.hw * Math.sin(B.rot)) + Math.abs(B.hd * Math.cos(B.rot)) + 2.5;
    for (let ix = Math.floor((B.x - ex) / HOUSE_CELL); ix <= Math.floor((B.x + ex) / HOUSE_CELL); ix++)
      for (let iz = Math.floor((B.z - ez) / HOUSE_CELL); iz <= Math.floor((B.z + ez) / HOUSE_CELL); iz++) {
        const k = ix * 100003 + iz; let L = HASH.get(k); if (!L) HASH.set(k, (L = [])); L.push(S);
      }
  }
}
const EMPTY = [];
function near(x, z) { ensure(); return HASH.get(Math.floor(x / HOUSE_CELL) * 100003 + Math.floor(z / HOUSE_CELL)) || EMPTY; }

// a Spec by site id, or for any site object (the asset gallery builds made-up sites); memoised
export function houseSpec(idOrSite) {
  ensure();
  if (typeof idOrSite === 'string') return SPEC_BY_ID.get(idOrSite) || null;
  if (!idOrSite) return null;
  const known = SPEC_BY_ID.get(idOrSite.id);
  if (known && HOUSE_SITES.includes(idOrSite)) return known;
  const key = JSON.stringify(idOrSite);
  let S = SPEC_BY_KEY.get(key);
  if (!S) { S = deepFreeze(buildSpec({ seed: 1, style: 'sunmere', group: 'gallery', rot: 0, enter: true, ...idOrSite })); SPEC_BY_KEY.set(key, S); }
  return S;
}
export function housesIn(group) { ensure(); return ALL.filter((S) => S.group === group); }
export const houseSpecsForGroup = housesIn;
export function allHouses() { ensure(); return ALL; }

// where a point stands against a house: 'in' (inside the walls), 'door' (in the opening or on the doorstep) or null
function where(S, x, z) {
  if (!S.enter) return null;
  const [lx, lz] = worldToLocal(S, x, z), I = S.inner;
  if (lx > I.x0 && lx < I.x1 && lz > I.z0 && lz < I.z1) return 'in';
  const D = S.door, u = (lx - D.lx) * D.nx + (lz - D.lz) * D.nz, t = (lx - D.lx) * -D.nz + (lz - D.lz) * D.nx;
  if (Math.abs(t) < DOOR_W / 2 && u >= -WALL_T / 2 && u <= WALL_T / 2 + S.stepLen) return u;
  return null;
}
// the house whose room (or door threshold) holds the point; inside only: houseAt(x, z, false)
export function houseAt(x, z, threshold = true) {
  if (!_ready) return null;
  for (const S of near(x, z)) { const w = where(S, x, z); if (w === 'in' || (threshold && w !== null)) return S; }
  return null;
}
// the floor height there: floorY inside and in the doorway, a ramp over the doorstep down (or up) to the ground, else -Infinity
export function houseFloor(x, z) {
  if (!_ready) return -Infinity;
  const L = near(x, z);
  for (let i = 0; i < L.length; i++) {
    const S = L[i], w = where(S, x, z);
    if (w === null) continue;
    if (w === 'in' || w <= WALL_T / 2) return S.floorY;
    return S.floorY + (S.stepY - S.floorY) * ((w - WALL_T / 2) / S.stepLen);
  }
  return -Infinity;
}
// push a circle of radius r out of every house wall box near it (the same maths as the client's world.collide)
export function housePush(x, z, r) {
  if (!_ready) return [x, z];
  const L = near(x, z);
  for (let i = 0; i < L.length; i++) {
    const Ws = L[i].walls;
    for (let j = 0; j < Ws.length; j++) {
      const b = Ws[j], c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c, hw = b.hw + r, hd = b.hd + r;
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
        const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
        let nx = lx, nz = lz;
        if (px < pz) nx = Math.sign(lx || 1) * hw; else nz = Math.sign(lz || 1) * hd;
        // deep in a solid box (a teleport, an old save): never let the shortest way out land in a room it was not in
        if (Math.min(px, pz) > r && where(L[i], x, z) !== 'in') {
          const outs = [[Math.sign(lx || 1) * hw, lz, px], [-Math.sign(lx || 1) * hw, lz, 2 * hw - px], [lx, Math.sign(lz || 1) * hd, pz], [lx, -Math.sign(lz || 1) * hd, 2 * hd - pz]].sort((a, b2) => a[2] - b2[2]);
          for (const [ox, oz] of outs) { const wx = b.x + ox * c + oz * s, wz = b.z - ox * s + oz * c; if (where(L[i], wx, wz) !== 'in') { nx = ox; nz = oz; break; } }
        }
        x = b.x + nx * c + nz * s; z = b.z - nx * s + nz * c;
      }
    }
  }
  return [x, z];
}
// does the straight move (x0, z0) -> (x1, z1) pass into any wall box (shrunk by 0.05 m)? A start already inside a box
// does not count for that box (the push sorts it out), so nobody is ever pinned.
export function houseCrosses(x0, z0, x1, z1) {
  if (!_ready) return false;
  ensure();
  let list;
  const cx0 = Math.floor(Math.min(x0, x1) / HOUSE_CELL), cx1 = Math.floor(Math.max(x0, x1) / HOUSE_CELL), cz0 = Math.floor(Math.min(z0, z1) / HOUSE_CELL), cz1 = Math.floor(Math.max(z0, z1) / HOUSE_CELL);
  if ((cx1 - cx0 + 1) * (cz1 - cz0 + 1) > 16) list = ALL;
  else { const set = new Set(); for (let ix = cx0; ix <= cx1; ix++) for (let iz = cz0; iz <= cz1; iz++) for (const S of HASH.get(ix * 100003 + iz) || EMPTY) set.add(S); list = set; }
  for (const S of list) for (const b of S.walls) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot), hw = b.hw - 0.05, hd = b.hd - 0.05;
    if (hw <= 0 || hd <= 0) continue;
    const ax = (x0 - b.x) * c - (z0 - b.z) * s, az = (x0 - b.x) * s + (z0 - b.z) * c;
    if (Math.abs(ax) < hw && Math.abs(az) < hd) continue;
    const bx = (x1 - b.x) * c - (z1 - b.z) * s, bz = (x1 - b.x) * s + (z1 - b.z) * c;
    // slab test of the segment against the box
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    let ok = true;
    for (const [p, dd, h] of [[ax, dx, hw], [az, dz, hd]]) {
      if (Math.abs(dd) < 1e-12) { if (Math.abs(p) >= h) { ok = false; break; } continue; }
      let ta = (-h - p) / dd, tb = (h - p) / dd;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
// the talk gate for an NPC that stands in a house: in that house, or within 3 m of its door with a clear line in through it
export function houseTalkOk(houseId, x, z) {
  const S = houseSpec(houseId);
  if (!S) return true;
  const h = houseAt(x, z);
  if (h && h.id === S.id) return true;
  // (and in the doorway's view: beside the door outside the wall, the jamb stands between him and the room)
  return Math.hypot(x - S.doorAt.x, z - S.doorAt.z) <= 3 && !houseCrosses(x, z, S.doorIn.x, S.doorIn.z);
}

_ready = true;
