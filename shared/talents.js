// Talents: three paths per class. One point per level from level 5 (16 points at level 20).
// Rows open as you spend points in the same path: row 1 at 0, row 2 at 3, row 3 at 6, the capstone at 10, the mastery at 14
// (the mastery row came with the level 30 cap; the grandmastery row at 18 with the level 35 cap: 31 points;
// the Makers' row once the whole path below it is spent, 19 points, with the level 40 cap: 36 points;
// the Reach row at 20, the whole path again, with the level 45 cap: 41 points, one full path of 21 and 20 in another;
// the Rime row at 21, the whole path again, with the level 50 cap: 46 points, two full paths of 22 and 2 in the third;
// the Heights row at 22, the whole path again, with the level 55 cap: 51 points, two full paths of 23 and 5 in the third;
// the Tidewater row at 23, the whole path again, with the level 60 cap: 56 points, two full paths of 24 and 8 in the third).
// Each talent: { id, name, ic (a skill id whose painted icon it shows), ranks, e: effects per rank }
// Effect kinds (values are per rank; percentages as fractions):
//   dmg hp armor haste crit critDmg heal regen speed leech thorns cost dot aoe execute opener killRes dodge cdr threat ccDur absorb
//   ['sk', skillId, 'pow'|'cd'|'cost', v]  one skill: potency (damage and healing), cooldown seconds off, resource off
//   lastStand (capstone, no value): once every 2 minutes a killing blow leaves you at 30% health instead
import { SKILLS } from './classes.js';

export const TALENT_START = 5;
export const TALENT_ROW_REQ = [0, 3, 6, 10, 14, 18, 19, 20, 21, 22, 23]; // rows 7 to 11 open once the rest of the path is full (19, 20, 21, 22, then 23)
export const talentPoints = (level) => Math.max(0, level - TALENT_START + 1);
export const talentResetCost = (level) => 50 * level; // copper

const T = (id, name, ic, ranks, row, e) => ({ id, name, ic, ranks, row, e });
const sk = (id, k, v) => ['sk', id, k, v];

