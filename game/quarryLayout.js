// Ironcliff Quarry layout: the stonecutters' camp on the west rim, cranes over the pit, scaffolds on the cut
// walls, stone stacks and rubble on the ledges, rails from the ramp head to the camp, lanterns down the ramp.
import { QUARRY } from '/sunmere-play/shared/terrain.js';
import * as P from '../assets/props.js';
import * as D from '../assets/dressing.js';
import { derrick, scaffold, stoneStack, workTent, toolRack, rubble } from '../assets/quarry.js';
import { flagPost as bannerPost } from '../assets/village3.js'; // banners hang down the pole's side: no crossbar

const PI = Math.PI;

export function buildQuarry(W) {
  const S = W.scatter, T = W.terrain;
  const put = (key, x, z, r = 0, s = 1) => S.place(key, x, T.height(x, z) - 0.02, z, r, s);
  const Q = QUARRY;
  // ---- the camp on the west rim
  for (const [x, z, r, c] of [[167, -20, 2.4, '#e8dcc0'], [164, -31, 1.4, '#d8c8a8'], [167, -40, 0.7, '#e8dcc0']]) W.placeObject(workTent(10 + x, c), x, z, r);
  W.placeObject(P.campfire(6), 174.5, -29, 0);
  W.placeObject(toolRack(7), 177.5, -18.5, -0.3);
  W.placeObject(stoneStack(8), 178, -40.5, 0.4);
  W.placeObject(stoneStack(9), 181, -15, 1.2);
  W.placeObject(bannerPost(12), 176, -33, PI / 2);
  for (const [x, z, r] of [[169, -25, 0.3], [172.5, -34.5, 1.1], [179.5, -24, 2.0]]) put('crates', x, z, r);
  for (const [x, z] of [[176, -36.5], [176, -25.5], [181, -31]]) put('lantern', x, z, PI / 2);
  // ---- rails from the ramp head back to the camp, carts waiting on them
  W.placeObject(D.railTrack(3, 14), 177, -36.2, PI / 2);
  put('mineCart', 179.5, -36.2, PI / 2);
  put('mineCart', 175.2, -36.2, PI / 2 + 0.02);
  // ---- cranes on the rim, booms out over the pit
  for (const [x, z] of [[196, -12.5], [229, -26], [213, -59.5], [191, -55]]) {
    const face = Math.atan2(Q.x - x, Q.z - z);
    W.placeObject(derrick(20 + x), x, z, face);
  }
  // ---- scaffolds against the terrace walls
  for (const [a, rr] of [[2.4, 15.8], [-0.5, 22.6], [3.9, 22.4], [1.2, 9.2]]) {
    const x = Q.x + Math.cos(a) * rr, z = Q.z + Math.sin(a) * rr;
    W.placeObject(scaffold(30 + rr, 4.6, 3.0), x, z, Math.atan2(Q.x - x, Q.z - z) + PI);
  }
  // ---- cut stone and rubble on the ledges and the floor
  for (const [a, rr, kind] of [[0.6, 18.4, 's'], [1.9, 18.6, 'r'], [3.3, 18.2, 's'], [4.6, 18.5, 'r'], [5.6, 11.6, 's'], [0.2, 11.8, 'r'], [2.8, 11.4, 'r'], [4.0, 4.5, 's'], [1.2, 5.2, 'r']]) {
    const x = Q.x + Math.cos(a) * rr, z = Q.z + Math.sin(a) * rr;
    W.placeObject(kind === 's' ? stoneStack(40 + Math.round(a * 10)) : rubble(50 + Math.round(a * 10)), x, z, a);
  }
  // ---- lanterns down the ramp
  for (let i = 0; i < 4; i++) { const x = Q.ramp.x0 + 2 + i * 4.6; put('lantern', x, Q.ramp.z - Q.ramp.w - 0.9, 0); }
}
