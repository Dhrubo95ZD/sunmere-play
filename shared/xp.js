// Experience from kills in dungeons and raids (P15.7, v127; docs/ai/xp_v127.md, measured with tools/xpcheck.mjs). The kill
// formula itself (killXp, KILL_XP) lives in shared/classes.js so shared/data.js can reckon quest bands with it; this file
// adds the dungeon factor and is what the World's kill loop (shared/sim.js), a bot's kill credit (shared/botmind.js) and
// Clear the Rides (shared/rides.js) import.
// A full clear (every machine once, at the dungeon's median machine level) pays KILL_XP.run levels (a raid KILL_XP.raid)
// to one hero; a party splits it as before (1.25 / party size, bots not counted). Before v127 a clear paid 4-13 levels
// in the valley and up to 58 (the Upper Cutting) at 65.
import { xpForLevel, killXp, killXpDamp, KILL_XP } from './classes.js';
import { MOBS, SPAWNS } from './data.js';
import { DUNGEONS } from './dungeons.js';

export { killXp, killXpDamp, KILL_XP };
const SCALE = {};
for (const D of DUNGEONS) {
  const sp = SPAWNS.filter((s) => s.dungeon === D.id && MOBS[s.mob]?.xp > 0);
  if (!sp.length) continue;
  const lv = sp.map((s) => MOBS[s.mob].lvl[0]).sort((a, b) => a - b), L = lv[(lv.length - 1) >> 1];
  let xp = 0; for (const s of sp) { const m = MOBS[s.mob]; xp += killXp(m.xp, m.lvl[0], L) * (s.n || 1); }
  SCALE[D.id] = Math.min(1, ((D.raid ? KILL_XP.raid : KILL_XP.run) * xpForLevel(L)) / xp);
}
export const dungeonXpScale = (id) => (id && SCALE[id]) || 1;
// a world event's experience (WORLD_EVENTS[i].xp): its authored share of a level at the event's level (its lowest machine
// level), damped like a kill, then that share of the hero's own level, a tenth less for each level above the event, at
// least a fifth (P15.7 review: the fixed amount paid a level-5 hero who tagged one machine of the Storm Surge six levels,
// and on-level events every 10-15 minutes the worth of 20 kills)
const evLevel = (E) => Math.max(1, Math.min(...(E.mobs || []).map((m) => m[2]?.[0] || MOBS[m[0]]?.lvl?.[0] || 99)));
export const eventXp = (E, pL) => { const T = evLevel(E), L = Math.min(pL, T); return Math.round((E.xp / xpForLevel(T)) * killXpDamp(T) * xpForLevel(L) * Math.max(0.2, Math.min(1, 1 + (T - pL) * 0.1))); };
