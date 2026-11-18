// Classes and their 30 skills (20 to level 20, then one at 42 and a capstone at 45, one at 47 and a capstone at 50, one at 52 and a capstone at 55, one at 57 and a capstone at 60, one at 62 and a capstone at 65) (gameplay data shared by server and client).
// effects: ['dmg', coef] ['dot', coef, dur] ['heal', coef] ['hot', coef, dur] ['stun', dur] ['slow', pct, dur]
//          ['root', dur] ['knock', dist] ['dash', dist] ['leap', dist] ['back', dist] ['buff', stat, pct, dur]
//          ['debuff', stat, pct, dur] ['taunt', dur] ['absorb', coef, dur] ['cleanse'] ['execute', mult]
//          ['res', amount] (the caster's own resource back, capped at its maximum: the Deadeye's Quick Reload)
// hit: { t: seconds until impact, kind: melee|proj|aoe|self|line|cone|ground, r (radius), cone (deg), speed, n (hits), gap }
// target: enemy | self | ally | ground
// move: true  fired on the run: moving does not interrupt it (the Deadeye's shots; the client plays it on the upper body)
// ranged: true for the classes that fight from range (companions and volunteers keep their distance, sim.js)

export const CLASSES = {
  knight: {
    name: 'Knight', role: 'Melee · Defender', color: '#5a8ae8', resource: 'Valor', resColor: '#e8c24a',
    hp: 140, res: 100, regen: 9, armor: 0.12, speed: 6.2, weapon: 'Longsword & Kite Shield',
    desc: 'A sworn guardian in gold-trimmed plate. Holds the line with shield and blade.',
  },
  ranger: {
    name: 'Ranger', role: 'Ranged · Striker', color: '#7ab04a', resource: 'Focus', resColor: '#e8d070',
    hp: 110, res: 100, regen: 11, armor: 0.06, speed: 6.6, weapon: 'Recurve Bow', ranged: true,
    desc: 'A woodland scout who never misses. Keeps foes at bay with arrows and traps.',
  },
  chemist: {
    name: 'Chemist', role: 'Ranged · Area Damage', color: '#9a6ae0', resource: 'Reagents', resColor: '#b88aff',
    hp: 100, res: 100, regen: 10, armor: 0.04, speed: 6.2, weapon: 'Reactor Rod & Flasks', ranged: true,
    desc: 'A brilliant chemist whose bombs, acids and powders turn battles in an instant.',
  },
  sandblade: {
    name: 'Sandblade', role: 'Melee · Duelist', color: '#e07a4a', resource: 'Energy', resColor: '#f0d050',
    hp: 120, res: 100, regen: 12, armor: 0.08, speed: 6.8, weapon: 'Scimitar & Round Shield',
    desc: 'A desert duelist, fast as a sandstorm. Weaves between enemies with flashing cuts.',
  },
  warden: {
    name: 'Warden', role: 'Melee · Tank', color: '#6a8ac8', resource: 'Resolve', resColor: '#d86a4a',
    hp: 170, res: 100, regen: 10, armor: 0.2, speed: 5.9, weapon: 'Warhammer & Tower Shield',
    desc: 'An iron wall. Crushes the ground beneath the enemy and shrugs off any blow.',
  },
  herbalist: {
    name: 'Herbalist', role: 'Healer · Support', color: '#5ac86a', resource: 'Herbs', resColor: '#8ae86a',
    hp: 105, res: 100, regen: 11, armor: 0.05, speed: 6.3, weapon: 'Lantern Staff & Remedies', ranged: true,
    desc: 'A wandering healer with salves, tonics and bitter powders. Keeps every ally standing.',
  },
  // the seventh class (v106, docs/ai/deadeye_plan.md): black-powder steam pistols, one in each hand, every shot fired on the run
  deadeye: {
    name: 'Deadeye', role: 'Ranged · Skirmisher', color: '#4ab0b0', resource: 'Powder', resColor: '#b8b0a0',
    hp: 112, res: 100, regen: 8, armor: 0.07, speed: 6.7, weapon: 'Twin Steam Pistols', ranged: true, // (regen 9 and Snap Shot 0.9 in the plan: tuned to 8 and 0.8 so the dummy test puts him within 5% of the Ranger standing)
    desc: 'A gunhand in a long road coat. Never stands still: one pistol fires while the other comes up, and he is gone before the smoke clears.',
  },
};

const S = (id, name, o) => ({ id, name, gcd: true, cast: 0, cost: 15, cd: 0, range: 4, target: 'enemy', ...o });

