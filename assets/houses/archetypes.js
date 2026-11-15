// House exteriors: one routine builds any Spec (cottage, townhouse, longhouse, smithy, shop, farmhouse, towerhouse, works)
// in house-local space. The shape (size, door, windows, extensions, chimney, roof form and palette) comes from the Spec;
// everything this file adds on top (trims, glazing pattern, shutters, flowers, yard props) is drawn from
// houseRng(seed, 3), so the art can change without ever moving a wall the server knows about.
//
// Output (all local; index.js moves it into the world):
//   shell   walls, roofs, gables, chimneys, frames, openings, door leaf, steps, extensions, porches (cut by the shader)
//   detail  shutters, flower boxes, gutters and downpipes, hardware, door lantern brackets, signs, yard props, icicles
//   smokes, lanterns, glows, fires, circles (yard props and chimney stacks outside the walls), braces (for the audit)
import * as THREE from 'three';
import { Builder, lathe, lumpy, sphere, cyl, cone as coneG, box as boxG } from '../kit.js';
import { houseRng, WALL_T, DOOR_W, DOOR_H, WALL_H } from '/sunmere-play/shared/houses.js';
import {
  PI, HT, U, LOWER_TOP, JETTY, clamp, lerp, shade, mixHex, pick, between, bx, rbx, beamAB, faceOf, FACES, fp, fbox, fdiag,
  doorFace, doorT, openingsOn, hasJetty, texTint, ROOF_MAT, ROOF_TH, UPPER_MAT, wallBand, windowShell, shutters, flowerBox,
  tuft, planeY, envAt, roofSlab, gableWall, addPrism, squarePipe,
} from './parts.js';

const STONE_TINT = { sunmere: '#dcd4c4', farmland: '#c8bea8', ledgerholm: '#bab4aa', harrowmouth: '#aaa094', reach: '#a29d96', rime: '#a8acb0', heights: '#b0aca4' };
const BRICK = '#c47a5c', SNOW = '#b8c0c8';
const rectC = (cx, cz, w, d) => ({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
const grow = (R, e) => ({ x0: R.x0 - e, z0: R.z0 - e, x1: R.x1 + e, z1: R.z1 + e });
const inR = (R, x, z, pad = 0) => x > R.x0 - pad && x < R.x1 + pad && z > R.z0 - pad && z < R.z1 + pad;
const rOverlap = (A, B) => A.x0 < B.x1 && A.x1 > B.x0 && A.z0 < B.z1 && A.z1 > B.z0;
const NORMAL = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] };

// ------------------------------------------------------------------ the context
export function makeCtx(S, ground, { blocked = null, cut = false, shellOnly = false } = {}) {
  const r = houseRng(S.seed, 3);
  const ctx = {
    S, r, ground, blocked: blocked || (() => false), cut, shellOnly,
    shell: new Builder(S.seed * 7 + 1), detail: new Builder(S.seed * 7 + 2),
    smokes: [], lanterns: [], glows: [], fires: [], circles: [], braces: [], shutterBraces: [], keep: [],
  };
  // the ground under the footprint and the extensions
  let gmin = Infinity, gmax = -Infinity;
  const sample = (R) => { for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const g = ground(lerp(R.x0, R.x1, i / 4), lerp(R.z0, R.z1, j / 4)); gmin = Math.min(gmin, g); gmax = Math.max(gmax, g); } };
  sample(S.foot);
  for (const E of S.ext) sample(rectC(E.lx, E.lz, E.w, E.d));
  ctx.gmin = gmin; ctx.gmax = gmax; ctx.deep = gmin - 0.3;
  // palette: what the Spec chose (stream 2) and the client-only looks (stream 3)
  const style = S.style, stoneTint = STONE_TINT[style] || STONE_TINT.sunmere;
  let upperMat = UPPER_MAT[S.wall.upper] || 'plaster', upperTint = S.wall.tint;
  if (S.arch === 'towerhouse' && (S.wall.upper === 'plaster' || S.wall.upper === 'plank')) { upperMat = 'stone'; upperTint = mixHex(S.wall.tint, stoneTint, 0.5); } // towers are stone all the way up
  if (S.wall.upper === 'ashlar') upperTint = mixHex(S.wall.tint, '#ffffff', 0.15);
  ctx.pal = {
    upperMat, upperTint,
    lowerMat: S.wall.lower === 'none' ? null : 'stone', lowerTint: S.wall.lower === 'brick' ? BRICK : stoneTint,
    stone: stoneTint, frameC: pick(r, ['#ffffff', '#e6d8c4', '#c8b49a']),
    winC: pick(r, ['#6a5444', '#e8e0d0', shade(S.accent, 1.1), '#4a3a30']),
    bars: r() < 0.5 ? 'v' : 'h', door: S.doorColor, accent: S.accent,
    roofMat: ROOF_MAT[S.roof.mat] || 'slate', roofTh: ROOF_TH[S.roof.mat] || 0.14,
    shut: S.arch !== 'works' && S.arch !== 'towerhouse' && S.wall.upper !== 'ashlar' && r() < 0.7,
    flowers: ['sunmere', 'farmland', 'harrowmouth'].includes(style) && r() < 0.75,
    snow: style === 'rime' || style === 'heights',
  };
  ctx.pal.roofTint = texTint(ctx.pal.roofMat, S.roof.mat === 'iron' ? mixHex(S.roof.tint, '#9a9ea4', 0.6) : S.roof.tint);
  cgtLook(ctx);
  ctx.framed = S.wall.frame !== 'none' && (S.wall.upper === 'plaster' || S.wall.upper === 'plank');
  ctx.jet = hasJetty(S) ? JETTY : 0;
  // keep-clear zones outside: the door's path (the doorstep and 1.5 m beyond), every extension
  const Fd = faceOf(S, doorFace(S)), td = doorT(S);
  const a = fp(Fd, td - 1.1, 0, HT), c = fp(Fd, td + 1.1, 0, HT + S.stepLen + 1.6);
  ctx.keep.push({ x0: Math.min(a[0], c[0]), z0: Math.min(a[2], c[2]), x1: Math.max(a[0], c[0]), z1: Math.max(a[2], c[2]) });
  for (const E of S.ext) ctx.keep.push(grow(rectC(E.lx, E.lz, E.w, E.d), 0.15));
  return ctx;
}

