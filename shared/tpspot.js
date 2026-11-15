// Where the /tp test command sets a hero down (admin/test only: server.js closes it to players when sign-in is required).
// The old /tp took the typed point as it was: a point off the coast of the Cinder Reach or the Rime Steps, over the Windward
// Heights' cliff lip, or out past the valley's mountains was refused (the hero stayed put) or, on a pier end, left the hero
// standing in the sea fog. tpSpot picks the area the point belongs to (the area box it is in, or the nearest one), then the
// nearest walkable, dry spot inside that same area, so scripted shots can /tp anywhere. Normal movement and the ship and
// lift crossings are not touched by this.
import { WORLD, AREAS, islandAt, areaOf, inWorld, waterAt, walkHeight } from './terrain.js';
import { DUNGEONS, DUNGEON_MIN_X, CELL, dungeonAt, cellFloor, dungeonPush } from './dungeons.js';
import { housePush } from './houses.js';

const boxDist = (B, x, z) => Math.hypot(Math.max(B.minX - x, 0, x - B.maxX), Math.max(B.minZ - z, 0, z - B.maxZ));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the dungeon a point belongs to: the one it is in, or the nearest one by its box
function dungeonFor(x, z) {
  const d = dungeonAt(x, z);
  if (d) return d;
  let best = DUNGEONS[0], bd = Infinity;
  for (const D of DUNGEONS) { const k = boxDist({ minX: D.ox, maxX: D.ox + D.w, minZ: D.oz, maxZ: D.oz + D.h }, x, z); if (k < bd) { bd = k; best = D; } }
  return best;
}
// the nearest floor cell of a dungeon to a point (the whole grid, so a point deep in the rock still finds the halls)
function nearestFloor(x, z) {
  const d = dungeonFor(x, z);
  const ci = clamp(Math.floor((x - d.ox) / CELL), 0, d.nx - 1), cj = clamp(Math.floor((z - d.oz) / CELL), 0, d.nz - 1);
  if (cellFloor(d, ci, cj) && dungeonAt(x, z) === d) { const [px, pz] = dungeonPush(x, z, 0.4); return { x: px, z: pz, area: 'dungeon', id: d.id }; }
  let best = null, bd = Infinity;
  for (let j = 0; j < d.nz; j++) for (let i = 0; i < d.nx; i++) if (cellFloor(d, i, j)) { const k = (i - ci) ** 2 + (j - cj) ** 2; if (k < bd) { bd = k; best = [i, j]; } }
  if (!best) return { x: d.startW[0], z: d.startW[1], area: 'dungeon', id: d.id };
  const [px, pz] = dungeonPush(d.ox + (best[0] + 0.5) * CELL, d.oz + (best[1] + 0.5) * CELL, 0.4);
  return { x: px, z: pz, area: 'dungeon', id: d.id };
}

// the overworld area a point belongs to: the island box it is in, the valley, or (out between them) the nearest box
function areaFor(x, z) {
  const I = islandAt(x, z);
  if (I) return { id: I.id, box: I.box };
  if (boxDist(WORLD, x, z) === 0) return { id: 'valley', box: WORLD };
  let best = { id: 'valley', box: WORLD }, bd = boxDist(WORLD, x, z);
  for (const A of AREAS) { const k = boxDist(A.box, x, z); if (k < bd) { bd = k; best = { id: A.id, box: A.box }; } }
  return best;
}

// a spot a hero can stand on in area `id`: walkable with `pad` metres to spare and, when `dry`, not under water (a pier or
// footbridge deck above the water counts as dry)
function standable(id, x, z, pad, dry) {
  if (areaOf(x, z) !== id || !inWorld(x, z, pad)) return false;
  if (!dry) return true;
  // (a little above the waterline, not in the surf; an island's shallows read as no water but lie below its sea level)
  const w = waterAt(x, z) ?? islandAt(x, z)?.box.water;
  return w === null || w === undefined || walkHeight(x, z) >= w + 0.5;
}

// the nearest walkable spot to (x, z) in the area it belongs to: { x, z, area } (area 'dungeon' with the dungeon's id)
export function tpSpot(x, z) {
  x = Number(x); z = Number(z);
  if (!isFinite(x) || !isFinite(z)) return null;
  if (x >= DUNGEON_MIN_X) return nearestFloor(x, z);
  const A = areaFor(x, z), B = A.box;
  // into the area's box (just inside, so the point is not on a neighbour's edge)
  const cx = clamp(x, B.minX + 0.5, B.maxX - 0.5), cz = clamp(z, B.minZ + 0.5, B.maxZ - 0.5);
  const maxR = Math.hypot(B.maxX - B.minX, B.maxZ - B.minZ);
  // a dry point the hero could walk to (a pier end, a step from a wall or the edge) is taken as typed, as the old /tp did;
  // only a point in the water or off the walkable ground is moved
  if (standable(A.id, x, z, 0, true)) return land(A.id, x, z);
  // rings outward: the first ring with a good spot wins (the closest spot on it); a comfortable dry spot first, then any
  // walkable one
  for (const [pad, dry] of [[3, true], [0.5, true], [0, false]]) {
    if (standable(A.id, cx, cz, pad, dry)) return land(A.id, cx, cz);
    for (let r = 1; r <= maxR; r += r < 40 ? 1 : 3) {
      const n = Math.max(8, Math.ceil(2 * Math.PI * r / 1.5));
      let best = null, bd = Infinity;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, px = cx + Math.sin(a) * r, pz = cz + Math.cos(a) * r;
        if (!standable(A.id, px, pz, pad, dry)) continue;
        const d = Math.hypot(px - x, pz - z);
        if (d < bd) { bd = d; best = [px, pz]; }
      }
      if (best) return land(A.id, best[0], best[1]);
    }
  }
  return null;
}
// out of any house wall it lands in (the push keeps it walkable; if not, the spot as found)
function land(id, x, z) {
  const [hx, hz] = housePush(x, z, 0.4);
  return areaOf(hx, hz) === id && inWorld(hx, hz, 0) ? { x: hx, z: hz, area: id } : { x, z, area: id };
}
