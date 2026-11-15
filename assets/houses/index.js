// Enterable houses: the art side (WP2). The shared model (shared/houses.js) says where every house stands, how big it is,
// where its door, windows, walls and NPC spots are; this module turns a Spec into geometry.
//
//   buildHouseGroup(specs) -> { shell, detail, smokes, lanterns, glows, fires, circles }
//       One call per settlement group (housesIn(group)). shell and detail are Builders already in WORLD coordinates
//       (merged across the group: one draw per material). shell = walls, roofs, chimneys, frames, openings, door
//       leaves, steps, extensions (the cut-away shader works on it); detail = shutters, flower boxes, gutters, hardware,
//       lanterns' brackets, signs and yard props (hide it beyond 70 m, 45 m on phones). circles: {x, z, r} world
//       colliders for yard props and chimney stacks outside the walls (the walls themselves are spec.walls).
//   buildInterior(spec) -> { builder, circles, lamps, fires }
//       The inside of one house in WORLD coordinates: floors, lining, partitions, joists, hearth and furniture.
//       circles are furniture colliders; lamps [{p, color, scale}] for the light pool; fires [{p, scale, light}].
//   houseGallery() -> { name: { cat, make(seed) } } entries for client/assets/index.js.
//   buildHouseLocal(spec, opts) / buildInteriorLocal(spec): the same in house space (y = 0 at the floor), for tools.
import { Builder } from '../kit.js';
import { houseSpec, housesIn, allHouses, ARCHES, STYLES } from '/sunmere-play/shared/houses.js';
import { heightAt } from '/sunmere-play/shared/terrain.js';
import { makeCtx, buildExterior } from './archetypes.js';
import { buildInteriorLocal, partGaps } from './interiors.js';
import { bx, fp, faceOf, doorFace, doorT, HT } from './parts.js';
import { WALL_H } from '/sunmere-play/shared/houses.js';
import { cgtEnabled } from './cgt.js';

export { buildInteriorLocal };

// house space -> world (the same turn as placeObject and shared/houses.js localToWorld)
function toWorld(S, p) { const c = Math.cos(S.rot), s = Math.sin(S.rot); return [S.x + p[0] * c + p[2] * s, p[1] + S.floorY, S.z - p[0] * s + p[2] * c]; }
function toWorld2(S, x, z) { const c = Math.cos(S.rot), s = Math.sin(S.rot); return [S.x + x * c + z * s, S.z - x * s + z * c]; }
function toLocal2(S, x, z) { const c = Math.cos(S.rot), s = Math.sin(S.rot), dx = x - S.x, dz = z - S.z; return [dx * c - dz * s, dx * s + dz * c]; }
function worldGround(S) { return (lx, lz) => { const [x, z] = toWorld2(S, lx, lz); return heightAt(x, z) - S.floorY; }; }
// is a world point inside another house's cut-away box (its footprint, extensions and eaves)?
function inBox(B, x, z, pad = 0) { const c = Math.cos(B.rot), s = Math.sin(B.rot), dx = x - B.x, dz = z - B.z; const lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < B.hw + pad && Math.abs(lz) < B.hd + pad; }

// one house in house space: { shell, detail, smokes, lanterns, glows, fires, circles, braces, ... } (see archetypes.js)
export function buildHouseLocal(S, opts = {}) {
  const ground = opts.ground || worldGround(S);
  let blocked = opts.blocked;
  if (!blocked && !opts.ground) {
    const near = allHouses().filter((o) => o !== S && Math.hypot(o.x - S.x, o.z - S.z) < 40);
    blocked = (lx, lz) => { const [x, z] = toWorld2(S, lx, lz); return near.some((o) => inBox(o.cutBox, x, z, 0.2)); };
  }
  const ctx = makeCtx(S, ground, { blocked, cut: !!opts.cut, shellOnly: !!S.shell && (opts.shell ?? cgtEnabled()) }); // (v109: a CGTrader model stands in, houses/cgt.js)
  buildExterior(ctx);
  return ctx;
}

export function buildHouseGroup(specs) {
  const out = { shell: new Builder(11), detail: new Builder(12), smokes: [], lanterns: [], glows: [], fires: [], circles: [] };
  for (const S of specs) {
    const ctx = buildHouseLocal(S);
    const m = { p: [S.x, S.floorY, S.z], r: [0, S.rot, 0] };
    out.shell.addBuilder(ctx.shell, m);
    out.detail.addBuilder(ctx.detail, m);
    for (const sm of ctx.smokes) out.smokes.push({ ...sm, p: toWorld(S, sm.p), house: S.id }); // (house: the world hides it over a cut-away room)
    for (const l of ctx.lanterns) out.lanterns.push({ ...l, p: toWorld(S, l.p), house: S.id }); // (v109: hidden with its glow while the house is cut open)
    for (const g of ctx.glows) out.glows.push({ ...g, p: toWorld(S, g.p) });
    for (const f of ctx.fires) out.fires.push({ ...f, p: toWorld(S, f.p) });
    for (const c of ctx.circles) { const [x, z] = toWorld2(S, c.x, c.z); out.circles.push({ x, z, r: c.r, house: S.id }); }
  }
  return out;
}