// ------------------------------------------------------------------ (v111) the CGTrader look for the built houses
// The houses with no CGTrader shell (shops, longhouses, towerhouses, the built cottages and townhouses, the works) take the
// shells' palette (houses/cgt.js): the farmhouse's straw thatch, clay tile roofs in the red cottage's red (dark grey in the
// stone towns), cream plaster, dark-wood frames, shutters and corner posts, a pale stone plinth band, deeper eaves with a
// fascia board, and a chimney stack with a square pot on roofs that had none. Client-only looks from houseRng(seed, 4):
// nothing the server knows (walls, doors, footprints, floors) moves, and stream 3 (the yard props) runs as before.
const CGT_THATCH = '#96723f', CGT_WOOD = '#4a3220', CGT_STONE = '#d4ccbe';
const CGT_PLASTER = ['#ece2d2', '#e8dccb', '#efe7da', '#e4d8c6'];
const CGT_TILE = { sunmere: ['#74382c', '#6a3228', '#5e5a58'], farmland: ['#74382c', '#6a3228'], ledgerholm: ['#5a5654', '#4e4c4c'], harrowmouth: ['#74382c', '#7c402c'], reach: ['#5a5652'], rime: ['#54545a'], heights: ['#54545a'] };
const ISLAND = { reach: 1, rime: 1, heights: 1 };
// (?oldhouses=1 in the URL: the pre-v111 look, for comparisons)
const OLD_LOOK = typeof window !== 'undefined' && /[?&]oldhouses=1/.test(window.location?.search || '');
function cgtLook(ctx) {
  if (OLD_LOOK) return;
  const { S, pal } = ctx, r = houseRng(S.seed, 4);
  let key = S.roof.mat;
  if (key === 'mossTile' || (key === 'shingle' && (S.style === 'sunmere' || S.style === 'farmland') && r() < 0.5)) key = 'thatch';
  if (key === 'slate' || key === 'terracotta' || key === 'iron') key = 'tile'; // (the blue fish-scale slate, the iron sheet drawn with it and the orange pantiles: the shells' flat oblong tiles, the shingle texture in clay red or slate grey)
  if (key === 'thatch' && S.roof.form === 'flat') key = 'tile';
  pal.roofKey = key;
  if (key === 'thatch') { pal.roofMat = 'thatch'; pal.roofTint = texTint('thatch', CGT_THATCH); pal.roofTh = 0.46; }
  else if (key === 'tile') { pal.tileC = S.roof.mat === 'terracotta' ? '#74382c' : pick(r, CGT_TILE[S.style] || CGT_TILE.sunmere); pal.roofMat = 'shingleWood'; pal.roofTint = texTint('shingleWood', pal.tileC); pal.roofTh = 0.15; }
  if (ISLAND[S.style]) return islandLook(ctx); // (v112: the island works: soot and timber, see islandLook)
  pal.cgt = true;
  if (pal.upperMat === 'plaster') pal.upperTint = pick(r, CGT_PLASTER);
  pal.stone = mixHex(pal.stone, CGT_STONE, 0.6);
  if (pal.lowerMat) pal.lowerTint = pal.stone; // (no brick on the shells: the stone course)
  pal.frameC = CGT_WOOD; pal.winC = shade(CGT_WOOD, 1.15);
  pal.shut = S.arch !== 'works' && S.arch !== 'towerhouse' && S.wall.upper !== 'ashlar';
  pal.shutC = mixHex(pal.accent, CGT_WOOD, 0.45);
}
// (v112) the island works: sooty stone in the same spirit as v111: dark tarred timber corner posts in place of the
// quoins, a pale plinth band, deeper eaves with a fascia board, a dark timber band under a flat roof's cornice and a
// square chimney stack on every roof that has none. Client-only looks (no stream 3 draws).
const ISLAND_SOOT = { reach: '#4a4642', rime: '#4c4e54', heights: '#4e4c4a' }, ISLAND_WOOD = '#2e241c';
function islandLook(ctx) {
  const { S, pal } = ctx;
  pal.isl = true;
  const soot = ISLAND_SOOT[S.style] || ISLAND_SOOT.reach;
  pal.upperTint = mixHex(pal.upperTint, soot, 0.28);
  pal.stone = mixHex(pal.stone, CGT_STONE, 0.35);
  if (pal.lowerMat) pal.lowerTint = mixHex(pal.lowerTint, soot, 0.18);
  // (v112 leftovers) light timber window frames and pale stone sills and lintels, so the dark daytime glass reads on the sooty stone
  pal.frameC = ISLAND_WOOD; pal.winC = '#e2d6bc'; pal.winMat = 'woodLight'; pal.sillC = '#d6d0c4';
}
// a chimney stack on the ridge of a roof that has none (stone, a band, a cap slab and one square pot), on the side away
// from the door; it starts just above the roof's underside, so nothing shows in the room and nothing new stands on the ground
function roofStack(ctx) {
  const { S, shell, pal } = ctx, R = ctx.roof;
  if (!R || S.chimney || S.arch === 'towerhouse' || (S.arch === 'works' && !ctx.pal.isl)) return;
  if (R.flat) return flatStack(ctx);
  if (!R.E) return;
  const F = R.R, W = F.x1 - F.x0, D = F.z1 - F.z0, alongX = W >= D, L = alongX ? W : D, w = 0.6;
  for (const sg of doorT(S) > 0 ? [-1, 1] : [1, -1]) {
    const px = (F.x0 + F.x1) / 2 + (alongX ? sg * 0.3 * L : 0), pz = (F.z0 + F.z1) / 2 + (alongX ? 0 : sg * 0.3 * L);
    if (S.ext.some((E) => (E.kind === 'dormer' || E.kind === 'outStair') && Math.abs(E.lx - px) < E.w / 2 + w && Math.abs(E.lz - pz) < E.d / 2 + 2.5)) continue;
    let lo = Infinity, hi = -Infinity;
    for (const dx of [-w / 2, w / 2]) for (const dz of [-w / 2, w / 2]) { const y = envAt(R.planes, px + dx, pz + dz); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const top = hi + R.th + 0.7, c = shade(pal.stone, 0.92);
    bx(shell, 'stoneDark', px - w / 2, lo + 0.03, pz - w / 2, px + w / 2, top, pz + w / 2, c);
    bx(shell, 'stoneLarge', px - w / 2 - 0.04, top - 0.34, pz - w / 2 - 0.04, px + w / 2 + 0.04, top - 0.24, pz + w / 2 + 0.04, shade(pal.stone, 1.06));
    bx(shell, 'stoneLarge', px - w / 2 - 0.08, top, pz - w / 2 - 0.08, px + w / 2 + 0.08, top + 0.12, pz + w / 2 + 0.08, shade(pal.stone, 1.1));
    bx(shell, 'stone', px - 0.12, top + 0.12, pz - 0.12, px + 0.12, top + 0.46, pz + 0.12, '#b87a58');
    return;
  }
}
// (v112) a flat-roofed island works: a square stack on the roof slab between the hatch and the vent box (flatRoof)
function flatStack(ctx) {
  const { S, shell, pal } = ctx, F = S.foot, y = S.wallTop + 0.36, w = 0.6;
  const lo = F.x0 + 1.95, hi = F.x1 - 1.75; // (clear of the hatch at x0 + 0.8..1.7 and the vent at x1 - 1.5..-0.8)
  if (hi - lo < w + 0.1) return;
  const px = (lo + hi) / 2, pz = F.z0 + 1.05, top = y + 1.25, c = shade(pal.stone, 0.8);
  bx(shell, 'stoneDark', px - w / 2, y, pz - w / 2, px + w / 2, top, pz + w / 2, c);
  bx(shell, 'stoneLarge', px - w / 2 - 0.04, top - 0.34, pz - w / 2 - 0.04, px + w / 2 + 0.04, top - 0.24, pz + w / 2 + 0.04, shade(pal.stone, 1.0));
  bx(shell, 'stoneLarge', px - w / 2 - 0.08, top, pz - w / 2 - 0.08, px + w / 2 + 0.08, top + 0.12, pz + w / 2 + 0.08, shade(pal.stone, 1.04));
  bx(shell, 'stone', px - 0.12, top + 0.12, pz - 0.12, px + 0.12, top + 0.46, pz + 0.12, '#6a5a50');
}

// ------------------------------------------------------------------ build everything
export function buildExterior(ctx) {
  // (v109) a CGTrader model stands in for the walls, roof, windows and chimney (houses/cgt.js): only the stone footing
  // under it, and for an enterable house the open door, its frame and steps (in the model's door hole) and the yard
  if (ctx.shellOnly) {
    const { S } = ctx;
    for (const R of S.enter ? [S.foot] : S.wallRects) bx(ctx.shell, 'stoneLarge', R.x0 + 0.05, ctx.deep, R.z0 + 0.05, R.x1 - 0.05, -0.06, R.z1 - 0.05, ctx.pal.stone);
    if (S.enter) {
      for (const f of FACES) for (const o of openingsOn(S, f)) if (o.kind === 'door') door(ctx, faceOf(S, f), o);
      yard(ctx);
    }
    if (ctx.cut) { clampBuilder(ctx.shell, ctx.S.cutY - ctx.S.floorY); clampBuilder(ctx.detail, ctx.S.cutY - ctx.S.floorY); }
    return ctx;
  }
  plinth(ctx);
  walls(ctx);
  roof(ctx);
  openings(ctx);
  chimney(ctx);
  if (!ctx.cut && (ctx.pal.cgt || ctx.pal.isl)) roofStack(ctx);
  for (const E of ctx.S.ext) extension(ctx, E);
  extras(ctx);
  yard(ctx);
  if (ctx.cut) { clampBuilder(ctx.shell, ctx.S.cutY - ctx.S.floorY); clampBuilder(ctx.detail, ctx.S.cutY - ctx.S.floorY); ctx.smokes.length = 0; }
  return ctx;
}
// the gallery's cut-away: drop every triangle wholly above y, squash the rest down to it (walls end flat at the cut)
export function clampBuilder(b, y) {
  for (const [mat, list] of b.parts) {
    const keep = [];
    for (const g of list) {
      const p = g.attributes.position, names = Object.keys(g.attributes), idx = [];
      for (let i = 0; i < p.count; i += 3) if (Math.min(p.getY(i), p.getY(i + 1), p.getY(i + 2)) < y - 1e-4) idx.push(i);
      if (!idx.length) continue;
      const ng = new THREE.BufferGeometry();
      for (const n of names) {
        const A = g.attributes[n], k = A.itemSize, arr = new Float32Array(idx.length * 3 * k);
        idx.forEach((i, j) => { for (let v = 0; v < 3; v++) for (let c = 0; c < k; c++) arr[(j * 3 + v) * k + c] = A.array[(i + v) * k + c]; });
        if (n === 'position') for (let q = 1; q < arr.length; q += 3) arr[q] = Math.min(arr[q], y);
        ng.setAttribute(n, new THREE.BufferAttribute(arr, k));
      }
      keep.push(ng);
    }
    if (keep.length) b.parts.set(mat, keep); else b.parts.delete(mat);
  }
}

// ------------------------------------------------------------------ plinth: a core block to the floor and a skirt round it
function plinth(ctx) {
  const { S, shell } = ctx, F = S.foot, y0 = ctx.deep;
  bx(shell, 'stoneLarge', F.x0, y0, F.z0, F.x1, -0.02, F.z1, ctx.pal.stone);
  const top = ctx.pal.cgt || ctx.pal.isl ? 0.34 : 0.12, td = doorT(ctx.S), df = doorFace(S); // (v111: the shells' taller pale plinth band)
  for (const f of FACES) {
    const Fc = faceOf(S, f);
    const [ta, tb] = f === 'front' || f === 'back' ? [-S.w / 2 - 0.1, S.w / 2 + 0.1] : [-S.d / 2, S.d / 2];
    const runs = f === df ? [[ta, td - DOOR_W / 2 - 0.12], [td + DOOR_W / 2 + 0.12, tb]] : [[ta, tb]];
    for (const [p, q] of runs) if (q - p > 0.05) fbox(shell, 'stoneLarge', Fc, p, q, y0, top, HT - 0.02, U.skirt, shade(ctx.pal.stone, 0.92));
  }
}

// ------------------------------------------------------------------ walls, timber frames, quoins
function bandsOf(S) {
  const out = [];
  for (let k = 0; k < S.storeys; k++) out.push({ k, y0: k === 0 ? -0.02 : k * WALL_H, y1: k === S.storeys - 1 ? S.wallTop : (k + 1) * WALL_H });
  return out;
}
function walls(ctx) {
  const { S, pal } = ctx;
  ctx.verticals = {};
  for (const band of bandsOf(S)) for (const f of FACES) {
    const jet = band.k > 0 && ctx.jet && (f === 'front' || f === 'left' || f === 'right') ? ctx.jet : 0;
    const F = faceOf(S, f, f === 'front' ? jet : 0);
    if (jet && f !== 'front') F.t1 += jet; // the side walls of a jettied storey run out to the overhang
    const opens = openingsOn(S, f).filter((o) => o.y1 > band.y0 && o.y0 < band.y1);
    wallBand(ctx, F, F.t0, F.t1, band.y0, band.y1, opens, {
      lowerMat: band.k === 0 ? pal.lowerMat : null, lowerTint: pal.lowerTint, upperMat: pal.upperMat, upperTint: pal.upperTint,
    });
    if (ctx.framed) frameFace(ctx, F, band, opens, jet);
  }
  if (ctx.framed || (pal.cgt && (S.wall.upper === 'plaster' || S.wall.upper === 'plank') && S.arch !== 'towerhouse') || pal.isl) cornerPosts(ctx); // (v111: dark corner posts on every plaster or plank house; v112: and the island works)
  else quoins(ctx);
  // string courses between stone storeys
  if (!ctx.framed && S.storeys > 1) for (let k = 1; k < S.storeys; k++) for (const f of FACES) {
    const jet = ctx.jet && f === 'front' ? ctx.jet : 0;
    const F = faceOf(S, f, jet), [ta, tb] = f === 'front' || f === 'back' ? [-S.w / 2 - 0.05, S.w / 2 + 0.05] : [-S.d / 2 - 0.05, S.d / 2 + 0.05 + (ctx.jet && k > 0 ? ctx.jet : 0)];
    fbox(ctx.shell, 'stoneLarge', F, ta, tb, k * WALL_H - 0.08, k * WALL_H + 0.06, HT - 0.02, HT + 0.06, shade(pal.stone, 1.05));
  }
  // a jettied front: the overhang's soffit, its bressummer and stepped bracket blocks under it
  if (ctx.jet) {
    const z0 = S.d / 2, z1 = S.d / 2 + ctx.jet, y = WALL_H;
    bx(ctx.shell, 'beam', -S.w / 2, y - 0.2, z0, S.w / 2, y, z1, '#d8c8b0');
    bx(ctx.shell, 'beam', -S.w / 2 - 0.02, y - 0.26, z1 - 0.18, S.w / 2 + 0.02, y - 0.02, z1 + 0.035, pal.frameC);
    const opens = openingsOn(S, 'front').filter((o) => o.y0 < WALL_H);
    const xs = [-S.w / 2 + 0.2, S.w / 2 - 0.2];
    for (const x of [-S.w / 6, S.w / 6]) if (opens.every((o) => x < o.t0 - 0.2 || x > o.t1 + 0.2)) xs.push(x);
    for (const x of xs) {
      bx(ctx.shell, 'beam', x - 0.08, y - 0.55, z0 - 0.02, x + 0.08, y - 0.2, z1 - 0.06, pal.frameC);
      bx(ctx.shell, 'beam', x - 0.07, y - 0.85, z0 - 0.02, x + 0.07, y - 0.55, z0 + 0.24, pal.frameC);
    }
  }
}
// timber framing on one storey of one face: sole rail and top plate, posts flanking every opening, studs in long runs,
// sill and head rails between the jamb posts, and (braced) one diagonal per clear panel
function frameFace(ctx, F, band, opens, jet) {
  const { S, shell, pal } = ctx, c = pal.frameC;
  const low = band.k === 0 && pal.lowerMat ? LOWER_TOP : band.y0 + 0.02;
  const yb = band.k === 0 ? low : band.y0, yt = band.y1;
  const RAIL = 0.14, PLATE = 0.16, POST = 0.16;
  const door = opens.find((o) => o.kind === 'door');
  // the corner posts stand at the face's ends (on the side faces they sit just past t0/t1)
  const front = F.face === 'front' || F.face === 'back';
  const ends = front ? [-S.w / 2, S.w / 2] : [-S.d / 2, S.d / 2 + (jet && F.face !== 'front' ? jet : 0)];
  const verts = [[ends[0] - 0.045, ends[0] + POST], [ends[1] - POST, ends[1] + 0.045]];
  // sole rail (broken at the door) and top plate
  const runs = door ? [[ends[0], door.t0], [door.t1, ends[1]]] : [[ends[0], ends[1]]];
  for (const [p, q] of runs) if (q - p > 0.05) fbox(shell, 'beam', F, p, q, yb, yb + RAIL, HT - 0.02, U.rail, c);
  fbox(shell, 'beam', F, ends[0], ends[1], yt - PLATE, yt, HT - 0.02, U.rail, c);
  const lowerV = band.k > 0 && !jet ? ctx.verticals[F.face] || [] : [];
  const clash = (t0, t1) => lowerV.some(([a, b]) => t0 < b + 0.12 && t1 > a - 0.12);
  for (const o of opens) {
    let jl = [o.t0 - POST, o.t0], jr = [o.t1, o.t1 + POST];
    if (clash(...jl)) jl = [jl[0] - 0.3, jl[1] - 0.3];
    if (clash(...jr)) jr = [jr[0] + 0.3, jr[1] + 0.3];
    for (const J of [jl, jr]) if (J[0] > verts[0][1] + 0.02 && J[1] < verts[1][0] - 0.02 && !verts.some(([a, b]) => J[0] < b && J[1] > a)) verts.push(J);
    if (o.kind === 'door') { if (o.y1 + RAIL < yt - PLATE - 0.02) fbox(shell, 'beam', F, o.t0, o.t1, o.y1, o.y1 + RAIL, HT - 0.02, U.rail, c); continue; }
    if (o.y1 + RAIL < yt - PLATE - 0.02) fbox(shell, 'beam', F, o.t0, o.t1, o.y1, o.y1 + RAIL, HT - 0.02, U.rail, c);
    if (o.y0 - RAIL > yb + RAIL + 0.02) fbox(shell, 'beam', F, o.t0, o.t1, o.y0 - RAIL, o.y0, HT - 0.02, U.rail, c);
  }
  verts.sort((p, q) => p[0] - q[0]);
  // studs in the long runs (kept off the storey below's posts, so no post meets another across a rail)
  const studs = [];
  for (let i = 0; i < verts.length - 1; i++) {
    const g0 = verts[i][1], g1 = verts[i + 1][0], gap = g1 - g0;
    if (gap < 2.0 || opens.some((o) => o.t0 < g1 && o.t1 > g0)) continue;
    const n = Math.floor(gap / 1.3);
    for (let k = 1; k <= n; k++) { const t = g0 + (gap * k) / (n + 1); const J = [t - POST / 2, t + POST / 2]; if (!clash(...J)) studs.push(J); }
  }
  verts.push(...studs); verts.sort((p, q) => p[0] - q[0]);
  for (const [p, q] of verts.slice(1, -1)) {
    const o = opens.find((op) => p < op.t1 + 0.4 && q > op.t0 - 0.4 && op.kind === 'door');
    fbox(shell, 'beam', F, p, q, o ? Math.max(yb, 0) : yb + RAIL, yt - PLATE, HT - 0.02, U.post, c);
  }
  if (band.k === 0) ctx.verticals[F.face] = verts.slice();
  // braces: one per clear panel; per wall either all one way or chevrons
  if (S.wall.frame !== 'braced') return;
  if (ctx.pal.cgt) { ctx.r(); ctx.r(); return; } // (v111: posts and rails only, like the shells; the two draws keep stream 3 in step)
  const chevron = ctx.r() < 0.5, lean0 = ctx.r() < 0.5 ? 1 : -1;
  let idx = 0;
  for (let i = 0; i < verts.length - 1; i++) {
    const p0 = verts[i][1], p1 = verts[i + 1][0], w = p1 - p0;
    if (w < 0.55 || w > 2.4) continue;
    if (opens.some((o) => o.t0 < p1 + 0.02 && o.t1 > p0 - 0.02)) continue;
    const lean = chevron ? (idx % 2 ? -lean0 : lean0) : lean0; idx++;
    const ya = yb + RAIL + 0.07, yb2 = yt - PLATE - 0.07, ta = p0 + 0.08, tb = p1 - 0.08;
    const A = lean > 0 ? [ta, ya] : [tb, ya], B = lean > 0 ? [tb, yb2] : [ta, yb2];
    fdiag(shell, 'beam', F, A[0], A[1], B[0], B[1], HT - 0.02, U.brace, 0.13, c);
    ctx.braces.push({ face: F.face + band.k, a: A, b: B });
  }
}
function cornerPosts(ctx) {
  const { S, shell, pal } = ctx, w = S.w, d = S.d;
  for (const band of bandsOf(S)) {
    const y0 = band.k === 0 && pal.lowerMat ? LOWER_TOP : band.y0, y1 = band.y1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const Z = d / 2 + (sz > 0 && band.k > 0 ? ctx.jet : 0), X = w / 2;
      bx(shell, 'beam', sx * X - sx * 0.16, y0, sz * Z - sz * 0.16, sx * X + sx * 0.045, y1, sz * Z + sz * 0.045, pal.frameC);
    }
  }
}
function quoins(ctx) {
  const { S, shell, pal } = ctx, w = S.w, d = S.d;
  if (S.wall.upper === 'plank') return;
  const y0 = pal.lowerMat ? LOWER_TOP : 0.05, y1 = ctx.jet ? WALL_H - 0.05 : S.wallTop - 0.08;
  const c = S.wall.upper === 'ashlar' ? shade(pal.upperTint, 1.08) : shade(pal.stone, 1.06);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = y0, i = 0; y < y1 - 0.15; i++) {
    const hh = Math.min(0.36, y1 - y), lx = i % 2 ? 0.62 : 0.34, lz = i % 2 ? 0.34 : 0.62;
    bx(shell, 'stoneLarge', sx * (w / 2 - lx), y, sz * (d / 2 - lz), sx * (w / 2 + 0.035), y + hh, sz * (d / 2 + 0.035), c);
    y += hh;
  }
}