export const TALENTS = {
  knight: [
    { name: 'Vanguard', desc: 'Strike first and strike hard.', ic: 'k_valiant', list: [
      T('kv1', 'Keen Edge', 'k_valiant', 3, 0, [['dmg', 0.02]]),
      T('kv2', 'Heavy Swings', 'k_rising', 3, 0, [sk('k_rising', 'pow', 0.1), sk('k_twin', 'pow', 0.1)]),
      T('kv3', 'Sweeping Blows', 'k_cleave', 3, 1, [['aoe', 0.05]]),
      T('kv4', 'Battle Rhythm', 'k_lunge', 2, 1, [['cdr', 0.05]]),
      T('kv5', 'Ruthless', 'k_sunder', 2, 2, [['execute', 0.1]]),
      T('kv6', 'Keen Eye', 'k_riposte', 2, 2, [['crit', 0.03]]),
      T('kv7', 'Skyfall', 'k_skybreaker', 1, 3, [sk('k_skybreaker', 'cd', 6), sk('k_skybreaker', 'pow', 0.4)]),
      T('kv8', 'Veteran of the Line', 'k_kingsfall', 2, 4, [['dmg', 0.03], sk('k_kingsfall', 'pow', 0.15)]),
      T('kv9', 'Banner of the Valley', 'k_kingsfall', 1, 5, [['dmg', 0.04], ['crit', 0.02]]),
      T('kv10', 'Bronze-Cast Edge', 'k_kingsfall', 1, 6, [['dmg', 0.04], ['critDmg', 0.08]]),
      T('kv11', 'Breaker of Plate', 'k_breach', 1, 7, [sk('k_breach', 'pow', 0.25), ['critDmg', 0.08]]),
      T('kv12', 'Millrace Edge', 'k_millrace', 1, 8, [sk('k_millrace', 'pow', 0.25), ['dmg', 0.03]]),
      T('kv13', 'Crosswind Edge', 'k_crosswind', 1, 9, [sk('k_crosswind', 'pow', 0.25), ['critDmg', 0.08]]),
      T('kv14', 'Tidebreak Edge', 'k_tidebreak', 1, 10, [sk('k_tidebreak', 'pow', 0.25), ['critDmg', 0.08]]),
    ] },
    { name: 'Bulwark', desc: 'Plate, shield and a will that does not bend.', ic: 'k_guard', list: [
      T('kb1', 'Plate Drills', 'k_guard', 3, 0, [['armor', 0.02]]),
      T('kb2', 'Toughness', 'k_wind', 3, 0, [['hp', 0.04]]),
      T('kb3', 'Shield Mastery', 'k_bash', 3, 1, [sk('k_bash', 'cd', 1), sk('k_shieldthrow', 'pow', 0.1)]),
      T('kb4', 'Steadfast', 'k_shout', 2, 1, [['threat', 0.25]]),
      T('kb5', 'Iron Will', 'k_unbreakable', 2, 2, [['absorb', 0.15]]),
      T('kb6', 'Retaliation', 'k_riposte', 2, 2, [['thorns', 0.08]]),
      T('kb7', 'Unyielding', 'k_guard', 1, 3, [['lastStand', 1]]),
      T('kb8', 'Wall of Brass', 'k_unbreakable', 2, 4, [['armor', 0.03], ['hp', 0.04]]),
      T('kb9', 'Last Wall Standing', 'k_unbreakable', 1, 5, [['armor', 0.04], ['absorb', 0.1]]),
      T('kb10', 'Counterweight Stance', 'k_unbreakable', 1, 6, [['armor', 0.05], ['hp', 0.04]]),
      T('kb11', 'Ash-Grey Wall', 'k_holdline', 1, 7, [['armor', 0.05], sk('k_holdline', 'cd', 8)]),
      T('kb12', 'Floodgate Shield', 'k_sluicegate', 1, 8, [['armor', 0.05], sk('k_sluicegate', 'cd', 8)]),
      T('kb13', 'Windwall Plate', 'k_windwall', 1, 9, [['armor', 0.05], sk('k_windwall', 'cd', 8)]),
      T('kb14', 'Sea Wall Plate', 'k_seawall', 1, 10, [['armor', 0.05], sk('k_seawall', 'cd', 8)]),
    ] },
    { name: 'Banner', desc: 'Lead from the front and outlast the fight.', ic: 'k_rally', list: [
      T('kn1', 'Rallying Voice', 'k_rally', 3, 0, [sk('k_rally', 'cd', 5)]),
      T('kn2', 'Second Breath', 'k_wind', 3, 0, [['heal', 0.08], ['regen', 0.04]]),
      T('kn3', 'Valor Flow', 'k_charge', 3, 1, [['regen', 0.06]]),
      T('kn4', 'Swift March', 'k_lunge', 2, 1, [['speed', 0.04]]),
      T('kn5', 'Lifeblood', 'k_valiant', 2, 2, [['leech', 0.03]]),
      T('kn6', 'Discipline', 'k_pommel', 2, 2, [['cost', 0.05]]),
      T('kn7', 'Kingsfall Herald', 'k_kingsfall', 1, 3, [sk('k_kingsfall', 'cd', 15), sk('k_kingsfall', 'pow', 0.3)]),
      T('kn8', 'Standard-Bearer', 'k_rally', 2, 4, [['heal', 0.06], ['cdr', 0.04]]),
      T('kn9', 'Heart of the Watch', 'k_rally', 1, 5, [['heal', 0.08], ['regen', 0.06]]),
      T('kn10', 'Keeper of the Camp', 'k_rally', 1, 6, [['heal', 0.08], ['absorb', 0.08]]),
      T('kn11', 'Captain of the Landing', 'k_holdline', 1, 7, [['heal', 0.08], sk('k_holdline', 'pow', 0.2)]),
      T('kn12', 'Keeper of the Steps', 'k_sluicegate', 1, 8, [['heal', 0.08], sk('k_sluicegate', 'pow', 0.2)]),
      T('kn13', 'Standard of the Heights', 'k_windwall', 1, 9, [['heal', 0.08], sk('k_windwall', 'pow', 0.2)]),
      T('kn14', 'Standard of the Yards', 'k_seawall', 1, 10, [['heal', 0.08], sk('k_seawall', 'pow', 0.2)]),
    ] },
  ],
  ranger: [
    { name: 'Marksman', desc: 'One arrow, one target, no second chances.', ic: 'r_aimed', list: [
      T('rm1', 'Steady Aim', 'r_aimed', 3, 0, [sk('r_aimed', 'pow', 0.08)]),
      T('rm2', 'Sharp Arrows', 'r_quick', 3, 0, [['dmg', 0.02]]),
      T('rm3', 'Sure Aim', 'r_mark', 3, 1, [['crit', 0.03]]), // 'Deadeye' until v106: the name went to the seventh class (saves key talents by id)
      T('rm4', 'Opening Shot', 'r_arcing', 2, 1, [['opener', 0.15]]),
      T('rm5', 'Lethal Shots', 'r_pierce', 2, 2, [['critDmg', 0.15]]),
      T('rm6', 'Patience', 'r_rapid', 2, 2, [sk('r_rapid', 'cd', 8)]),
      T('rm7', 'Arrow Storm', 'r_thousand', 1, 3, [sk('r_thousand', 'cd', 15), sk('r_thousand', 'pow', 0.4)]),
      T('rm8', 'Eagle Eye', 'r_thousand', 2, 4, [['critDmg', 0.1], sk('r_thousand', 'pow', 0.15)]),
      T('rm9', 'One Arrow, One Engine', 'r_thousand', 1, 5, [['crit', 0.03], ['critDmg', 0.1]]),
      T('rm10', 'Plumb-True Aim', 'r_thousand', 1, 6, [['crit', 0.03], ['dmg', 0.03]]),
      T('rm11', 'Iron Plumb', 'r_deadweight', 1, 7, [sk('r_deadweight', 'pow', 0.25), ['crit', 0.02]]),
      T('rm12', 'Chisel-Point Fletching', 'r_chisel', 1, 8, [sk('r_chisel', 'pow', 0.25), ['critDmg', 0.08]]),
      T('rm13', 'Ridgeline Eye', 'r_ridgeline', 1, 9, [sk('r_ridgeline', 'pow', 0.2), ['crit', 0.02]]),
      T('rm14', 'Spring Tide Eye', 'r_springtide', 1, 10, [sk('r_springtide', 'pow', 0.2), ['crit', 0.02]]),
    ] },
    { name: 'Trapper', desc: 'Snares, barbs and ground of your choosing.', ic: 'r_trap', list: [
      T('rt1', 'Barbed Arrows', 'r_explosive', 3, 0, [['dot', 0.08]]),
      T('rt2', 'Tight Snares', 'r_trap', 3, 0, [['ccDur', 0.1]]),
      T('rt3', 'Field Craft', 'r_cripple', 3, 1, [sk('r_trap', 'cd', 2), sk('r_cripple', 'pow', 0.15)]),
      T('rt4', 'Smoke Screen', 'r_smoke', 2, 1, [['dodge', 0.03]]),
      T('rt5', 'Scatter Shot', 'r_fan', 2, 2, [['aoe', 0.08]]),
      T('rt6', 'Volley Master', 'r_volley', 2, 2, [sk('r_volley', 'cd', 2), sk('r_volley', 'pow', 0.1)]),
      T('rt7', 'Blasting Heads', 'r_explosive', 1, 3, [sk('r_explosive', 'cd', 4), sk('r_explosive', 'pow', 0.5)]),
      T('rt8', 'Snare Master', 'r_trap', 2, 4, [['aoe', 0.06], ['dot', 0.06]]),
      T('rt9', 'Glass Snares', 'r_trap', 1, 5, [['dot', 0.08], ['ccDur', 0.15]]),
      T('rt10', 'Sluice Snares', 'r_trap', 1, 6, [['ccDur', 0.15], ['dot', 0.08]]),
      T('rt11', 'Ripsaw Teeth', 'r_ripsaw', 1, 7, [['dot', 0.1], sk('r_ripsaw', 'cd', 3)]),
      T('rt12', 'Falling Bodkins', 'r_hail', 1, 8, [sk('r_hail', 'pow', 0.2), ['aoe', 0.04]]),
      T('rt13', 'Waxed Hemp', 'r_tether', 1, 9, [sk('r_tether', 'cd', 3), ['ccDur', 0.1]]),
      T('rt14', 'Pine Tar Heads', 'r_tarhead', 1, 10, [sk('r_tarhead', 'cd', 3), ['ccDur', 0.1]]),
    ] },
    { name: 'Wayfarer', desc: 'Light on the feet, hard to pin down.', ic: 'r_disengage', list: [
      T('rw1', 'Light Feet', 'r_disengage', 3, 0, [['speed', 0.03]]),
      T('rw2', 'Endurance', 'r_roll', 3, 0, [['hp', 0.04]]),
      T('rw3', 'Calm Breathing', 'r_rapid', 3, 1, [['regen', 0.06]]),
      T('rw4', 'Close Quarters', 'r_dagger', 2, 1, [sk('r_dagger', 'pow', 0.2), sk('r_kick', 'pow', 0.2)]),
      T('rw5', 'Tumble', 'r_roll', 2, 2, [['cdr', 0.05]]),
      T('rw6', 'Forager', 'r_quick', 2, 2, [['leech', 0.03]]),
      T('rw7', 'Open Road', 'r_disengage', 1, 3, [['dodge', 0.08], sk('r_disengage', 'cd', 6)]),
      T('rw8', 'Long Road Home', 'r_disengage', 2, 4, [['speed', 0.03], ['dodge', 0.02]]),
      T('rw9', 'Salt Road Runner', 'r_disengage', 1, 5, [['speed', 0.04], ['dodge', 0.03]]),
      T('rw10', 'Stair-Runner', 'r_disengage', 1, 6, [['speed', 0.04], ['haste', 0.03]]),
      T('rw11', 'Black Sand Stride', 'r_disengage', 1, 7, [['speed', 0.04], ['dodge', 0.03]]),
      T('rw12', 'Glacier Footing', 'r_hail', 1, 8, [['speed', 0.04], sk('r_hail', 'cd', 8)]),
      T('rw13', 'Windward Stride', 'r_tether', 1, 9, [['speed', 0.04], ['dodge', 0.03]]),
      T('rw14', 'Mudflat Stride', 'r_tarhead', 1, 10, [['speed', 0.04], ['dodge', 0.03]]),
    ] },
  ],
  chemist: [
    { name: 'Volatile', desc: 'Bigger blasts, shorter fuses.', ic: 'c_volatile', list: [
      T('cv1', 'Hotter Flames', 'c_fire', 3, 0, [sk('c_fire', 'pow', 0.08)]),
      T('cv2', 'Unstable Compounds', 'c_volatile', 3, 0, [['dmg', 0.02]]),
      T('cv3', 'Blast Radius', 'c_shrapnel', 3, 1, [['aoe', 0.05]]),
      T('cv4', 'Quick Fuse', 'c_clockwork', 2, 1, [['cdr', 0.05]]),
      T('cv5', 'Overpressure', 'c_concussion', 2, 2, [['critDmg', 0.15]]),
      T('cv6', 'Precise Measures', 'c_catalyst', 2, 2, [['crit', 0.03]]),
      T('cv7', 'Master Blaster', 'c_grand', 1, 3, [sk('c_grand', 'cd', 15), sk('c_grand', 'pow', 0.3)]),
      T('cv8', 'Grand Design', 'c_grand', 2, 4, [['aoe', 0.05], sk('c_grand', 'pow', 0.15)]),
      T('cv9', 'Kiln-Hot Mixtures', 'c_grand', 1, 5, [['aoe', 0.06], ['dmg', 0.03]]),
      T('cv10', 'Pressure Charge', 'c_grand', 1, 6, [['aoe', 0.06], ['critDmg', 0.08]]),
      T('cv11', 'Overpressure Valve', 'c_boiler', 1, 7, [sk('c_boiler', 'pow', 0.25), ['aoe', 0.04]]),
      T('cv12', 'Saltpetre Charge', 'c_frostpack', 1, 8, [sk('c_frostpack', 'pow', 0.25), ['ccDur', 0.1]]),
      T('cv13', 'Short Fuse', 'c_ridgecharge', 1, 9, [sk('c_ridgecharge', 'pow', 0.25), ['aoe', 0.04]]),
      T('cv14', 'Tar Kettle', 'c_tarpot', 1, 10, [sk('c_tarpot', 'pow', 0.25), ['aoe', 0.04]]),
    ] },
    { name: 'Corrosion', desc: 'Acids that keep working after you walk away.', ic: 'c_acid', list: [
      T('cc1', 'Stronger Acids', 'c_acid', 3, 0, [['dot', 0.08]]),
      T('cc2', 'Lingering Fumes', 'c_corrosive', 3, 0, [sk('c_corrosive', 'pow', 0.1)]),
      T('cc3', 'Eating Through', 'c_naphtha', 3, 1, [['execute', 0.08]]),
      T('cc4', 'Thick Tar', 'c_tar', 2, 1, [['ccDur', 0.15]]),
      T('cc5', 'Caustic Chain', 'c_chain', 2, 2, [sk('c_chain', 'pow', 0.2)]),
      T('cc6', 'Economy', 'c_staff', 2, 2, [['cost', 0.05]]),
      T('cc7', 'Meltdown', 'c_acid', 1, 3, [['dot', 0.25]]),
      T('cc8', 'Slow Burn', 'c_acid', 2, 4, [['dot', 0.08], ['dmg', 0.02]]),
      T('cc9', 'Glass-Eating Acid', 'c_acid', 1, 5, [['dot', 0.1], ['execute', 0.08]]),
      T('cc10', 'Verdigris Rot', 'c_acid', 1, 6, [['dot', 0.1], ['dmg', 0.03]]),
      T('cc11', 'Thermite Mix', 'c_thermite', 1, 7, [['dot', 0.1], sk('c_thermite', 'cd', 3)]),
      T('cc12', 'Slaked Lime', 'c_quicklime', 1, 8, [['dot', 0.1], sk('c_quicklime', 'cd', 3)]),
      T('cc13', 'Carbide Bed', 'c_carbide', 1, 9, [['dot', 0.1], sk('c_carbide', 'cd', 3)]),
      T('cc14', 'Saturated Brine', 'c_brine', 1, 10, [['dot', 0.1], sk('c_brine', 'cd', 3)]),
    ] },
    { name: 'Apparatus', desc: 'Padding, remedies and a well-kept kit.', ic: 'c_draught', list: [
      T('ca1', 'Padded Coat', 'c_smokebomb', 3, 0, [['armor', 0.02]]),
      T('ca2', 'Field Medicine', 'c_draught', 3, 0, [['heal', 0.1]]),
      T('ca3', 'Reagent Recycler', 'c_spark', 3, 1, [['regen', 0.06]]),
      T('ca4', 'Quick Retreat', 'c_vault', 2, 1, [['speed', 0.04]]),
      T('ca5', 'Flash Powder', 'c_flash', 2, 2, [sk('c_flash', 'cd', 4)]),
      T('ca6', 'Reclaimer', 'c_staff', 2, 2, [['killRes', 5]]),
      T('ca7', 'Emergency Formula', 'c_vigor', 1, 3, [['lastStand', 1], sk('c_vigor', 'cd', 15)]),
      T('ca8', 'Field Laboratory', 'c_draught', 2, 4, [['absorb', 0.1], ['heal', 0.06]]),
      T('ca9', 'Desert Pharmacy', 'c_draught', 1, 5, [['heal', 0.08], ['absorb', 0.1]]),
      T('ca10', 'Cistern Draughts', 'c_draught', 1, 6, [['heal', 0.08], ['regen', 0.06]]),
      T('ca11', 'Heat-Proof Apron', 'c_draught', 1, 7, [['armor', 0.04], ['heal', 0.08]]),
      T('ca12', 'Oilskin Coat', 'c_frostpack', 1, 8, [['armor', 0.04], ['hp', 0.04]]),
      T('ca13', 'Felted Liner', 'c_carbide', 1, 9, [['armor', 0.04], ['hp', 0.04]]),
      T('ca14', 'Oilskin Apron', 'c_brine', 1, 10, [['armor', 0.04], ['hp', 0.04]]),
    ] },
  ],
  sandblade: [
    { name: 'Duelist', desc: 'Every cut finds a gap.', ic: 's_slash', list: [
      T('sd1', 'Honed Scimitar', 's_slash', 3, 0, [['dmg', 0.02]]),
      T('sd2', 'Twin Fangs', 's_twin', 3, 0, [sk('s_twin', 'pow', 0.1)]),
      T('sd3', 'Weak Spots', 's_feint', 3, 1, [['crit', 0.03]]),
      T('sd4', 'Counter Rhythm', 's_counter', 2, 1, [sk('s_counter', 'pow', 0.2)]),
      T('sd5', 'No Mercy', 's_finish', 2, 2, [['execute', 0.12]]),
      T('sd6', 'Deep Cuts', 's_rend', 2, 2, [['dot', 0.12]]),
      T('sd7', 'Blade Storm', 's_thousand', 1, 3, [sk('s_thousand', 'cd', 15), sk('s_thousand', 'pow', 0.4)]),
      T('sd8', 'Ten Thousand Cuts', 's_thousand', 2, 4, [['crit', 0.02], sk('s_thousand', 'pow', 0.15)]),
      T('sd9', 'Salt-Wind Strikes', 's_thousand', 1, 5, [['crit', 0.03], ['haste', 0.03]]),
      T('sd10', 'Paddle-Wheel Flurry', 's_thousand', 1, 6, [['haste', 0.04], ['crit', 0.02]]),
      T('sd11', 'Obsidian Edge', 's_sirocco', 1, 7, [sk('s_sirocco', 'pow', 0.2), ['execute', 0.08]]),
      T('sd12', 'Falling Water', 's_cascade', 1, 8, [sk('s_cascade', 'pow', 0.2), ['execute', 0.08]]),
      T('sd13', 'Snowblind Edge', 's_whiteout', 1, 9, [sk('s_whiteout', 'pow', 0.2), ['execute', 0.08]]),
      T('sd14', 'Bore Edge', 's_tidalbore', 1, 10, [sk('s_tidalbore', 'pow', 0.2), ['execute', 0.08]]),
    ] },
    { name: 'Dunestrider', desc: 'Move like the wind across the sand.', ic: 's_step', list: [
      T('ss1', 'Sand Legs', 's_step', 3, 0, [['speed', 0.03]]),
      T('ss2', 'Quick Recovery', 's_evasion', 3, 0, [['regen', 0.06]]),
      T('ss3', 'Shifting Sands', 's_cloak', 3, 1, [['dodge', 0.03]]),
      T('ss4', 'Dune Leaper', 's_leap', 2, 1, [sk('s_leap', 'cd', 3)]),
      T('ss5', 'Whirlwind Steps', 's_whirl', 2, 2, [['aoe', 0.08]]),
      T('ss6', 'Light Touch', 's_dust', 2, 2, [['cost', 0.06]]),
      T('ss7', 'Mirage', 's_cloak', 1, 3, [['dodge', 0.08], sk('s_cloak', 'cd', 10)]),
      T('ss8', 'Dune Dancer', 's_step', 2, 4, [['dodge', 0.03], ['haste', 0.02]]),
      T('ss9', 'Mirage Step', 's_step', 1, 5, [['dodge', 0.04], ['speed', 0.03]]),
      T('ss10', 'Lamp-Shaft Shadow', 's_step', 1, 6, [['dodge', 0.04], ['critDmg', 0.08]]),
      T('ss11', 'Ash-Wind Step', 's_step', 1, 7, [['dodge', 0.04], ['haste', 0.03]]),
      T('ss12', 'Riverstone Step', 's_undertow', 1, 8, [['dodge', 0.04], sk('s_undertow', 'cd', 2)]),
      T('ss13', 'Drift Step', 's_scour', 1, 9, [['dodge', 0.04], sk('s_scour', 'cd', 2)]),
      T('ss14', 'Rip Current Step', 's_riptide', 1, 10, [['dodge', 0.04], sk('s_riptide', 'cd', 2)]),
    ] },
    { name: 'Bladeguard', desc: 'Shield up, blade ready, never down.', ic: 's_ram', list: [
      T('sg1', 'Round Shield', 's_ram', 3, 0, [['armor', 0.02]]),
      T('sg2', 'Hardy', 's_shieldspin', 3, 0, [['hp', 0.04]]),
      T('sg3', 'Second Edge', 's_needle', 3, 1, [['leech', 0.02]]),
      T('sg4', 'Ram Drills', 's_ram', 2, 1, [sk('s_ram', 'cd', 2), ['ccDur', 0.1]]),
      T('sg5', 'Spiked Rim', 's_shieldspin', 2, 2, [['thorns', 0.08]]),
      T('sg6', 'Steady Footing', 's_sweep', 2, 2, [['cdr', 0.05]]),
      T('sg7', 'Desert Resolve', 's_evasion', 1, 3, [['lastStand', 1]]),
      T('sg8', 'Sandwall', 's_ram', 2, 4, [['armor', 0.03], ['thorns', 0.05]]),
      T('sg9', 'Glassguard', 's_ram', 1, 5, [['armor', 0.04], ['thorns', 0.06]]),
      T('sg10', 'Bronze Bulwark', 's_ram', 1, 6, [['armor', 0.05], ['thorns', 0.06]]),
      T('sg11', 'Glass-Faced Shield', 's_glass', 1, 7, [['armor', 0.05], sk('s_glass', 'pow', 0.2)]),
      T('sg12', 'Ice-Rimmed Shield', 's_undertow', 1, 8, [['armor', 0.05], sk('s_undertow', 'pow', 0.2)]),
      T('sg13', 'Rimed Buckler', 's_scour', 1, 9, [['armor', 0.05], sk('s_scour', 'pow', 0.2)]),
      T('sg14', 'Salt-Crusted Buckler', 's_riptide', 1, 10, [['armor', 0.05], sk('s_riptide', 'pow', 0.2)]),
    ] },
  ],
  warden: [
    { name: 'Ironwall', desc: 'Nothing passes.', ic: 'w_wall', list: [
      T('wi1', 'Plating', 'w_iron', 3, 0, [['armor', 0.02]]),
      T('wi2', 'Bulk', 'w_wall', 3, 0, [['hp', 0.05]]),
      T('wi3', 'Bastion', 'w_challenge', 3, 1, [['threat', 0.2]]),
      T('wi4', 'Wall Drills', 'w_wall', 2, 1, [sk('w_wall', 'cd', 8)]),
      T('wi5', 'Rebound', 'w_deflect', 2, 2, [['thorns', 0.08]]),
      T('wi6', 'Fortitude', 'w_fortify', 2, 2, [['dot', 0.12], ['heal', 0.08]]),
      T('wi7', 'Immovable', 'w_laststand', 1, 3, [['lastStand', 1], sk('w_laststand', 'cd', 30)]),
      T('wi8', 'Mountain Stance', 'w_wall', 2, 4, [['armor', 0.03], ['hp', 0.04]]),
      T('wi9', 'Bedrock', 'w_wall', 1, 5, [['armor', 0.04], ['hp', 0.05]]),
      T('wi10', 'Foundation Stone', 'w_wall', 1, 6, [['hp', 0.05], ['absorb', 0.08]]),
      T('wi11', 'Slag Wall', 'w_wall', 1, 7, [['hp', 0.05], ['armor', 0.04]]),
      T('wi12', 'Dam-Stone Wall', 'w_icefall', 1, 8, [['hp', 0.05], sk('w_icefall', 'cd', 6)]),
      T('wi13', 'Brake-Shoe Wall', 'w_brakeblock', 1, 9, [['hp', 0.05], sk('w_brakeblock', 'cd', 6)]),
      T('wi14', 'Breakwater Wall', 'w_breakwater', 1, 10, [['hp', 0.05], sk('w_breakwater', 'cd', 6)]),
    ] },
    { name: 'Earthshaker', desc: 'Make the ground do the work.', ic: 'w_pound', list: [
      T('we1', 'Heavy Hammer', 'w_blow', 3, 0, [['dmg', 0.02]]),
      T('we2', 'Aftershock', 'w_pound', 3, 0, [['aoe', 0.05]]),
      T('we3', 'Fault Lines', 'w_split', 3, 1, [sk('w_split', 'pow', 0.1)]),
      T('we4', 'Concussive', 'w_ring', 2, 1, [['ccDur', 0.15]]),
      T('we5', 'Crushing Force', 'w_pulverize', 2, 2, [['critDmg', 0.15]]),
      T('we6', 'Momentum', 'w_combo', 2, 2, [['cdr', 0.05]]),
      T('we7', 'Landslide', 'w_colossus', 1, 3, [sk('w_colossus', 'cd', 15), sk('w_colossus', 'pow', 0.4)]),
      T('we8', 'Rockfall', 'w_colossus', 2, 4, [['aoe', 0.05], sk('w_colossus', 'pow', 0.15)]),
      T('we9', 'Quake-Maker', 'w_colossus', 1, 5, [['aoe', 0.06], ['ccDur', 0.15]]),
      T('we10', 'Weight of the Deep', 'w_colossus', 1, 6, [['aoe', 0.06], ['dmg', 0.03]]),
      T('we11', 'Drop Forge', 'w_piledriver', 1, 7, [sk('w_piledriver', 'pow', 0.25), sk('w_anvil', 'cd', 3)]),
      T('we12', 'Icefall Weight', 'w_icefall', 1, 8, [sk('w_icefall', 'pow', 0.25), ['aoe', 0.04]]),
      T('we13', 'Counterweight Mass', 'w_counterweight', 1, 9, [sk('w_counterweight', 'pow', 0.25), ['aoe', 0.04]]),
      T('we14', 'Spud Weight', 'w_spud', 1, 10, [sk('w_spud', 'pow', 0.25), ['aoe', 0.04]]),
    ] },
    { name: 'Reprisal', desc: 'Every blow taken is paid back.', ic: 'w_shatter', list: [
      T('wr1', 'Grudge', 'w_slam', 3, 0, [['crit', 0.02]]),
      T('wr2', 'Resolve Flow', 'w_challenge', 3, 0, [['regen', 0.06]]),
      T('wr3', 'Shatter', 'w_shatter', 3, 1, [sk('w_shatter', 'pow', 0.1)]),
      T('wr4', 'Stubborn', 'w_uppercut', 2, 1, [['dodge', 0.03]]),
      T('wr5', 'Payback', 'w_toss', 2, 2, [['leech', 0.03]]),
      T('wr6', 'Charge On', 'w_bulwark', 2, 2, [sk('w_bulwark', 'cd', 4), ['speed', 0.03]]),
      T('wr7', 'Unstoppable', 'w_intercept', 1, 3, [['execute', 0.25]]),
      T('wr8', 'Hard Bargain', 'w_shatter', 2, 4, [['leech', 0.02], ['dmg', 0.02]]),
      T('wr9', 'Hard Ledger', 'w_shatter', 1, 5, [['leech', 0.03], ['dmg', 0.03]]),
      T('wr10', 'Makers\u2019 Ledger', 'w_shatter', 1, 6, [['leech', 0.03], ['crit', 0.02]]),
      T('wr11', 'Anvil Ledger', 'w_anvil', 1, 7, [sk('w_anvil', 'pow', 0.25), ['leech', 0.02]]),
      T('wr12', 'Trip Ledger', 'w_triphammer', 1, 8, [sk('w_triphammer', 'pow', 0.25), ['thorns', 0.04]]),
      T('wr13', 'Ratchet Ledger', 'w_brakeblock', 1, 9, [sk('w_brakeblock', 'pow', 0.2), ['thorns', 0.04]]),
      T('wr14', 'Tide Ledger', 'w_breakwater', 1, 10, [sk('w_breakwater', 'pow', 0.2), ['thorns', 0.04]]),
    ] },
  ],
  herbalist: [
    { name: 'Remedies', desc: 'Salves and tonics that never run thin.', ic: 'h_salve', list: [
      T('hr1', 'Gentle Hands', 'h_salve', 3, 0, [['heal', 0.04]]),
      T('hr2', 'Long Remedies', 'h_poultice', 3, 0, [['dot', 0.08]]),
      T('hr3', 'Strong Tonic', 'h_tonic', 3, 1, [sk('h_tonic', 'pow', 0.08)]),
      T('hr4', 'Thrift', 'h_salve', 2, 1, [['cost', 0.06]]),
      T('hr5', 'Quick Hands', 'h_antidote', 2, 2, [['haste', 0.03]]),
      T('hr6', 'Bark Skin', 'h_bark', 2, 2, [['absorb', 0.15]]),
      T('hr7', 'Master Remedy', 'h_remedy', 1, 3, [sk('h_remedy', 'cd', 15), sk('h_remedy', 'pow', 0.3)]),
      T('hr8', 'Healer of the Pass', 'h_remedy', 2, 4, [['heal', 0.06], sk('h_remedy', 'pow', 0.15)]),
      T('hr9', 'Oasis Hands', 'h_remedy', 1, 5, [['heal', 0.08], ['cost', 0.05]]),
      T('hr10', 'Channel-Water Hands', 'h_remedy', 1, 6, [['heal', 0.08], ['cdr', 0.04]]),
      T('hr11', 'Camphor Hands', 'h_camphor', 1, 7, [sk('h_camphor', 'pow', 0.25), sk('h_camphor', 'cd', 8)]),
      T('hr12', 'Willow Hands', 'h_willowsteam', 1, 8, [sk('h_willowsteam', 'pow', 0.25), sk('h_willowsteam', 'cd', 8)]),
      T('hr13', 'Spruce Hands', 'h_sprucebroth', 1, 9, [sk('h_sprucebroth', 'pow', 0.25), sk('h_sprucebroth', 'cd', 8)]),
      T('hr14', 'Kettle Hands', 'h_saltkettle', 1, 10, [sk('h_saltkettle', 'pow', 0.25), sk('h_saltkettle', 'cd', 8)]),
    ] },
    { name: 'Bramble', desc: 'Nettles, seeds and a hard staff.', ic: 'h_dart', list: [
      T('hb1', 'Nettles', 'h_dart', 3, 0, [['dot', 0.08]]),
      T('hb2', 'Hard Staff', 'h_sweep', 3, 0, [['dmg', 0.02]]),
      T('hb3', 'Seed Pods', 'h_seed', 3, 1, [['aoe', 0.06]]),
      T('hb4', 'Thorny Coat', 'h_uproot', 2, 1, [['thorns', 0.06]]),
      T('hb5', 'Stinging Sap', 'h_sneeze', 2, 2, [['ccDur', 0.15]]),
      T('hb6', 'Sharp Eye', 'h_flurry', 2, 2, [['crit', 0.03]]),
      T('hb7', 'Overgrowth', 'h_seed', 1, 3, [sk('h_seed', 'cd', 4), sk('h_seed', 'pow', 0.5)]),
      T('hb8', 'Bramblewood', 'h_dart', 2, 4, [['dmg', 0.03], ['dot', 0.05]]),
      T('hb9', 'Thornglass', 'h_dart', 1, 5, [['dmg', 0.04], ['dot', 0.06]]),
      T('hb10', 'Green Bronze Thorns', 'h_dart', 1, 6, [['dot', 0.08], ['dmg', 0.03]]),
      T('hb11', 'Bitter Thorn', 'h_dart', 1, 7, [['dot', 0.08], ['dmg', 0.03]]),
      T('hb12', 'Lime-Steeped Thorns', 'h_dart', 1, 8, [['dot', 0.08], ['crit', 0.02]]),
      T('hb13', 'Pitch-Dipped Darts', 'h_dart', 1, 9, [['dot', 0.08], ['crit', 0.02]]),
      T('hb14', 'Brine-Soaked Darts', 'h_dart', 1, 10, [['dot', 0.08], ['crit', 0.02]]),
    ] },
    { name: 'Cultivation', desc: 'Deep roots and a full herb pouch.', ic: 'h_bark', list: [
      T('hc1', 'Deep Roots', 'h_bark', 3, 0, [['hp', 0.04]]),
      T('hc2', 'Herb Pouch', 'h_swift', 3, 0, [['regen', 0.06]]),
      T('hc3', 'Swift Roots', 'h_swift', 3, 1, [['speed', 0.03]]),
      T('hc4', 'Calming Air', 'h_smoke', 2, 1, [['dodge', 0.03]]),
      T('hc5', 'Self Care', 'h_bandage', 2, 2, [sk('h_bandage', 'pow', 0.3), sk('h_revive', 'pow', 0.15)]),
      T('hc6', 'Gatherer', 'h_net', 2, 2, [['killRes', 5]]),
      T('hc7', 'Evergreen', 'h_sap', 1, 3, [['lastStand', 1]]),
      T('hc8', 'Old Growth', 'h_bark', 2, 4, [['regen', 0.06], ['hp', 0.03]]),
      T('hc9', 'Deep Well', 'h_bark', 1, 5, [['regen', 0.08], ['hp', 0.04]]),
      T('hc10', 'Underground Spring', 'h_bark', 1, 6, [['regen', 0.08], ['armor', 0.04]]),
      T('hc11', 'Bitterroot Stock', 'h_tincture', 1, 7, [sk('h_tincture', 'pow', 0.2), ['regen', 0.06]]),
      T('hc12', 'Meltwater Stock', 'h_snowmelt', 1, 8, [sk('h_snowmelt', 'pow', 0.2), sk('h_snowmelt', 'cost', 5)]),
      T('hc13', 'Pitch Stock', 'h_pitch', 1, 9, [sk('h_pitch', 'pow', 0.2), sk('h_pitch', 'cost', 5)]),
      T('hc14', 'Samphire Beds', 'h_samphire', 1, 10, [sk('h_samphire', 'pow', 0.2), sk('h_samphire', 'cost', 5)]),
    ] },
  ],
  deadeye: [
    { name: 'Gunslinger', desc: 'Two barrels, no wasted shots.', ic: 'd_pair', list: [
      T('dg1', 'Steady Wrists', 'd_snap', 3, 0, [['dmg', 0.02]]),
      T('dg2', 'Trigger Discipline', 'd_snap', 3, 0, [sk('d_snap', 'pow', 0.1)]),
      T('dg3', 'Sure Grip', 'd_pair', 3, 1, [['crit', 0.03]]),
      T('dg4', 'First Shot', 'd_chalk', 2, 1, [['opener', 0.15]]),
      T('dg5', 'Heavy Charges', 'd_slug', 2, 2, [['critDmg', 0.15]]),
      T('dg6', 'Fast Draw', 'd_quick', 2, 2, [sk('d_quick', 'cd', 2)]),
      T('dg7', 'Storm of Powder', 'd_storm', 1, 3, [sk('d_storm', 'cd', 15), sk('d_storm', 'pow', 0.4)]),
      T('dg8', 'Gunsmith’s Eye', 'd_storm', 2, 4, [['critDmg', 0.1], sk('d_storm', 'pow', 0.15)]),
      T('dg9', 'Matched Pair', 'd_pair', 1, 5, [['crit', 0.03], ['critDmg', 0.1]]),
      T('dg10', 'Bored True', 'd_quick', 1, 6, [['crit', 0.03], ['dmg', 0.03]]),
      T('dg11', 'Breach Load', 'd_breach', 1, 7, [sk('d_breach', 'pow', 0.25), ['crit', 0.02]]),
      T('dg12', 'Splitting Ball', 'd_splitter', 1, 8, [sk('d_splitter', 'pow', 0.25), ['critDmg', 0.08]]),
      T('dg13', 'Dry-Fire Drill', 'd_dry', 1, 9, [sk('d_dry', 'pow', 0.2), ['crit', 0.02]]),
      T('dg14', 'Broadside Drill', 'd_broadside', 1, 10, [sk('d_broadside', 'pow', 0.2), ['crit', 0.02]]),
    ] },
    { name: 'Powderwright', desc: 'Burning wadding, smoke and splash.', ic: 'd_powderburn', list: [
      T('dp1', 'Hot Wadding', 'd_powderburn', 3, 0, [['dot', 0.08]]),
      T('dp2', 'Thick Smoke', 'd_smoke', 3, 0, [['ccDur', 0.1]]),
      T('dp3', 'Coarse Grain', 'd_powderburn', 3, 1, [sk('d_powderburn', 'pow', 0.15)]),
      T('dp4', 'Smoke Cover', 'd_smoke', 2, 1, [['dodge', 0.03]]),
      T('dp5', 'Loose Shot', 'd_scatter', 2, 2, [['aoe', 0.08]]),
      T('dp6', 'Ricochet Angles', 'd_ricochet', 2, 2, [sk('d_ricochet', 'cd', 2), sk('d_ricochet', 'pow', 0.1)]),
      T('dp7', 'Double Charge', 'd_scatter', 1, 3, [sk('d_scatter', 'cd', 3), sk('d_scatter', 'pow', 0.5)]),
      T('dp8', 'Powder Hand', 'd_powderburn', 2, 4, [['aoe', 0.06], ['dot', 0.06]]),
      T('dp9', 'Sulphur Mix', 'd_priming', 1, 5, [['dot', 0.08], ['ccDur', 0.15]]),
      T('dp10', 'Short Links', 'd_chain', 1, 6, [sk('d_chain', 'cd', 3), ['ccDur', 0.1]]),
      T('dp11', 'Red-Hot Ball', 'd_hotshot', 1, 7, [sk('d_hotshot', 'pow', 0.25), ['dot', 0.1]]),
      T('dp12', 'Gauge Pressure', 'd_pressure', 1, 8, [sk('d_pressure', 'pow', 0.2), ['aoe', 0.04]]),
      T('dp13', 'Black Cloud', 'd_pressure', 1, 9, [sk('d_pressure', 'cd', 3), sk('d_smoke', 'cd', 3)]),
      T('dp14', 'Rock Salt Pouch', 'd_saltshot', 1, 10, [sk('d_saltshot', 'pow', 0.25), ['dot', 0.08]]),
    ] },
    { name: 'Skirmisher', desc: 'Never where the engine swings.', ic: 'd_roll', list: [
      T('dk1', 'Light Boots', 'd_roll', 3, 0, [['speed', 0.03]]),
      T('dk2', 'Road Leather', 'd_slide', 3, 0, [['hp', 0.04]]),
      T('dk3', 'Even Breath', 'd_reload', 3, 1, [['regen', 0.06]]),
      T('dk4', 'Close Work', 'd_grip', 2, 1, [sk('d_grip', 'pow', 0.2), sk('d_scatter', 'pow', 0.1)]),
      T('dk5', 'Tuck and Roll', 'd_roll', 2, 2, [['cdr', 0.05]]),
      T('dk6', 'Spare Cartridges', 'd_reload', 2, 2, [['killRes', 5]]),
      T('dk7', 'Kick Back', 'd_recoil', 1, 3, [['dodge', 0.08], sk('d_recoil', 'cd', 6)]),
      T('dk8', 'Long Slide', 'd_slide', 2, 4, [['speed', 0.03], ['dodge', 0.02]]),
      T('dk9', 'Running Fire', 'd_cartridge', 1, 5, [['haste', 0.03], sk('d_cartridge', 'cd', 10)]),
      T('dk10', 'Reload Drill', 'd_reload', 1, 6, [sk('d_reload', 'cd', 4), ['regen', 0.06]]),
      T('dk11', 'Last Round Ready', 'd_lastround', 1, 7, [sk('d_lastround', 'pow', 0.25), ['execute', 0.1]]),
      T('dk12', 'Hard to Pin', 'd_chain', 1, 8, [['dodge', 0.04], ['leech', 0.03]]),
      T('dk13', 'Wide Road', 'd_roll', 1, 9, [['hp', 0.04], ['dodge', 0.03]]),
      T('dk14', 'Shingle Road', 'd_roll', 1, 10, [['hp', 0.04], ['dodge', 0.03]]),
    ] },
  ],
};