// props: true lists the ready-made pieces (interiors.js) as props [{ name, p, ry, s, fb }] in WORLD space (fb a Builder
// of the built stand-in, in world space too) instead of building them in
export function buildInterior(spec, { props = false } = {}) {
  const S = typeof spec === 'string' ? houseSpec(spec) : spec;
  const L = buildInteriorLocal(S, { props });
  const builder = new Builder(13), m = { p: [S.x, S.floorY, S.z], r: [0, S.rot, 0] };
  builder.addBuilder(L.builder, m);
  return {
    builder,
    props: L.props.map((P) => { const fb = new Builder(14); fb.addBuilder(P.fb, m); return { name: P.name, p: toWorld(S, P.p), ry: S.rot + P.ry, s: P.s, fb }; }),
    circles: L.circles.map((c) => { const [x, z] = toWorld2(S, c.x, c.z); return { x, z, r: c.r, kind: c.kind, house: S.id }; }),
    lamps: L.lamps.map((l) => ({ ...l, p: toWorld(S, l.p) })),
    fires: L.fires.map((f) => ({ ...f, p: toWorld(S, f.p) })),
  };
}

// ------------------------------------------------------------------ the asset gallery
export const STYLE_KEYS = Object.keys(STYLES);
const VARIANTS = ['bakery', 'weaver', 'clerk', 'chandler'];
// a made-up site for any archetype, style and seed (the gallery and the audit use these)
export function gallerySite(arch, seed, style = STYLE_KEYS[seed % STYLE_KEYS.length]) {
  const site = { id: `gal_${arch}_${style}_${seed}`, arch, seed: 1000 + seed * 37 + ARCHES.indexOf(arch) * 7, style, group: 'gallery', x: 0, z: 0, rot: 0, enter: true, role: seed % 3 ? 'home' : 'work' };
  if (arch === 'shop') site.variant = VARIANTS[seed % VARIANTS.length];
  if (arch === 'works' && seed % 2) site.chimney = 3.2;
  return site;
}
const flat = (S) => () => -0.3; // a level yard 0.3 m under the floor
// gallery-ready result: everything in one builder with the ground at y = 0
export function galleryHouse(arch, seed, { style, interior = false, cut = false } = {}) {
  const S = houseSpec(gallerySite(arch, seed, style));
  const ctx = buildHouseLocal(S, { ground: flat(S), cut });
  const b = new Builder(3), m = { p: [0, 0.3, 0] };
  b.addBuilder(ctx.shell, m); b.addBuilder(ctx.detail, m);
  const lift = (p) => [p[0], p[1] + 0.3, p[2]];
  const res = { builder: b, smokes: ctx.smokes.map((s) => ({ ...s, p: lift(s.p) })), lanterns: ctx.lanterns.map((l) => ({ ...l, p: lift(l.p) })), glows: [], fires: [], spec: S };
  if (interior) {
    const I = buildInteriorLocal(S);
    b.addBuilder(I.builder, m);
    res.fires = I.fires.map((f) => ({ ...f, p: lift(f.p) }));
    res.glows = I.lamps.map((l) => ({ p: lift(l.p), color: l.color, size: 1.2, intensity: 0.5 }));
  }
  return res;
}
export function houseGallery() {
  const out = {};
  for (const arch of ARCHES) {
    out['house_' + arch] = { cat: 'Houses', make: (s) => galleryHouse(arch, s) };
    out['inside_' + arch] = { cat: 'Houses', make: (s) => galleryHouse(arch, s, { interior: true, cut: true }) };
  }
  return out;
}
// ------------------------------------------------------------------ the RuneScape-style cut-away (v108)
// The wainscot line (over the floor): walls, partitions, posts and extensions are cut down to it while the house is open.
export const CUT_LOW = 0.8, CUT_CEIL = 2.2;
// the partition lines in house space, each one rect over its whole run (gaps, door heads and frames included), for the
// shader's cutP (at most 6)
export function cutParts(S) {
  const I = S.inner, lines = new Map();
  for (const P of S.parts) {
    const alongX = P.x1 - P.x0 > P.z1 - P.z0, key = alongX ? 'x' + ((P.z0 + P.z1) / 2).toFixed(2) : 'z' + ((P.x0 + P.x1) / 2).toFixed(2);
    const R = lines.get(key);
    if (!R) lines.set(key, alongX ? { x0: I.x0, z0: P.z0, x1: I.x1, z1: P.z1 } : { x0: P.x0, z0: I.z0, x1: P.x1, z1: I.z1 });
  }
  // the door leaf (archetypes.js door: open inward at 100 degrees, hinged at the jamb nearer the corner), shrunk by the
  // shader's 0.14 m reach so the cut takes the leaf and nothing beside it
  if (S.enter) {
    const F = faceOf(S, doorFace(S)), td = doorT(S), s = td < 0 ? -1 : 1, th = td + s * (0.75 - 0.08);
    const pts = [fp(F, th - 0.05 * s, 0, -HT - 0.02), fp(F, th + 0.24 * s, 0, -HT - 1.2)];
    const R = { x0: Math.min(pts[0][0], pts[1][0]) + 0.14, z0: Math.min(pts[0][2], pts[1][2]) + 0.14, x1: Math.max(pts[0][0], pts[1][0]) - 0.14, z1: Math.max(pts[0][2], pts[1][2]) - 0.14 };
    const out = [R, ...lines.values()];
    return out.slice(0, 6);
  }
  return [...lines.values()].slice(0, 6);
}
// the wall hearth's breast in house space (the cut's kept rect, cutK), or null; the same rect as interiors.js
export function cutKeep(S) {
  const C = S.chimney;
  if (!S.enter || !C || !C.face || (C.face !== 'left' && C.face !== 'right')) return null;
  const s = C.face === 'right' ? 1 : -1, x0 = s * (S.w / 2 - 0.34), x1 = C.lx - s * C.w / 2; // (4 cm off the wall face: the lining behind is cut)
  return { x0: Math.min(x0, x1), z0: C.lz - C.w / 2, x1: Math.max(x0, x1), z1: C.lz + C.w / 2 };
}
// the sill strips that finish the cut walls: one Builder per wall top (house space, the strip's top at y = 0, so the world
// lifts it to wherever the cut line is, never over that wall's own top). [{ builder, top }] in WORLD x/z (y local).
// Strips run 7 cm proud of each face (over the trims and the lining); the long and the short runs differ by 1 cm in
// reach and 3 mm in height, posts by 2 cm / 6 mm, so no two strips ever share a face (no z-fighting at the corners).
export function buildCutCaps(S) {
  const groups = new Map(), stone = S.wall.upper === 'ashlar' || S.wall.upper === 'stone' || S.arch === 'towerhouse';
  const mat = stone ? 'stoneLarge' : 'beam', col = stone ? '#d8d0c0' : '#7a5838';
  const get = (top) => { const k = Math.round(top * 20) / 20; if (!groups.has(k)) groups.set(k, new Builder(S.seed * 7 + 9)); return groups.get(k); };
  const strip = (R, top, kind) => {
    const long = R.x1 - R.x0 >= R.z1 - R.z0, post = Math.max(R.x1 - R.x0, R.z1 - R.z0) < 0.4;
    const pad = post ? 0.05 : long ? 0.07 : 0.06, up = post ? 0.006 : long ? 0 : 0.003;
    bx(get(top), kind === 'slab' ? 'stoneLarge' : mat, R.x0 - pad, -0.09 + up, R.z0 - pad, R.x1 + pad, up, R.z1 + pad, kind === 'slab' ? '#c8c0b0' : col);
  };
  const partTop = Math.min(S.wallTop, WALL_H);
  const isPart = (R) => S.parts.some((P) => Math.abs(P.x0 - R.x0) < 1e-3 && Math.abs(P.z0 - R.z0) < 1e-3 && Math.abs(P.x1 - R.x1) < 1e-3 && Math.abs(P.z1 - R.z1) < 1e-3);
  const extOf = (R) => S.ext.find((E) => Math.abs(E.lx - (R.x0 + R.x1) / 2) < 1e-3 && Math.abs(E.lz - (R.z0 + R.z1) / 2) < 1e-3 && Math.abs(E.w - (R.x1 - R.x0)) < 1e-3);
  for (const R of S.wallRects) {
    const E = extOf(R);
    if (E) { strip(R, E.h || 2.2, 'slab'); continue; }
    if (!S.enter) { strip(R, S.wallTop, 'slab'); continue; }
    const post = Math.max(R.x1 - R.x0, R.z1 - R.z0) < 0.4;
    strip(R, post ? 2.2 : isPart(R) ? partTop : S.wallTop, 'wall');
  }
  // the partitions' door frame posts (0.23 m deep, a little wider than the partition)
  for (const G of S.enter ? partGaps(S) : []) for (const t of [G.lo, G.hi - 0.1]) {
    const R = G.along === 'x' ? { x0: t, z0: G.at - 0.115, x1: t + 0.1, z1: G.at + 0.115 } : { x0: G.at - 0.115, z0: t, x1: G.at + 0.115, z1: t + 0.1 };
    strip(R, partTop, 'wall');
  }
  const m = { p: [S.x, 0, S.z], r: [0, S.rot, 0] };
  return [...groups].map(([top, b]) => { const w = new Builder(13); w.addBuilder(b, m); return { builder: w, top }; });
}
export { houseSpec, housesIn, toLocal2 };