// ------------------------------------------------------------------ door and windows
function openings(ctx) {
  const { S, pal, shell, detail, r } = ctx;
  const stone = S.wall.upper === 'ashlar' || S.wall.upper === 'rubble' || S.arch === 'towerhouse' || S.arch === 'works';
  for (const f of FACES) {
    const opens = openingsOn(S, f);
    for (const o of opens) {
      const jet = ctx.jet && f === 'front' && o.y0 > WALL_H ? ctx.jet : 0;
      const F = faceOf(S, f, jet);
      if (o.kind === 'door') { door(ctx, F, o); continue; }
      if (o.kind === 'shop') { shopHatch(ctx, F, o); continue; }
      windowShell(ctx, F, o, {
        bars: pal.bars, frameC: pal.winC, frameMat: pal.winMat, jambs: pal.isl && !ctx.framed ? pal.sillC : null,
        sill: ctx.framed ? null : 'stoneLarge', sillC: pal.sillC || shade(pal.stone, 1.08),
        lintel: ctx.framed ? null : stone || r() < 0.5 ? 'stoneLarge' : 'beam', lintelC: pal.sillC || shade(pal.stone, 1.08),
      });
      if (ctx.framed) fbox(shell, 'beam', F, o.t0 - 0.06, o.t1 + 0.06, o.y0 - 0.05, o.y0, U.rail, HT + 0.09, pal.frameC); // a drip sill on the rail
      // shutters where the wall has room either side; flower boxes under the ground-floor windows
      const sw = (o.t1 - o.t0) / 2 + 0.03 + 0.1;
      const Fn = faceOf(S, f);
      const roomy = opens.every((p) => p === o || p.t1 < o.t0 - sw - 0.05 || p.t0 > o.t1 + sw + 0.05 || p.y0 > o.y1 + 0.1 || p.y1 < o.y0 - 0.1)
        && o.t0 - sw > Fn.t0 + 0.2 && o.t1 + sw < Fn.t1 - 0.2 && !(S.chimney && S.chimney.face === f && Math.abs(winTc(o) - S.chimney.lz) < sw + 0.6 + S.chimney.w / 2);
      if (pal.shut && roomy && o.t1 - o.t0 > 0.5) shutters(ctx, F, o, pal.shutC || shade(pal.accent, 1.0));
      if (pal.flowers && o.y0 < 1.3 && o.t1 - o.t0 > 0.5 && (f === 'front' || r() < 0.4)) flowerBox(ctx, F, o, mixHex(pal.accent, '#8a6a48', 0.5));
    }
  }
}
const winTc = (o) => (o.t0 + o.t1) / 2;
function door(ctx, F, o) {
  const { S, pal, shell, detail, r } = ctx;
  const t = (o.t0 + o.t1) / 2;
  // frame: jambs and head lining the reveal, a threshold stone, and a lintel outside
  fbox(shell, 'beam', F, o.t0, o.t1, DOOR_H - 0.08, DOOR_H, U.frameIn, U.frame + 0.005, pal.frameC);
  for (const [a, c] of [[o.t0, o.t0 + 0.08], [o.t1 - 0.08, o.t1]]) fbox(shell, 'beam', F, a, c, 0.005, DOOR_H - 0.08, U.frameIn, U.frame + 0.005, pal.frameC);
  fbox(shell, 'stoneLarge', F, o.t0 - 0.05, o.t1 + 0.05, -0.1, 0.005, -HT, HT + 0.02, shade(pal.stone, 1.05));
  if (!ctx.framed) fbox(shell, (S.wall.upper === 'plaster' || S.wall.upper === 'plank') && r() < 0.5 ? 'beam' : 'stoneLarge', F, o.t0 - 0.2, o.t1 + 0.2, DOOR_H, DOOR_H + 0.22, 0.06, U.lintel, shade(pal.stone, 1.08));
  // the leaf stands open inward at 100 degrees, hinged at the jamb nearer the corner
  const hingeR = t < 0 ? false : true; // hinge on the +t jamb when the door sits right of centre
  const s = hingeR ? 1 : -1, th = t + s * (DOOR_W / 2 - 0.08);
  const H = fp(F, th, 0.03, -HT - 0.04);
  const phi = (100 * PI) / 180;
  // closed, the leaf runs from the hinge toward the other jamb (-s along t); open, it swings inward (-n)
  const dir = [Math.cos(phi) * -s * F.tan[0] + Math.sin(phi) * -F.n[0], Math.cos(phi) * -s * F.tan[1] + Math.sin(phi) * -F.n[1]];
  const ry = Math.atan2(-dir[1], dir[0]);
  const leaf = new Builder(1), hw = new Builder(2);
  const LW = 1.15, LH = DOOR_H - 0.12;
  bx(leaf, 'wood', 0, 0, -0.025, LW, LH, 0.025, pal.door);
  // Z-ledges on one face: two battens and the diagonal between them (never an X)
  for (const y of [0.3, LH - 0.32]) bx(leaf, 'wood', 0.05, y - 0.07, 0.025, LW - 0.05, y + 0.07, 0.05, shade(pal.door, 0.86));
  const dg = new Builder(3);
  fdiag(dg, 'wood', { n: [0, 1], tan: [1, 0], off: 0 }, 0.12, 0.42, LW - 0.12, LH - 0.44, 0.025, 0.045, 0.11, shade(pal.door, 0.86));
  leaf.addBuilder(dg);
  // strap hinges and a ring pull on the other face (detail)
  for (const y of [0.3, LH - 0.32]) bx(hw, 'iron', 0.0, y - 0.03, -0.04, 0.75, y + 0.03, -0.025, '#3a3634');
  hw.add(new THREE.TorusGeometry(0.055, 0.012, 6, 12), 'iron', { p: [LW - 0.18, 1.0, -0.045], c: '#4a4440' });
  shell.addBuilder(leaf, { p: H, r: [0, ry, 0] });
  detail.addBuilder(hw, { p: H, r: [0, ry, 0] });
  // the doorstep: stone steps down the ramp the server walks you over
  const drop = Math.max(0, S.floorY - S.stepY), L = S.stepLen, n = clamp(Math.round(drop / 0.17), 1, 7);
  for (let i = 0; i < n; i++) {
    const ua = HT + 0.02 + (i * L) / n, ub = HT + 0.02 + ((i + 1) * L) / n, top = -drop * ((i + 0.5) / n);
    const ug = ctx.ground(...xz(fp(F, t, 0, ub)));
    fbox(shell, 'stoneLarge', F, t - 0.85 + i * 0.02, t + 0.85 - i * 0.02, Math.min(ug, top) - 0.35, top, ua, ub, shade(pal.stone, 1.0 - i * 0.03));
  }
  // a lantern on an iron bracket beside the door, on the side with clear wall
  const opens = openingsOn(S, F.face);
  for (const side of hingeR ? [-1, 1] : [1, -1]) {
    const tl = side > 0 ? o.t1 + 0.38 : o.t0 - 0.38;
    if (tl < F.t0 + 0.3 || tl > F.t1 - 0.3 || opens.some((p) => p !== o && tl > p.t0 - 0.25 && tl < p.t1 + 0.25 && p.y0 < 2.8)) continue;
    const y = DOOR_H + 0.22;
    fbox(detail, 'iron', F, tl - 0.025, tl + 0.025, y, y + 0.05, HT, HT + 0.5, '#3a3634');
    beamAB(detail, 'iron', fp(F, tl, y - 0.35, HT + 0.01), fp(F, tl, y + 0.01, HT + 0.32), 0.035, 0.035, '#3a3634');
    bx(detail, 'iron', ...(() => { const A = fp(F, tl - 0.06, y - 0.42, HT), B = fp(F, tl + 0.06, y + 0.1, HT + 0.03); return [A[0], A[1], A[2], B[0], B[1], B[2]]; })(), '#3a3634');
    ctx.lanterns.push({ p: fp(F, tl, y, HT + 0.46), len: 0.2, color: 'yellow', scale: 0.75 });
    break;
  }
  // a door hood on knee braces where the roof leaves room above the door
  const R = ctx.roof;
  if (R && !S.ext.some((E) => E.kind === 'porch') && r() < 0.6) {
    const P = fp(F, t, 0, HT + 0.8);
    if (envAt(R.planes, P[0], P[2]) > DOOR_H + 0.95) {
      const A = fp(F, t - 0.95, 0, HT), B = fp(F, t + 0.95, 0, HT + 0.75);
      const rect = { x0: Math.min(A[0], B[0]), z0: Math.min(A[2], B[2]), x1: Math.max(A[0], B[0]), z1: Math.max(A[2], B[2]) };
      const yw = DOOR_H + 0.55, k = 0.45, s0 = F.off + HT;
      roofSlab(shell, ctx.pal.roofMat, [{ c: yw + k * s0, ax: -k * F.n[0], az: -k * F.n[1] }], rect, 0.08, ctx.pal.roofTint, { uvs: 0.42 });
      for (const tt of [t - 0.8, t + 0.8]) beamAB(shell, 'beam', fp(F, tt, DOOR_H + 0.05, HT + 0.02), fp(F, tt, yw - 0.2, HT + 0.6), 0.07, 0.07, pal.frameC);
    }
  }
}
const xz = (p) => [p[0], p[2]];

// the shop's serving hatch: an open counter opening with a lift-up shutter propped as an awning
function shopHatch(ctx, F, o) {
  const { shell, detail, pal, S } = ctx;
  fbox(shell, 'woodDark', F, o.t0, o.t1, o.y1 - 0.07, o.y1, U.frameIn, U.frame, pal.winC);
  for (const [a, c] of [[o.t0, o.t0 + 0.07], [o.t1 - 0.07, o.t1]]) fbox(shell, 'woodDark', F, a, c, o.y0, o.y1 - 0.07, U.frameIn, U.frame, pal.winC);
  fbox(shell, 'wood', F, o.t0 - 0.06, o.t1 + 0.06, o.y0 - 0.06, o.y0, -HT - 0.12, HT + 0.42, '#c8a878'); // the counter board through the wall
  // the shutter: hinged at the head, lifted to 25 degrees above level, on two parallel props
  const L = 0.95, ang = (25 * PI) / 180, H = fp(F, (o.t0 + o.t1) / 2, o.y1 + 0.05, HT + 0.03);
  const out = [F.n[0] * Math.cos(ang), Math.sin(ang), F.n[1] * Math.cos(ang)];
  const C = [H[0] + out[0] * L / 2, H[1] + out[1] * L / 2, H[2] + out[2] * L / 2];
  const Wd = o.t1 - o.t0 + 0.14;
  if (F.tan[0]) shell.add(boxG(Wd, 0.05, L), 'wood', { p: C, r: [-ang * Math.sign(F.n[1]), 0, 0], uv: 'box', c: pal.accent });
  else shell.add(boxG(0.05 * 0 + L, 0.05, Wd), 'wood', { p: C, r: [0, 0, ang * Math.sign(F.n[0])], uv: 'box', c: pal.accent });
  const tip = [H[0] + out[0] * (L - 0.05), H[1] + out[1] * (L - 0.05) - 0.03, H[2] + out[2] * (L - 0.05)];
  for (const tt of [o.t0 + 0.12, o.t1 - 0.12]) {
    const base = fp(F, tt, o.y0 + 0.02, HT + 0.36), d = (tt - (o.t0 + o.t1) / 2);
    beamAB(detail, 'beam', base, [tip[0] + F.tan[0] * d, tip[1], tip[2] + F.tan[1] * d], 0.04, 0.04, '#6a5040');
  }
  void S;
}

