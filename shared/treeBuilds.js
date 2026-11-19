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
  herbalist: [
    { id: 'mender', name: 'Field Mender', desc: 'Heals for the whole group: Restorative Tonic, Splash Jar or Slow Salve, Willowbark, Antidote, Rejuvenating Brew, Full Dressing and the fusion power of the Common Ground.',
      want: ['h_tonic', 'hf_form_salve', 'h_antidote', 'hf_form_poultice', 'h_brew', 'h_willowbark', 'full_dressing', 'swiftroot', 'cg_follow', 'h_fieldhands'] },
    { id: 'smoke', name: 'Smoke and Pepper', desc: 'The smoke pot first: Camphor, Camphor Smoke or Drifting Smoke, the Snare Net Form, Bitter Leaves, Sneezing Powder and Grove Keeper.',
      want: ['h_camphor', 'hf_form_smoke', 'hf_form_net', 'h_bitterleaves', 'sneezing_powder', 'h_tonic', 'hf_form_salve', 'grove_keeper', 'h_brew'] },
    { id: 'brawler', name: 'Bitter Medicine', desc: 'A healer in the fight: Field Hands, Bitter Leaves, the Snare Net Form, Battle Medic, Bitter Medicine and Willowbark.',
      want: ['h_fieldhands', 'h_bitterleaves', 'hf_form_net', 'battle_medic', 'h_tonic', 'hf_form_salve', 'h_willowbark', 'bitter_medicine', 'sneezing_powder'] },
  ],
  chemist: [
    { id: 'board', name: 'Set the Board', desc: 'Puddles and fire: Measured Pours, Hot Tar or Pitch Wall, Spark Gap, Catalyst, the Furnace Cask and Closed Lab, with the fusion power of the Common Ground.',
      want: ['c_measured', 'cf_form_acid', 'c_sparkgap', 'cf_form_tar', 'live_rod', 'c_catalyst', 'blast_vault', 'c_heavycask', 'furnace_cask', 'cg_follow'] },
    { id: 'reactions', name: 'Reactive Chemistry', desc: 'Coats for the whole group: Etching Acid, Flashbang, Deep Chill, Bitter Draught, Cold Packs and Reactive Chemistry.',
      want: ['c_measured', 'cf_form_acid', 'c_flash', 'cf_form_chill', 'cf_form_volatile', 'c_draught', 'c_coldpacks', 'reactive_chemistry', 'c_sparkgap', 'live_rod'] },
    { id: 'cold', name: 'Cold Chemistry', desc: 'Frost in place of fire: Flashbang, Frost Line or Deep Chill, Steady Mixing, Cold Chemistry, Bench Chemist and the Furnace Cask (Frost Cask).',
      want: ['c_flash', 'cf_form_chill', 'c_steady', 'cold_chemistry', 'c_sparkgap', 'cf_form_tar', 'cf_form_volatile', 'bench_chemist', 'c_measured', 'furnace_cask'] },
  ],
  ranger: [
    { id: 'run', name: 'Never Still', desc: "Arrows on the run: Light Step, Bodkin Points, Fletcher's Kit, Steady Breath, Hunter's Chalk and Never Still, with the fusion power of the Common Ground.",
      want: ['r_lightstep', 'rf_form_quick', 'r_fletcher', 'r_rapid', 'rf_form_pierce', 'r_chalk', 'restless', 'long_draw', 'r_morearrows', 'cg_follow'] },
    { id: 'traps', name: "Trapper's Ground", desc: "Snares everywhere: Spring Trap, Oiled Springs, Trapper's Spring for Spring Snare, Trapper's Ground and Closed Ground.",
      want: ['r_lightstep', 'rf_form_trap', 'trappers_spring', 'r_trapsprings', 'trappers_ground', 'r_rapid', 'rf_form_pierce', 'long_draw', 'r_chalk', 'closed_ground'] },
    { id: 'one', name: 'One Arrow', desc: 'Every shot drawn: Steady Breath, Tar-Head, Long Draw, More Arrows, Bodkin Hail and One Arrow.',
      want: ['r_morearrows', 'rf_form_quick', 'one_arrow', 'r_rapid', 'rf_form_pierce', 'long_draw', 'rf_form_volley', 'r_smoke', 'r_chalk', 'cg_practised'] },
  ],
  deadeye: [
    { id: 'run', name: 'Never Still', desc: 'Gun on the run: Paper Cartridges, Rock Salt, Low Road for Slide Shot, Smoke Charge, Coat Tails, Never Still and the fusion power of the Common Ground.',
      want: ['d_cartridge', 'df_form_snap', 'low_road', 'df_form_scatter', 'd_smoke', 'd_coattails', 'd_chalk', 'never_still', 'cg_follow', 'cg_wide'] },
    { id: 'chambers', name: 'Six Chambers', desc: 'Rounds instead of Powder: Quick Reload, Iron Slug, Priming Burst, High Recoil, Held Breath for Last Round, Six Chambers and Steady Hammer.',
      want: ['d_reload', 'df_form_pair', 'd_priming', 'df_form_recoil', 'held_breath', 'six_chambers', 'd_steady', 'd_cartridge', 'df_form_snap', 'low_road'] },
    { id: 'storm', name: 'Falling Storm', desc: 'From above: High Recoil, Iron Slug, Chalk Mark, High Ground for Falling Storm, Bank Shot and Steady Hammer.',
      want: ['d_cartridge', 'df_form_snap', 'low_road', 'd_chalk', 'high_ground', 'd_priming', 'df_form_recoil', 'held_breath', 'd_steady', 'bank_shot'] },
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