export const SKILLS = {
  knight: [
    S('k_valiant', 'Valiant Strike', { icon: 'slash', lvl: 1, cost: 10, cd: 0, hit: { t: 0.34, kind: 'melee' }, fx: [['dmg', 1.0]], desc: 'A diagonal cut from high to low.' }),
    S('k_bash', 'Shield Bash', { icon: 'shield', lvl: 1, cost: 15, cd: 8, hit: { t: 0.28, kind: 'melee' }, fx: [['dmg', 0.6], ['stun', 1.5]], desc: 'Drive your shield forward, stunning the target.' }),
    S('k_rising', 'Rising Cut', { icon: 'rise', lvl: 2, cost: 15, cd: 5, hit: { t: 0.3, kind: 'melee' }, fx: [['dmg', 1.3], ['knock', 1.5]], desc: 'An upward slash that lifts the enemy off balance.' }),
    S('k_rally', 'Rally Cry', { icon: 'banner', lvl: 3, cost: 25, cd: 45, target: 'self', range: 0, hit: { t: 0.55, kind: 'self', r: 15 }, fx: [['buff', 'dmg', 15, 12]], desc: 'You and nearby allies deal 15% more damage for 12s.' }),
    S('k_cleave', 'Cleaving Arc', { icon: 'arc', lvl: 4, cost: 20, cd: 6, hit: { t: 0.4, kind: 'cone', r: 4.5, cone: 160 }, fx: [['dmg', 0.9]], desc: 'A broad sweep hitting all enemies in front.' }),
    S('k_lunge', 'Lunge', { icon: 'thrust', lvl: 5, cost: 15, cd: 10, range: 10, hit: { t: 0.32, kind: 'melee' }, fx: [['dash', 7], ['dmg', 1.2]], desc: 'Close the distance with a piercing thrust.' }),
    S('k_guard', 'Guardian Stance', { icon: 'stance', lvl: 6, cost: 20, cd: 30, target: 'self', range: 0, hit: { t: 0.3, kind: 'self' }, fx: [['buff', 'armor', 40, 8]], desc: 'Brace behind your shield, reducing damage taken by 40%.' }),
    S('k_twin', 'Twin Slash', { icon: 'twin', lvl: 7, cost: 20, cd: 6, hit: { t: 0.24, kind: 'melee', n: 2, gap: 0.26 }, fx: [['dmg', 0.75]], desc: 'Two fast horizontal cuts.' }),
    S('k_skybreaker', 'Skybreaker', { icon: 'leap', lvl: 8, cost: 30, cd: 14, range: 12, hit: { t: 0.72, kind: 'aoe', r: 4 }, fx: [['leap', 9], ['dmg', 1.6], ['slow', 30, 3]], desc: 'Leap into the air and bring your blade down in a crushing blow.' }),
    S('k_wind', 'Second Wind', { icon: 'heart', lvl: 9, cost: 20, cd: 60, target: 'self', range: 0, cast: 1.2, hit: { t: 1.2, kind: 'self' }, fx: [['heal', 2.5]], desc: 'Kneel and catch your breath, restoring health.' }),
    S('k_spin', 'Spinning Blade', { icon: 'spin', lvl: 10, cost: 25, cd: 9, range: 0, target: 'self', hit: { t: 0.35, kind: 'aoe', r: 4 }, fx: [['dmg', 1.1]], desc: 'Whirl your sword around you in a full circle.' }),
    S('k_pommel', 'Pommel Strike', { icon: 'fist', lvl: 11, cost: 10, cd: 12, gcd: false, hit: { t: 0.2, kind: 'melee' }, fx: [['dmg', 0.5], ['stun', 0.8]], desc: 'A quick jab with the hilt that interrupts.' }),
    S('k_shieldthrow', 'Shield Throw', { icon: 'disc', lvl: 12, cost: 20, cd: 10, range: 20, hit: { t: 0.38, kind: 'proj', speed: 26 }, fx: [['dmg', 1.3], ['slow', 40, 4]], desc: 'Hurl your shield; it returns to your arm.' }),
    S('k_riposte', 'Riposte', { icon: 'parry', lvl: 13, cost: 15, cd: 12, hit: { t: 0.55, kind: 'melee' }, fx: [['dmg', 1.8]], desc: 'Parry, then answer with a precise counter-cut.' }),
    S('k_charge', 'Valor Charge', { icon: 'charge', lvl: 14, cost: 20, cd: 18, range: 18, hit: { t: 0.5, kind: 'melee' }, fx: [['dash', 15], ['dmg', 1.0], ['stun', 1.2]], desc: 'Charge the target and knock it down.' }),
    S('k_sunder', 'Sundering Stab', { icon: 'stab', lvl: 15, cost: 20, cd: 10, hit: { t: 0.42, kind: 'melee' }, fx: [['dmg', 1.1], ['debuff', 'armor', 25, 10]], desc: 'Drive the blade down through the enemy\'s guard, weakening its armour.' }),
    S('k_shout', 'Defiant Shout', { icon: 'shout', lvl: 16, cost: 10, cd: 15, target: 'self', range: 0, hit: { t: 0.35, kind: 'aoe', r: 10 }, fx: [['taunt', 4]], desc: 'Challenge every enemy nearby to fight you.' }),
    S('k_arcwave', 'Arc Wave', { icon: 'wave', lvl: 17, cost: 25, cd: 12, range: 16, hit: { t: 0.42, kind: 'line', r: 16, speed: 22 }, fx: [['dmg', 1.4]], desc: 'A swing so fierce it sends a wave of dust tearing along the ground.' }),
    S('k_unbreakable', 'Unbreakable', { icon: 'bastion', lvl: 18, cost: 30, cd: 60, target: 'self', range: 0, hit: { t: 0.5, kind: 'self' }, fx: [['absorb', 3, 10]], desc: 'Steel yourself, absorbing a large amount of damage.' }),
    S('k_kingsfall', 'Kingsfall', { icon: 'crown', lvl: 20, cost: 50, cd: 45, range: 10, hit: { t: 0.32, kind: 'aoe', r: 5, n: 3, gap: 0.42 }, fx: [['dmg', 1.4]], desc: 'Ultimate: two sweeping cuts and a leaping slam that shakes the earth.' }),
    // level 42 and 45 (Part Ten, the Cinder Reach)
    S('k_breach', 'Breaching Cut', { icon: 'slash', lvl: 42, cost: 20, cd: 10, hit: { t: 0.5, kind: 'melee' }, fx: [['dmg', 1.8], ['debuff', 'armor', 20, 8]], desc: 'A heavy cut from high over the shoulder, stepping in, that splits the plating of a machine.' }),
    S('k_holdline', 'Hold the Line', { icon: 'bastion', lvl: 45, cost: 40, cd: 30, target: 'self', range: 0, hit: { t: 0.66, kind: 'aoe', r: 5 }, fx: [['dmg', 3.0], ['taunt', 4], ['slow', 30, 4]], desc: 'Capstone: plant the shield, then sweep the blade all the way round. Every machine nearby is struck, slowed and turned on you.' }),
    // level 47 and 50 (Part Eleven, the Rime Steps)
    S('k_millrace', 'Millrace Sweep', { icon: 'arc', lvl: 47, cost: 20, cd: 9, range: 5, hit: { t: 0.42, kind: 'cone', r: 5, cone: 150 }, fx: [['dmg', 1.5], ['slow', 40, 4]], desc: 'A low, flat sweep of the blade from right to left, stepping through, that cuts at the legs of every machine in front.' }),
    S('k_sluicegate', 'Sluicegate Blow', { icon: 'shield', lvl: 50, cost: 45, cd: 30, hit: { t: 0.3, kind: 'melee', n: 2, gap: 0.55 }, fx: [['dmg', 1.7], ['stun', 1.2], ['debuff', 'vuln', 15, 8]], desc: 'Capstone: ram the kite shield in to jam the machine like a closing sluice gate, then bring the sword down on the seam. The machine takes more from every blow after.' }),
    // level 52 and 55 (Part Twelve, the Windward Heights)
    S('k_crosswind', 'Crosswind Cut', { icon: 'arc', lvl: 52, cost: 20, cd: 9, range: 5, hit: { t: 0.4, kind: 'cone', r: 5, cone: 130 }, fx: [['dmg', 1.6], ['knock', 2]], desc: 'A flat backhand cut at chest height from left to right, stepping in, that shoves every machine in front aside like a hard side wind.' }),
    S('k_windwall', 'Windwall Advance', { icon: 'shield', lvl: 55, cost: 45, cd: 30, range: 5, hit: { t: 0.34, kind: 'cone', r: 5, cone: 120, n: 2, gap: 0.5 }, fx: [['dmg', 1.6], ['knock', 2], ['stun', 1.0]], desc: 'Capstone: lean into the kite shield and drive it forward like a board set against the wind, then thrust the sword out flat over its rim. Every machine in front is battered and staggered twice.' }),
    // ---- level 57 and 60 (Tidewater Sound) ----
    S('k_tidebreak', 'Tidebreak Cut', { icon: 'slash', lvl: 57, cost: 20, cd: 10, hit: { t: 0.46, kind: 'melee' }, fx: [['dmg', 1.8], ['slow', 40, 4]], desc: 'A diagonal cut falling from high over the left shoulder on a hard step in, breaking over the machine like a wave on the quay. It wades on slowly after.' }),
    S('k_seawall', 'Sea Wall', { icon: 'bastion', lvl: 60, cost: 45, cd: 30, target: 'self', range: 0, hit: { t: 0.36, kind: 'aoe', r: 5, n: 2, gap: 0.5 }, fx: [['dmg', 1.6], ['stun', 1.0], ['taunt', 4]], desc: 'Capstone: drive the kite shield down edge-first into the ground like a sea wall, then sweep the sword round over its rim. Every machine nearby is struck twice, staggered and turned on you.' }),
    // ---- level 62 and 65 (the Rainward Gorge) ----
    S('k_slipface', 'Slipface Cut', { icon: 'slash', lvl: 62, cost: 20, cd: 10, hit: { t: 0.44, kind: 'melee' }, fx: [['dmg', 1.85], ['debuff', 'armor', 10, 6]], desc: 'A heavy cut falling steeply from high over the right shoulder on a hard step in, shearing down through the plating like the face of a slip coming off a wet bank. The plates it lands on are left loose.' }),
    S('k_drystone', 'Dry-Stone Wall', { icon: 'bastion', lvl: 65, cost: 45, cd: 30, target: 'self', range: 0, hit: { t: 0.36, kind: 'aoe', r: 5, n: 2, gap: 0.5 }, fx: [['dmg', 1.65], ['stun', 1.0], ['taunt', 4], ['slow', 30, 4]], desc: 'Capstone: set the kite shield down square like the first stone of a dry-stone wall, then sweep the sword round over its rim, forehand and back. Every machine nearby is struck twice, staggered, slowed and turned on you.' }),
  ],
  ranger: [
    S('r_quick', 'Quick Shot', { icon: 'arrow', lvl: 1, cost: 8, range: 28, hit: { t: 0.28, kind: 'proj', speed: 48 }, fx: [['dmg', 0.9]], desc: 'A fast snap shot.' }),
    S('r_aimed', 'Aimed Shot', { icon: 'aim', lvl: 1, cost: 18, cast: 1.5, range: 32, hit: { t: 1.55, kind: 'proj', speed: 60 }, fx: [['dmg', 2.1]], desc: 'Draw fully and release a devastating arrow.' }),
    S('r_twin', 'Twin Arrows', { icon: 'twinarrow', lvl: 2, cost: 15, cd: 6, range: 28, hit: { t: 0.25, kind: 'proj', speed: 50, n: 2, gap: 0.22 }, fx: [['dmg', 0.9]], desc: 'Loose two arrows in quick succession.' }),
    S('r_volley', 'Volley', { icon: 'rain', lvl: 3, cost: 25, cd: 10, target: 'ground', range: 26, hit: { t: 1.1, kind: 'ground', r: 5 }, fx: [['dmg', 1.2]], desc: 'Fire high into the sky; arrows rain down on an area.' }),
    S('r_cripple', 'Crippling Shot', { icon: 'cripple', lvl: 4, cost: 12, cd: 8, range: 28, hit: { t: 0.3, kind: 'proj', speed: 50 }, fx: [['dmg', 0.6], ['slow', 50, 4]], desc: 'Aim low to slow the target.' }),
    S('r_disengage', 'Disengage', { icon: 'backflip', lvl: 5, cost: 10, cd: 14, target: 'self', range: 0, gcd: false, hit: { t: 0.1, kind: 'self' }, fx: [['back', 9]], desc: 'Backflip away from danger.' }),
    S('r_pierce', 'Piercing Arrow', { icon: 'pierce', lvl: 6, cost: 20, cd: 8, range: 30, hit: { t: 0.5, kind: 'line', r: 30, speed: 70 }, fx: [['dmg', 1.5]], desc: 'An arrow that punches through every enemy in a line.' }),
    S('r_trap', 'Snare Trap', { icon: 'trap', lvl: 7, cost: 15, cd: 16, target: 'ground', range: 12, hit: { t: 0.5, kind: 'ground', r: 3 }, fx: [['root', 3], ['dmg', 0.4]], desc: 'Toss a snare that roots enemies who step in it.' }),
    S('r_barrage', 'Barrage', { icon: 'barrage', lvl: 8, cost: 30, cd: 12, range: 26, channel: 1.8, hit: { t: 0.2, kind: 'proj', speed: 55, n: 6, gap: 0.28 }, fx: [['dmg', 0.65]], desc: 'Channel a rapid stream of arrows.' }),
    S('r_dagger', 'Dagger Slash', { icon: 'dagger', lvl: 9, cost: 8, cd: 4, range: 3.5, hit: { t: 0.22, kind: 'melee' }, fx: [['dmg', 1.3]], desc: 'A backhand slash with your hunting knife.' }),
    S('r_mark', 'Marked Target', { icon: 'mark', lvl: 10, cost: 10, cd: 20, range: 35, gcd: false, hit: { t: 0.3, kind: 'melee' }, fx: [['debuff', 'vuln', 15, 15]], desc: 'Point out a target: it takes 15% more damage.' }),
    S('r_explosive', 'Explosive Arrow', { icon: 'blast', lvl: 11, cost: 25, cd: 10, range: 28, hit: { t: 0.45, kind: 'proj', speed: 44, r: 3.5 }, fx: [['dmg', 1.3], ['dot', 0.4, 4]], desc: 'An arrow tipped with lamp oil that bursts into flame.' }),
    S('r_kick', 'Sweeping Kick', { icon: 'kick', lvl: 12, cost: 12, cd: 10, range: 3.5, hit: { t: 0.28, kind: 'melee' }, fx: [['dmg', 0.6], ['knock', 4]], desc: 'Kick the enemy away.' }),
    S('r_smoke', 'Smoke Arrow', { icon: 'smoke', lvl: 13, cost: 18, cd: 18, target: 'ground', range: 26, hit: { t: 0.6, kind: 'ground', r: 5 }, fx: [['slow', 40, 5], ['debuff', 'miss', 30, 5]], desc: 'A smoke cloud that slows and blinds enemies inside.' }),
    S('r_arcing', 'Arcing Shot', { icon: 'arcing', lvl: 14, cost: 20, cd: 8, range: 36, hit: { t: 0.85, kind: 'proj', speed: 30, arc: 1 }, fx: [['dmg', 2.0]], desc: 'A lofted shot that drops from above.' }),
    S('r_rapid', 'Steady Breath', { icon: 'breath', lvl: 15, cost: 20, cd: 40, target: 'self', range: 0, hit: { t: 0.5, kind: 'self' }, fx: [['buff', 'haste', 30, 8]], desc: 'Calm your aim: 30% faster attacks for 8s.' }),
    S('r_fan', 'Fan of Arrows', { icon: 'fan', lvl: 16, cost: 25, cd: 9, range: 18, hit: { t: 0.38, kind: 'cone', r: 18, cone: 50 }, fx: [['dmg', 1.0]], desc: 'Five arrows spread in a cone.' }),
    S('r_pin', 'Pinning Shot', { icon: 'pin', lvl: 17, cost: 15, cd: 14, range: 28, hit: { t: 0.35, kind: 'proj', speed: 52 }, fx: [['dmg', 0.7], ['root', 3]], desc: 'Pin the target to the ground.' }),
    S('r_roll', 'Rolling Shot', { icon: 'roll', lvl: 18, cost: 15, cd: 12, range: 28, hit: { t: 0.62, kind: 'proj', speed: 50 }, fx: [['dash', -5], ['dmg', 1.1]], desc: 'Roll aside and shoot as you rise.' }),
    S('r_thousand', 'Thousand Arrows', { icon: 'storm', lvl: 20, cost: 50, cd: 45, target: 'ground', range: 24, hit: { t: 0.9, kind: 'ground', r: 7, n: 4, gap: 0.25 }, fx: [['dmg', 0.9]], desc: 'Ultimate: leap high and rain arrows down in a storm.' }),
    S('r_ripsaw', 'Ripsaw Arrow', { icon: 'pierce', lvl: 42, cost: 20, cd: 9, range: 30, hit: { t: 0.44, kind: 'proj', speed: 50 }, fx: [['dmg', 1.4], ['dot', 1.0, 6]], desc: 'A serrated steel broadhead that keeps cutting after it lands.' }),
    S('r_deadweight', 'Deadweight Shot', { icon: 'aim', lvl: 45, cost: 40, cd: 30, cast: 1.3, range: 36, hit: { t: 1.4, kind: 'line', r: 36, speed: 80 }, fx: [['dmg', 3.2], ['stun', 1.2]], desc: 'Capstone: brace low, draw an iron-weighted arrow to the ear and send it through every machine in a line.' }),
    S('r_chisel', 'Chisel Arrow', { icon: 'pierce', lvl: 47, cost: 20, cd: 9, range: 30, hit: { t: 0.46, kind: 'proj', speed: 55 }, fx: [['dmg', 1.8], ['debuff', 'armor', 20, 8]], desc: 'A square hardened-steel head, like a mason\'s chisel, that splits the joints of iron plating.' }),
    S('r_hail', 'Hail of Bodkins', { icon: 'rain', lvl: 50, cost: 40, cd: 35, cast: 1.0, target: 'ground', range: 30, hit: { t: 1.4, kind: 'ground', r: 6, n: 3, gap: 0.3 }, fx: [['dmg', 1.5], ['slow', 40, 5]], desc: 'Capstone: three high, heavy bodkin arrows loosed one after another on a steep arc. They come down together on the ground ahead, three times over.' }),
    S('r_tether', 'Tether Arrow', { icon: 'pin', lvl: 52, cost: 20, cd: 12, range: 28, hit: { t: 0.46, kind: 'proj', speed: 50 }, fx: [['dmg', 1.4], ['root', 2.5]], desc: 'An arrow trailing a short weighted cord of waxed hemp. It wraps round the legs of a machine and holds it where it stands.' }),
    S('r_ridgeline', 'Ridgeline Salvo', { icon: 'barrage', lvl: 55, cost: 45, cd: 30, range: 30, hit: { t: 0.4, kind: 'proj', speed: 60, n: 4, gap: 0.26 }, fx: [['dmg', 1.05], ['debuff', 'vuln', 10, 6]], desc: 'Capstone: four heavy steel-headed arrows nocked and loosed in a fast, even string, every one laid into the same seam. The machine takes more from every blow after.' }),
    // ---- level 57 and 60 (Tidewater Sound) ----
    S('r_tarhead', 'Tar-Head Arrow', { icon: 'pierce', lvl: 57, cost: 20, cd: 10, range: 30, hit: { t: 0.46, kind: 'proj', speed: 50 }, fx: [['dmg', 1.8], ['slow', 45, 5]], desc: 'An arrow with its head bound in tarred rope fibre. It sticks where it lands, and the machine drags the tar into every joint.' }),
    S('r_springtide', 'Spring Tide', { icon: 'aim', lvl: 60, cost: 45, cd: 30, cast: 0.8, range: 34, hit: { t: 0.9, kind: 'line', r: 34, speed: 85, n: 2, gap: 0.4 }, fx: [['dmg', 1.8], ['slow', 50, 5], ['debuff', 'vuln', 10, 6]], desc: 'Capstone: drop to one knee and send two long, heavy arrows down the same line, the second hard on the first, through every machine in the way like a spring tide over the flats. They are slowed, and take more from every blow after.' }),
    // ---- level 62 and 65 (the Rainward Gorge) ----
    S('r_stake', 'Ash Stake Arrow', { icon: 'pin', lvl: 62, cost: 20, cd: 10, range: 30, hit: { t: 0.46, kind: 'proj', speed: 50 }, fx: [['dmg', 1.95], ['root', 2]], desc: 'A short, thick ash-shafted arrow with a square iron head, loosed low into the track plates like a surveyor’s stake driven into wet ground. The machine stays where it is pinned.' }),
    S('r_cloudburst', 'Cloudburst', { icon: 'rain', lvl: 65, cost: 45, cd: 35, cast: 1.0, target: 'ground', range: 30, hit: { t: 1.4, kind: 'ground', r: 6, n: 4, gap: 0.25 }, fx: [['dmg', 1.25], ['slow', 40, 5], ['debuff', 'vuln', 8, 6]], desc: 'Capstone: four heavy arrows loosed nearly straight up, one after another as fast as the bow can be drawn. They come down on the ground ahead in a hard, wet rush, four times over, slowing every machine there and leaving it open to every blow after.' }),
  ],
  chemist: [
    S('c_fire', 'Fire Flask', { icon: 'flame', lvl: 1, cost: 14, cast: 1.0, range: 26, hit: { t: 1.25, kind: 'proj', speed: 22, arc: 1, r: 2.5 }, fx: [['dmg', 1.3], ['dot', 0.4, 4]], desc: 'Hurl a flask of lamp oil that bursts into flame.' }),
    S('c_acid', 'Acid Vial', { icon: 'acid', lvl: 1, cost: 12, range: 24, hit: { t: 0.42, kind: 'proj', speed: 26, arc: 0.6 }, fx: [['dot', 1.2, 6], ['debuff', 'armor', 10, 6]], desc: 'A sidearm toss of corrosive acid.' }),
    S('c_staff', 'Rod Strike', { icon: 'gear', lvl: 2, cost: 5, range: 3.5, hit: { t: 0.3, kind: 'melee' }, fx: [['dmg', 0.8]], desc: 'Bash with the brass head of your reactor rod.' }),
    S('c_chill', 'Chill Powder', { icon: 'frost', lvl: 3, cost: 15, cd: 10, range: 8, hit: { t: 0.38, kind: 'cone', r: 8, cone: 70 }, fx: [['dmg', 0.5], ['slow', 50, 5]], desc: 'Fling a cloud of freezing salts.' }),
    S('c_volatile', 'Volatile Mixture', { icon: 'volatile', lvl: 4, cost: 25, cd: 9, cast: 1.2, range: 24, hit: { t: 1.5, kind: 'proj', speed: 20, arc: 1, r: 4.5 }, fx: [['dmg', 2.4]], desc: 'Shake a flask until it hisses, then throw it.' }),
    S('c_smokebomb', 'Smoke Bomb', { icon: 'smoke', lvl: 5, cost: 15, cd: 18, target: 'self', range: 0, hit: { t: 0.35, kind: 'aoe', r: 5 }, fx: [['debuff', 'miss', 40, 4], ['buff', 'evade', 40, 4]], desc: 'Slam a bomb at your feet; enemies inside can barely see.' }),
    S('c_tar', 'Tar Pot', { icon: 'tar', lvl: 6, cost: 15, cd: 14, target: 'ground', range: 20, hit: { t: 0.7, kind: 'ground', r: 3.5 }, fx: [['root', 2.5], ['slow', 40, 5]], desc: 'Throw a pot of sticky tar that holds enemies in place.' }),
    S('c_spark', 'Spark Gear', { icon: 'spark', lvl: 7, cost: 18, cd: 7, range: 6, hit: { t: 0.5, kind: 'cone', r: 6, cone: 60, n: 3, gap: 0.2 }, fx: [['dmg', 0.5]], desc: 'Spin the gear on your rod against a flint wheel, spraying hot sparks.' }),
    S('c_concussion', 'Concussion Bomb', { icon: 'burst', lvl: 8, cost: 20, cd: 12, target: 'self', range: 0, hit: { t: 0.32, kind: 'aoe', r: 5 }, fx: [['dmg', 0.8], ['knock', 6]], desc: 'A blast at your feet that throws enemies back.' }),
    S('c_draught', 'Healing Draught', { icon: 'potion', lvl: 9, cost: 20, cd: 30, target: 'self', range: 0, cast: 1.0, hit: { t: 1.0, kind: 'self' }, fx: [['heal', 2.2]], desc: 'Drink a restorative brew.' }),
    S('c_shrapnel', 'Shrapnel Grenade', { icon: 'grenade', lvl: 10, cost: 25, cd: 10, target: 'ground', range: 22, hit: { t: 0.9, kind: 'ground', r: 4, n: 3, gap: 0.25 }, fx: [['dmg', 0.7]], desc: 'A bouncing grenade that bursts three times.' }),
    S('c_corrosive', 'Corrosive Cloud', { icon: 'cloud', lvl: 11, cost: 25, cd: 15, target: 'ground', range: 22, hit: { t: 0.8, kind: 'ground', r: 5 }, fx: [['dot', 1.3, 8]], desc: 'Shatter a jar of fumes that eat away at enemies.' }),
    S('c_flash', 'Flashbang', { icon: 'flash', lvl: 12, cost: 18, cd: 20, range: 9, hit: { t: 0.45, kind: 'cone', r: 9, cone: 90 }, fx: [['stun', 2]], desc: 'A blinding magnesium flash.' }),
    S('c_catalyst', 'Catalyst', { icon: 'catalyst', lvl: 13, cost: 15, cd: 30, target: 'self', range: 0, gcd: false, hit: { t: 0.6, kind: 'self' }, fx: [['buff', 'dmg', 35, 8]], desc: 'Mix a catalyst: your bombs hit 35% harder for 8s.' }),
    S('c_chain', 'Chain Reaction', { icon: 'chain', lvl: 14, cost: 30, cd: 12, range: 22, hit: { t: 0.32, kind: 'proj', speed: 24, arc: 0.7, n: 3, gap: 0.24, r: 2.5 }, fx: [['dmg', 0.9]], desc: 'Throw three flasks in rapid succession.' }),
    S('c_naphtha', 'Naphtha Wave', { icon: 'firewave', lvl: 15, cost: 30, cd: 14, range: 12, hit: { t: 0.75, kind: 'line', r: 12, speed: 16 }, fx: [['dmg', 1.2], ['dot', 0.6, 4]], desc: 'Spray burning oil in a line before you.' }),
    S('c_vault', 'Rod Vault', { icon: 'vault', lvl: 16, cost: 10, cd: 14, target: 'self', range: 0, gcd: false, hit: { t: 0.2, kind: 'self' }, fx: [['back', 9]], desc: 'Plant your rod and vault backwards.' }),
    S('c_vigor', 'Elixir of Vigor', { icon: 'elixir', lvl: 17, cost: 25, cd: 40, target: 'self', range: 0, hit: { t: 0.7, kind: 'self', r: 15 }, fx: [['buff', 'haste', 20, 10], ['buff', 'speed', 20, 10]], desc: 'Burst a flask overhead: allies move and strike faster.' }),
    S('c_clockwork', 'Clockwork Bomb', { icon: 'clock', lvl: 18, cost: 30, cd: 16, target: 'ground', range: 10, hit: { t: 2.4, kind: 'ground', r: 6 }, fx: [['dmg', 2.6]], desc: 'Set a ticking gear bomb that detonates after a moment.' }),
    S('c_grand', 'Grand Detonation', { icon: 'cask', lvl: 20, cost: 50, cd: 50, target: 'ground', range: 24, cast: 1.6, hit: { t: 2.3, kind: 'ground', r: 8 }, fx: [['dmg', 3.6], ['knock', 4]], desc: 'Ultimate: heave a cask of blasting powder for a colossal explosion.' }),
    S('c_thermite', 'Thermite Charge', { icon: 'flame', lvl: 42, cost: 25, cd: 12, target: 'ground', range: 22, hit: { t: 0.8, kind: 'ground', r: 3.5 }, fx: [['dmg', 1.2], ['dot', 1.0, 6], ['debuff', 'armor', 15, 6]], desc: 'Toss a tin of iron scale and aluminium powder: it burns white-hot through machine plating.' }),
    S('c_boiler', 'Boiler Bomb', { icon: 'burst', lvl: 45, cost: 45, cd: 35, target: 'ground', range: 24, cast: 1.2, hit: { t: 2.0, kind: 'ground', r: 7 }, fx: [['dmg', 3.0], ['stun', 1.5], ['slow', 40, 5]], desc: 'Capstone: heave a sealed steel canister of superheated water. It bursts in a scalding blast of steam that staggers everything nearby.' }),
    S('c_quicklime', 'Quicklime Flask', { icon: 'acid', lvl: 47, cost: 25, cd: 10, range: 24, hit: { t: 0.6, kind: 'proj', speed: 24, arc: 0.8, r: 3 }, fx: [['dmg', 1.4], ['dot', 0.7, 6], ['debuff', 'miss', 20, 6]], desc: 'A flask of quicklime and meltwater. It boils as it bursts, and the hot caustic dust clogs every joint and lens it settles on.' }),
    S('c_frostpack', 'Frostpack Drum', { icon: 'frost', lvl: 50, cost: 45, cd: 35, target: 'ground', range: 24, cast: 1.2, hit: { t: 2.0, kind: 'ground', r: 7 }, fx: [['dmg', 3.0], ['root', 2.5], ['slow', 50, 6]], desc: 'Capstone: heave a drum of saltpetre and meltwater. It bursts, the salts drink the heat out of the water, and every machine nearby is frozen fast where it stands.' }),
    S('c_carbide', 'Carbide Flare', { icon: 'flame', lvl: 52, cost: 25, cd: 10, range: 24, hit: { t: 0.6, kind: 'proj', speed: 24, arc: 0.8, r: 3.5 }, fx: [['dmg', 1.5], ['dot', 0.7, 6]], desc: 'A flask of carbide lumps over a water bulb. Cracked against the rod and thrown, it fills with lamp gas and bursts in a hot white flare that clings to plating.' }),
    S('c_ridgecharge', 'Ridge Charge', { icon: 'cask', lvl: 55, cost: 45, cd: 35, target: 'ground', range: 24, cast: 1.2, hit: { t: 2.0, kind: 'ground', r: 7 }, fx: [['dmg', 3.2], ['knock', 3], ['debuff', 'armor', 20, 6]], desc: 'Capstone: light the fuse of a waxed-paper charge of blasting powder on the flint wheel of the rod, let it burn down, then hurl it far overhand. The blast throws machines back and buckles their plating.' }),
    // ---- level 57 and 60 (Tidewater Sound) ----
    S('c_brine', 'Brine Flask', { icon: 'acid', lvl: 57, cost: 25, cd: 10, range: 24, hit: { t: 0.6, kind: 'proj', speed: 24, arc: 0.8, r: 3.5 }, fx: [['dmg', 1.4], ['dot', 0.6, 6], ['debuff', 'armor', 10, 6]], desc: 'A flask of sea brine boiled down hard and spiked with oil of vitriol. It bursts in a hot, stinging spray that pits plating and keeps eating at it.' }),
    S('c_tarpot', 'Boiling Tar Pot', { icon: 'cask', lvl: 60, cost: 45, cd: 35, target: 'ground', range: 24, cast: 1.2, hit: { t: 2.0, kind: 'ground', r: 7 }, fx: [['dmg', 2.8], ['slow', 50, 6], ['dot', 1.2, 6]], desc: 'Capstone: hold a sealed iron pot of pine tar to the heater on the rod until it spits, then heave it underarm. It bursts in a black splash of boiling tar over every machine nearby, scalding it and gumming its joints.' }),
    // ---- level 62 and 65 (the Rainward Gorge) ----
    S('c_kilnlime', 'Kiln Lime Flask', { icon: 'acid', lvl: 62, cost: 25, cd: 10, range: 24, hit: { t: 0.6, kind: 'proj', speed: 24, arc: 0.8, r: 3.5 }, fx: [['dmg', 1.5], ['dot', 0.7, 6], ['slow', 30, 4]], desc: 'A flask of lime fresh from the kiln, thrown to burst on wet plating. The lime drinks the rain and boils hot against the steel, scalding it and clogging its joints.' }),
    S('c_limemortar', 'Lime Mortar Drum', { icon: 'cask', lvl: 65, cost: 45, cd: 35, target: 'ground', range: 24, cast: 1.2, hit: { t: 2.0, kind: 'ground', r: 7 }, fx: [['dmg', 3.0], ['root', 2.5], ['dot', 0.6, 6], ['debuff', 'armor', 15, 6]], desc: 'Capstone: light the short fuse of a sealed iron drum of quicklime, sand and rainwater on the flint wheel of the rod and heave it. It bursts over every machine nearby in a hot grey mortar that scalds, sets round their tracks and eats into their plating.' }),
  ],
  sandblade: [
    S('s_slash', 'Sand Slash', { icon: 'slash', lvl: 1, cost: 10, hit: { t: 0.22, kind: 'melee' }, fx: [['dmg', 0.95]], desc: 'A swift curved cut.' }),
    S('s_twin', 'Twin Fang', { icon: 'twin', lvl: 1, cost: 18, cd: 5, hit: { t: 0.2, kind: 'melee', n: 2, gap: 0.22 }, fx: [['dmg', 0.75]], desc: 'Slash and back-slash in one motion.' }),
    S('s_dust', 'Dust Kick', { icon: 'kick', lvl: 2, cost: 15, cd: 12, hit: { t: 0.28, kind: 'melee' }, fx: [['stun', 1.5], ['debuff', 'miss', 30, 4]], desc: 'Kick sand into the enemy\'s eyes.' }),
    S('s_whirl', 'Whirling Scimitar', { icon: 'spin', lvl: 3, cost: 25, cd: 8, target: 'self', range: 0, hit: { t: 0.25, kind: 'aoe', r: 4, n: 2, gap: 0.3 }, fx: [['dmg', 0.7]], desc: 'Spin twice, cutting everything around you.' }),
    S('s_step', 'Desert Step', { icon: 'step', lvl: 4, cost: 15, cd: 10, range: 12, gcd: false, hit: { t: 0.18, kind: 'melee' }, fx: [['dash', 10]], desc: 'Dart forward in a blur of sand.' }),
    S('s_ram', 'Shield Ram', { icon: 'shield', lvl: 5, cost: 15, cd: 10, range: 8, hit: { t: 0.35, kind: 'melee' }, fx: [['dash', 5], ['dmg', 0.7], ['stun', 1.0]], desc: 'Barge in behind your round shield.' }),
    S('s_needle', 'Needle Thrust', { icon: 'thrust', lvl: 6, cost: 15, cd: 6, hit: { t: 0.24, kind: 'melee' }, fx: [['dmg', 0.9], ['dot', 0.6, 6]], desc: 'A precise thrust that leaves a bleeding wound.' }),
    S('s_feint', 'Feint', { icon: 'feint', lvl: 7, cost: 10, cd: 15, gcd: false, hit: { t: 0.4, kind: 'melee' }, fx: [['debuff', 'vuln', 25, 5]], desc: 'Fake a cut to open the guard: the next blows strike deep.' }),
    S('s_scorch', 'Searing Edge', { icon: 'flameblade', lvl: 8, cost: 20, cd: 20, target: 'self', range: 0, hit: { t: 0.55, kind: 'self' }, fx: [['buff', 'dmg', 20, 10]], desc: 'Grind your blade along your shield until it glows hot.' }),
    S('s_leap', 'Dune Leap', { icon: 'leap', lvl: 9, cost: 25, cd: 12, range: 12, hit: { t: 0.62, kind: 'aoe', r: 3.5 }, fx: [['leap', 9], ['dmg', 1.3]], desc: 'Bound high and land blade-first.' }),
    S('s_evasion', 'Evasion', { icon: 'evade', lvl: 10, cost: 15, cd: 30, target: 'self', range: 0, gcd: false, hit: { t: 0.2, kind: 'self' }, fx: [['buff', 'evade', 50, 5]], desc: 'Weave and sway: dodge half of all attacks for 5s.' }),
    S('s_rend', 'Rending Cuts', { icon: 'rend', lvl: 11, cost: 25, cd: 8, hit: { t: 0.16, kind: 'melee', n: 3, gap: 0.16 }, fx: [['dmg', 0.5], ['dot', 0.3, 6]], desc: 'Three lightning cuts that bleed.' }),
    S('s_devil', 'Dust Devil', { icon: 'whirlwind', lvl: 12, cost: 35, cd: 14, target: 'self', range: 0, channel: 2.2, hit: { t: 0.25, kind: 'aoe', r: 4.5, n: 6, gap: 0.35 }, fx: [['dmg', 0.45]], desc: 'Spin into a whirl of sand and steel.' }),
    S('s_shieldspin', 'Shield Spin', { icon: 'disc', lvl: 13, cost: 20, cd: 10, range: 18, hit: { t: 0.35, kind: 'proj', speed: 24 }, fx: [['dmg', 1.4]], desc: 'Fling your round shield like a disc.' }),
    S('s_sweep', 'Low Sweep', { icon: 'sweep', lvl: 14, cost: 18, cd: 12, target: 'self', range: 0, hit: { t: 0.3, kind: 'aoe', r: 3.5 }, fx: [['dmg', 0.6], ['stun', 1.2]], desc: 'Drop low and sweep the enemies\' legs.' }),
    S('s_finish', 'Finishing Blow', { icon: 'execute', lvl: 15, cost: 30, cd: 10, hit: { t: 0.48, kind: 'melee' }, fx: [['execute', 3], ['dmg', 1.2]], desc: 'A brutal strike, far deadlier against wounded foes.' }),
    S('s_cloak', 'Dust Cloak', { icon: 'cloak', lvl: 16, cost: 20, cd: 40, target: 'self', range: 0, gcd: false, hit: { t: 0.3, kind: 'self' }, fx: [['buff', 'evade', 80, 3], ['buff', 'speed', 30, 3]], desc: 'Vanish into a swirl of sand for a moment.' }),
    S('s_hamstring', 'Hamstring', { icon: 'cripple', lvl: 17, cost: 12, cd: 8, hit: { t: 0.24, kind: 'melee' }, fx: [['dmg', 0.5], ['slow', 50, 6]], desc: 'Cut low at the legs.' }),
    S('s_counter', 'Counter Stance', { icon: 'parry', lvl: 18, cost: 15, cd: 14, hit: { t: 0.6, kind: 'melee' }, fx: [['dmg', 1.7]], desc: 'Catch the blow on your shield and strike back.' }),
    S('s_thousand', 'Thousand Cuts', { icon: 'storm', lvl: 20, cost: 50, cd: 45, range: 12, hit: { t: 0.2, kind: 'aoe', r: 6, n: 6, gap: 0.2 }, fx: [['dmg', 0.8]], desc: 'Ultimate: flicker between enemies, cutting them all.' }),
    S('s_glass', 'Glasscutter', { icon: 'rend', lvl: 42, cost: 20, cd: 8, hit: { t: 0.32, kind: 'melee' }, fx: [['dmg', 1.3], ['dot', 0.6, 6]], desc: 'A long drawing cut along the whole edge that scores a deep line through plating.' }),
    S('s_sirocco', 'Sirocco', { icon: 'execute', lvl: 45, cost: 40, cd: 25, hit: { t: 0.24, kind: 'melee', n: 3, gap: 0.36 }, fx: [['dmg', 1.0], ['execute', 0.6]], desc: 'Capstone: two crossing cuts and a falling finisher, each far deadlier against a wounded machine.' }),
    S('s_undertow', 'Undertow', { icon: 'twin', lvl: 47, cost: 20, cd: 8, hit: { t: 0.3, kind: 'melee', n: 2, gap: 0.3 }, fx: [['dmg', 0.85], ['debuff', 'vuln', 12, 6]], desc: 'A low backhand that drags the guard aside and a forehand that follows it in, like water pulling at the legs.' }),
    S('s_cascade', 'Cascade', { icon: 'whirlwind', lvl: 50, cost: 45, cd: 28, range: 5, hit: { t: 0.3, kind: 'cone', r: 5, cone: 140, n: 3, gap: 0.32 }, fx: [['dmg', 1.0], ['execute', 0.8], ['dot', 0.5, 6]], desc: 'Capstone: three wide cuts that tumble one into the next, each a step further in, scoring every machine in front and far deadlier against the wounded.' }),
    S('s_scour', 'Scouring Edge', { icon: 'slash', lvl: 52, cost: 20, cd: 8, hit: { t: 0.36, kind: 'melee' }, fx: [['dmg', 1.6], ['debuff', 'miss', 25, 4]], desc: 'A rising cut from low on the right that scoops a spray of frozen grit up into the lenses of a machine.' }),
    S('s_whiteout', 'Whiteout', { icon: 'whirlwind', lvl: 55, cost: 45, cd: 28, target: 'self', range: 0, hit: { t: 0.3, kind: 'aoe', r: 4.5, n: 4, gap: 0.3 }, fx: [['dmg', 0.95], ['execute', 0.8], ['debuff', 'miss', 20, 4]], desc: 'Capstone: a full turn with the scimitar held out flat, throwing up a blinding curtain of snow, and a last forehand cut out of the spin. Every machine around is struck four times, far harder when it is wounded.' }),
    // ---- level 57 and 60 (Tidewater Sound) ----
    S('s_riptide', 'Riptide', { icon: 'twin', lvl: 57, cost: 20, cd: 8, hit: { t: 0.3, kind: 'melee', n: 2, gap: 0.3 }, fx: [['dmg', 0.95], ['slow', 40, 4]], desc: 'A low thrust in under the guard and a cut drawn back out across it, the way a rip current takes the legs from under you.' }),
    S('s_tidalbore', 'Tidal Bore', { icon: 'whirlwind', lvl: 60, cost: 45, cd: 28, range: 6, hit: { t: 0.3, kind: 'cone', r: 6, cone: 120, n: 3, gap: 0.32 }, fx: [['dmg', 1.05], ['execute', 0.8], ['slow', 40, 4]], desc: 'Capstone: three cuts, each a long step further up the line, coming on like the bore that runs up a creek on the spring flood. Every machine in front is struck three times, far harder when it is wounded.' }),
    // ---- level 62 and 65 (the Rainward Gorge) ----
    S('s_undercut', 'Undercut', { icon: 'twin', lvl: 62, cost: 20, cd: 8, hit: { t: 0.3, kind: 'melee', n: 2, gap: 0.3 }, fx: [['dmg', 1.0], ['debuff', 'armor', 10, 5]], desc: 'A low cut in under the plating and a second drawn back out along the same line, the way running water undercuts a bank until it falls.' }),
    S('s_landslide', 'Landslide', { icon: 'whirlwind', lvl: 65, cost: 45, cd: 28, range: 6, hit: { t: 0.3, kind: 'cone', r: 6, cone: 130, n: 3, gap: 0.32 }, fx: [['dmg', 1.1], ['execute', 0.8], ['knock', 1.5]], desc: 'Capstone: three cuts coming downhill one after another, each a long step further on, like a slope letting go. Every machine in front is struck three times, far harder when it is wounded, and driven back.' }),
  ],
  warden: [
    S('w_blow', 'Hammer Blow', { icon: 'hammer', lvl: 1, cost: 10, hit: { t: 0.42, kind: 'melee' }, fx: [['dmg', 1.1]], desc: 'A heavy sideways swing.' }),
    S('w_slam', 'Shield Slam', { icon: 'shield', lvl: 1, cost: 15, cd: 9, hit: { t: 0.32, kind: 'melee' }, fx: [['dmg', 0.7], ['stun', 1.6]], desc: 'Smash the tower shield into the enemy.' }),
    S('w_pound', 'Ground Pound', { icon: 'pound', lvl: 2, cost: 20, cd: 8, target: 'self', range: 0, hit: { t: 0.55, kind: 'aoe', r: 5 }, fx: [['dmg', 0.9], ['slow', 40, 4]], desc: 'Slam the hammer into the earth, staggering all around.' }),
    S('w_challenge', 'Challenge', { icon: 'shout', lvl: 3, cost: 10, cd: 12, target: 'self', range: 0, gcd: false, hit: { t: 0.3, kind: 'aoe', r: 12 }, fx: [['taunt', 5]], desc: 'Bang hammer on shield: enemies must face you.' }),
    S('w_wall', 'Shield Wall', { icon: 'wall', lvl: 4, cost: 25, cd: 40, target: 'self', range: 0, hit: { t: 0.4, kind: 'self' }, fx: [['buff', 'armor', 60, 6]], desc: 'Plant the shield: take 60% less damage.' }),
    S('w_bulwark', 'Bulwark Charge', { icon: 'charge', lvl: 5, cost: 20, cd: 16, range: 16, hit: { t: 0.5, kind: 'melee' }, fx: [['dash', 13], ['dmg', 0.8], ['knock', 3]], desc: 'Rumble forward behind your shield.' }),
    S('w_uppercut', 'Uppercut Smash', { icon: 'rise', lvl: 6, cost: 20, cd: 8, hit: { t: 0.38, kind: 'melee' }, fx: [['dmg', 1.3], ['stun', 0.8]], desc: 'An upward swing that lifts the enemy.' }),
    S('w_iron', 'Iron Skin', { icon: 'iron', lvl: 7, cost: 20, cd: 30, target: 'self', range: 0, hit: { t: 0.5, kind: 'self' }, fx: [['buff', 'armor', 30, 12]], desc: 'Brace every muscle: +30% armour for 12s.' }),
    S('w_split', 'Earthsplitter', { icon: 'fissure', lvl: 8, cost: 30, cd: 12, range: 14, hit: { t: 0.7, kind: 'line', r: 14, speed: 18 }, fx: [['dmg', 1.5], ['stun', 0.8]], desc: 'Split the ground in a line of jagged rock.' }),
    S('w_toss', 'Hammer Toss', { icon: 'toss', lvl: 9, cost: 20, cd: 10, range: 20, hit: { t: 0.45, kind: 'proj', speed: 22 }, fx: [['dmg', 1.2], ['stun', 1.0]], desc: 'Hurl the warhammer end over end; it returns.' }),
    S('w_fortify', 'Fortify', { icon: 'heart', lvl: 10, cost: 20, cd: 30, target: 'self', range: 0, hit: { t: 0.6, kind: 'self' }, fx: [['hot', 2.4, 10]], desc: 'Steady your breathing: regain health over time.' }),
    S('w_combo', 'Bastion Combo', { icon: 'combo', lvl: 11, cost: 25, cd: 8, hit: { t: 0.3, kind: 'melee', n: 3, gap: 0.34 }, fx: [['dmg', 0.65]], desc: 'Shield, hammer, shield.' }),
    S('w_ring', 'Concussive Ring', { icon: 'ring', lvl: 12, cost: 30, cd: 18, target: 'self', range: 0, hit: { t: 0.95, kind: 'aoe', r: 6 }, fx: [['dmg', 1.0], ['stun', 1.5]], desc: 'Whirl the hammer overhead and slam it down.' }),
    S('w_intercept', 'Intercept', { icon: 'leap', lvl: 13, cost: 15, cd: 16, range: 16, hit: { t: 0.65, kind: 'aoe', r: 3 }, fx: [['leap', 14], ['dmg', 0.6]], desc: 'Leap to the target\'s side.' }),
    S('w_laststand', 'Last Stand', { icon: 'stand', lvl: 14, cost: 25, cd: 90, target: 'self', range: 0, gcd: false, hit: { t: 0.4, kind: 'self' }, fx: [['heal', 3], ['buff', 'armor', 20, 10]], desc: 'Roar and recover a large chunk of health.' }),
    S('w_stomp', 'Seismic Stomp', { icon: 'stomp', lvl: 15, cost: 20, cd: 10, target: 'self', range: 0, hit: { t: 0.45, kind: 'aoe', r: 6 }, fx: [['slow', 50, 5], ['dmg', 0.5]], desc: 'Stomp so hard the ground trembles.' }),
    S('w_shatter', 'Shatter Armour', { icon: 'shatter', lvl: 16, cost: 25, cd: 12, hit: { t: 0.6, kind: 'melee' }, fx: [['dmg', 1.4], ['debuff', 'armor', 30, 10]], desc: 'A crushing overhead blow that breaks armour.' }),
    S('w_deflect', 'Deflect', { icon: 'deflect', lvl: 17, cost: 15, cd: 20, target: 'self', range: 0, gcd: false, hit: { t: 0.2, kind: 'self' }, fx: [['buff', 'block', 80, 3]], desc: 'Angle your shield to turn aside almost every blow.' }),
    S('w_pulverize', 'Pulverize', { icon: 'pulverize', lvl: 18, cost: 30, cd: 10, hit: { t: 0.38, kind: 'melee', n: 3, gap: 0.38 }, fx: [['dmg', 0.8]], desc: 'Three bone-shaking swings.' }),
    S('w_colossus', 'Colossus Drop', { icon: 'crater', lvl: 20, cost: 50, cd: 50, range: 14, hit: { t: 0.95, kind: 'aoe', r: 7 }, fx: [['leap', 12], ['dmg', 2.6], ['stun', 2]], desc: 'Ultimate: a towering leap that leaves a crater.' }),
    S('w_anvil', 'Anvil Drop', { icon: 'hammer', lvl: 42, cost: 20, cd: 12, hit: { t: 0.62, kind: 'melee' }, fx: [['dmg', 2.0], ['stun', 1.2]], desc: 'The hammer is hauled high and comes straight down like a forge drop.' }),
    S('w_piledriver', 'Pile Driver', { icon: 'pound', lvl: 45, cost: 45, cd: 30, target: 'self', range: 0, hit: { t: 0.56, kind: 'aoe', r: 6, n: 2, gap: 0.6 }, fx: [['dmg', 1.4], ['stun', 1.0]], desc: 'Capstone: drive the hammer into the ground twice. The second blow heaves the ground up all around you.' }),
    S('w_triphammer', 'Trip Hammer', { icon: 'pulverize', lvl: 47, cost: 20, cd: 10, hit: { t: 0.36, kind: 'melee', n: 3, gap: 0.3 }, fx: [['dmg', 0.8], ['debuff', 'armor', 15, 8]], desc: 'Three short, even chops in a row, like the water-driven hammers of the Flume Works, each one denting the plate a little deeper.' }),
    S('w_icefall', 'Icefall Breaker', { icon: 'fissure', lvl: 50, cost: 45, cd: 30, range: 16, hit: { t: 0.7, kind: 'line', r: 16, speed: 20 }, fx: [['dmg', 3.0], ['stun', 1.5], ['knock', 3]], desc: 'Capstone: the hammer driven down so hard that a rolling crack of heaved stone and ice runs out ahead, throwing every machine in the line off its feet.' }),
    S('w_counterweight', 'Counterweight Sweep', { icon: 'hammer', lvl: 52, cost: 20, cd: 10, range: 5, hit: { t: 0.48, kind: 'cone', r: 5, cone: 140 }, fx: [['dmg', 1.6], ['knock', 3]], desc: 'The hammer swung low and flat from the right like the counterweight of a lift, knocking back every machine in front.' }),
    S('w_brakeblock', 'Brake Block', { icon: 'shield', lvl: 55, cost: 45, cd: 30, hit: { t: 0.32, kind: 'melee', n: 2, gap: 0.6 }, fx: [['dmg', 1.8], ['stun', 1.6], ['taunt', 4]], desc: 'Capstone: jam the tower shield into the machine like a brake block against a drum, then drop the hammer on top of it. The machine stops dead and turns on you.' }),
    // ---- level 57 and 60 (Tidewater Sound) ----
    S('w_spud', 'Spud Drop', { icon: 'hammer', lvl: 57, cost: 20, cd: 12, hit: { t: 0.6, kind: 'melee' }, fx: [['dmg', 1.9], ['root', 2.5]], desc: 'The hammer hauled up two-handed and driven straight down like the spud post of a dredge into the mud, pinning the machine where it stands.' }),
    S('w_breakwater', 'Breakwater', { icon: 'shield', lvl: 60, cost: 45, cd: 30, range: 6, hit: { t: 0.34, kind: 'cone', r: 6, cone: 140, n: 2, gap: 0.55 }, fx: [['dmg', 1.7], ['knock', 2], ['stun', 1.0], ['taunt', 4]], desc: 'Capstone: heave the tower shield forward into the machines like a breakwater taking a wave, then bring the hammer down flat behind it. Every machine in front is battered twice, staggered and turned on you.' }),
    // ---- level 62 and 65 (the Rainward Gorge) ----
    S('w_pilehammer', 'Pile Hammer', { icon: 'hammer', lvl: 62, cost: 20, cd: 12, hit: { t: 0.6, kind: 'melee' }, fx: [['dmg', 2.0], ['stun', 1.2]], desc: 'The hammer lifted two-handed high over the head and dropped straight down like the weight of a pile driver onto a timber pile, stopping the machine dead.' }),
    S('w_cribwall', 'Crib Wall', { icon: 'shield', lvl: 65, cost: 45, cd: 30, range: 6, hit: { t: 0.34, kind: 'cone', r: 6, cone: 140, n: 2, gap: 0.55 }, fx: [['dmg', 1.8], ['knock', 2], ['root', 1.5], ['taunt', 4]], desc: 'Capstone: set the tower shield square like the face of a timber crib wall holding up a slope, then bring the hammer down twice behind it. Every machine in front is battered twice, held fast and turned on you.' }),
  ],
  herbalist: [
    S('h_salve', 'Mending Salve', { icon: 'salve', lvl: 1, cost: 15, cast: 1.3, target: 'ally', range: 28, hit: { t: 1.4, kind: 'proj', speed: 22, arc: 0.5 }, fx: [['heal', 1.8]], desc: 'Toss a healing salve to an ally (or yourself).' }),
    S('h_sweep', 'Staff Sweep', { icon: 'staff', lvl: 1, cost: 5, range: 3.5, hit: { t: 0.3, kind: 'melee' }, fx: [['dmg', 0.8]], desc: 'A wide swing of your lantern staff.' }),
    S('h_dart', 'Nettle Dart', { icon: 'dart', lvl: 2, cost: 10, range: 26, hit: { t: 0.35, kind: 'proj', speed: 40 }, fx: [['dmg', 0.5], ['dot', 1.2, 8]], desc: 'A blowgun dart steeped in stinging nettle.' }),
    S('h_poultice', 'Soothing Poultice', { icon: 'leaf', lvl: 3, cost: 15, target: 'ally', range: 28, hit: { t: 0.45, kind: 'proj', speed: 24, arc: 0.5 }, fx: [['hot', 2.0, 10]], desc: 'Heal an ally over time.' }),
    S('h_net', 'Snare Net', { icon: 'net', lvl: 4, cost: 15, cd: 14, range: 16, hit: { t: 0.5, kind: 'proj', speed: 18, arc: 0.4 }, fx: [['root', 3]], desc: 'Throw a woven net over the target.' }),
    S('h_smoke', 'Calming Smoke', { icon: 'smoke', lvl: 5, cost: 20, cd: 16, target: 'self', range: 0, hit: { t: 0.5, kind: 'aoe', r: 7 }, fx: [['slow', 40, 5], ['hot', 0.8, 5]], desc: 'Burn a bundle of herbs: allies recover, enemies falter.' }),
    S('h_tonic', 'Restorative Tonic', { icon: 'tonic', lvl: 6, cost: 30, cast: 2.0, target: 'ally', range: 28, hit: { t: 2.05, kind: 'proj', speed: 26, arc: 0.4 }, fx: [['heal', 3.6]], desc: 'A slow but powerful remedy.' }),
    S('h_flurry', 'Staff Flurry', { icon: 'flurry', lvl: 7, cost: 15, cd: 6, range: 3.5, hit: { t: 0.18, kind: 'melee', n: 3, gap: 0.18 }, fx: [['dmg', 0.65]], desc: 'Three quick jabs with the staff.' }),
    S('h_sneeze', 'Sneezing Powder', { icon: 'powder', lvl: 8, cost: 15, cd: 14, range: 7, hit: { t: 0.4, kind: 'cone', r: 7, cone: 70 }, fx: [['stun', 1.2], ['debuff', 'miss', 20, 4]], desc: 'Blow pungent powder into enemy faces.' }),
    S('h_revive', 'Revitalize', { icon: 'bloom', lvl: 9, cost: 35, cd: 25, cast: 1.5, target: 'self', range: 0, hit: { t: 1.55, kind: 'self', r: 14 }, fx: [['heal', 1.6]], desc: 'Plant your staff; the lantern flares and every ally nearby recovers.' }),
    S('h_bandage', 'Field Bandage', { icon: 'bandage', lvl: 10, cost: 15, cd: 20, target: 'self', range: 0, channel: 2.0, hit: { t: 0.5, kind: 'self', n: 4, gap: 0.5 }, fx: [['heal', 0.8]], desc: 'Bind your wounds.' }),
    S('h_antidote', 'Antidote', { icon: 'antidote', lvl: 11, cost: 10, cd: 8, target: 'ally', range: 28, gcd: false, hit: { t: 0.4, kind: 'proj', speed: 30, arc: 0.4 }, fx: [['cleanse'], ['heal', 0.5]], desc: 'Cure poisons and ailments.' }),
    S('h_seed', 'Seed Bomb', { icon: 'seed', lvl: 12, cost: 20, cd: 8, target: 'ground', range: 22, hit: { t: 0.75, kind: 'ground', r: 4 }, fx: [['dmg', 1.3]], desc: 'A hard seed pod that bursts on impact.' }),
    S('h_bark', 'Bark Poultice', { icon: 'bark', lvl: 13, cost: 20, cd: 25, target: 'ally', range: 28, hit: { t: 0.45, kind: 'proj', speed: 26, arc: 0.4 }, fx: [['buff', 'armor', 30, 12]], desc: 'Coat an ally in hardened sap: +30% armour.' }),
    S('h_lantern', 'Lantern Flash', { icon: 'lantern', lvl: 14, cost: 15, cd: 18, target: 'self', range: 0, hit: { t: 0.45, kind: 'aoe', r: 6 }, fx: [['stun', 1.5]], desc: 'Swing the lantern up in a blinding flare.' }),
    S('h_brew', 'Rejuvenating Brew', { icon: 'brew', lvl: 15, cost: 30, cd: 30, target: 'self', range: 0, hit: { t: 0.8, kind: 'self', r: 14 }, fx: [['hot', 2.0, 12]], desc: 'Spray a fine mist of brew over your party.' }),
    S('h_swift', 'Swiftroot Tea', { icon: 'swift', lvl: 16, cost: 20, cd: 40, target: 'self', range: 0, gcd: false, hit: { t: 0.5, kind: 'self', r: 14 }, fx: [['buff', 'speed', 35, 8]], desc: 'Share a bitter tea: allies run 35% faster.' }),
    S('h_uproot', 'Uprooting Strike', { icon: 'uproot', lvl: 17, cost: 20, cd: 8, range: 3.5, hit: { t: 0.5, kind: 'melee' }, fx: [['dmg', 1.4], ['knock', 2]], desc: 'An overhead strike with the full length of the staff.' }),
    S('h_sap', 'Sap Shield', { icon: 'sap', lvl: 18, cost: 25, cd: 20, target: 'ally', range: 28, hit: { t: 0.45, kind: 'proj', speed: 26, arc: 0.4 }, fx: [['absorb', 2.2, 10]], desc: 'A coat of tough amber sap absorbs damage.' }),
    S('h_remedy', 'Grand Remedy', { icon: 'remedy', lvl: 20, cost: 50, cd: 50, target: 'self', range: 0, cast: 1.2, hit: { t: 1.3, kind: 'self', r: 18 }, fx: [['heal', 4], ['hot', 1.5, 8], ['cleanse']], desc: 'Ultimate: a great burst of healing petals and mist for all allies.' }),
    S('h_tincture', 'Bitterroot Tincture', { icon: 'potion', lvl: 42, cost: 20, cd: 8, target: 'ally', range: 28, hit: { t: 0.45, kind: 'proj', speed: 26, arc: 0.4 }, fx: [['heal', 1.6], ['hot', 1.4, 8]], desc: 'A quick toss of a stoppered tincture: a mend at once and more over the next few seconds.' }),
    S('h_camphor', 'Camphor Mist', { icon: 'brew', lvl: 45, cost: 45, cd: 40, target: 'self', range: 0, cast: 1.0, hit: { t: 1.1, kind: 'self', r: 18 }, fx: [['heal', 2.4], ['absorb', 1.4, 10]], desc: 'Capstone: crack a jar of camphor over the hot lantern. The vapour mends every ally nearby and hardens them against the next blows.' }),
    S('h_snowmelt', 'Snowmelt Draught', { icon: 'antidote', lvl: 47, cost: 25, cd: 10, target: 'ally', range: 28, hit: { t: 0.5, kind: 'proj', speed: 26, arc: 0.4 }, fx: [['heal', 2.0], ['cleanse']], desc: 'An underhand toss of warmed meltwater steeped with willow bark: it mends at once and washes off every clinging ailment.' }),
    S('h_willowsteam', 'Willowbark Steam', { icon: 'bloom', lvl: 50, cost: 50, cd: 45, target: 'self', range: 0, cast: 1.2, hit: { t: 1.3, kind: 'self', r: 18 }, fx: [['heal', 2.6], ['hot', 1.6, 10], ['buff', 'armor', 15, 10]], desc: 'Capstone: crouch and plunge a bundle of willow bark into the hot lantern pan, then sweep the staff out over your allies. The steam mends every ally nearby, keeps mending them, and warms them against the next blows.' }),
    S('h_pitch', 'Pine Pitch Salve', { icon: 'sap', lvl: 52, cost: 25, cd: 12, target: 'ally', range: 28, hit: { t: 0.5, kind: 'proj', speed: 26, arc: 0.4 }, fx: [['heal', 1.6], ['absorb', 1.4, 8]], desc: 'A pad of pine pitch and wool, kneaded warm and soft and tossed to an ally. It mends, then sets hard over the worst of the next blows.' }),
    S('h_sprucebroth', 'Spruce Broth Spray', { icon: 'brew', lvl: 55, cost: 50, cd: 45, target: 'self', range: 0, cast: 1.2, hit: { t: 1.3, kind: 'self', r: 18 }, fx: [['heal', 2.8], ['hot', 1.5, 10], ['buff', 'haste', 15, 10]], desc: 'Capstone: swirl a jar of hot spruce-tip broth before the chest until it steams, then swing it out wide so the hot spray reaches every ally nearby. It mends them, keeps mending them, and quickens their hands.' }),
    // ---- level 57 and 60 (Tidewater Sound) ----
    S('h_samphire', 'Samphire Poultice', { icon: 'sap', lvl: 57, cost: 25, cd: 10, target: 'ally', range: 28, hit: { t: 0.5, kind: 'proj', speed: 26, arc: 0.4 }, fx: [['heal', 1.8], ['hot', 1.2, 8]], desc: 'A warm poultice of marsh samphire and salt grass bound in linen, tossed to an ally. It mends at once and keeps mending.' }),
    S('h_saltkettle', 'Marsh Kettle Steam', { icon: 'brew', lvl: 60, cost: 50, cd: 45, target: 'self', range: 0, cast: 1.2, hit: { t: 1.3, kind: 'self', r: 18 }, fx: [['heal', 2.8], ['hot', 1.4, 10], ['absorb', 1.2, 10]], desc: 'Capstone: hold the lantern pan of brine and marsh herbs over the flame until it boils, then lift the staff high so the steam rolls out over every ally nearby. It mends them, keeps mending them, and hardens them against the next blows.' }),
    // ---- level 62 and 65 (the Rainward Gorge) ----
    S('h_moss', 'Moss Dressing', { icon: 'sap', lvl: 62, cost: 25, cd: 10, target: 'ally', range: 28, hit: { t: 0.5, kind: 'proj', speed: 26, arc: 0.4 }, fx: [['heal', 1.9], ['hot', 1.15, 8], ['cleanse']], desc: 'A pad of washed bog moss soaked in hot pine-needle water and bound in linen, tossed to an ally. It mends at once, keeps mending, and draws out what clings to the wound.' }),
    S('h_cedarsteam', 'Cedar Bark Steam', { icon: 'brew', lvl: 65, cost: 50, cd: 45, target: 'self', range: 0, cast: 1.2, hit: { t: 1.3, kind: 'self', r: 18 }, fx: [['heal', 3.1], ['hot', 1.5, 10], ['buff', 'armor', 12, 10]], desc: 'Capstone: drop a curl of cedar bark and wet bracken onto the hot lantern pan and sweep the staff out low. The thick resin steam rolls over every ally nearby, mends them, keeps mending them, and toughens them against the next blows.' }),
  ],
  // the Deadeye (v106): every shot is instant and fires on the run; a round ball ('ball' projectile, 'pierce' impact on the client).
  // Quick Reload gives Powder back ('res') and a short Loaded window; the left and right hands alternate on the client only.
  deadeye: [
    S('d_snap', 'Snap Shot', { icon: 'arrow', lvl: 1, move: true, cost: 8, range: 22, hit: { t: 0.2, kind: 'proj', speed: 70 }, fx: [['dmg', 0.8]], desc: 'A quick one-handed shot, the right pistol and then the left.' }),
    S('d_pair', 'Paired Shot', { icon: 'twinarrow', lvl: 1, move: true, cost: 14, cd: 5, range: 22, hit: { t: 0.2, kind: 'proj', speed: 70, n: 2, gap: 0.16 }, fx: [['dmg', 0.75]], desc: 'Both pistols come up level and fire one after the other.' }),
    S('d_reload', 'Quick Reload', { icon: 'breath', lvl: 2, move: true, cost: 0, cd: 14, gcd: false, target: 'self', range: 0, hit: { t: 0.4, kind: 'self' }, fx: [['res', 40], ['buff', 'dmg', 10, 4]], desc: 'Pour, ram and snap shut: 40 Powder back, and 10% more damage for 4s.' }),
    S('d_roll', 'Combat Roll', { icon: 'roll', lvl: 3, cost: 10, cd: 12, gcd: false, target: 'self', range: 0, hit: { t: 0.1, kind: 'self' }, fx: [['dash', 8], ['buff', 'evade', 20, 2]], desc: 'A shoulder roll with both pistols tucked in: dodge 20% of attacks for 2s.' }),
    S('d_powderburn', 'Powder Burn', { icon: 'blast', lvl: 4, move: true, cost: 15, cd: 8, range: 18, hit: { t: 0.22, kind: 'proj', speed: 70 }, fx: [['dmg', 0.7], ['dot', 0.5, 6]], desc: 'A low shot from the hip. The burning wadding keeps smouldering on the target.' }),
    S('d_knee', 'Knee Shot', { icon: 'cripple', lvl: 5, move: true, cost: 12, cd: 8, range: 22, hit: { t: 0.2, kind: 'proj', speed: 70 }, fx: [['dmg', 0.6], ['slow', 50, 4]], desc: 'Aim low at a leg joint to slow the machine.' }),
    S('d_scatter', 'Scatter Charge', { icon: 'fan', lvl: 6, cost: 20, cd: 9, range: 14, hit: { t: 0.3, kind: 'cone', r: 14, cone: 50 }, fx: [['dmg', 1.0]], desc: 'Both pistols loaded with loose shot, fired from the hip at everything in front.' }),
    S('d_slide', 'Slide Shot', { icon: 'roll', lvl: 7, cost: 15, cd: 12, range: 20, hit: { t: 0.5, kind: 'proj', speed: 70 }, fx: [['dash', 7], ['dmg', 1.1]], desc: 'Drop into a knee slide and fire as you go.' }),
    S('d_grip', 'Grip Strike', { icon: 'fist', lvl: 8, cost: 10, cd: 10, range: 3.5, hit: { t: 0.22, kind: 'melee' }, fx: [['dmg', 0.6], ['knock', 5]], desc: 'A backhand with the pistol grip that sends a close machine reeling.' }),
    S('d_fan', 'Fan the Hammer', { icon: 'barrage', lvl: 9, move: true, cost: 30, cd: 12, range: 18, hit: { t: 0.18, kind: 'proj', speed: 70, n: 6, gap: 0.18 }, fx: [['dmg', 0.5]], desc: 'The left palm works the hammer while the right pistol fires six times.' }),
    S('d_chalk', 'Chalk Mark', { icon: 'mark', lvl: 10, move: true, cost: 10, cd: 20, gcd: false, range: 30, hit: { t: 0.3, kind: 'proj', speed: 40 }, fx: [['debuff', 'vuln', 12, 12]], desc: 'Flick a chalk pellet at the target: it takes 12% more damage for 12s.' }),
    S('d_smoke', 'Smoke Charge', { icon: 'smoke', lvl: 11, cost: 18, cd: 18, target: 'ground', range: 18, hit: { t: 0.6, kind: 'ground', r: 5 }, fx: [['slow', 40, 5], ['debuff', 'miss', 30, 5]], desc: 'Lob a paper cartridge that bursts into a low bank of powder smoke. Machines inside slow down and miss more.' }),
    S('d_ricochet', 'Ricochet', { icon: 'arcing', lvl: 12, move: true, cost: 20, cd: 9, range: 22, hit: { t: 0.22, kind: 'proj', speed: 70, r: 3.5 }, fx: [['dmg', 1.1]], desc: 'An angled shot that skips off the target into the machines beside it.' }),
    S('d_recoil', 'Recoil Jump', { icon: 'backflip', lvl: 13, cost: 10, cd: 14, gcd: false, range: 15, hit: { t: 0.15, kind: 'proj', speed: 70 }, fx: [['back', 9], ['dmg', 0.6]], desc: 'Fire down at the ground and ride the kick backwards out of reach.' }),
    S('d_cartridge', 'Paper Cartridges', { icon: 'stance', lvl: 14, move: true, cost: 20, cd: 45, target: 'self', range: 0, hit: { t: 0.4, kind: 'self', r: 12 }, fx: [['buff', 'haste', 20, 8]], desc: 'Hand out torn cartridges: you and nearby allies attack 20% faster for 8s.' }),
    S('d_slug', 'Iron Slug', { icon: 'pierce', lvl: 15, move: true, cost: 20, cd: 8, range: 24, hit: { t: 0.4, kind: 'line', r: 24, speed: 90 }, fx: [['dmg', 1.4]], desc: 'A braced two-handed shot whose heavy slug goes through every machine in a line.' }),
    S('d_priming', 'Priming Burst', { icon: 'blast', lvl: 16, cost: 15, cd: 20, target: 'self', range: 0, hit: { t: 0.2, kind: 'aoe', r: 5 }, fx: [['dmg', 0.3], ['stun', 1.2]], desc: 'Tip loose priming powder at your feet and let it bang. Machines close by are stunned.' }),
    S('d_chain', 'Chain Shot', { icon: 'pin', lvl: 17, move: true, cost: 15, cd: 14, range: 20, hit: { t: 0.25, kind: 'proj', speed: 55 }, fx: [['dmg', 0.7], ['root', 2.5]], desc: 'Two balls on a short chain that wrap round the legs and hold the machine still.' }),
    S('d_quick', 'Quickdraw', { icon: 'aim', lvl: 18, move: true, cost: 15, cd: 10, gcd: false, range: 22, hit: { t: 0.12, kind: 'proj', speed: 80 }, fx: [['dmg', 1.0]], desc: 'Holster to shot faster than the eye can follow.' }),
    S('d_storm', 'Powder Storm', { icon: 'storm', lvl: 20, move: true, cost: 50, cd: 45, target: 'ground', range: 20, hit: { t: 0.5, kind: 'ground', r: 6, n: 5, gap: 0.22 }, fx: [['dmg', 0.75]], desc: 'Ultimate: circle the area firing left and right until it is full of smoke and sparks.' }),
    // level 42 to 55 (the Cinder Reach, the Rime Steps and the Windward Heights)
    S('d_lastround', 'Last Round', { icon: 'execute', lvl: 42, move: true, cost: 20, cd: 9, range: 22, hit: { t: 0.25, kind: 'proj', speed: 80 }, fx: [['dmg', 1.5], ['execute', 1.4]], desc: 'A heavy charge saved for the end, far deadlier against a wounded machine.' }),
    S('d_breach', 'Breach Charge', { icon: 'pierce', lvl: 45, cost: 40, cd: 30, cast: 0.9, range: 24, hit: { t: 1.0, kind: 'line', r: 24, speed: 90 }, fx: [['dmg', 3.0], ['knock', 4], ['stun', 1.0]], desc: 'Capstone: feet planted and both arms locked out level, fire a double-loaded charge through every machine in a line.' }),
    S('d_splitter', 'Plate Splitter', { icon: 'pierce', lvl: 47, move: true, cost: 20, cd: 9, range: 22, hit: { t: 0.22, kind: 'proj', speed: 70 }, fx: [['dmg', 1.6], ['debuff', 'armor', 20, 8]], desc: 'A hardened ball aimed at a rivet line. The plating splits and takes more from every blow.' }),
    S('d_pressure', 'Pressure Volley', { icon: 'rain', lvl: 50, move: true, cost: 45, cd: 35, target: 'ground', range: 22, hit: { t: 0.9, kind: 'ground', r: 6, n: 3, gap: 0.3, arc: 1 }, fx: [['dmg', 1.3], ['slow', 40, 5]], desc: 'Capstone: three square steam canisters lobbed high, one after another. They burst over the ground ahead in shot and steam.' }),
    S('d_hotshot', 'Hot Shot', { icon: 'blast', lvl: 52, move: true, cost: 20, cd: 9, range: 22, hit: { t: 0.22, kind: 'proj', speed: 70 }, fx: [['dmg', 1.4], ['dot', 1.0, 6]], desc: 'A ball heated in a furnace before loading. The machine it strikes keeps smouldering.' }),
    S('d_dry', 'Both Pistols Dry', { icon: 'barrage', lvl: 55, move: true, cost: 45, cd: 30, range: 22, hit: { t: 0.2, kind: 'proj', speed: 70, n: 6, gap: 0.16 }, fx: [['dmg', 0.7], ['debuff', 'vuln', 10, 6]], desc: 'Capstone: walk forward emptying both pistols in an even string, right and left, until the hammers click on nothing. The machine takes more from every blow after.' }),
    // ---- level 57 and 60 (Tidewater Sound) ----
    S('d_saltshot', 'Rock Salt Load', { icon: 'blast', lvl: 57, move: true, cost: 20, cd: 9, range: 22, hit: { t: 0.22, kind: 'proj', speed: 70 }, fx: [['dmg', 1.3], ['debuff', 'miss', 20, 5]], desc: 'A charge of coarse rock salt in place of the ball. It bursts across the plating and packs every lens and joint with grit.' }),
    S('d_broadside', 'Broadside', { icon: 'barrage', lvl: 60, cost: 45, cd: 30, range: 22, hit: { t: 0.3, kind: 'proj', speed: 80, n: 3, gap: 0.42 }, fx: [['dmg', 1.25], ['knock', 2], ['debuff', 'armor', 15, 6]], desc: 'Capstone: feet planted square, fire both pistols together, three times over, each pair landing as one heavy blow. The machine is driven back and its plating buckles.' }),
    // ---- level 62 and 65 (the Rainward Gorge) ----
    S('d_gravel', 'Gravel Load', { icon: 'blast', lvl: 62, move: true, cost: 20, cd: 9, range: 22, hit: { t: 0.22, kind: 'proj', speed: 70 }, fx: [['dmg', 1.5], ['slow', 40, 5]], desc: 'A charge of sharp river gravel in place of the ball. It strips the track plates and leaves the machine labouring.' }),
    S('d_rollingfire', 'Rolling Fire', { icon: 'barrage', lvl: 65, cost: 45, cd: 30, range: 22, hit: { t: 0.3, kind: 'proj', speed: 80, n: 4, gap: 0.32 }, fx: [['dmg', 1.0], ['root', 1.5], ['debuff', 'vuln', 10, 6]], desc: 'Capstone: drop to one knee in the mud and fire four times at an even beat, right, left, right, left, every ball laid low into the tracks. The machine is pinned where it stands and takes more from every blow after.' }),
  ],
};