// ------------------------------------------------------------------ roofs
// the eave rectangle and the planes of the main roof; the underside passes through the walls' outer top edges
export function mainRoofPlanes(S, jet = 0) {
  const R = { x0: S.foot.x0, z0: S.foot.z0, x1: S.foot.x1, z1: S.foot.z1 + jet };
  const W = R.x1 - R.x0, D = R.z1 - R.z0, y = S.wallTop, rise = S.roof.rise;
  // a hip on a near-square plan is a pyramid, whose hips read as an X from above: build it as a gable instead
  let f = S.roof.form;
  // (v111: and on any plan where the ridge would be shorter than 40% of the long side: its hips read nearly as an X)
  if (f === 'hip' && Math.abs(W - D) < Math.max(1.6, 0.4 * Math.max(W, D))) f = W >= D ? 'gableX' : 'gableZ';
  const P = [];
  const sx = rise / (D / 2), sz = rise / (W / 2), sh = rise / (Math.min(W, D) / 2);
  if (f === 'flat') return { R, planes: [{ c: y, ax: 0, az: 0 }], flat: true };
  if (f === 'gableX' || f === 'halfHip') { P.push({ c: y + R.z1 * sx, ax: 0, az: -sx }, { c: y - R.z0 * sx, ax: 0, az: sx }); }
  if (f === 'gableZ') { P.push({ c: y + R.x1 * sz, ax: -sz, az: 0 }, { c: y - R.x0 * sz, ax: sz, az: 0 }); }
  if (f === 'hip') P.push({ c: y + R.z1 * sh, ax: 0, az: -sh }, { c: y - R.z0 * sh, ax: 0, az: sh }, { c: y + R.x1 * sh, ax: -sh, az: 0 }, { c: y - R.x0 * sh, ax: sh, az: 0 });
  if (f === 'halfHip') { const hk = y + rise * 0.58, se = sx * 2.2; P.push({ c: hk - R.x0 * se, ax: se, az: 0 }, { c: hk + R.x1 * se, ax: -se, az: 0 }); }
  return { R, planes: P, flat: false };
}
function roof(ctx) {
  const { S, pal, shell, detail } = ctx;
  if (S.arch === 'towerhouse') return towerRoof(ctx);
  const { R, planes, flat } = mainRoofPlanes(S, ctx.jet);
  ctx.roof = { planes, R, th: pal.roofTh, flat };
  if (ctx.cut) return;
  if (flat) return flatRoof(ctx, R);
  // (v111: deeper eaves, kept inside the cut box's 0.6 m with the fascia board)
  const key = pal.roofKey || S.roof.mat, deep = !!(pal.cgt || pal.isl);
  const over = key === 'thatch' ? (deep ? 0.58 : 0.55) : deep ? 0.52 : 0.42, verge = key === 'thatch' ? (deep ? 0.5 : 0.45) : deep ? 0.45 : 0.32;
  // eaves overhang more than verges (gable ends)
  const gableX = S.roof.form === 'gableX' || S.roof.form === 'halfHip', gableZ = S.roof.form === 'gableZ';
  const E = { x0: R.x0 - (gableX ? verge : over), x1: R.x1 + (gableX ? verge : over), z0: R.z0 - (gableZ ? verge : over), z1: R.z1 + (gableZ ? verge : over) };
  ctx.roof.E = E;
  const th = pal.roofTh, thatch = key === 'thatch';
  // (v112) deep thatch ends in a rolled, rounded lip all round (the shells' shaggy eave): the slab stops ROLL short of the
  // eave line and a straw roll runs along its edge, out to the same eave line (still inside the cut box)
  const roll = thatch && deep ? 0.27 : 0;
  const slab = roofSlab(shell, pal.roofMat, planes, roll ? grow(E, -roll) : E, th, pal.roofTint, { soffitC: '#7a6450', uvs: thatch ? (deep ? 0.32 : 0.5) : 0.42 }); // (v111: deep: the straw at a coarser scale, chunky courses like the shells')
  ctx.roof.slab = slab;
  // ridge and hip caps
  const capMat = { slate: 'stoneDark', thatch: 'thatch', shingle: 'beam', mossTile: 'mossRoof', terracotta: 'slateRed', iron: 'iron', tile: 'shingleWood' }[key] || 'stoneDark';
  const capC = thatch ? shade(pal.roofTint, 0.8) : key === 'tile' ? texTint('shingleWood', pal.tileC, 0.72) : S.roof.mat === 'slate' ? '#8a8e94' : S.roof.mat === 'terracotta' ? texTint('slateRed', S.roof.tint, 0.9) : S.roof.mat === 'iron' ? '#6a6866' : S.roof.mat === 'mossTile' ? '#d8d8c8' : pal.frameC;
  for (const [a, c] of slab.lines) beamAB(shell, capMat, [a[0], a[1] + (thatch ? 0.06 : 0.04), a[2]], [c[0], c[1] + (thatch ? 0.06 : 0.04), c[2]], thatch ? 0.42 : 0.24, thatch ? 0.24 : 0.11, capC);
  // verge (barge) boards and eave fascias; gutters with downpipes (not on thatch)
  for (const B of slab.bounds) {
    const out = B.side === 'x0' ? [-1, 0] : B.side === 'x1' ? [1, 0] : B.side === 'z0' ? [0, -1] : [0, 1];
    const off = (p, o2, dy) => [p[0] + out[0] * o2, p[1] + dy, p[2] + out[1] * o2];
    if (thatch) {
      if (!roll) continue;
      // under a gable's roll, a dark barge board; the roll itself, a little past both ends so the corners close
      if (!B.level) beamAB(shell, 'beam', off(B.a, -0.1, -th - 0.16), off(B.b, -0.1, -th - 0.16), 0.06, 0.24, pal.frameC);
      strawRoll(shell, pal.roofMat, off(B.a, 0, -th / 2), off(B.b, 0, -th / 2), roll, shade(pal.roofTint, 0.92));
      continue;
    }
    if (!B.level) beamAB(shell, 'beam', off(B.a, 0.03, -th / 2 - 0.05), off(B.b, 0.03, -th / 2 - 0.05), 0.05, th + 0.16, pal.frameC);
    else {
      if (deep) beamAB(shell, 'woodDark', off(B.a, 0.035, -th / 2 - 0.09), off(B.b, 0.035, -th / 2 - 0.09), 0.06, th + 0.22, pal.frameC); // (v111: a deep fascia board)
      else beamAB(shell, 'woodDark', off(B.a, 0.025, -th / 2 - 0.04), off(B.b, 0.025, -th / 2 - 0.04), 0.04, th + 0.1, '#8a7058');
      const L = Math.hypot(B.b[0] - B.a[0], B.b[2] - B.a[2]);
      if (L > 2 && !pal.snow) gutter(ctx, off(B.a, 0.1, -th - 0.1), off(B.b, 0.1, -th - 0.1), out);
      if (pal.snow) icicleRow(ctx, off(B.a, 0.05, -0.04), off(B.b, 0.05, -0.04));
    }
  }
  // gable walls and their vents; the snow load
  const jetF = { front: ctx.jet, back: 0, left: 0, right: 0 };
  for (const f of FACES) {
    const F = faceOf(S, f, jetF[f]);
    const [ta, tb] = f === 'front' || f === 'back' ? [R.x0, R.x1] : [R.z0, R.z1];
    if (!gableWall(shell, pal.upperMat, F, planes, ta, tb, S.wallTop, pal.upperTint)) continue;
    if (S.chimney && S.chimney.face === f) continue;
    // a slatted vent under the apex (horizontal slats only)
    const A = fp(F, (ta + tb) / 2, 0, HT), apex = envAt(planes, A[0], A[2]);
    if (deep) { gableTimbers(ctx, F, planes, ta, tb, apex); continue; }
    if (apex - S.wallTop > 1.3) {
      const tc = (ta + tb) / 2, y = Math.max(S.wallTop + 0.35, apex - 0.95);
      fbox(detail, 'beam', F, tc - 0.32, tc + 0.32, y - 0.25, y + 0.25, HT, HT + 0.03, pal.frameC);
      for (let i = 0; i < 4; i++) fbox(detail, 'beam', F, tc - 0.26, tc + 0.26, y - 0.2 + i * 0.13, y - 0.16 + i * 0.13, HT + 0.03, HT + 0.07, shade(pal.frameC, 0.7));
    }
  }
  if (pal.snow) roofSlab(shell, 'snowPack', planes, grow(E, -0.08), 0.11, SNOW, { soffit: null, uvs: 0.3, topLift: th });
}
// (v112) the gable triangle in the shells' manner: a dark tie beam across its foot, a small square slatted vent under the
// apex and an upright stud either side of it up to the roof (uprights and a level beam only: no braces, nothing that
// crosses or meets on a diagonal)
function gableTimbers(ctx, F, planes, ta, tb, apex) {
  const { S, detail, pal } = ctx, y0 = S.wallTop, c = pal.frameC, tc = (ta + tb) / 2, rise = apex - y0;
  if (rise < 0.5) return;
  fbox(detail, 'beam', F, ta + 0.02, tb - 0.02, y0 - 0.02, y0 + 0.16, HT, HT + 0.06, c);
  const vs = 0.26, vy = Math.max(y0 + 0.2 + vs, apex - 0.62 - vs * 0.4);
  const vent = rise > 1.25;
  if (vent) {
    fbox(detail, 'beam', F, tc - vs, tc + vs, vy - vs, vy + vs, HT, HT + 0.03, c);
    fbox(detail, 'beam', F, tc - vs + 0.06, tc + vs - 0.06, vy - vs + 0.06, vy + vs - 0.06, HT + 0.03, HT + 0.035, '#1e1812'); // (beam, not a new material: the village's detail stays within 8 draws)
    for (let i = 0; i < 3; i++) { const y = vy - vs + 0.13 + i * 0.13; fbox(detail, 'beam', F, tc - vs + 0.06, tc + vs - 0.06, y - 0.025, y + 0.025, HT + 0.035, HT + 0.07, shade(c, 1.25)); }
  }
  const half = (tb - ta) / 2, off = Math.min(half - 0.45, Math.max(vent ? vs + 0.55 : 0.6, half * 0.45));
  for (const sg of vent ? [-1, 1] : [0]) {
    const t = tc + sg * off, P = fp(F, t, 0, HT + 0.06), top = envAt(planes, P[0], P[2]) - 0.03;
    if (top - (y0 + 0.16) < 0.35) continue;
    fbox(detail, 'beam', F, t - 0.07, t + 0.07, y0 + 0.16, top, HT, HT + 0.05, c);
  }
}
// (v112) a rounded roll of straw from a to c (radius r): the thatch's eave and verge lip; the straws run round the roll
const _Y = new THREE.Vector3(0, 1, 0);
function strawRoll(b, mat, a, c, r, col) {
  const d = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), L = d.length();
  if (L < 0.05) return;
  d.divideScalar(L);
  // past both ends on a level eave (the corners close); a sloped verge runs past its foot, and at the apex its end is
  // mitred on the upright plane through the peak, so the two verge rolls meet there in a clean point and never run on
  // past each other (an X at the ridge)
  const ext = r * 0.5, lvl = Math.abs(a[1] - c[1]) < 1e-3, up = lvl ? 0 : c[1] > a[1] ? 1 : -1; // (up: +1 when c is the apex end)
  const eA = up < 0 ? r : ext, eC = up > 0 ? r : ext, Lx = L + eA + eC, g = new THREE.CylinderGeometry(r, r, Lx, 10, 1, false);
  const uv = g.attributes.uv, k = 0.32;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v * Lx * k, u * 2 * PI * r * k); }
  const q = new THREE.Quaternion().setFromUnitVectors(_Y, d), m = (eC - eA) / 2; // (the centre moves toward the longer run-on)
  const hd = Math.hypot(d.x, d.z);
  if (up && hd > 0.05) {
    // the mitre: every vertex of the apex half slides along the roll's axis (local y) onto the upright plane through the
    // apex (normal h, level, pointing up the slope); moving local y by s moves a point s * hd * up along h
    const h = new THREE.Vector3(d.x, 0, d.z).divideScalar(hd * up), H0 = (L / 2 - m * up) * hd, pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) * up <= 0) continue;
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyQuaternion(q);
      pos.setY(i, pos.getY(i) + (H0 - v.dot(h)) / (hd * up));
    }
    g.computeVertexNormals();
  }
  b.add(g, mat, { p: [(a[0] + c[0]) / 2 + d.x * m, (a[1] + c[1]) / 2 + d.y * m, (a[2] + c[2]) / 2 + d.z * m], q, uv: 'keep', c: col });
}
// a flat roof behind a parapet (the island works): cornice, parapet with coping, the slab, a hatch and a vent box
function flatRoof(ctx, R) {
  const { S, shell, pal } = ctx, y = S.wallTop, c = pal.upperTint;
  bx(shell, 'stoneDark', R.x0 - 0.2, y - 0.02, R.z0 - 0.2, R.x1 + 0.2, y + 0.24, R.z1 + 0.2, shade(pal.stone, 0.75));
  if (pal.isl) for (const f of FACES) { // (v112) a dark timber band under the cornice
    const F = faceOf(S, f, f === 'front' ? ctx.jet : 0), [ta, tb] = f === 'front' || f === 'back' ? [R.x0 - 0.05, R.x1 + 0.05] : [R.z0, R.z1];
    fbox(shell, 'beam', F, ta, tb, y - 0.3, y - 0.02, HT - 0.02, HT + 0.05, pal.frameC);
  }
  for (const f of FACES) {
    const F = faceOf(S, f, f === 'front' ? ctx.jet : 0);
    const [ta, tb] = f === 'front' || f === 'back' ? [R.x0 - 0.06, R.x1 + 0.06] : [R.z0 + 0.24, R.z1 - 0.24];
    fbox(shell, pal.upperMat, F, ta, tb, y + 0.24, y + 0.8, HT - 0.24, HT + 0.06, c);
    fbox(shell, 'stoneLarge', F, ta - 0.04, tb + 0.04, y + 0.8, y + 0.92, HT - 0.28, HT + 0.1, shade(pal.stone, 1.1));
  }
  bx(shell, 'slate', R.x0 + 0.2, y + 0.24, R.z0 + 0.2, R.x1 - 0.2, y + 0.36, R.z1 - 0.2, texTint('slate', '#5a5854'));
  const r = ctx.r;
  bx(shell, 'woodDark', R.x0 + 0.8, y + 0.36, R.z0 + 0.6, R.x0 + 1.7, y + 0.72, R.z0 + 1.5, '#7a6450');
  bx(shell, 'iron', R.x1 - 1.5, y + 0.36, R.z0 + 0.7, R.x1 - 0.8, y + 1.0, R.z0 + 1.4, '#6a6866');
  if (pal.snow) bx(shell, 'snowPack', R.x0 + 0.25, y + 0.36, R.z0 + 0.25, R.x1 - 0.25, y + 0.5, R.z1 - 0.25, SNOW);
  void r;
}
// the towerhouse: a parapet with thin flat merlons round a low hipped roof inside it
function towerRoof(ctx) {
  const { S, shell, pal } = ctx, y = S.wallTop, I = S.inner;
  const rise = Math.min(S.roof.rise, 1.6), s = rise / ((I.x1 - I.x0) / 2);
  // a low gable inside the parapet (a pyramid would show an X from above)
  const planes = [{ c: y + 0.25 + I.z1 * s, ax: 0, az: -s }, { c: y + 0.25 - I.z0 * s, ax: 0, az: s }];
  const E = grow(I, 0.02);
  ctx.roof = { planes, R: S.foot, th: pal.roofTh, flat: false, E };
  const slab = roofSlab(shell, pal.roofMat, planes, E, pal.roofTh, pal.roofTint, { soffitC: '#6a5a4a' });
  for (const [a, c] of slab.lines) beamAB(shell, 'stoneDark', [a[0], a[1] + 0.04, a[2]], [c[0], c[1] + 0.04, c[2]], 0.2, 0.1, '#8a8e94');
  if (pal.snow) roofSlab(shell, 'snowPack', planes, grow(E, -0.05), 0.1, SNOW, { soffit: null, topLift: pal.roofTh });
  // corbel course, parapet, merlons
  const F0 = S.foot;
  bx(shell, 'stoneDark', F0.x0 - 0.12, y - 0.3, F0.z0 - 0.12, F0.x1 + 0.12, y, F0.z1 + 0.12, shade(pal.stone, 0.8));
  for (const f of FACES) {
    const F = faceOf(S, f);
    const [ta, tb] = f === 'front' || f === 'back' ? [-S.w / 2 - 0.12, S.w / 2 + 0.12] : [-S.d / 2 + 0.18, S.d / 2 - 0.18];
    fbox(shell, pal.upperMat, F, ta, tb, y, y + 0.55, -HT, HT + 0.12, pal.upperTint);
    const n = Math.max(2, Math.round((tb - ta) / 0.95));
    for (let i = 0; i <= n; i++) { if (i % 2) continue; const t = lerp(ta + 0.25, tb - 0.25, i / n); fbox(shell, pal.upperMat, F, t - 0.23, t + 0.23, y + 0.55, y + 1.0, -HT + 0.06, HT + 0.08, pal.upperTint); }
  }
}
function gutter(ctx, a, c, out) {
  const { detail, S } = ctx;
  beamAB(detail, 'iron', a, c, 0.11, 0.09, '#5a5654');
  // a downpipe at the end away from the door: an elbow back to the wall, then down the wall to a shoe
  const ends = [a, c];
  const D = fp(faceOf(S, doorFace(S)), doorT(S), 0, HT);
  ends.sort((p, q) => Math.hypot(q[0] - D[0], q[2] - D[2]) - Math.hypot(p[0] - D[0], p[2] - D[2]));
  const e = ends[0], hw = S.w / 2, hd = S.d / 2 + (out[1] > 0 ? ctx.jet : 0);
  const w = out[0] ? [out[0] * (hw + 0.09), clamp(e[2], -hd + 0.2, hd - 0.2)] : [clamp(e[0], -hw + 0.2, hw - 0.2), out[1] * (hd + 0.09)];
  if (S.ext.some((E) => inR(rectC(E.lx, E.lz, E.w, E.d), w[0], w[1], 0.25))) return;
  if (S.chimney && Math.hypot(w[0] - S.chimney.lx, w[1] - S.chimney.lz) < S.chimney.w / 2 + 0.3) return;
  const g = ctx.ground(w[0], w[1]), top = e[1] - 0.25;
  beamAB(detail, 'iron', [e[0], e[1] - 0.02, e[2]], [w[0], top, w[1]], 0.07, 0.07, '#5a5654');
  bx(detail, 'iron', w[0] - 0.04, g + 0.12, w[1] - 0.04, w[0] + 0.04, top + 0.03, w[1] + 0.04, '#5a5654');
  bx(detail, 'iron', w[0] - 0.065, g, w[1] - 0.065, w[0] + 0.065, g + 0.14, w[1] + 0.065, '#4a4644');
  for (let y = g + 0.8; y < top - 0.3; y += 1.2) bx(detail, 'iron', w[0] - 0.06, y, w[1] - 0.06, w[0] + 0.06, y + 0.05, w[1] + 0.06, '#3a3634');
}
function icicleRow(ctx, a, c) {
  const L = Math.hypot(c[0] - a[0], c[2] - a[2]), n = Math.max(3, Math.round(L * 0.9)), r = ctx.r;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, h = between(r, 0.18, 0.6);
    ctx.detail.add(coneG(0.05, h, 5), 'ice', { p: [lerp(a[0], c[0], t), a[1] - h / 2, lerp(a[2], c[2], t)], r: [PI, 0, 0], c: '#ffffff' });
  }
}

