// The outdoor areas beyond the valley: each one an island-style terrain box of its own, joined to the rest only by the ship
// (and the Windward Heights to the Rime Steps by the counterweight lift).
// terrain.js asks islandAt(x, z) at the top of heightAt, walkHeight, deckAt, waterAt, waterKind, groundAt, zoneAt, regionAt
// and worldGap, and hands the point to the area's own functions. The valley itself is not in this list: it is everything
// else below DUNGEON_MIN_X, and the dungeons are everything from there on.
//
// An entry: { id, name, box, height, ground, water, waterKind, zone, gap, deck }
//   box        the area's data object, with minX/maxX/minZ/maxZ, and the places a crossing or a death needs (landing,
//              harbour, grave, caravan, pier, berth)
//   height     (x, z) -> ground height            ground  (x, z) -> paint weights, the same shape as groundAt's
//   water      (x, z) -> surface height | null    waterKind (x, z) -> 'sea' | 'stream' | 'tide' | null
//   zone       (x, z) -> a ZONES id               gap     (x, z) -> past the walkable edge (0 or less inside)
//   deck       (x, z) -> deck height | -Infinity (piers, footbridges)
// The boxes must not overlap each other, the valley's WORLD box or the dungeons (x 700 and on).
import { REACH, reachHeight, reachGround, reachWater, reachDeck, reachZone, reachGap } from './reach.js';
import { RIME, rimeHeight, rimeGround, rimeWater, rimeWaterKind, rimeDeck, rimeZone, rimeGap } from './rime.js';
import { HEIGHTS, heightsHeight, heightsGround, heightsWater, heightsWaterKind, heightsDeck, heightsZone, heightsGap } from './heights.js';
import { TIDEWATER, tidewaterHeight, tidewaterGround, tidewaterWater, tidewaterWaterKind, tidewaterDeck, tidewaterZone, tidewaterGap } from './tidewater.js';
import { RAINWARD, rainwardHeight, rainwardGround, rainwardWater, rainwardWaterKind, rainwardDeck, rainwardZone, rainwardGap } from './rainward.js';

export const inBox = (B, x, z, pad = 0) => x >= B.minX + pad && x <= B.maxX - pad && z >= B.minZ + pad && z <= B.maxZ - pad;

export const AREAS = [
  { id: 'reach', name: 'The Cinder Reach', box: REACH, height: reachHeight, ground: reachGround, water: reachWater, waterKind: (x, z) => (reachWater(x, z) === null ? null : 'sea'), zone: reachZone, gap: reachGap, deck: reachDeck },
  { id: 'rime', name: 'The Rime Steps', box: RIME, height: rimeHeight, ground: rimeGround, water: rimeWater, waterKind: rimeWaterKind, zone: rimeZone, gap: rimeGap, deck: rimeDeck },
  // Part Twelve: a plateau above the clouds, reached only by the counterweight lift from the Rime Steps (no sea, no water)
  { id: 'heights', name: 'The Windward Heights', box: HEIGHTS, height: heightsHeight, ground: heightsGround, water: heightsWater, waterKind: heightsWaterKind, zone: heightsZone, gap: heightsGap, deck: heightsDeck },
  // Part Thirteen: an inlet on the cold coast with the Makers' yards, reached by the ship; its water rises and falls with the
  // tide (water reads the shared tide clock, shared/tidewater.js)
  { id: 'tidewater', name: 'Tidewater Sound', box: TIDEWATER, height: tidewaterHeight, ground: tidewaterGround, water: tidewaterWater, waterKind: tidewaterWaterKind, zone: tidewaterZone, gap: tidewaterGap, deck: tidewaterDeck },
  // Part Fourteen: a deep wet gorge inland of the Sound, reached by the haul road from the Tide Mills; its rain comes and goes
  // on the world clock (shared/rainward.js), the same for every player, like the Sound's tide
  { id: 'rainward', name: 'The Rainward Gorge', box: RAINWARD, height: rainwardHeight, ground: rainwardGround, water: rainwardWater, waterKind: rainwardWaterKind, zone: rainwardZone, gap: rainwardGap, deck: rainwardDeck },
];
export const AREA_BY_ID = Object.fromEntries(AREAS.map((A) => [A.id, A]));

// the island-style area a point lies in, or null (the valley or a dungeon)
export function islandAt(x, z) {
  for (let i = 0; i < AREAS.length; i++) if (inBox(AREAS[i].box, x, z)) return AREAS[i];
  return null;
}