export const SKILL_BY_ID = {};
for (const [cls, list] of Object.entries(SKILLS)) for (const s of list) { s.cls = cls; SKILL_BY_ID[s.id] = s; }

export const LEVEL_CAP = 70; // 65 -> 70 with Part Fifteen (the Russet Weald, set with P15.1); 60 -> 65 with Part Fourteen (the Rainward Gorge, set with P14.1); 55 -> 60 with Part Thirteen (Tidewater Sound, set with P13.1); 50 -> 55 with Part Twelve (the Windward Heights); 45 -> 50 with Part Eleven (the Rime Steps); 40 -> 45 with Part Ten (the Cinder Reach); 25 -> 30 with Part Four (the Far Vale), 30 -> 35 with Part Six (the Glass Waste), 35 -> 40 with Part Eight (the Deepway)
export const xpForLevel = (l) => Math.round(120 * Math.pow(l, 1.55));
// Kill experience (P15.7, v127; docs/ai/xp_v127.md, measured with tools/xpcheck.mjs). Authored machine experience
// (MOBS[k].xp) climbs about five times from level 40 to 69 while a level's need climbs a little over two, so before v127
// an ordinary on-level machine paid a tenth of a level at 30, a third at 40 and over half at 67. The damp is a curve of
// points (level, factor; straight between them) times, past level `from`, 1 / (1 + a (L - from)^pow): levels 1-4 as
// authored, about a thirtieth of a level a machine from 10 to 35 (the Valley's quests ask for many kills) and a
// twentieth (0.055) from 40 to 69. `share` is the same curve as a share of a level, which the quest bands in
// shared/data.js count on for the machines a quest asks for.
export const KILL_XP = { low: [[4, 1], [10, 0.38], [30, 0.38], [40, 0.55]], from: 30, a: 0.0269, pow: 1.41, share: [[1, 0.1], [10, 0.032], [30, 0.04], [40, 0.055]], run: 1, raid: 1, over: 2.5 };
export const curveAt = (pts, L) => { if (L <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (L <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (L - x0)) / (x1 - x0); } return pts[pts.length - 1][1]; };
export const killXpDamp = (L) => curveAt(KILL_XP.low, L) * (L <= KILL_XP.from ? 1 : 1 / (1 + KILL_XP.a * Math.pow(L - KILL_XP.from, KILL_XP.pow)));
// a machine of level mL (authored experience xp) killed by a hero of level pL, before party split and dungeon scale.
// A machine more than 4 levels above the hero pays at most KILL_XP.over times the share of a level it pays an on-level hero (P15.7 review:
// a level-10 hero partied with, or tagging for, a level-69 hero got a whole level a kill; now about a seventh)
export const killXp = (xp, mL, pL) => {
  const base = xp * (1 + 0.15 * (mL - 1)) * killXpDamp(mL), v = base * Math.max(0.2, Math.min(1.5, 1 + (mL - pL) * 0.1));
  return mL > pL + 4 ? Math.min(v, (base * KILL_XP.over * xpForLevel(pL)) / xpForLevel(mL)) : v;
};
// a daily's experience: 0.08 of the hero's level, a tenth less for each level the hero is above the daily, at least a
// fifth (P15.7 review: a level-69 hero did the valley's level-3 dailies for 0.08 of level 69 each, 1.4 levels a day)
export const dailyXp = (Q, pL) => Math.round(xpForLevel(Math.max(pL, Q.lvl || 1)) * 0.08 * Math.max(0.2, Math.min(1, 1 + ((Q.lvl || 1) - pL) * 0.1)));
export const skillsForLevel = (cls, level) => SKILLS[cls].filter((s) => s.lvl <= level);
// base damage/heal per point of coefficient at a level
export const powerAt = (level) => 9 + level * 3.2;