// ------------------------------------------------------------------ chimney stacks and the hearth-pit vent
function chimney(ctx) {
  const { S, shell, pal } = ctx, C = S.chimney;
  if (!C) return;
  const R = ctx.roof, top = (x, z) => (R ? envAt(R.planes, x, z) + R.th : S.wallTop);
  const brick = S.variant === 'bakery' || (S.style === 'harrowmouth' && ctx.r() < 0.4);
  const mat = brick ? 'stone' : 'stoneDark', c = brick ? BRICK : shade(pal.stone, 0.95);
  if (!C.face) { // the longhouse's hearth pit: a louvred vent box on the ridge
    const y = top(C.lx, C.lz) - 0.12;
    bx(shell, 'woodDark', C.lx - 0.35, y, C.lz - 0.35, C.lx + 0.35, y + 0.55, C.lz + 0.35, '#6a5444');
    for (let i = 0; i < 3; i++) bx(shell, 'beam', C.lx - 0.39, y + 0.12 + i * 0.14, C.lz - 0.39, C.lx + 0.39, y + 0.17 + i * 0.14, C.lz + 0.39, pal.frameC);
    const yr = y + 0.8;
    roofSlab(shell, pal.roofMat, [{ c: yr + 0.5 * C.lz, ax: 0, az: -0.5 }, { c: yr - 0.5 * C.lz, ax: 0, az: 0.5 }], { x0: C.lx - 0.5, z0: C.lz - 0.5, x1: C.lx + 0.5, z1: C.lz + 0.5 }, 0.06, pal.roofTint);
    ctx.smokes.push({ p: [C.lx, y + 1.1, C.lz], opts: { rate: 1.1, size: 0.8 } });
    return;
  }
  const s = C.face === 'right' ? 1 : -1, w = C.w;
  const inner = s * (S.w / 2 - WALL_T), outer = C.lx + s * w / 2, innerExt = C.lx - s * w / 2;
  let yTop = -Infinity;
  for (const dx of [-w / 2, w / 2]) for (const dz of [-w / 2, w / 2]) yTop = Math.max(yTop, top(C.lx + dx, C.lz + dz));
  yTop = Math.max(yTop, S.wallTop) + (C.h > 2 ? C.h * 0.55 : 0.85);
  // outside half from the ground, inside half from above the room (the room side is the interior's hearth breast)
  bx(shell, mat, inner, ctx.deep, C.lz - w / 2, outer, yTop, C.lz + w / 2, c);
  bx(shell, mat, innerExt, Math.min(S.wallTop, WALL_H) + 0.02, C.lz - w / 2, inner, yTop, C.lz + w / 2, c);
  // a stone band, the cap slab and square pots
  bx(shell, 'stoneLarge', Math.min(innerExt, outer) - 0.04, yTop - 0.42, C.lz - w / 2 - 0.04, Math.max(innerExt, outer) + 0.04, yTop - 0.3, C.lz + w / 2 + 0.04, shade(pal.stone, 1.08));
  bx(shell, 'stoneLarge', Math.min(innerExt, outer) - 0.08, yTop, C.lz - w / 2 - 0.08, Math.max(innerExt, outer) + 0.08, yTop + 0.13, C.lz + w / 2 + 0.08, shade(pal.stone, 1.1));
  const pots = w > 1.1 ? [-0.25, 0.25] : [0];
  for (const o2 of pots) bx(shell, 'stone', C.lx - 0.12, yTop + 0.13, C.lz + o2 - 0.12, C.lx + 0.12, yTop + 0.5, C.lz + o2 + 0.12, '#b87a58');
  for (const o2 of pots) ctx.smokes.push({ p: [C.lx, yTop + 0.65, C.lz + o2], opts: { rate: S.variant === 'bakery' ? 1.8 : 1.2, size: 0.9 } });
  ctx.circles.push({ x: s * (S.w / 2), z: C.lz, r: w / 2 });
  ctx.keep.push({ x0: Math.min(inner, outer) - 0.3, z0: C.lz - w / 2 - 0.3, x1: Math.max(inner, outer) + 0.3, z1: C.lz + w / 2 + 0.3 });
}

