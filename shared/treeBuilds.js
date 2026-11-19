// Suggested paths on the Skill Web (combat_design.md 3.1 and 4.5): three ordered target lists per class on the Web. The Web
// screen's "Suggested path" stages the road to each target in order, as far as the hero's points reach (pathTo fills the
// small nodes between); the bots read the same lists in S15. A class not on the Web yet has none.
// Imports only from shared/.
import { TREE_BY_ID, TREE_START } from './tree.js';

export const TREE_BUILDS = {
  knight: [
    { id: 'skyfall', name: 'From Above', desc: 'Leaps and lifts: Stormfall hangs longer, landings hit harder, and Three Heights adds Anvil Fall.',
      want: ['kf_form_rising', 'k_hardlanding', 'kf_form_sky', 'k_breaker', 'riposte_drill', 'cg_practised', 'k_unyielding', 'three_heights', 'cg_follow', 'cinder_landing', 'cg_impact'] },
    { id: 'line', name: 'Hold the Line', desc: 'Plate and the shield: Guard parries open every skill, Turning Riposte, and more health and armour.',
      want: ['k_platedrills', 'k_steadyarm', 'kf_form_valiant', 'k_breaker', 'riposte_drill', 'oathbound', 'cg_practised', 'cg_hardened', 'cg_thick', 'cg_second'] },
    { id: 'blade', name: 'The Long Edge', desc: 'The chain and the sweep: Twin Edge, Arc Wave, Rolling Edge out of the roll, and the Common Ground\'s fusion power.',
      want: ['k_platedrills', 'kf_form_valiant', 'k_hardlanding', 'kf_form_cleave', 'k_veteran', 'rolling_edge', 'cg_practised', 'cg_follow', 'cg_keen', 'cg_wide'] },
  ],
  sandblade: [
    { id: 'storm', name: 'The Long Column', desc: 'Spins and sand: Drawing Spin, Sand Line, Hot Sand, and The Long Column for Sandstorm Drop.',
      want: ['s_heat', 'sf_form_whirl', 'rolling_sand', 's_lightfeet', 'sand_veil', 'long_column', 'sf_form_slash', 's_evasion', 'afterwake', 'hot_sand'] },
    { id: 'duel', name: 'The Duelist', desc: 'Parries and answers: Counter Guard opens Riptide from the sidestep, Dust Cloak and Evasion keep you untouched.',
      want: ['s_evasion', 'sf_form_slash', 's_heat', 'sf_form_whirl', 's_cloak', 'rolling_sand', 's_lightfeet', 'counter_guard', 'sand_veil', 's_rend'] },
    { id: 'blade', name: 'Behind You', desc: 'Steps and thrusts: Three Charges, Searing Edge, Finishing Blow, Afterwake and the Common Ground\'s fusion power.',
      want: ['sf_form_needle', 'sf_form_step', 's_finish', 's_evasion', 'sf_form_slash', 's_rend', 'afterwake', 's_joints', 'cg_practised', 'cg_follow'] },
  ],
  warden: [
    { id: 'wall', name: 'The Living Wall', desc: 'The tank: Iron Skin, Living Wall for Breakwater, Shoulder to Shoulder for Intercept, Presence, Unmoving and Last Stand.',
      want: ['w_ironskin', 'w_fortify', 'wf_form_blow', 'living_wall', 'w_presence', 'wf_form_charge', 'shoulder_to_shoulder', 'unmoving', 'w_laststand', 'cg_thick'] },
    { id: 'quake', name: 'The Quarry', desc: 'Slams and fissures: Wide Crater, Tremor Feet, Aftershock, Long Fissure, Bedrock and Fault and Fall for Hammerfall.',
      want: ['w_ironskin', 'wf_form_pound', 'w_tremor', 'w_laststand', 'fault_and_fall', 'w_presence', 'wf_form_charge', 'aftershock', 'wf_form_split', 'w_bedrock'] },
    { id: 'forge', name: 'The Forge', desc: 'A hot hammer: Forge-Heated Head, Steam Plate, Bedrock, Iron Weight and the Common Ground weight.',
      want: ['w_presence', 'wf_form_charge', 'wf_form_split', 'w_steamplate', 'w_bedrock', 'forge_head', 'w_fortify', 'wf_form_blow', 'w_ironskin', 'cg_thick'] },
  ],
};

// the node ids a suggested path takes from what the hero holds, in order, at most `pts` of them. pathTo(cls, alloc, id) is
// shared/treeMods.js's road finder (passed in so this file stays free of the modifier table)
export function buildSteps(cls, buildId, alloc, pts, pathTo) {
  const B = (TREE_BUILDS[cls] || []).find((b) => b.id === buildId);
  if (!B || !TREE_START[cls]) return [];
  const have = { ...(alloc || {}) }, out = [];
  for (const id of B.want) {
    if (!TREE_BY_ID[id] || have[id]) continue;
    const road = pathTo(cls, have, id);
    if (!road || out.length + road.length > pts) continue;
    for (const k of road) { have[k] = 1; out.push(k); }
  }
  return out;
}