export const TALENT_BY_ID = {};
for (const [cls, paths] of Object.entries(TALENTS)) paths.forEach((P, pi) => P.list.forEach((t) => { TALENT_BY_ID[t.id] = { ...t, cls, path: pi }; }));

// sum a player's talent ranks into one modifier table used by the simulation
export function talentMods(cls, talents = {}) {
  const m = { dmg: 0, hp: 0, armor: 0, haste: 0, crit: 0, critDmg: 0, heal: 0, regen: 0, speed: 0, leech: 0, thorns: 0, cost: 0, dot: 0, aoe: 0, execute: 0, opener: 0, killRes: 0, dodge: 0, cdr: 0, threat: 0, ccDur: 0, absorb: 0, lastStand: 0, sk: {} };
  for (const [id, r] of Object.entries(talents)) {
    const t = TALENT_BY_ID[id];
    if (!t || t.cls !== cls || !r) continue;
    for (const e of t.e) {
      if (e[0] === 'sk') { const s = (m.sk[e[1]] = m.sk[e[1]] || { pow: 0, cd: 0, cost: 0 }); s[e[2]] += e[3] * r; }
      else m[e[0]] += e[1] * r;
    }
  }
  return m;
}

export function pathSpent(cls, talents, pi) { let n = 0; for (const t of TALENTS[cls][pi].list) n += talents[t.id] || 0; return n; }
export function totalSpent(talents) { let n = 0; for (const r of Object.values(talents || {})) n += r; return n; }