// ------------------------------------------------------------------ extensions
function monoPlane(F, yw, k) { const s0 = F.off + HT; return { c: yw + k * s0, ax: -k * F.n[0], az: -k * F.n[1] }; }
// a roof sloping away from the house wall F over rect E: start under the main roof's eave, at least `minOut` at the edge
function leanRoof(ctx, F, E, h, { pad = 0.25, minOut = 1.95, mat = null, tint = null, th = null } = {}) {
  const { S, pal } = ctx;
  const R = ctx.roof, thl = th ?? Math.min(pal.roofTh, 0.16);
  const s0 = F.off + HT, depth = Math.abs((E.x1 - E.x0) * F.n[0] + (E.z1 - E.z0) * F.n[1]);
  const over = 0.45;
  // the main roof's underside just beyond the wall, along the extension's width
  let envW = Infinity, envO = Infinity;
  const along = F.tan[0] ? [E.x0, E.x1] : [E.z0, E.z1];
  for (const t of [along[0], (along[0] + along[1]) / 2, along[1]]) {
    const P0 = fp(F, t, 0, HT + 0.02), P1 = fp(F, t, 0, HT + over);
    if (R) { envW = Math.min(envW, envAt(R.planes, P0[0], P0[2])); envO = Math.min(envO, envAt(R.planes, P1[0], P1[2])); }
  }
  if (!R || R.flat) { envW = S.wallTop + 0.5; envO = envW; }
  const yw = Math.min(h + 0.55, envW - thl - 0.06);
  let k = Math.max(0.16, (yw - (envO - thl - 0.04)) / over);
  if (yw - k * depth < minOut) k = Math.max(0.05, (yw - minOut) / depth);
  const yo = yw - k * depth;
  // the eave rect: the extension plus a pad on its three free sides, stopping at the wall
  const Ex = grow(E, pad);
  if (F.n[0] > 0) Ex.x0 = Math.max(Ex.x0, S.w / 2); if (F.n[0] < 0) Ex.x1 = Math.min(Ex.x1, -S.w / 2);
  if (F.n[1] > 0) Ex.z0 = Math.max(Ex.z0, S.d / 2 + (F.face === 'front' ? ctx.jet * 0 : 0)); if (F.n[1] < 0) Ex.z1 = Math.min(Ex.z1, -S.d / 2);
  const P = monoPlane(F, yw, k);
  roofSlab(ctx.shell, mat || pal.roofMat, [P], Ex, thl, tint || pal.roofTint, { uvs: 0.42 });
  if (pal.snow) roofSlab(ctx.shell, 'snowPack', [P], grow(Ex, -0.06), 0.09, SNOW, { soffit: null, topLift: thl });
  return { yw, yo, k, P, Ex, thl };
}
function extension(ctx, E) {
  const { S, shell, detail, pal, r } = ctx;
  const R = rectC(E.lx, E.lz, E.w, E.d), F = faceOf(S, E.face);
  if (E.kind === 'jetty') return; // built with the walls
  if (E.kind === 'dormer') return ctx.cut ? null : dormer(ctx, E);
  if (E.kind === 'porch' || E.open) {
    const L = leanRoof(ctx, F, R, E.h, { pad: 0.18, minOut: 2.05 });
    for (const [px, pz] of E.posts || []) {
      const g = ctx.ground(px, pz), yt = planeY(L.P, px, pz);
      bx(shell, 'stoneLarge', px - 0.17, g - 0.3, pz - 0.17, px + 0.17, g + 0.12, pz + 0.17, shade(pal.stone, 1.05));
      bx(shell, 'beam', px - 0.11, g + 0.12, pz - 0.11, px + 0.11, yt, pz + 0.11, pal.frameC);
    }
    // the beam along the posts' line, under the roof edge
    const ps = E.posts || [];
    if (ps.length >= 2) {
      const ya = planeY(L.P, ps[0][0], ps[0][1]) - 0.02, yb = planeY(L.P, ps[1][0], ps[1][1]) - 0.02;
      beamAB(shell, 'beam', [ps[0][0], ya - 0.09, ps[0][1]], [ps[1][0], yb - 0.09, ps[1][1]], 0.16, 0.18, pal.frameC);
      // knee braces from each post up to the beam, both leaning inward (a chevron, never crossing)
      const dx = ps[1][0] - ps[0][0], dz = ps[1][1] - ps[0][1], Ln = Math.hypot(dx, dz), ux = dx / Ln, uz = dz / Ln;
      for (const [i, sg] of [[0, 1], [1, -1]]) {
        const p = ps[i], y = planeY(L.P, p[0], p[1]);
        beamAB(shell, 'beam', [p[0], y - 0.75, p[1]], [p[0] + ux * sg * 0.55, y - 0.2, p[1] + uz * sg * 0.55], 0.08, 0.08, pal.frameC);
      }
    }
    return;
  }
  // solid extensions stand on their own plinth
  bx(shell, 'stoneLarge', R.x0, ctx.deep, R.z0, R.x1, 0.08, R.z1, ctx.pal.stone);
  if (E.kind === 'leanTo') {
    const plank = r() < 0.6 || S.wall.upper === 'plank';
    const mat = plank ? 'wood' : pal.upperMat, c = plank ? (S.style === 'harrowmouth' ? '#5a4a3c' : '#c8a882') : pal.upperTint;
    const L = leanRoof(ctx, F, R, E.h, { pad: 0.22, minOut: 1.9 });
    const out = [F.n[0], F.n[1]];
    // walls: a box to the low eave, and a wedge up to the roof on the two ends
    const yo = L.yo - 0.02;
    bx(shell, mat, R.x0, 0.08, R.z0, R.x1, yo, R.z1, c);
    const sW = F.off + HT, sO = sW + Math.abs((R.x1 - R.x0) * out[0] + (R.z1 - R.z0) * out[1]);
    const F2 = { face: 'x', n: F.tan, tan: F.n, off: 0 };
    const a0 = F.tan[0] ? R.x0 : R.z0, a1 = F.tan[0] ? R.x1 : R.z1;
    const prof = [[sW, yo], [sO, yo], [sW, L.yw - 0.02]]; // t runs out along the wall's normal
    addPrism(shell, mat, F2, prof, a0, a1, c);
    // a plank door on its far end (closed)
    const Fo = { face: 'o', n: out, tan: F.tan, off: sO - HT, t0: a0, t1: a1 };
    const tc = (a0 + a1) / 2;
    fbox(shell, 'wood', Fo, tc - 0.4, tc + 0.4, 0.1, Math.min(1.85, yo - 0.08), HT, HT + 0.05, shade(pal.door, 0.9));
    fdiag(shell, 'wood', Fo, tc - 0.32, 0.35, tc + 0.32, Math.min(1.6, yo - 0.3), HT + 0.05, HT + 0.07, 0.08, shade(pal.door, 0.75));
    for (const y of [0.28, Math.min(1.7, yo - 0.2)]) fbox(shell, 'wood', Fo, tc - 0.38, tc + 0.38, y - 0.05, y + 0.05, HT + 0.05, HT + 0.075, shade(pal.door, 0.75));
    ctx.braces.push({ face: 'leanTo', a: [tc - 0.32, 0.35], b: [tc + 0.32, Math.min(1.6, yo - 0.3)] });
    return;
  }
  if (E.kind === 'bay') {
    // a solid bay: stone base, walled sides, a framed window proud of its face and a little hipped roof
    const out = [F.n[0], F.n[1]], sW = F.off + HT, depth = E.d, top = 2.15;
    bx(shell, pal.lowerMat || 'stoneLarge', R.x0, 0.08, R.z0, R.x1, 0.85, R.z1, pal.lowerMat ? pal.lowerTint : pal.stone);
    bx(shell, pal.upperMat, R.x0 + 0.03, 0.85, R.z0 + 0.03, R.x1 - 0.03, top, R.z1 - 0.03, pal.upperTint);
    const Fb = { face: 'bay', n: out, tan: F.tan, off: sW + depth - 0.03 - HT, t0: 0, t1: 0 };
    const t0 = F.tan[0] ? R.x0 : R.z0, t1 = F.tan[0] ? R.x1 : R.z1;
    const o = { t0: t0 + 0.16, t1: t1 - 0.16, y0: 1.0, y1: top - 0.14 };
    fbox(shell, 'woodDark', Fb, o.t0 - 0.07, o.t1 + 0.07, o.y0 - 0.07, o.y1 + 0.07, HT, HT + 0.06, pal.winC);
    fbox(shell, 'glassWarm', Fb, o.t0, o.t1, o.y0, o.y1, HT + 0.06, HT + 0.085);
    for (let i = 1; i <= 2; i++) { const t = lerp(o.t0, o.t1, i / 3); fbox(shell, 'woodDark', Fb, t - 0.02, t + 0.02, o.y0, o.y1, HT + 0.1, HT + 0.125, pal.winC); }
    fbox(shell, 'stoneLarge', Fb, t0 - 0.02, t1 + 0.02, 0.85, 0.93, HT - 0.05, HT + 0.12, shade(pal.stone, 1.08));
    const k = 0.55, yE = top + 0.06;
    const planes = [];
    for (const [m, e] of [[out, sW + depth], [F.tan, t1], [[-F.tan[0], -F.tan[1]], -t0]]) planes.push({ c: yE + k * e, ax: -k * m[0], az: -k * m[1] });
    const Ex = grow(R, 0.12);
    if (F.n[0] > 0) Ex.x0 = S.w / 2; if (F.n[0] < 0) Ex.x1 = -S.w / 2; if (F.n[1] > 0) Ex.z0 = S.d / 2; if (F.n[1] < 0) Ex.z1 = -S.d / 2;
    roofSlab(shell, pal.roofMat, planes, Ex, Math.min(0.12, pal.roofTh), pal.roofTint);
    return;
  }
  if (E.kind === 'shopfront') {
    // the counter outside the serving hatch (the hatch itself is cut through the wall)
    bx(shell, 'wood', R.x0, 0.08, R.z0, R.x1, 0.92, R.z1, shade(pal.accent, 1.05));
    bx(shell, 'wood', R.x0 - 0.04, 0.92, R.z0, R.x1 + 0.04, 0.99, R.z1 + 0.05, '#c8a878');
    for (const x of [R.x0 + 0.05, R.x1 - 0.12]) bx(shell, 'beam', x, 0.1, R.z1 - 0.02, x + 0.07, 0.9, R.z1 + 0.015, pal.frameC);
    shopGoods(ctx, R);
    shopSign(ctx);
    return;
  }
  if (E.kind === 'outStair') {
    if (E.h > 6) return turret(ctx, E, R);
    return outStair(ctx, E, R, F);
  }
}
function dormer(ctx, E) {
  const { S, shell, detail, pal } = ctx, R = ctx.roof;
  if (!R || R.flat) return;
  const zf = E.lz + E.d / 2, x0 = E.lx - E.w / 2, x1 = E.lx + E.w / 2;
  // it needs a slope that falls toward the front where it sits
  const act = R.planes.reduce((best, P) => (planeY(P, E.lx, zf) < planeY(best, E.lx, zf) ? P : best), R.planes[0]);
  if (!(act.az < -0.3 && Math.abs(act.ax) < 0.05)) return;
  const yb = planeY(act, E.lx, zf) + R.th - 0.08, yt = yb + E.h;
  const back = zf - (E.h + 0.3) / -act.az - 0.25;
  bx(shell, pal.upperMat, x0, yb, back, x1, yt, zf, pal.upperTint);
  // a window on its face: the pane in a frame, all proud of the dormer's face
  const Fd = { face: 'dormer', n: [0, 1], tan: [1, 0], off: zf - HT, t0: x0, t1: x1 };
  const o = { t0: E.lx - 0.36, t1: E.lx + 0.36, y0: yb + 0.2, y1: yt - 0.18 };
  fbox(shell, 'woodDark', Fd, o.t0 - 0.06, o.t1 + 0.06, o.y0 - 0.06, o.y1 + 0.06, HT, HT + 0.07, pal.winC);
  fbox(shell, 'glassWarm', Fd, o.t0, o.t1, o.y0, o.y1, HT + 0.07, HT + 0.095);
  if (pal.bars === 'v') fbox(shell, 'woodDark', Fd, E.lx - 0.016, E.lx + 0.016, o.y0, o.y1, HT + 0.11, HT + 0.13, pal.winC);
  else fbox(shell, 'woodDark', Fd, o.t0, o.t1, (o.y0 + o.y1) / 2 - 0.016, (o.y0 + o.y1) / 2 + 0.016, HT + 0.11, HT + 0.13, pal.winC);
  // its own little gable roof, ridge running back into the main roof
  const s = 0.75, hw = E.w / 2 + 0.18;
  const hw0 = E.w / 2;
  const planes = [{ c: yt + s * (hw0 + E.lx), ax: -s, az: 0 }, { c: yt + s * (hw0 - E.lx), ax: s, az: 0 }];
  roofSlab(shell, pal.roofMat, planes, { x0: E.lx - hw, z0: back, x1: E.lx + hw, z1: zf + 0.25 }, Math.min(pal.roofTh, 0.16), pal.roofTint);
  gableWall(shell, pal.upperMat, Fd, planes, x0, x1, yt, pal.upperTint, HT);
  void detail;
}
function outStair(ctx, E, R, F) {
  const { S, shell, pal } = ctx;
  // stone steps rising toward the back to a landing at the upper storey, with a rail on posts on the open side
  const n = 15, top = WALL_H - 0.05, land = 1.0;
  const zFront = R.z1, zBack = R.z0, run = zFront - zBack - land;
  const xo = F.n[0] < 0 ? R.x0 : R.x1, xi = F.n[0] < 0 ? R.x1 : R.x0;
  for (let i = 0; i < n; i++) {
    const z1 = zFront - (i * run) / n, z0 = zFront - ((i + 1) * run) / n, y = ((i + 1) * top) / n;
    bx(shell, 'stoneLarge', R.x0, 0.08, z0, R.x1, y, z1 + 0.001, shade(pal.stone, 1 - (i % 2) * 0.04));
  }
  bx(shell, 'stoneLarge', R.x0, 0.08, zBack, R.x1, top, zBack + land, shade(pal.stone, 0.96));
  // the rail: posts at both ends and the middle, a sloped rail resting on them (posts end at the rail)
  const xr = xo - Math.sign(xo - xi) * 0.06, posts = [[zFront - 0.1, (top / n) * 1], [zFront - run / 2, top / 2 + 0.05], [zBack + land - 0.1, top]];
  for (const [z, y] of posts) bx(shell, 'beam', xr - 0.045, y, z - 0.045, xr + 0.045, y + 0.9, z + 0.045, pal.frameC);
  beamAB(shell, 'beam', [xr, posts[0][1] + 0.93, posts[0][0]], [xr, posts[2][1] + 0.93, posts[2][0]], 0.08, 0.06, pal.frameC);
  // a plain upper door on the wall at the landing (closed)
  const Fw = faceOf(S, E.face), tz = zBack + land / 2;
  fbox(shell, 'beam', Fw, tz - 0.5, tz + 0.5, top, top + 2.05, HT, HT + 0.05, pal.frameC);
  fbox(shell, 'wood', Fw, tz - 0.42, tz + 0.42, top + 0.02, top + 1.95, HT + 0.05, HT + 0.08, pal.door);
  for (const y of [top + 0.35, top + 1.6]) fbox(shell, 'wood', Fw, tz - 0.38, tz + 0.38, y - 0.05, y + 0.05, HT + 0.08, HT + 0.1, shade(pal.door, 0.82));
}
function turret(ctx, E, R) {
  const { S, shell, pal } = ctx, h = E.h;
  bx(shell, pal.upperMat, R.x0, 0.08, R.z0, R.x1, h, R.z1, pal.upperTint);
  for (const y of [WALL_H, WALL_H * 2]) bx(shell, 'stoneLarge', R.x0 - 0.06, y - 0.08, R.z0 - 0.06, R.x1 + 0.06, y + 0.06, R.z1 + 0.06, shade(pal.stone, 1.05));
  // slit windows on the outer faces: a dark stone surround with a lit pane proud of it
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  for (const [y, f] of [[1.8, 0], [4.6, 1], [7.4, 0], [6.0, 2]]) {
    const n = f === 0 ? [Math.sign(E.lx), 0] : f === 1 ? [0, -1] : [0, 1];
    const p = [cx + n[0] * (E.w / 2), y, cz + n[1] * (E.d / 2)];
    if (n[0]) { bx(shell, 'stoneDark', p[0] - 0.02 * n[0], y - 0.5, p[2] - 0.2, p[0] + 0.05 * n[0], y + 0.5, p[2] + 0.2, shade(pal.stone, 0.7)); bx(shell, 'glassWarm', p[0] + 0.05 * n[0], y - 0.4, p[2] - 0.1, p[0] + 0.07 * n[0], y + 0.4, p[2] + 0.1); }
    else { bx(shell, 'stoneDark', p[0] - 0.2, y - 0.5, p[2] - 0.02 * n[1], p[0] + 0.2, y + 0.5, p[2] + 0.05 * n[1], shade(pal.stone, 0.7)); bx(shell, 'glassWarm', p[0] - 0.1, y - 0.4, p[2] + 0.05 * n[1], p[0] + 0.1, y + 0.4, p[2] + 0.07 * n[1]); }
  }
  // corbelled top with flat merlons and a low pyramid cap (four planes)
  bx(shell, 'stoneDark', R.x0 - 0.12, h - 0.25, R.z0 - 0.12, R.x1 + 0.12, h + 0.05, R.z1 + 0.12, shade(pal.stone, 0.8));
  for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) bx(shell, pal.upperMat, (sx ? R.x1 - 0.3 : R.x0 - 0.12), h + 0.05, (sz ? R.z1 - 0.3 : R.z0 - 0.12), (sx ? R.x1 + 0.12 : R.x0 + 0.3), h + 0.55, (sz ? R.z1 + 0.12 : R.z0 + 0.3), pal.upperTint);
  // a flat lead top with a square hatch (no pyramid: its hips would read as an X from above)
  const I = grow(R, -0.18);
  bx(shell, 'iron', I.x0, h + 0.05, I.z0, I.x1, h + 0.13, I.z1, '#8a8c90');
  bx(shell, 'woodDark', (I.x0 + I.x1) / 2 - 0.3, h + 0.13, (I.z0 + I.z1) / 2 - 0.3, (I.x0 + I.x1) / 2 + 0.3, h + 0.3, (I.z0 + I.z1) / 2 + 0.3, '#6a5444');
}
// the shop's sign: an iron arm out from the wall and a hanging board with a picture of the trade on both faces (no text)
function shopSign(ctx) {
  const { S, detail, pal } = ctx, F = faceOf(S, 'front'), t = S.door.lx + (S.door.lx > 0 ? 1.15 : -1.15) * 0;
  const tS = S.door.lx < 0 ? S.door.lx - DOOR_W / 2 - 0.45 : S.door.lx + DOOR_W / 2 + 0.45;
  const y = 2.78, arm = 0.95;
  fbox(detail, 'iron', F, tS - 0.025, tS + 0.025, y, y + 0.05, HT, HT + arm, '#3a3634');
  beamAB(detail, 'iron', fp(F, tS, y - 0.45, HT + 0.01), fp(F, tS, y + 0.01, HT + 0.5), 0.035, 0.035, '#3a3634');
  const uc = HT + arm - 0.42;
  for (const du of [-0.27, 0.27]) fbox(detail, 'iron', F, tS - 0.012, tS + 0.012, y - 0.14, y, uc + du - 0.012, uc + du + 0.012, '#3a3634');
  // the board hangs edge-on to the wall, so both faces show to the street
  const Fs = { face: 'sign', n: F.tan, tan: F.n, off: 0 };
  const a = fp(F, tS, y - 0.68, uc - 0.34), b = fp(F, tS, y - 0.14, uc + 0.34);
  bx(detail, 'wood', a[0] - 0.02 * F.tan[0] - 0.0, a[1], a[2] - 0.02 * F.tan[1], b[0] + 0.02 * F.tan[0], b[1], b[2] + 0.02 * F.tan[1], shade(pal.accent, 1.15));
  const pic = (kind, sgn) => {
    const base = fp(F, tS, y - 0.41, uc); const nx = F.tan[0] * sgn, nz = F.tan[1] * sgn;
    const at = (du, dy, dn) => [base[0] + F.n[0] * du + nx * dn, base[1] + dy, base[2] + F.n[1] * du + nz * dn];
    const yaw = Math.atan2(F.n[0], F.n[1]);
    if (kind === 'bakery') { rbx(detail, 'cloth', at(0, 0, 0.04), [0.42, 0.16, 0.05], yaw, '#c88a40'); rbx(detail, 'cloth', at(0, 0.09, 0.05), [0.3, 0.06, 0.05], yaw, '#e0a860'); }
    else if (kind === 'weaver') { for (let i = 0; i < 3; i++) rbx(detail, 'cloth', at(0, -0.12 + i * 0.11, 0.035), [0.38 - i * 0.04, 0.09, 0.04], yaw, ['#4a5a8a', '#8a3a2a', '#d8c8a0'][i]); }
    else if (kind === 'clerk') { rbx(detail, 'cloth', at(0, 0, 0.035), [0.34, 0.26, 0.04], yaw, '#5a3a2a'); rbx(detail, 'cloth', at(0.0, 0, 0.06), [0.28, 0.2, 0.02], yaw, '#efe6d2'); }
    else { rbx(detail, 'cloth', at(0, -0.05, 0.04), [0.24, 0.24, 0.05], yaw, '#b8643a'); rbx(detail, 'cloth', at(0, 0.11, 0.04), [0.14, 0.08, 0.05], yaw, '#a8582e'); }
  };
  for (const sg of [-1, 1]) pic(S.variant || 'chandler', sg);
  void t; void Fs; void a;
}
// what the shop puts out on its counter
function shopGoods(ctx, R) {
  const { S, detail, r } = ctx, v = S.variant || 'chandler';
  const n = Math.max(3, Math.round((R.x1 - R.x0) / 0.42));
  for (let i = 0; i < n; i++) {
    const x = lerp(R.x0 + 0.22, R.x1 - 0.22, i / (n - 1)), z = (R.z0 + R.z1) / 2 + between(r, -0.08, 0.08);
    if (v === 'bakery') rbx(detail, 'cloth', [x, 1.05, z], [0.3, 0.12, 0.17], between(r, -0.2, 0.2), pick(r, ['#c88a40', '#b8783a', '#d8a050']));
    else if (v === 'weaver') rbx(detail, 'cloth', [x, 1.04, z], [0.34, 0.1, 0.26], 0, pick(r, ['#4a5a8a', '#8a3a2a', '#d8c8a0', '#5e7a4e']));
    else if (v === 'clerk') rbx(detail, 'cloth', [x, 1.01, z], [0.24, 0.03, 0.18], between(r, -0.3, 0.3), '#efe6d2');
    else detail.add(lathe([[0.001, 0], [0.09, 0], [0.11, 0.1], [0.08, 0.2], [0.06, 0.22], [0.001, 0.22]], 8), 'cloth', { p: [x, 0.99, z], c: pick(r, ['#b8643a', '#8a6a4a', '#5a6a5a']) });
  }
}
// tower top extras, the works' pipes, the smithy's open bay, farm gardens
function extras(ctx) {
  const { S, shell, detail, pal, r } = ctx;
  if (S.arch === 'works') {
    // a dark iron steam pipe up one corner, a short run under the eaves and an elbow into the wall, a square gauge box
    // by the door (v112 leftovers: was a brass run down, along the whole wall and down again, a big gold rectangle)
    const F = faceOf(S, r() < 0.5 ? 'left' : 'right'), y = S.wallTop - 0.35;
    const tA = F.t0 + 0.4, tB = Math.min(tA + 1.1, F.t1 - 0.6), pc = '#3a3633';
    const opens = openingsOn(S, F.face);
    const clear = (t) => opens.every((o) => t < o.t0 - 0.2 || t > o.t1 + 0.2);
    if (clear(tA)) {
      squarePipe(detail, 'iron', fp(F, tA, -0.1, HT + 0.14), fp(F, tA, y, HT + 0.14), 0.07, pc);
      squarePipe(detail, 'iron', fp(F, tA, y, HT + 0.14), fp(F, tB, y, HT + 0.14), 0.06, pc);
      squarePipe(detail, 'iron', fp(F, tB, y, HT + 0.14), fp(F, tB, y, 0.02), 0.06, pc);
    }
    const Fd = faceOf(S, doorFace(S)), td = doorT(S), tg = td + (td > 0 ? -1 : 1) * (DOOR_W / 2 + 0.55);
    if (openingsOn(S, Fd.face).every((o) => o.kind === 'door' || tg < o.t0 - 0.3 || tg > o.t1 + 0.3)) {
      fbox(detail, 'brass', Fd, tg - 0.18, tg + 0.18, 1.4, 1.84, HT, HT + 0.12);
      fbox(detail, 'cloth', Fd, tg - 0.12, tg + 0.12, 1.5, 1.74, HT + 0.12, HT + 0.14, '#e8e0c8');
      fbox(detail, 'iron', Fd, tg - 0.01, tg + 0.01, 1.58, 1.7, HT + 0.14, HT + 0.155, '#2a2826'); // the needle, upright
    }
  }
  if (S.arch === 'smithy') {
    // the open bay under the lean-to: an anvil on a block, a square quench trough, a tool rack on the wall
    const E = S.ext.find((e) => e.kind === 'leanTo');
    if (E) {
      const ax = E.lx, az = E.lz + 0.6, g = ctx.ground(ax, az);
      bx(shell, 'beam', ax - 0.25, g, az - 0.25, ax + 0.25, g + 0.5, az + 0.25, '#6a5040');
      bx(shell, 'iron', ax - 0.3, g + 0.5, az - 0.12, ax + 0.3, g + 0.78, az + 0.12, '#4a4848');
      bx(shell, 'wood', ax - 0.7, g, az - 1.6, ax + 0.4, g + 0.6, az - 1.0, '#6a5040');
      bx(shell, 'stoneDark', ax - 0.62, g + 0.45, az - 1.52, ax + 0.32, g + 0.56, az - 1.08, '#2a3a40');
      ctx.circles.push({ x: ax, z: az, r: 0.45 }, { x: ax - 0.15, z: az - 1.3, r: 0.5 });
    }
  }
}