// ---- the combat rework (combat_design.md section 11, stage S2) ----
// SKILLS stays as LEGACY_SKILLS: a class on KIT_V2 (shared/kit.js) plays its new kit instead. OLD_TO_NEW maps every one
// of the 210 legacy skills: { to, as } with as core / fusion / triad / form / notable / keystone / zone / retired. Used to
// remap the bar and the phone wheel, talent and set modifiers naming a skill, logs, achievements and quest text, and to
// reuse choreo. `to` is the new id where it is known; the classes after the Knight fill theirs with their slices
// (S8-S13). A legacy skill not listed is a zone notable from level 42, else retired.
export const LEGACY_SKILLS = SKILLS;
const MIG = {
  knight: {
    core: ['k_valiant', 'k_rising', 'k_skybreaker', 'k_bash', 'k_cleave', 'k_lunge', 'k_guard'], k_riposte: ['core', 'k_guard'],
    k_kingsfall: ['fusion', 'kf_kingsfall'], k_spin: ['fusion', 'kf_riposte'], k_sunder: ['fusion', 'kf_pierce'], k_charge: ['fusion', 'kf_battering'], k_shieldthrow: ['triad', 'kt_anvilfall'],
    k_twin: ['form', 'k_valiant'], k_arcwave: ['form', 'k_cleave'], k_millrace: ['form', 'k_cleave'],
    k_rally: ['notable', 'shared_courage'], k_unbreakable: ['notable', 'unyielding'], k_shout: ['keystone', 'oathbound'], k_wind: ['notable', 'second_breath'],
  },
  warden: { core: ['w_blow', 'w_uppercut', 'w_pound', 'w_slam', 'w_bulwark', 'w_split', 'w_challenge'], fusion: ['w_colossus', 'w_piledriver', 'w_icefall', 'w_triphammer', 'w_breakwater', 'w_intercept', 'w_combo'], form: ['w_toss', 'w_stomp'], notable: ['w_iron', 'w_fortify', 'w_laststand', 'w_deflect'] },
  sandblade: {
    core: ['s_slash', 's_whirl', 's_leap', 's_step', 's_dust', 's_needle', 's_counter'],
    s_thousand: ['fusion', 'sf_thousand'], s_sirocco: ['fusion', 'sf_sirocco'], s_glass: ['fusion', 'sf_glasscutter'], s_devil: ['fusion', 'sf_dustwhirl'], s_riptide: ['fusion', 'sf_riptide'], s_whiteout: ['fusion', 'sf_whiteout'],
    s_twin: ['form', 's_slash'], s_scorch: ['form', 's_needle'], s_sweep: ['form', 's_whirl'], s_ram: ['form', 's_step'],
    s_evasion: ['notable', 's_evasion'], s_finish: ['notable', 's_finish'], s_cloak: ['notable', 's_cloak'], s_rend: ['notable', 's_rend'],
  },
  ranger: { core: ['r_quick', 'r_disengage', 'r_volley', 'r_trap', 'r_aimed', 'r_pierce', 'r_explosive'], fusion: ['r_deadweight', 'r_ripsaw', 'r_kick', 'r_roll'], form: ['r_arcing', 'r_fan'], notable: ['r_mark', 'r_rapid', 'r_smoke', 'r_thousand'] },
  deadeye: { core: ['d_snap', 'd_pair', 'd_recoil', 'd_knee', 'd_scatter', 'd_fan', 'd_quick'], fusion: ['d_chain', 'd_rollingfire', 'd_lastround', 'd_breach', 'd_slide'], form: ['d_hotshot', 'd_saltshot', 'd_slug'], notable: ['d_reload', 'd_cartridge', 'd_chalk', 'd_priming', 'd_smoke'] },
  chemist: { core: ['c_staff', 'c_smokebomb', 'c_fire', 'c_acid', 'c_chill', 'c_tar', 'c_concussion'], fusion: ['c_thermite', 'c_chain', 'c_boiler'], triad: ['c_grand'], form: ['c_volatile', 'c_naphtha'], notable: ['c_catalyst', 'c_flash', 'c_spark', 'c_draught'], retired: ['c_clockwork'] },
  herbalist: { core: ['h_sweep', 'h_net', 'h_salve', 'h_poultice', 'h_dart', 'h_smoke', 'h_lantern'], fusion: ['h_remedy', 'h_bandage', 'h_sneeze', 'h_sap'], form: ['h_seed', 'h_swift', 'h_bark'], notable: ['h_antidote', 'h_brew', 'h_camphor', 'h_willowsteam', 'h_tonic', 'h_revive'] },
};
export const OLD_TO_NEW = {};
for (const [cls, m] of Object.entries(MIG)) {
  for (const [k, v] of Object.entries(m)) {
    if (Array.isArray(v) && typeof v[0] === 'string' && SKILL_BY_ID[k]) { OLD_TO_NEW[k] = { to: v[1], as: v[0] }; continue; }
    for (const id of v) OLD_TO_NEW[id] = { to: k === 'core' ? id : null, as: k };
  }
  for (const s of SKILLS[cls]) if (!OLD_TO_NEW[s.id]) OLD_TO_NEW[s.id] = { to: null, as: s.lvl >= 42 ? 'zone' : 'retired' };
}