// human-readable effect text for tooltips
const SK_NAME = {};
for (const list of Object.values(SKILLS)) for (const s of list) SK_NAME[s.id] = s.name;
const PCT = (v) => `${Math.round(v * 100)}%`;
export function describeEffect(e, r = 1) {
  if (e[0] === 'sk') {
    const n = SK_NAME[e[1]] || e[1];
    if (e[2] === 'pow') return `${n} is ${PCT(e[3] * r)} stronger`;
    if (e[2] === 'cd') return `${n} cooldown ${+(e[3] * r).toFixed(1)}s shorter`;
    return `${n} costs ${e[3] * r} less`;
  }
  const v = e[1] * r;
  switch (e[0]) {
    case 'dmg': return `${PCT(v)} more damage`;
    case 'hp': return `${PCT(v)} more maximum health`;
    case 'armor': return `${PCT(v)} less damage taken`;
    case 'haste': return `${PCT(v)} haste`;
    case 'crit': return `${PCT(v)} critical strike chance`;
    case 'critDmg': return `critical strikes deal ${PCT(v)} more`;
    case 'heal': return `${PCT(v)} more healing`;
    case 'regen': return `${PCT(v)} faster resource regeneration`;
    case 'speed': return `${PCT(v)} faster movement`;
    case 'leech': return `${PCT(v)} of damage dealt heals you`;
    case 'thorns': return `attackers take ${PCT(v)} of the damage they deal`;
    case 'cost': return `skills cost ${PCT(v)} less`;
    case 'dot': return `${PCT(v)} stronger effects over time`;
    case 'aoe': return `${PCT(v)} more damage with area skills`;
    case 'execute': return `${PCT(v)} more damage to targets below 35% health`;
    case 'opener': return `${PCT(v)} more damage to targets above 90% health`;
    case 'killRes': return `restore ${v} resource on each kill`;
    case 'dodge': return `${PCT(v)} chance to dodge attacks`;
    case 'cdr': return `${PCT(v)} shorter cooldowns`;
    case 'threat': return `${PCT(v)} more threat`;
    case 'ccDur': return `stuns and roots last ${PCT(v)} longer`;
    case 'absorb': return `${PCT(v)} stronger shields`;
    case 'lastStand': return 'once every 2 minutes, a killing blow leaves you at 30% health instead';
  }
  return e[0];
}

// resource cost and cooldown of a skill after talents (used by the server and by the client's prediction)
export function skillCost(sk, mods) { const t = mods?.sk[sk.id]; return Math.max(0, Math.round(sk.cost * (1 - (mods?.cost || 0)) - (t?.cost || 0))); }
export function skillCd(sk, mods) { const t = mods?.sk[sk.id]; return sk.cd ? Math.max(1, sk.cd * (1 - (mods?.cdr || 0)) - (t?.cd || 0)) : 0; }