// ------------------------------------------------------------------ yard props (detail; circles for the bigger ones)
const PROPS = {
  sunmere: ['woodpile', 'barrel', 'crates', 'bench', 'sacks', 'ladder', 'tools', 'barrel', 'washing', 'vegbed', 'hitch'],
  farmland: ['woodpile', 'barrel', 'cart', 'vegbed', 'sacks', 'tools', 'washing', 'fence', 'crates', 'ladder'],
  ledgerholm: ['crates', 'barrel', 'bench', 'sacks', 'woodpile', 'hitch'],
  harrowmouth: ['rack', 'barrel', 'crates', 'woodpile', 'bench', 'sacks', 'tools'],
  reach: ['crates', 'sacks', 'coal', 'barrel', 'crates'],
  rime: ['woodpile', 'crates', 'sacks', 'barrel', 'coal'],
  heights: ['crates', 'woodpile', 'sacks', 'coal'],
};
function yard(ctx) {
  const { S, r } = ctx;
  const list = (PROPS[S.style] || PROPS.sunmere).slice();
  // the archetype's own: the farmhouse has its kitchen garden, the shop its sacks, the works its coal
  const want = [];
  if (S.arch === 'farmhouse') want.push('garden', 'barrel', 'cart');
  if (S.arch === 'smithy') want.push('woodpile', 'coal');
  if (S.arch === 'longhouse') want.push('woodpile');
  const n = S.arch === 'works' ? 3 : 4 + Math.floor(r() * 2);
  while (want.length < n && list.length) want.push(list.splice(Math.floor(r() * list.length), 1)[0]);
  const placed = [];
  for (const kind of want) placeProp(ctx, kind, placed);
}
const SIZE = { woodpile: [1.5, 0.62], barrel: [0.7, 0.7], crates: [1.0, 0.7], bench: [1.5, 0.5], sacks: [1.0, 0.7], ladder: [0.6, 0.25], tools: [0.7, 0.25], washing: [3.2, 0.4], vegbed: [2.2, 1.1], hitch: [1.8, 0.3], cart: [1.4, 2.2], fence: [2.6, 0.2], garden: [3.0, 2.0], rack: [2.2, 0.8], coal: [1.2, 0.9] };
const GAP = { washing: 1.4, vegbed: 0.9, garden: 1.0, cart: 0.8, hitch: 1.6, rack: 1.1 }; // distance from the wall
function placeProp(ctx, kind, placed) {
  const { S, r } = ctx, [w, d] = SIZE[kind] || [1, 0.6], gap = GAP[kind] ?? 0.2;
  const tries = [];
  for (const f of FACES) {
    const F = faceOf(S, f);
    const ends = f === 'front' || f === 'back' ? [-S.w / 2, S.w / 2] : [-S.d / 2, S.d / 2];
    for (let t = ends[0] + w / 2 - 0.2; t <= ends[1] - w / 2 + 0.2; t += 0.35) tries.push([F, t, r()]);
  }
  tries.sort((p, q) => p[2] - q[2]);
  for (const [F, t] of tries) {
    const u0 = HT + 0.12 + gap, u1 = u0 + d;
    const A = fp(F, t - w / 2, 0, u0), B = fp(F, t + w / 2, 0, u1);
    const rect = { x0: Math.min(A[0], B[0]), z0: Math.min(A[2], B[2]), x1: Math.max(A[0], B[0]), z1: Math.max(A[2], B[2]) };
    if (ctx.keep.some((K) => rOverlap(K, rect)) || placed.some((P) => rOverlap(grow(P, 0.25), rect))) continue;
    // the ground must be fairly level and nobody else's house there
    const cs = [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]];
    const gs = cs.map(([x, z]) => ctx.ground(x, z));
    if (Math.max(...gs) - Math.min(...gs) > 0.45 || cs.some(([x, z]) => ctx.blocked(x, z))) continue;
    // tall props keep off windows; nothing covers the door's face near the door
    if (['ladder', 'tools', 'woodpile', 'rack', 'washing'].includes(kind) && openingsOn(S, F.face).some((o) => o.kind !== 'door' && t + w / 2 > o.t0 - 0.1 && t - w / 2 < o.t1 + 0.1 && o.y0 < 2.2 && kind !== 'washing')) continue;
    placed.push(rect);
    buildProp(ctx, kind, F, t, u0, u1, w, Math.min(...gs));
    return true;
  }
  return false;
}
function buildProp(ctx, kind, F, t, u0, u1, w, g) {
  const { detail: b, r, pal, S } = ctx, um = (u0 + u1) / 2, yaw = Math.atan2(F.n[0], F.n[1]);
  const P = (tt, y, u) => fp(F, tt, y, u);
  const circ = (tt, u, rad) => { const p = P(tt, 0, u); ctx.circles.push({ x: p[0], z: p[2], r: rad }); };
  if (kind === 'woodpile') {
    // split logs stacked along the wall under a plank lid
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
      const p = P(t - w / 2 + 0.15 + (i + row * 0.5) * 0.24, g + 0.1 + row * 0.19, um);
      b.add(cyl(0.1, 0.1, u1 - u0, 7), 'bark', { p, r: F.tan[0] ? [PI / 2, 0, 0] : [0, 0, PI / 2], c: '#e0c8a8' });
    }
    fbox(b, 'beam', F, t - w / 2 - 0.05, t + w / 2 + 0.05, g + 0.68, g + 0.72, u0 - 0.05, u1 + 0.08, '#8a7058');
    for (const tt of [t - w / 2, t + w / 2]) fbox(b, 'beam', F, tt - 0.04, tt + 0.04, g, g + 0.68, u1 - 0.06, u1 + 0.02, '#6a5444');
    circ(t - w / 4, um, (u1 - u0) / 2 + 0.05); circ(t + w / 4, um, (u1 - u0) / 2 + 0.05);
  } else if (kind === 'barrel') {
    barrel(b, P(t, g, um), 0.3, 0.78, pick(r, ['#a07a50', '#8a6a48']));
    circ(t, um, 0.36);
  } else if (kind === 'crates') {
    crate(b, P(t - 0.2, g, um), 0.55, yaw + between(r, -0.15, 0.15));
    crate(b, P(t + 0.28, g, um + 0.02), 0.45, yaw + between(r, -0.3, 0.3));
    if (r() < 0.6) crate(b, P(t - 0.18, g + 0.55, um), 0.42, yaw + 0.2);
    circ(t - 0.15, um, 0.36); circ(t + 0.3, um, 0.3);
  } else if (kind === 'bench') {
    fbox(b, 'wood', F, t - w / 2, t + w / 2, g + 0.42, g + 0.48, u0, u1, '#a07a50');
    for (const tt of [t - w / 2 + 0.15, t + w / 2 - 0.15]) fbox(b, 'beam', F, tt - 0.05, tt + 0.05, g, g + 0.42, u0 + 0.05, u1 - 0.05, '#6a5040');
    circ(t - 0.4, um, 0.25); circ(t + 0.4, um, 0.25);
  } else if (kind === 'sacks') {
    for (let i = 0; i < 3; i++) b.add(lumpy(sphere(0.3, 8, 6), 0.05, 2.2, S.seed + i, { flatBottom: -0.2 }), 'cloth', { p: P(t - 0.3 + i * 0.3, g + 0.24 + (i === 1 ? 0.02 : 0), um + (i % 2) * 0.05), s: [1, 0.75, 0.85], c: pick(r, ['#c8b088', '#b8a078', '#d0bc94']) });
    circ(t, um, 0.45);
  } else if (kind === 'ladder') {
    // two rails leaning on the wall and rungs between them (rungs end at the rails)
    const L = Math.min(3.2, S.wallTop - 0.2), lean = 0.55;
    for (const tt of [t - 0.2, t + 0.2]) beamAB(b, 'beam', P(tt, g, HT + 0.12 + lean), P(tt, g + L, HT + 0.08), 0.05, 0.06, '#8a6a48');
    for (let i = 1; i < 8; i++) { const k = i / 8; fbox(b, 'beam', F, t - 0.18, t + 0.18, g + L * k - 0.02, g + L * k + 0.02, HT + 0.1 + lean * (1 - k) - 0.02, HT + 0.1 + lean * (1 - k) + 0.02, '#9a7a58'); }
  } else if (kind === 'tools') {
    // a spade and a rake leaning side by side (never crossed)
    beamAB(b, 'beam', P(t - 0.15, g, HT + 0.4), P(t - 0.12, g + 1.45, HT + 0.06), 0.035, 0.035, '#8a6a48');
    fbox(b, 'iron', F, t - 0.28, t - 0.02, g, g + 0.3, HT + 0.38, HT + 0.42, '#6a6866');
    beamAB(b, 'beam', P(t + 0.2, g + 0.2, HT + 0.36), P(t + 0.22, g + 1.6, HT + 0.06), 0.035, 0.035, '#8a6a48');
    fbox(b, 'iron', F, t + 0.05, t + 0.39, g + 1.6, g + 1.64, HT + 0.04, HT + 0.1, '#5a5856');
    for (let i = 0; i < 6; i++) fbox(b, 'iron', F, t + 0.07 + i * 0.058, t + 0.085 + i * 0.058, g + 1.64, g + 1.74, HT + 0.05, HT + 0.08, '#5a5856');
  } else if (kind === 'washing') {
    // two posts, a line between them and plain cloths pegged on it
    const pa = t - w / 2 + 0.1, pb = t + w / 2 - 0.1;
    for (const tt of [pa, pb]) fbox(b, 'beam', F, tt - 0.05, tt + 0.05, g, g + 1.9, um - 0.05, um + 0.05, '#8a6a48');
    beamAB(b, 'beam', P(pa, g + 1.82, um), P(pb, g + 1.82, um), 0.012, 0.012, '#d8d0c0');
    const cols = ['#e8e0d0', '#c8d0d8', '#d8c8a8', '#a8b8a0', '#e0d8c8'];
    for (let i = 0; i < 4; i++) { const tt = lerp(pa + 0.35, pb - 0.35, i / 3), cw = between(r, 0.4, 0.62), ch = between(r, 0.45, 0.75); b.add(boxG(F.tan[0] ? cw : 0.02, ch, F.tan[0] ? 0.02 : cw), 'cloth', { p: P(tt, g + 1.8 - ch / 2, um), uv: 'box', c: cols[(i + S.seed) % cols.length], w: [0, 0, 0, 0.04] }); }
    circ(pa, um, 0.15); circ(pb, um, 0.15);
  } else if (kind === 'vegbed' || kind === 'garden') {
    const hw = w / 2;
    fbox(b, 'beam', F, t - hw, t + hw, g - 0.05, g + 0.16, u0, u1, '#7a5a40');
    fbox(b, 'dirtPlain', F, t - hw + 0.06, t + hw - 0.06, g + 0.1, g + 0.17, u0 + 0.06, u1 - 0.06, '#5a4030');
    const rows = Math.max(2, Math.round((u1 - u0) / 0.38));
    for (let i = 0; i < rows; i++) for (let j = 0; j < Math.round(w / 0.36); j++) tuft(b, 'grassCard', P(t - hw + 0.22 + j * 0.36, g + 0.16, u0 + 0.2 + i * ((u1 - u0 - 0.4) / Math.max(1, rows - 1))), 0.3, 0.32, j, ['#7a9a40', '#5a8a3a', '#9aaa50'][i % 3]);
    if (kind === 'garden') {
      // a low panel fence on three sides (solid wattle panels between posts: no rails to cross)
      const sides = [[t - hw - 0.15, t + hw + 0.15, u1 + 0.15, u1 + 0.2], [t - hw - 0.15, t - hw - 0.1, u0 - 0.2, u1 + 0.2], [t + hw + 0.1, t + hw + 0.15, u0 - 0.2, u1 + 0.2]];
      for (const [a, c2, ua, ub] of sides) fbox(b, 'wood', F, a, c2, g, g + 0.62, ua, ub, '#9a7a50');
      for (const [tt, uu] of [[t - hw - 0.13, u1 + 0.18], [t + hw + 0.13, u1 + 0.18], [t - hw - 0.13, u0 - 0.18], [t + hw + 0.13, u0 - 0.18]]) fbox(b, 'beam', F, tt - 0.05, tt + 0.05, g, g + 0.75, uu - 0.05, uu + 0.05, '#6a5040');
      for (const k of [-1, 1]) circ(t + k * hw * 0.5, u1 + 0.1, 0.3);
    }
    circ(t - hw / 2, um, Math.min(0.5, (u1 - u0) / 2)); circ(t + hw / 2, um, Math.min(0.5, (u1 - u0) / 2));
  } else if (kind === 'hitch') {
    for (const tt of [t - w / 2 + 0.1, t + w / 2 - 0.1]) fbox(b, 'beam', F, tt - 0.06, tt + 0.06, g, g + 1.05, um - 0.06, um + 0.06, '#6a5040');
    fbox(b, 'beam', F, t - w / 2 + 0.04, t + w / 2 - 0.04, g + 1.05, g + 1.15, um - 0.06, um + 0.06, '#7a5a44');
    circ(t - w / 2 + 0.1, um, 0.15); circ(t + w / 2 - 0.1, um, 0.15);
  } else if (kind === 'cart') {
    // a hand-cart: a plank bed on solid board wheels with square hub blocks, its handles resting on the ground
    const c = P(t, g, um);
    const tmp = new Builder(5);
    bx(tmp, 'wood', -0.6, 0.55, -0.45, 0.6, 0.62, 0.45, '#9a7a50');
    for (const sx of [-1, 1]) bx(tmp, 'wood', -0.6, 0.62, sx * 0.45 - 0.03, 0.6, 0.85, sx * 0.45 + 0.03, '#8a6a48');
    for (const sz of [-1, 1]) { tmp.add(cyl(0.38, 0.38, 0.07, 10), 'wood', { p: [0.05, 0.38, sz * 0.52], r: [PI / 2, 0, 0], c: '#7a5a40' }); bx(tmp, 'beam', -0.06, 0.32, sz * 0.52 - 0.06, 0.16, 0.44, sz * 0.52 + 0.06, '#5a4434'); }
    for (const sz of [-0.3, 0.3]) beamAB(tmp, 'beam', [0.6, 0.58, sz], [1.35, 0.05, sz], 0.05, 0.05, '#6a5040');
    b.addBuilder(tmp, { p: c, r: [0, yaw + PI / 2 + between(r, -0.2, 0.2), 0] });
    circ(t, um, 0.7);
  } else if (kind === 'fence') {
    fbox(b, 'wood', F, t - w / 2, t + w / 2, g, g + 0.7, u0, u1, '#9a7a50');
    for (const tt of [t - w / 2, t, t + w / 2]) fbox(b, 'beam', F, tt - 0.05, tt + 0.05, g, g + 0.82, um - 0.05, um + 0.05, '#6a5040');
    circ(t - w / 4, um, 0.15); circ(t + w / 4, um, 0.15);
  } else if (kind === 'rack') {
    // the drying rack: two square frames of poles with poles laid across the tops (all level, none crossed)
    for (const tt of [t - w / 2 + 0.1, t + w / 2 - 0.1]) for (const uu of [u0 + 0.05, u1 - 0.05]) fbox(b, 'beam', F, tt - 0.04, tt + 0.04, g, g + 1.7, uu - 0.04, uu + 0.04, '#7a6048');
    for (const uu of [u0 + 0.05, u1 - 0.05]) fbox(b, 'beam', F, t - w / 2 + 0.06, t + w / 2 - 0.06, g + 1.7, g + 1.76, uu - 0.035, uu + 0.035, '#8a7058');
    circ(t - w / 2 + 0.1, um, 0.42); circ(t + w / 2 - 0.1, um, 0.42);
  } else if (kind === 'coal') {
    fbox(b, 'wood', F, t - w / 2, t + w / 2, g, g + 0.55, u0, u1, '#5a4a3c');
    for (let i = 0; i < 6; i++) b.add(boxG(0.22, 0.14, 0.2), 'iron', { p: P(t - w / 2 + 0.2 + (i % 3) * 0.38, g + 0.58, u0 + 0.25 + Math.floor(i / 3) * 0.4), r: [0, i, 0.3], uv: 'box', c: '#2a2826' });
    circ(t, um, 0.5);
  }
  void pal;
}
export function barrel(b, p, rad, h, c) {
  b.add(lathe([[0.001, 0], [rad * 0.88, 0], [rad, h * 0.3], [rad, h * 0.7], [rad * 0.88, h], [0.001, h]], 10), 'wood', { p, c });
  for (const k of [0.17, 0.83]) b.add(cyl(rad * 0.985 + 0.012, rad * 0.985 + 0.012, 0.045, 10, 1, true), 'iron', { p: [p[0], p[1] + h * k, p[2]], c: '#4a4644' });
}
export function crate(b, p, s, ry, c = '#b08a5a') {
  b.add(boxG(s, s, s), 'wood', { p: [p[0], p[1] + s / 2, p[2]], r: [0, ry, 0], uv: 'box', c });
  // edge slats on two faces, all level (never an X on a crate)
  for (const y of [0.08, s - 0.08]) b.add(boxG(s + 0.02, 0.06, s + 0.02), 'wood', { p: [p[0], p[1] + y, p[2]], r: [0, ry, 0], uv: 'box', c: shade(c, 0.8) });
}
export { rectC, grow, inR, rOverlap, NORMAL };
