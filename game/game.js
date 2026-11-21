// Sunmere Online client: login showcase, world, local player control, networking, combat feedback.
import { offhandLook, wornLook } from '/sunmere-play/shared/items.js';
import { setCharWeapon, setCharArmor, setCharCape, setCharGear } from '../assets/characters.js';
import { keyFor, actionFor, SETTINGS } from '../engine/settings.js';
import { skillCost } from '/sunmere-play/shared/talents.js';
import { RUNABOUT, mountSpeed } from '/sunmere-play/shared/data.js';
import { waterNear, clampWorld, waterAt, areaOf, REACH, RIME } from '/sunmere-play/shared/terrain.js';
import { reachShore } from '/sunmere-play/shared/reach.js';
import { rimeShore, rimeChannel } from '/sunmere-play/shared/rime.js';
import { setTideClock, tidewaterShoreDist, tideLevel, TIDEWATER } from '/sunmere-play/shared/tidewater.js';
import { RAINWARD, rainwardRiverDist, riverZ } from '/sunmere-play/shared/rainward.js';
import { buildSteamship } from '../assets/steamship.js';
import { dungeonAt, dungeonSight } from '/sunmere-play/shared/dungeons.js';
import { CLIENT_VERSION, updateBlocked, showUpdatePanel } from './update.js';
import { houseAt, houseCrosses } from '/sunmere-play/shared/houses.js';
import { sweepMove } from '/sunmere-play/shared/sweep.js';
import { skillFeel, dodgeFor, dodgeWith, BUFFER, DODGE, CUT_KINDS } from '/sunmere-play/shared/feel.js';
import * as THREE from 'three';
import { Engine } from '../engine/renderer.js';
import { G, QUALITY } from '../engine/globals.js';
import { World } from './world.js';
import { CameraRig } from './camera.js';
import { createHorizon } from './horizon.js';
import { TargetFX } from './targetfx.js';
import { FX } from './fx.js';
import { voiceContext } from './voiceamb.js';
import { installReactFx } from './reactfx.js';
import { SFX } from './sfx.js';
import { EntityManager } from './entities.js';
import { Ambient } from './ambient.js';
import { connect, botPrefsMsg } from './net.js';
// living bots C.11: a bot's line on a channel the player hid in Options is not shown (also guards older servers)
const botHid = (ev, ch) => !!ev.bot && !ev.out && (SETTINGS.botChat?.[ch] === 0 || SETTINGS.botChat?.[ch] === false);
import { UI } from '../ui/ui.js';
import { CHOREO, clipOf } from './choreo.js';
import { CLASSES } from '/sunmere-play/shared/classes.js';
import { kitOf, stepOf, CHAIN_RESET } from '/sunmere-play/shared/kit.js';
import { FUSE, skillOf, fusionUnlocked, gateOk, LINK } from '/sunmere-play/shared/fusions.js';
import { shownName } from '/sunmere-play/shared/social.js';
import { NPCS, QUESTS, MOBS, ITEMS, npcSeen, enginesTurning } from '/sunmere-play/shared/data.js';
import { Builder, box, rbox, cyl, sphere, lathe } from '../assets/kit.js';
import { glowSprite } from '../assets/dynamic.js';
import { Townsfolk } from './townsfolk.js';
import { QuestObjects, brassTagNode, tarBarrelNode, yarnHankNode, stopBoardNode, seedTrayNode, liningStoneNode, ropeClampNode, wedgeNode, billetNode, louvrePinNode, stickerNode } from './questObjects.js';
import { ropeCarMesh, CAR_HANG } from './ropewayLayout.js';
import { buildHaulTrain } from '../assets/haulWagon.js';
import { QuestWalk } from './questwalk.js';
import { weatherAt, createRain, createSnow, nightAt } from '../engine/weather.js';
import { getMat } from '../engine/materials.js';
import { streamInfo } from '/sunmere-play/shared/terrain.js';
import { IS_TOUCH, IS_MOBILE, IS_WEB } from '../engine/platform.js';
import { slimStatic, pickCopies } from '../engine/slim.js';
import { initTouch } from '../ui/touch.js';
import { LOADING } from '../ui/loading/manifest.js';
import { createRamEvent } from './ramEvent.js';

const wait = () => new Promise((r) => setTimeout(r, 0));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const V2 = (x = 0, y = 0) => new THREE.Vector2(x, y);

// the ship's armoured ice bow (Chapter 33): on the Reach and Harrowmouth ships once m_c33_refit is done (the Rime ship always has it)
let showIceBow = () => {};
// a driftwood node (Chapter 33's baulks on the Reach beach): two salt-grey timbers and a soft glint to spot them by
function driftwood() {
  const b = new Builder(78);
  b.add(cyl(0.2, 0.24, 2.6, 9), 'woodLight', { p: [0, 0.2, 0], r: [0, 0.3, Math.PI / 2], uv: 'box', c: '#b8ae9c' });
  // (the timbers lie side by side, never crossed: two at an angle drew an X from above)
  b.add(cyl(0.16, 0.19, 1.9, 8), 'woodLight', { p: [0.15, 0.17, 0.48], r: [0, 0.36, Math.PI / 2 - 0.04], uv: 'box', c: '#a89e8a' });
  b.add(cyl(0.06, 0.08, 0.7, 6), 'woodLight', { p: [-0.55, 0.07, -0.42], r: [0, 0.26, Math.PI / 2], c: '#b0a690' });
  const g = b.build();
  const gl = glowSprite(0xfff0c8, 1.6, 0.5); gl.position.y = 0.7; g.add(gl);
  g.userData.update = (dt, t) => gl.userData.update(dt, t);
  return g;
}
// a spare counterweight block of the Makers' cast iron, frozen into the lake ice to the shoulders, with a lifting eye on top
function ironBlock() {
  const b = new Builder(79);
  b.add(rbox(1.0, 0.7, 1.0, 0.06), 'iron', { p: [0, 0.2, 0], r: [0, 0.35, 0], c: '#5a5e64' });
  b.add(box(0.12, 0.3, 0.42), 'iron', { p: [0, 0.68, 0], r: [0, 0.35, 0], c: '#4a4e54' });
  b.add(box(0.14, 0.1, 0.18), 'iron', { p: [0, 0.86, 0], r: [0, 0.35, 0], c: '#4a4e54' });
  b.add(cyl(0.95, 1.05, 0.22, 12), 'ice', { p: [0, 0.06, 0], c: '#d8ecf4' });
  const g = b.build();
  const gl = glowSprite(0xe8f4ff, 1.6, 0.5); gl.position.y = 0.9; g.add(gl);
  g.userData.update = (dt, t) => gl.userData.update(dt, t);
  return g;
}
function mushroom() {
  const b = new Builder(77);
  for (let i = 0; i < 3; i++) {
    const s = [1, 0.7, 0.55][i], x = [0, 0.18, -0.15][i], z = [0, 0.1, 0.14][i];
    b.add(cyl(0.035 * s, 0.05 * s, 0.3 * s, 8), 'plaster', { p: [x, 0.15 * s, z], c: '#f0e8d0' });
    b.add(lathe([[0.001, 0], [0.2 * s, 0.01], [0.17 * s, 0.07 * s], [0.08 * s, 0.12 * s], [0.001, 0.13 * s]], 14), 'glowGreen', { p: [x, 0.28 * s, z], c: 0xffffff });
  }
  const g = b.build();
  const gl = glowSprite(0xa8ff6a, 1.7, 0.7); gl.position.y = 0.4; // big enough to spot from across a clearing g.add(gl);
  g.userData.update = (dt, t) => gl.userData.update(dt, t);
  return g;
}

// running shots: the most the upper body twists onto the target before the body itself turns (rad, ~70 deg)
const AIM_TWIST = 1.22;

export async function startGame() {
  // a painting of one of the valley's regions behind the loading bar, and a tip
  {
    const L = document.getElementById('loading'), pics = ['valley', 'desert', 'rust', 'storm', 'briar', 'quarry', 'glade', 'westfold', 'coilway', 'farvale', 'harrow', 'saltpan', 'deepway', 'wildworks', 'ashfall', 'slagterraces', 'oldworks', 'icefall', 'flumeworks', 'damcrown', 'driftfields', 'enginerows', 'makersrest', 'ropewalkshore', 'tidemills', 'seagate', 'gorgefoot', 'seedterraces', 'slip', 'ropewayfoot', 'longsheds', 'standards'].filter((k) => LOADING.has(k));
    L.style.backgroundImage = `linear-gradient(180deg, rgba(8,6,4,.2) 0%, rgba(8,6,4,.05) 40%, rgba(8,6,4,.85) 100%), url(/sunmere-play/ui/loading/${pics[Math.floor(Math.random() * pics.length)]}.webp)`;
    const TIPS = ['Loot names show their rarity: green Uncommon, blue Rare, purple Epic, gold Legendary, and the tempered-steel sheen of Prismatic.',
      'Logging out in Sunmere or beside a Caravan Master builds rested experience fastest.', 'Press G to use your Homeward Compass and return to your home caravan stop.',
      'Hovering gear shows what you are wearing in that slot right beside it.', 'Clerk Wendel by the guild hall posts bounties every week and can send you to any dungeon door.',
      'Some Rare and Epic gear has a socket. Brannoc Hale’s smithy cuts gems to fill it.', 'Bosses telegraph their big attacks with red circles on the ground: step out of them.',
      'Twelve pages of a lost ledger are hidden along the roads. The Valley Journal (J) keeps the ones you find.', 'Hired companions take orders: Assist, Hold or Passive, from their target frame.',
      'The Proving Ring east of Sunmere pays for every wave you clear, and the best each week are rewarded.', 'Sell grey junk in one click at any merchant, and buy back anything sold by mistake.',
      'Every dungeon boss carries two pieces of its own. Look them up in the Valley Journal.',
      'A smith can upgrade any Uncommon or better piece up to +10. It always works, and the price is shown before you pay.',
      'Tempering: every endgame boss kill counts. A Legendary piece is certain within 20 kills, and a Prismatic within 300. The Armory shows your count.',
      'From +7 an upgraded weapon shows the heat in its steel. Pick the stage you like, or cold steel, in the Wardrobe.'];
    const tip = document.createElement('div'); tip.className = 'tip'; tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; L.appendChild(tip);
  }
  const bar = document.querySelector('#loading .bar i');
  const msg = document.querySelector('#loading .msg');
  const progress = async (p, m) => { bar.style.width = Math.round(p * 100) + '%'; if (m) msg.textContent = m; await wait(); };
  await progress(0.02, 'Mixing the paints…');
  // the Options' Shadows row (SETTINGS.shadowQ) over the quality preset, read once here (it applies on the next load)
  const SHQ = { high: { shadowSize: 4096, shadowTaps: 10, shadowHz: 0, charShadowDist: 45 }, medium: { shadowSize: 2048, shadowTaps: 6, shadowHz: 0, charShadowDist: 30 },
    low: { shadowSize: 1024, shadowTaps: 5, shadowHz: 30, charShadowDist: 15, shadowMaxExtent: 40 } }[SETTINGS.shadowQ];
  if (SHQ) Object.assign(QUALITY, SHQ, IS_MOBILE && SHQ.shadowSize > 2048 ? { shadowSize: 2048 } : {});
  const engine = new Engine(document.getElementById('view'));
  if (SETTINGS.shadowQ === 'off') { engine.renderer.shadowMap.enabled = false; if (engine.sun) engine.sun.castShadow = false; }
  await progress(0.06, 'Shaping the land…');
  const world = new World(engine, (p, m) => { bar.style.width = Math.round(p * 100) + '%'; msg.textContent = m; });
  // phones: shrink the static world's geometry before it is first drawn (the ground and dungeon floors stay as they are)
  // (the dungeon floors are ray-tested through coarse pick copies there, so their own arrays are freed too: slim.js pickCopies)
  if (IS_MOBILE) { world.floorPick = pickCopies(world.floors || []); slimStatic(world.group, Object.values(world.areaTerrains || {}).map((t) => t?.group)); }
  // the static world: shadow-only proxies cast for it (B1), and its matrices are frozen (D1; after slimStatic, which adds
  // the camera's collision copies as children)
  engine.useShadowProxies(world.shadowProxies || [], true);
  world.freezeWorld();
  // LF.4 distant hills and mountains past every outdoor area's edge (a child of the sky dome; ?horizon=0 leaves them off)
  if (!/[?&]horizon=0/.test(location.search)) engine.sky.add(createHorizon(engine, world));
  engine.scene.add(world.group);
  // F3: every area's geometry goes on the GPU and every program the world needs is built behind the loading screen (in
  // parallel where the driver can), so the first look at an area or dungeon does not stall (phones: and the slimmed
  // meshes drop their JS copies now, engine.preupload)
  // (the camera rig and the effects first: their pooled lights are part of the light setup every program is built for)
  const T = world.terrain;
  const heightAt = (x, z) => T.walk(x, z);
  const rig = new CameraRig(engine.camera, engine.renderer.domElement);
  rig.env = { heightAt, world }; // camera collision: the ground and the placed buildings
  const targetfx = new TargetFX(engine.scene, heightAt); // selection ring, outline and marker
  const sfx = new SFX();
  const fx = new FX(engine.scene, engine.camera, { heightAt, rig, sfx });
  await progress(0.9, 'Lighting the lamps…');
  { const pu = await engine.preupload(world.group); console.info(`[load] preupload ${pu.ms} ms (${pu.shown} hidden objects drawn once)`); }
  await engine.warmup(engine.scene);
  engine.coarse.addStatic(world.group); // coarse.js: the static world's frozen and walk-on-demand subtrees
  showIceBow = (y) => { const on = !!y?.done?.m_c33_refit; for (const m of [world.reachIceBow, world.harrowIceBow]) if (m) m.visible = on; };
  await progress(0.95, 'Gathering heroes…');
  const entities = new EntityManager(engine.scene, heightAt);
  fx.shadowSource = entities; // contact shadow blobs under characters, mobs and mounts
  fx.partyOf = (id) => !!ui?.partyIds?.has(id); // (S14: party members' effects show more than others')
  const ambient = new Ambient(fx, T);
  const townsfolk = new Townsfolk(engine.scene, world, { fx, sfx });
  const qobjects = new QuestObjects(engine.scene, heightAt);
  const rain = createRain();
  engine.scene.add(rain);
  const snow = createSnow();
  engine.scene.add(snow);
  // F3, the rest: the villagers, effects, rain and snow added since the world's warm-up, and the effect materials made
  // on demand (fx.warm), compiled before the loading screen goes
  await Promise.all([engine.warmup(engine.scene), fx.warm(engine.renderer, engine.camera, engine.scene), targetfx.warm(engine.renderer, engine.camera, engine.scene)]);
  const weather = { rain: 0, sand: 0, snow: 0 };

  const game = {
    engine, world, rig, fx, sfx, entities, cls: 'knight', localId: null, target: null, you: null, casting: null, pressedSkill: null,
    net: null, send: (m) => game.net?.send(m), nodes: new Map(),
    serverT: 0, serverLocal: performance.now(),
    serverTime() { return this.serverT + (performance.now() - this.serverLocal) / 1000; },
    playerPos() { return local ? local.pos : V(); }, playerYaw() { return local ? local.ry : 0; }, camYaw() { return rig.yaw; },
    nodesList() { return [...game.nodes.values()]; },
    setTarget(id) { game.target = id; game.send({ t: 'target', id }); },
    useSkill: (id, o) => useSkill(id, 0, o || {}),
    releaseDraw: () => releaseDraw(), // (S11: a touch coming off a held Piercing Arrow)
  };
  // Tidewater Sound's tide (waterAt, the sea sheet, the ship) runs on the server's clock, the same for every player
  setTideClock(() => game.serverTime());
  window.game = game;
  game.qobjects = qobjects; // for the off-screen checks
  game.weather = weather;
  game.world = world;
  const ui = new UI(game);
  game.ui = ui;
  installReactFx(fx, { ui, entities, localId: () => game.localId }); // (S7: coats, Reactions, wall slams, plates, the split, foes' clips)
  // v109 the quest walk: a click on a quest in the tracker or the log walks you there, with a faint trail ahead (questwalk.js)
  const qwalk = new QuestWalk({ scene: engine.scene, world, ui, game, heightAt, busy: () => !!(crossing || ui.scene) });
  game.qwalk = qwalk;
  // LF.6 the Ram Engine on the Harrow Coast: the engine's pose, the gates, the panel, the walk-up actions (ramEvent.js)
  const ramc = createRamEvent({ game, world, ui, fx, sfx, entities, rig });
  game.ram = ramc;
  game.questWalk = (qid) => { game.autoRun = false; moveTo = null; interactTarget = null; return qwalk.start(qid); };
  game.questWalkStop = () => qwalk.stop('manual');
  let local = null; // local EntityView

  // ------------------------------------------------------------------ login showcase
  document.getElementById('loading').classList.add('done');
  const show = { pos: V(-6, heightAt(-6, -4), -4), char: null, t: 0, next: 2.5 };
  rig.focus.copy(show.pos);
  rig.distTarget = rig.dist = 9;
  rig.yawTarget = rig.yaw = -0.5;
  rig.setShowcase(true);
  const preview = (cls, cv = 0) => {
    if (show.view) show.view.dispose();
    show.view = entities.ensure({ id: '__preview', ty: 'p', c: cls, v: cv, x: show.pos.x, y: show.pos.y, z: show.pos.z, r: 0.4 });
    entities.views.delete('__preview');
    show.view.ry = 0.4; show.view.pos.copy(show.pos); show.cls = cls; show.next = 1.6;
  };
  let entered = false, pendingJoin = null;
  ui.showLogin((name, cls, cv, opt) => enterWorld(name, cls, cv, opt), preview);

  // opt.url: an online server (wss://.../ws); opt.token: the Supabase sign-in, sent first. Resolves once in the world;
  // rejects (the login screen stays, with the reason) when the server cannot be reached or turns the character away.
  async function enterWorld(name, cls, cv = 0, opt = {}) {
    game.cls = cls;
    // an app older than the oldest allowed version may not play at all (client/game/update.js)
    if (updateBlocked()) { showUpdatePanel(); throw new Error('This version is out of date. Download the update to play.'); }
    const params = new URLSearchParams(location.search);
    const net = await connect(onMsg, { url: opt.url });
    if (!net) throw new Error('Could not reach the online server. Check the address, or play offline.');
    game.net = net;
    const ready = new Promise((res, rej) => { pendingJoin = { res, rej }; });
    const to = setTimeout(() => pendingJoin?.rej(new Error('The server did not answer. Try again.')), 25000);
    if (opt.token && !net.offline) game.send({ t: 'auth', token: opt.token });
    game.send({ t: 'join', name, cls, cv, ver: CLIENT_VERSION, web: IS_WEB, level: params.get('level') ? Number(params.get('level')) : undefined });
    try { await ready; } catch (e) { net.close?.(); game.net = null; throw e; } finally { clearTimeout(to); pendingJoin = null; }
    // what a reconnect needs to come back as the same character (the sign-in is fetched fresh each time: it renews itself)
    game.joinInfo = { name, cls: game.you?.cls || cls, cv, url: net.url, token: opt.token, getToken: opt.getToken };
  }

  // ------------------------------------------------------------------ reconnecting (online stability)
  // the socket dropped (a tunnel restart, a phone changing networks): try again with backoff (1, 2, 4, 8, then every 10 s),
  // re-send the sign-in, and the server hands back the same character where it stood (it waits 60 s for us). After two
  // minutes: give up with a clear message and a way back to the login screen.
  const RC = { on: false, t0: 0, tries: 0, timer: 0, wait: 0, LIMIT: 120000 };
  game.reconnect = RC;
  function startReconnect() {
    if (RC.on || !game.joinInfo?.url) return;
    Object.assign(RC, { on: true, t0: performance.now(), tries: 0 });
    game.target = null;
    ui.setPTrade?.({ closed: 1 }); // (the server calls off an open trade the moment the connection drops)
    ui.netBanner('reconnecting');
    ui.chat('Connection to the server was lost. Reconnecting...', '#ff6050');
    RC.timer = setTimeout(attempt, 600);
  }
  function retryLater() {
    clearTimeout(RC.wait); clearTimeout(RC.timer);
    if (!RC.on) return;
    // (at least 3 tries even when the two minutes passed while a phone was asleep with the timers paused)
    if (performance.now() - RC.t0 >= RC.LIMIT && RC.tries >= 3) return giveUp('Could not reconnect to the server.');
    RC.timer = setTimeout(attempt, Math.min(10000, 1000 * 2 ** Math.min(4, RC.tries - 1)));
  }
  async function attempt() {
    if (!RC.on) return;
    RC.tries++;
    ui.netBanner('reconnecting', RC.tries);
    const J = game.joinInfo;
    const net = await connect(onMsg, { url: J.url });
    if (!RC.on) { net?.close?.(); return; }
    if (!net) return retryLater();
    game.net = net;
    let tok = J.token;
    if (J.getToken) tok = (await J.getToken().catch(() => null)) || tok;
    if (tok) game.send({ t: 'auth', token: tok });
    game.send({ t: 'join', name: J.name, cls: J.cls, cv: J.cv, ver: CLIENT_VERSION, web: IS_WEB, resume: true });
    RC.wait = setTimeout(() => { if (RC.on && game.net === net) { net.close(); retryLater(); } }, 15000); // opened, never answered
  }
  function giveUp(text) {
    RC.on = false; clearTimeout(RC.timer); clearTimeout(RC.wait);
    try { game.net?.close?.(); } catch { /* closed */ }
    ui.netBanner('failed', text);
  }
  // back in: the same character (resume) or, after the grace period, the one from the last save (a new id)
  function onResume(m) {
    RC.on = false; clearTimeout(RC.timer); clearTimeout(RC.wait);
    ui.netBanner(null);
    const was = game.localId;
    game.you = m.you;
    if (m.id !== was) {
      const old = entities.views.get(was);
      if (old) { old.dispose(); entities.views.delete(was); }
      entities.seen?.delete(was);
      game.localId = m.id; entities.localId = m.id;
      local = entities.ensure({ id: m.id, ty: 'p', c: m.you.cls, v: m.you.cv || 0, n: m.you.name, l: m.you.level, x: m.you.x, y: heightAt(m.you.x, m.you.z), z: m.you.z, r: Math.PI, h: 1 });
    }
    if (local) { local.pos.set(m.you.x, heightAt(m.you.x, m.you.z), m.you.z); rig.focus.copy(local.pos); }
    moveTo = null; interactTarget = null;
    for (const n of m.nodes || []) { const g = game.nodes.get(n.id); if (g) { g.ready = n.ready; if (g.mesh) g.mesh.visible = n.ready; } }
    ui.setYou(m.you); updateMarkers(); qobjects.refresh(m.you);
    game.reconnects = (game.reconnects || 0) + 1;
    ui.chat(m.resume ? 'Reconnected. You are right where you were.' : 'Reconnected. Your character was loaded from its last save.', '#7ad07a');
  }
  function intoWorld() {
    entered = true;
    show.view?.dispose(); show.view = null;
    rig.setShowcase(false);
  }

  // ------------------------------------------------------------------ messages
  function onMsg(m) {
    switch (m.t) {
      case 'welcome': if (entered && game.localId) { onResume(m); return; } intoWorld(); onWelcome(m); pendingJoin?.res(); return;
      case 'joinErr': case 'authErr': if (m.code === 'update') showUpdatePanel({ min: m.min }); if (RC.on) { giveUp(m.text || 'The server would not let this character back in.'); return; } pendingJoin?.rej(new Error(m.text || 'Could not enter the world.')); return;
      case 'kicked': if (entered && ui.hud) ui.chat(m.text, '#ff6050'); else pendingJoin?.rej(new Error(m.text)); game.kicked = true; return;
      case 'you': game.you = m.you; showIceBow(m.you); world.setValleyStage?.(game.valleyStage || 0); world.updateHomestead?.(m.you, ui.ach?.done); if (local?.char) { const L = wornLook(m.you); setCharWeapon(local.char, L.wt, L.wq, L.oh, L.wu, L.ou); setCharArmor(local.char, L.sh); setCharCape(local.char, L.ck); setCharGear(local.char, L.gr); } local?.setPet(m.you.pet || null); local?.setPaint(m.you.paint || 'brass', m.you.runaboutMk || 1); local?.setMounted(!!m.you.mounted); ui.setYou(m.you); updateMarkers(); qobjects.refresh(m.you); world.setEnginesTurning?.(enginesTurning(m.you)); world.setRestOpen?.(!!m.you.done?.m_c40_bar); break;
      case 'stat': if (game.you) { Object.assign(game.you, m); ui.setStat(m); } break;
      case 'dodgeN': if (game.dodgeC) { game.dodgeC.n = m.n; game.dodgeC.next = m.next || 0; } break; // (S1: the server's dodge charges)
      case 'snap': game.serverT = m.time; game.serverLocal = performance.now(); entities.snapshot(m.e, performance.now() / 1000); for (const ev of m.ev) onEvent(ev); updateLootables(m.e); break;
      case 'ev': for (const ev of m.list) onEvent(ev); break;
      case 'correct': if (local) {
        game.corrections = (game.corrections || 0) + 1; // (counted for the off-screen checks: no rubber-banding indoors)
        if (m.fade) { ui.fade(); rig.focus.set(m.x, heightAt(m.x, m.z), m.z); }
        local.pos.set(m.x, heightAt(m.x, m.z), m.z); moveTo = null; interactTarget = null;
      } break;
      case 'dialog': ui.openDialog(m); break;
      case 'loot': ui.openLoot(m); break;
      case 'ach': ui.setAch(m); world.updateHomestead?.(game.you, m.done); qobjects.achC = m.c; if (game.you) qobjects.refresh(game.you); break;
      case 'achc': ui.achCounter(m); break;
      case 'party': ui.setParty(m); break;
      case 'lfg': ui.setLfg?.(m); break; // the group finder queue (living bots A.7)
      case 'bank': ui.setBank(m.items); break;
      case 'mail': ui.setMail(m.list); break;
      case 'trade': ui.setTrade(m); break;
      case 'ptrade': ui.setPTrade(m); break;
      case 'who': ui.setWho(m); break;
      case 'roster': ui.setRoster(m); break;
      case 'friends': ui.setFriends(m); break;
      case 'inspect': ui.openInspect(m); break;
      case 'bounty': ui.setBounty(m); break;
      case 'mailSent': ui.mailSent(); break;
      case 'disconnected':
        if (m.net && game.net && m.net !== game.net) break; // an old connection closing after a new one took over
        if (!entered) { pendingJoin?.rej(new Error(m.code === 4003 ? 'This server needs you to sign in with Google.' : 'The server closed the connection.')); break; }
        if (RC.on) { retryLater(); break; } // a reconnect attempt that opened and then closed
        if (game.kicked) break;
        if (m.code === 4003 || m.code === 4008) { ui.netBanner('failed', m.code === 4008 ? 'You were logged out after a long time away.' : 'Your sign-in has expired. Sign in again.'); break; }
        startReconnect(); break;
    }
  }

  function onWelcome(m) {
    game.localId = m.id;
    game.send({ t: 'ptrade', op: 'cancel' }); // (a trade left open on a dropped connection closes; the window is gone)
    game.send({ t: 'friend', op: 'list' });
    game.send(botPrefsMsg()); // living bots C.11: which bot chat this player sees
    entities.localId = m.id;
    game.you = m.you;
    world.updateHomestead?.(m.you, ui.ach?.done); // nothing in the homestead shows until it is earned or built
    qobjects.refresh(m.you);
    world.setEnginesTurning?.(enginesTurning(m.you)); // the Heights' wind engines this player has restarted (Chapter 37 on)
    world.setRestOpen?.(!!m.you.done?.m_c40_bar); // the iron bar off the Makers' Rest workshop door once Kamal has lifted it
    showIceBow(m.you);
    setTimeout(() => ui.maybeNews(), 2500);
    for (const n of m.npcs) entities.addNpc(n);
    for (const n of m.nodes) {
      const mesh = n.item === 'c33_drift' ? driftwood() : n.item === 'c37_block' ? ironBlock() : n.item === 'c40_tag' ? brassTagNode() : n.item === 'c41_tar' ? tarBarrelNode() : n.item === 'c41_yarn' ? yarnHankNode() : n.item === 'c43_board' ? stopBoardNode() : n.item === 'c45_tray' ? seedTrayNode() : n.item === 'c46_stone' ? liningStoneNode() : n.item === 'c49_clamp' ? ropeClampNode() : n.item === 'c49_wedge' ? wedgeNode() : n.item === 'wd_billet' ? billetNode() : n.item === 'c50_pin' ? louvrePinNode() : n.item === 'wd_sticker' ? stickerNode() : mushroom();
      mesh.position.set(n.x, heightAt(n.x, n.z), n.z);
      mesh.visible = n.ready;
      engine.scene.add(mesh);
      game.nodes.set(n.id, { ...n, mesh });
    }
    local = entities.ensure({ id: m.id, ty: 'p', c: m.you.cls, v: m.you.cv || 0, n: m.you.name, l: m.you.level, x: m.you.x, y: heightAt(m.you.x, m.you.z), z: m.you.z, r: Math.PI, h: 1 });
    local.pos.set(m.you.x, heightAt(m.you.x, m.you.z), m.you.z);
    rig.focus.copy(local.pos);
    // F3: the hero's programs, and the transparent variants its fade-out (fx.js fadeSelf) switches to, in the background
    if (local.char) engine.warmup(local.char, { transparent: local.char });
    engine.afterTeleport?.(); // (entering the world: the login's stutter does not count against dynamic resolution)
    ui.buildHUD();
    ui.setYou(m.you);
    // phones and tablets: the on-screen stick, camera drag, skill wheel and menu (desktop never builds them)
    if (IS_TOUCH && !touch) touch = initTouch({ game, ui, rig, canvas, act: touchActs });
    updateMarkers();
    if (game.net.offline) document.querySelector('.offline-tag')?.classList.remove('hidden');
    ui.chat(`Welcome to <b>Sunmere</b>. ${IS_TOUCH ? 'Open <b>Menu → How to Play</b>' : 'Press <b>H</b>'} for help. Follow the <b style="color:#ff8a50">Main Story</b> ${IS_TOUCH ? 'in the quest pill at the top left' : 'at the top right'}: find <b style="color:#f0b020">Marshal Aldric</b> by the guild hall to begin.`, '#ffe8a0');
    ui.zoneBanner('Sunmere Village', 'Level 1-5');
    setTimeout(() => ui.storyRecap(), 3500);
  }

  function updateLootables(list) {
    for (const d of list) { if (d.ty !== 'm') continue; const v = entities.get(d.id); v?.setLootable(!!d.lt && !!d.d, d.lq ?? 1); if (v) v.lootName = d.lt && d.d ? d.ln : null; }
  }

  function updateMarkers() {
    const y = game.you;
    if (!y) return;
    for (const n of NPCS) {
      const v = entities.get(n.id);
      if (!v) continue;
      // the story's crest outranks everything; a hand-in outranks a new quest; grey ? last
      const RANK = { 'msq-turnin': 6, 'msq-offer': 5, turnin: 4, offer: 3, 'msq-active': 2, active: 1 };
      let kind = null;
      const want = (k) => { if (!kind || RANK[k] > RANK[kind]) kind = k; };
      for (const qid of Object.keys(y.quests)) {
        const Q = QUESTS[qid];
        if (!Q || Q.turnin !== n.id) continue;
        const st = y.quests[qid], g = Q.goal;
        const cnt = g.item || g.gather ? y.bag.filter((b) => b.id === (g.item || g.gather)).reduce((a, b) => a + b.n, 0) : st.n;
        if (cnt >= (g.reach ? 1 : g.n)) want(Q.msq ? 'msq-turnin' : 'turnin'); else want(Q.msq ? 'msq-active' : 'active');
      }
      for (const qid of n.quests || []) {
        const Q = QUESTS[qid];
        if (y.quests[qid] || (Q.daily ? y.daily?.[qid] === y.today : y.done[qid])) continue;
        if (Q.pre && !y.done[Q.pre]) continue;
        if (Q.needLedger && (y.ledger || []).length < Q.needLedger) continue;
        if (Q.lvl > y.level + 2) continue;
        want(Q.msq ? 'msq-offer' : 'offer');
      }
      v.setMarker(kind);
    }
  }

  function entPos(id) { const v = entities.get(id); return v ? v.pos.clone() : null; }

  // (S14) a hero's server event (a bomb, a zone, a pop, an arc) plays on that hero's effect budget (fx.js budgetOf); damage
  // and heal events take theirs at the contact (EntityView.hit -> fx.tierHit)
  function onEvent(ev) {
    const who = ev.k === 'dmg' || ev.k === 'heal' ? null : ev.id ?? ev.from ?? ev.src;
    const v = who == null ? null : who === game.localId ? local : entities.get(who);
    const b = v && v.ty === 'p' && fx.budgetOf ? fx.budgetOf(v) : null;
    return b ? fx.withBudget(b, () => onEvent0(ev)) : onEvent0(ev);
  }
  function onEvent0(ev) {
    const me = game.localId;
    switch (ev.k) {
      case 'cast': {
        if (ev.hot) fx.forgeHead?.(ev.id === me ? local : entities.get(ev.id)); // (S9 Forge-Heated Head: the hammer head smokes)
        // already played locally. S2 prediction fallback: when the server cast something else from the same press (it fused
        // where the client predicted plain, or refused a predicted fusion), the clip swaps from the same frame; both start
        // from A's recovery pose, so the cut is clean
        // (S10) the Snap Shot the Deadeye fires out of a Slide: the slide clip (dodgef_) already shows it, so only the chain moves on
        if (ev.sf) { if (ev.id === me) game.chain = { id: ev.skill, step: ev.step || 1, at: game.serverTime() }; break; }
        if (ev.id === me) {
          const pr = game.pred, now = game.serverTime();
          if (pr && (ev.base || ev.skill) === pr.base && ev.skill !== pr.as && now - pr.at < 1.5 && local) {
            pr.as = ev.skill; local.playSkill(clipOf(ev.skill, ev.step, ev.fc), ev.target ? entities.get(ev.target) : null, ev.gx != null ? { x: ev.gx, z: ev.gz } : null, fx, ev.haste);
            const k = skillOf(ev.skill); if (game.lastCast) { game.lastCast.sk = k; game.lastCast.id = ev.skill; game.lastCast.done = !!k?.from; }
          }
          break;
        }
        const v = entities.get(ev.id);
        if (v) { if (ev.target) { const t = entities.get(ev.target); if (t) v.ry = Math.atan2(t.pos.x - v.pos.x, t.pos.z - v.pos.z); } v.playSkill(clipOf(ev.skill, ev.step, ev.fc), ev.target ? entities.get(ev.target) : null, ev.gx != null ? { x: ev.gx, z: ev.gz } : null, fx, ev.haste); if (ev.hd) { const k = skillOf(ev.skill); if (k?.draw) { holdDraw(v, k); if (v.drawHold) v.drawHold.remote = true; } } } // (hd, S11: another Ranger's held draw)
        break;
      }
      case 'buff': ui.unitBuff(ev); if (ev.debuff && ev.id?.[0] === 'm') fx.coat?.(entities.get(ev.id), ev.name, ev.dur); break; // (S7: a coat's look on the machine)
      // a fusion found for the first time (S2 discovery): the toast, and outside dungeons, raids and duels the contact beat
      // plays once at 0.6x for the own hero
      case 'fusionNew': {
        if (ui.combat) ui.combat.fusionToast(ev.name, true); else ui.zoneBanner?.(ev.name, 'New fusion'); sfx.play('crack', 0.6); // (S6: the fusion toast, "New fusion: Stormfall")
        const k = skillOf(ev.f), act = local?.anim?.action;
        if (ev.slow && k && act && 'speed' in act) { const hitAt = (k.hit?.t || 0.4) + Math.max(0, (k.hit?.n || 1) - 1) * (k.hit?.gap || 0); const wait = Math.max(0, hitAt - 0.1 - (act.time || 0)); setTimeout(() => { if (local.anim.action === act) act.speed = 0.6; setTimeout(() => { if (local.anim.action === act) act.speed = 1; }, 250); }, wait * 1000); }
        break;
      }
      case 'discover': ui.discoverCard(ev.zone); break;
      case 'homeview': ui.openHomeView(ev); break;
      case 'found': ui.onFound(ev.id); break;
      case 'story': ui.storyCard(ev); if (ev.kind === 'end') sfx.play('levelup', 0.5); break;
      case 'castStop': if (ev.id === me) { game.casting = null; local?.anim.stop(); } else entities.get(ev.id)?.anim?.stop(); break;
      case 'dmg': {
        const t = entities.get(ev.tgt);
        if (!t) break;
        t.hit(fx, entities.get(ev.src), ev);
        const mine = ev.src === me, onMe = ev.tgt === me;
        ui.meterEvent('dmg', ev);
        if (mine || onMe || ev.src === game.target) ui.floatText(t.pos, String(ev.amt), onMe ? 'dmg-in' : 'dmg-out', ev.crit);
        if (onMe) { rig.addShake(0.12); sfx.play('hit', 0.6); if (qwalk.active && ev.src !== me) qwalk.stop('combat'); }
        if (ev.skill === 'dot') fx.emit('sparks', t.pos.clone().add(V(0, 1.2, 0)), { n: 3, color: '#ff9a50' });
        break;
      }
      case 'heal': { ui.meterEvent('heal', ev); const t = entities.get(ev.tgt); if (t && (ev.src === me || ev.tgt === me)) ui.floatText(t.pos, '+' + ev.amt, 'heal'); break; }
      case 'miss': { const t = entities.get(ev.tgt); if (t && (ev.tgt === me || ev.src === me)) ui.floatText(t.pos, ev.text, 'miss'); if (ev.tgt === me && ev.text === 'Block' && game.plink?.from === 'dodge') game.plink.blocked = 1; if (ev.text === 'Block' && t?.cls === 'warden') fx.braceBlock?.(t, entities.get(ev.src)); break; } // (S9: a perfect Brace opens Breakwater on the bar; sparks and grit off the tower shield)
      // S1 machine reactions and the dodge (combat_design.md 2.4-2.6)
      case 'air': case 'stag': case 'broken': case 'recover': entities.get(ev.id)?.startReact?.(ev.k, ev, fx);
        if (ev.k === 'broken' && ev.cut) { for (const c of game.teleCut?.get(ev.id) || []) c.visible = false; game.teleCut?.delete(ev.id); ui.ucast?.delete(ev.id); } // (its wind-up was cancelled)
        break;
      // a knockback (S5): the machine slides with a dust trail from its feet and a scrape (Battering Line, Sidewind Cut,
      // Kingsfall); the move itself is the snapshot lerp
      // S7: a Reaction (the word and its effects), a wall slam (crunch, sparks, dust burst); a raider thrown far goes down
      case 'react': fx.react?.(ev); break;
      // the Sandblade (S8): Counter Stance's answer (its own clip on the hero, the machine it turned), Dust Whirl's column
      // falling or ended by Sandstorm Drop (a ring where it stood and sand thrown out), Whiteout's second cloud where the
      // sidestep began, Afterwake's sand wake along a dash, a machine dragged in by a pull
      case 'counter': { const v = entities.get(ev.id), t = entities.get(ev.tgt); if (v) { if (t) v.ry = Math.atan2(t.pos.x - v.pos.x, t.pos.z - v.pos.z); v.playSkill('s_counter_hit', t || null, null, fx); } break; }
      case 'column': { const v = entities.get(ev.id); if (v?.column && !(ev.dur > 0)) { v.column.t = v.column.dur; v.column = null; } if (ev.fall && v) { const p = new THREE.Vector3(ev.x, fx.ground?.(new THREE.Vector3(ev.x, 0, ev.z)) ?? v.pos.y, ev.z); fx.ring(p, '#d8c090', 3.5, 0.6); fx.emit('sand', p.clone().setY(p.y + 0.5), { n: 22, spread: 1.6 }); fx.sound('puff'); } break; }
      case 'sandcloud': fx.cloud('sand', new THREE.Vector3(ev.x, fx.ground?.(new THREE.Vector3(ev.x, 0, ev.z)) ?? 0, ev.z), ev.r || 4, 1.2); break;
      case 'wake': { const [x0, z0, x1, z1] = ev.seg, n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.2)); let acc = 0; fx.after?.(ev.dur || 3, (k, t, dt) => { acc += dt * 10; while (acc > 1) { acc--; const f = Math.random(), p = new THREE.Vector3(x0 + (x1 - x0) * f, 0, z0 + (z1 - z0) * f); p.y = (fx.ground?.(p) ?? 0) + 0.15; fx.emit('dust', p, { n: 1, size: 0.7, color: '#d8bc88', alpha: 0.4, speed: 0.4 }); } }); for (let i = 0; i <= n; i++) { const f = i / n, p = new THREE.Vector3(x0 + (x1 - x0) * f, 0, z0 + (z1 - z0) * f); p.y = (fx.ground?.(p) ?? 0) + 0.2; fx.emit('sand', p, { n: 3, spread: 0.4 }); } break; }
      // the Warden (S9): an Aftershock's repeat (a smaller ring and a smaller shake where the slam struck), Intercept's charge
      // to the ally (the ally's mark), Forge-Heated Head's slag is the fire zone's look
      case 'slag': fx.slag?.(new THREE.Vector3(ev.x, 0, ev.z), ev.r || 2, ev.dur || 3); break;
      case 'aftershock': { const v = entities.get(ev.id); fx.aftershock?.(new THREE.Vector3(ev.x, 0, ev.z), ev.r || 3, v === local); break; }
      case 'intercept': { const v = entities.get(ev.id), q = entities.get(ev.to); if (v && q) { v.ry = Math.atan2(q.pos.x - v.pos.x, q.pos.z - v.pos.z); fx.emit('dust', q.pos.clone().setY(q.pos.y + 0.2), { n: 8, spread: 0.6 }); } break; }
      case 'pull': { const v = entities.get(ev.id); if (v && !v.dead) fx.emit('dust', v.pos.clone().setY(v.pos.y + 0.2), { n: 4, size: 0.8, color: '#d8bc88' }); break; }
      case 'wall': fx.wallSlam?.(ev); break;
      case 'knock': { const v = entities.get(ev.id); if (v?.def?.humanoid && ev.d >= 2.5) fx.foeClip?.(v, 'down'); if (v && !v.dead && fx.after) { let acc = 0; fx.after(0.45, (k, t, dt) => { acc += dt * 28; while (acc > 1) { acc--; fx.emit('dust', v.pos.clone().setY(v.pos.y + 0.15), { n: 1, spread: 0.35, size: 0.75, alpha: 0.5 }); } }); fx.sound('scrape'); } }
        break;
      case 'dodge': if (ev.id !== me) { const v = entities.get(ev.id); if (v) { if (v.cls !== 'warden') v.ry = Math.atan2(ev.dx, ev.dz); v.playSkill((ev.s ? 'dodges_' : ev.f ? 'dodgef_' : 'dodge_') + (v.cls || 'knight'), ev.f && ev.tg ? entities.get(ev.tg) : null, null, fx); } } break; // (S10 f: a Deadeye's slide with Snap Shot held fires out of it)
      // the Deadeye (S10): a dry click (Six Chambers, both cylinders empty), a perfect reload's hot loads, a reload, Bank
      // Shot's skip from one machine to the next (a spark streak), Smoke Charge's bank of powder smoke where the slide began
      case 'dry': if (ev.id === me || entities.get(ev.id)) fx.sound('click'); break;
      case 'hotload': { const v = ev.id === me ? local : entities.get(ev.id); if (v) { fx.emit('embers', v.pos.clone().setY(v.pos.y + 1.1), { n: 10 }); fx.sound('click'); } if (ev.id === me) ui.combat?.fusionToast?.('Hot loads', false); break; }
      case 'reload': if (ev.id === me || entities.get(ev.id)) fx.sound('click'); break;
      case 'bank': { const a = entities.get(ev.from), b = entities.get(ev.to); if (a && b) { const pa = a.pos.clone().setY(a.pos.y + 1), pb = b.pos.clone().setY(b.pos.y + 1), d = pb.clone().sub(pa).normalize(); fx.emit('sparks', pa, { n: 6, dir: d, color: '#ffd890' }); fx.emit('sparks', pb, { n: 5, color: '#ffe0a8' }); fx.sound('hit'); } break; }
      // the Ranger (S11): his snares on the ground (placed, closing, gone or burst by a trap fusion), Ricochet Bodkin's path from
      // machine to machine, a held draw let go
      // the Chemist (S12): his puddles and clouds (a carried one follows him: Closed Lab), bombs lying with a burning fuse and their
      // bursts, Chain Reaction's pops, Spark Gear's and Galvanic Arc's arcs from machine to machine, Bitter Draught, Unstable Stock
      // the Herbalist (S13): his herb zones (smoke, steam, pepper, Field Hospital, herb patches; a carried one follows him: Drifting
      // Smoke), Lantern Haze lighting a smoke, a remedy's drops flying to the ally (Bitterroot, Swiftroot, Spreading Poultice), Field
      // Hospital holding up an ally who would fall, a machine choking in Sneezing Powder
      case 'hzone': { const own = ev.id === me ? local : entities.get(ev.id); fx.herbZone?.(ev, ev.follow && own ? () => own.pos : null); break; }
      case 'hzoneEnd': fx.herbZoneEnd?.(ev.zid); break;
      case 'hhaze': fx.herbHaze?.(ev); break;
      case 'hsplash': { const ent = (id) => (id === me ? local : entities.get(id)); const a = ent(ev.from), b = ent(ev.to); if (a && b) fx.herbSplash?.(a.pos, b.pos); break; }
      case 'hsave': { const v = ev.id === me ? local : entities.get(ev.id); if (v) { fx.emit('steam', v.pos.clone().setY(v.pos.y + 1.0), { n: 6, size: 0.9, alpha: 0.35, color: '#eef2ee' }); fx.emit('flecks', v.pos.clone().setY(v.pos.y + 1.2), { n: 10, color: '#c8a040' }); fx.sound('crack'); } break; }
      case 'sneeze': { const v = entities.get(ev.id); if (v) { fx.emit('dust', v.pos.clone().setY(v.pos.y + 1.4), { n: 5, size: 0.6, color: '#c8b87a' }); v.flinch?.(0.25); } break; }
      case 'czone': { const own = ev.id === me ? local : entities.get(ev.id); fx.chemZone?.(ev, ev.follow && own ? () => own.pos : null); break; }
      case 'czoneEnd': fx.chemZoneEnd?.(ev.zid); break;
      case 'bomb': { const on = ev.on ? entities.get(ev.on) : null; fx.bombPlace?.(ev, on ? () => on.pos : null); break; }
      case 'bombGone': fx.bombGone?.(ev.bid); break;
      case 'boom': fx.chemBoom?.(ev); break;
      case 'cpop': fx.chemPop?.(ev); break;
      case 'sparkarc': { const pts = (ev.path || []).map((id) => entities.get(id)?.pos).filter(Boolean); if (pts.length > 1) fx.sparkPath?.(pts, !!ev.g); break; }
      case 'draught': { const v = ev.id === me ? local : entities.get(ev.id); if (v) { fx.emit('drops', v.pos.clone().setY(v.pos.y + 1.5), { n: 8, color: '#bfe8ff' }); fx.sound('glass'); } break; }
      case 'scorch': { const v = ev.id === me ? local : entities.get(ev.id); if (v) { fx.emit('flame', v.pos.clone().setY(v.pos.y + 0.6), { n: 6, size: 0.6 }); fx.sound('hiss'); } break; }
      case 'trap': fx.trapPlace?.(ev.tid, ev.x, ev.z); break;
      case 'trapsnap': fx.trapSnap?.(ev.tid); break;
      case 'trapgone': fx.trapGone?.(ev.tid, ev.burst); break;
      case 'bounce': { const pts = (ev.path || []).map((id) => entities.get(id)?.pos).filter(Boolean); if (pts.length > 1) fx.bouncePath?.(pts); break; }
      case 'loose': { const v = ev.id === me ? local : entities.get(ev.id); if (v?.drawHold) loose(v.drawHold); break; }
      case 'smokebank': fx.cloud('gunsmoke', new THREE.Vector3(ev.x, fx.ground?.(new THREE.Vector3(ev.x, 0, ev.z)) ?? 0, ev.z), ev.r || 3, 3); break;
      case 'pdodge': if (ev.id === me && local) {
        // a perfect dodge: the world holds for 0.06 s around you, a puff of dust at the feet, a crack, and Opening
        const near = [...entities.views.values()].filter((v) => v.pos.distanceTo(local.pos) < 30);
        if (SETTINGS.hitstop !== false) fx.hitstop(DODGE.worldStop, near);
        fx.emit('dust', local.pos.clone().setY(local.pos.y + 0.15), { n: 10, spread: 0.4, size: 0.8 });
        sfx.play('crack', 0.8); ui.floatText(local.pos, 'Opening', 'miss');
      } break;
      case 'die': {
        const v = entities.get(ev.id);
        // (S7: a fusion's kill, ev.fz, splits a machine into 3-5 tumbling parts; the core falls with the death tilt)
        if (v) { const away = v.lastHit && performance.now() - v.lastHit.at < 1500 ? v.lastHit.away : null; v.kill(); if (v.ty === 'm') { fx.emit('sparks', v.pos.clone().add(V(0, 1, 0)), { n: 20, color: '#ffc070' }); fx.emit('smoke', v.pos.clone().add(V(0, 1, 0)), { n: 6 }); const sp = ev.fz && !v.def.humanoid && fx.split?.(v, away); if (!v.def.humanoid && !sp) fx.rocks(v.pos.clone(), 6, 0.6); } }
        if (ev.id === game.target && v?.ty === 'm') setTimeout(() => { if (game.target === ev.id) game.setTarget(null); }, 1200);
        if (ev.id === me) { game.casting = null; ui.chat('You have been defeated.', '#ff6050'); }
        break;
      }
      case 'revive': case 'spawn': { const v = entities.get(ev.id); fx.unsplit?.(v); v?.revive(true); break; }
      case 'xp': if (local) ui.floatText(local.pos, `+${ev.amt} XP${ev.rested ? ' (rested)' : ''}`, 'xp'); break;
      case 'lvl': {
        const v = entities.get(ev.id);
        if (v) { fx.ring(v.pos, '#ffe08a', 5, 0.8); fx.emit('motes', v.pos, { n: 60, color: '#ffe08a', r: 1 }); fx.emit('flash', v.pos.clone().add(V(0, 1.2, 0)), { size: 4, color: '#fff0b0' }); }
        if (ev.id === me) { sfx.play('levelup'); ui.zoneBanner('Level ' + ev.level, 'You feel stronger'); ui.chat(`You have reached level ${ev.level}!`, '#ffe08a'); }
        break;
      }
      case 'msg': ui.chat(ev.text, ev.color); if (ev.prism) ui.prismaticNews(ev); break;
      case 'upgrade': ui.onUpgrade(ev); break;
      case 'recv': ui.receipt(ev); break;
      case 'err': ui.error(ev.text); break;
      case 'chat': if (botHid(ev, 'world')) break; ui.chat(ev.text, '#ffffff', `<span style="color:${CLASSES[ev.cls]?.color || '#fff'}">${shownName(ev.from, ev.bot)}</span>`, ev.links); break;
      case 'mobAtk': {
        const v = entities.get(ev.id), t = entities.get(ev.tgt);
        if (v) { if (t) v.ry = Math.atan2(t.pos.x - v.pos.x, t.pos.z - v.pos.z); v.mobAttack(t, ev.ranged, ev.special, fx); }
        break;
      }
      case 'tele': { ui.unitCast(ev.id, ev.name || 'Attack', ev.t || 1.5);
        const v = entities.get(ev.id);
        const wet = v?.def?.water || v?.def?.mud || v?.def?.dust; // machines whose strikes are water (the Sluice Galleries): blue circles; mud (the Drain Adits): red-brown; oak dust and damp (the Drying Lofts): pale gold
        const cutList = CUT_KINDS.has(ev.kind) ? ((game.teleCut ||= new Map()).get(ev.id) || []).filter((c) => c.parent) : null; // (S1: a Broken boss's wind-up circles are hidden)
        if (cutList) game.teleCut.set(ev.id, cutList);
        for (const sp of ev.spots) if (ev.kind !== 'cranes' && ev.kind !== 'damp') { const tc = fx.telegraph(V(sp.x, 0, sp.z), sp.r, ev.t, ev.kind === 'damp' ? '#7a9a72' : ev.kind === 'nova' ? (wet ? v.def.novaColor || '#6ad0ff' : '#ff7a20') : (wet ? v.def.teleColor || '#2f9cff' : '#ff3020')); if (cutList && tc) cutList.push(tc); }
        if (v?.machine) v.machine.attack(ev.t, 'slam'); else if (v?.anim) v.mobAttack(null, false, true, fx);
        if (v && local && v.pos.distanceTo(local.pos) < 45) sfx.play(ev.kind === 'nova' ? 'shout' : 'grind', 0.8);
        break;
      }
      case 'boom': {
        const v = entities.get(ev.id);
        for (const sp of ev.spots) {
          const p = V(sp.x, heightAt(sp.x, sp.z), sp.z);
          if (ev.kind === 'damp') { fx.emit('dust', p, { n: 12, spread: sp.r * 0.6, size: 1.3, color: '#4a4638' }); continue; } // the damp: a breath of dark dust over the square stains only (no rings: the damp's hit spots overlap down a bay, and overlapping circles draw crescents and four-point shapes from above)
          if (v?.def?.dust || ev.kind === 'cranes') { fx.emit('dust', p, { n: 12, spread: sp.r * 0.5, size: 1.3, color: '#c8b494' }); fx.emit('ringdust', p, { n: 10, r: sp.r, speed: 1.2 + sp.r * 0.5, color: '#d8c8a4' }); if (ev.kind !== 'cranes') fx.ring(p, '#e0b860', sp.r, 0.5); continue; } // a load of oak set down, a breath of damp: dust, no crack
          if (v?.def?.mud || ev.kind === 'lanes' || ev.kind === 'sumps') { fx.emit('dust', p, { n: 14, spread: sp.r * 0.5, size: 1.3, color: '#6e4232' }); fx.emit('ringdust', p, { n: 10, r: sp.r, speed: 1.2 + sp.r * 0.5, color: '#8a5a40' }); fx.ring(p, '#c8682e', sp.r, 0.5); continue; } // a slap of wet mud, no crack
          if (v?.def?.water) { fx.emit('drops', p, { n: 22 }); fx.emit('steam', p, { n: 8 }); fx.emit('ringdust', p, { n: 12, r: sp.r, speed: 1.5 + sp.r * 0.6, color: '#dcecf6' }); fx.ring(p, '#8cd0ff', sp.r, 0.5); continue; } // a burst of water, no crack
          fx.impact('earth', p, { r: sp.r });
          fx.emit('dust', p, { n: 10, spread: sp.r * 0.5, size: 1.4 });
          if (world.indoor === 'depths') fx.emit('embers', p, { n: 16 });
          fx.decal('crack', p, sp.r * 0.7, 5);
        }
        if (local && ev.spots.some((sp) => Math.hypot(local.pos.x - sp.x, local.pos.z - sp.z) < sp.r + 6)) { rig.addShake(ev.kind === 'nova' ? 0.9 : 0.5); sfx.play('boom', 0.8); }
        // storm engines throw their beams as lightning
        if (v && ['thunderhead', 'stormengine', 'capwarden'].includes(v.def?.model) && ev.spots.length) { const last = ev.spots[ev.spots.length - 1]; fx.arc(v.pos.clone().add(V(0, (v.root.userData.height || 4) * 0.85, 0)), V(last.x, heightAt(last.x, last.z) + 0.3, last.z)); if (ev.kind === 'beam') for (const sp of ev.spots) fx.emit('sparks', V(sp.x, heightAt(sp.x, sp.z) + 0.3, sp.z), { n: 6, color: '#a8dcff' }); }
        break;
      }
      case 'yell': { if (ev.id) { const v = entities.get(ev.id); if (!v || !local || v.pos.distanceToSquared(local.pos) > 90 * 90) break; } const yk = ev.id + '|' + ev.text, yt = performance.now(), Y = (game.yellSeen ||= new Map()); if (!ev.id || !(yt - (Y.get(yk) || -1e9) < 45000)) ui.chat(ev.text, '#ff9a40'); if (ev.id) Y.set(yk, yt); ui.error(ev.text); break; } // a boss's yell only reaches those near the fight
      case 'useobj': { qobjects.used(ev.obj, ev.id === me, fx, sfx); const v = entities.get(ev.id); if (v?.anim && ev.id !== me) v.mobAttack?.(null, false, false, fx); break; }
      case 'slam': { const v = entities.get(ev.id); if (v) { fx.impact('earth', v.pos.clone(), { r: ev.r }); fx.decal('crack', v.pos.clone(), ev.r * 0.6, 6); rig.addShake(0.6); } break; }
      case 'node': { const n = game.nodes.get(ev.id); if (n) { n.ready = ev.ready; n.mesh.visible = ev.ready; } break; }
      case 'valley': game.valleyStage = ev.stage; world?.setValleyStage?.(ev.stage); break;
      case 'ram': ramc.onEv(ev); break; // LF.6 the Ram Engine's state and tally (shared/ramEngine.js)
      case 'ramload': { const v = entities.get(ev.id); if (v) { fx.emit('dust', v.pos.clone().setY(v.pos.y + 1), { n: 8, color: ev.kind === 'coal' ? '#3a3632' : '#8a8a86' }); if (ev.id === me) sfx.play('thud'); } break; }
      case 'ramfix': { const v = entities.get(ev.id); if (v) fx.emit('sparks', v.pos.clone().setY(v.pos.y + 1.1), { n: 8, color: '#ffd090' }); break; }
      case 'damp': world.dungeonViews?.get(ev.d)?.group.userData.damp?.(ev.a, ev.lv, ev.open); break; // P15.4 the Drying Lofts' damp, bay by bay, and the louvres thrown open (shared/sim.js 'damp')
      case 'rides': world.wealdCleared = ev.cl.map((c) => c > 0); ui.setRides?.(ev); break; // P15.3 Clear the Rides: the zone-wide tally (shared/rides.js)
      case 'wake': {
        // the First Engine rising: a short scene the first time each day, if you are down in the Deepway to see it
        const P = game.playerPos?.() || local?.pos, D = P && dungeonAt(P.x, P.z);
        const day = new Date().toDateString(); let seen = null; try { seen = localStorage.getItem('sunmere:wake:' + ev.kind); } catch {}
        if (ev.kind === 'firstengine' && D?.id === 'deepway' && seen !== day) {
          try { localStorage.setItem('sunmere:wake:' + ev.kind, day); } catch {}
          ui.playScene(null, { text: 'Deep in the First Chamber the counterweight drops, the paddle wheels shudder and turn, and the First Engine rises on its stilts, as it has every day since before the valley had a name.', x: ev.x, z: ev.z });
        }
        break;
      }
      case 'questDone': {
        sfx.play('levelup', 0.6);
        // a golden glint over the one who gave the quest
        const nv = ev.npc && entities.get(ev.npc);
        if (nv) { const p = nv.pos.clone().add(V(0, 2.2, 0)); fx.emit('glow', p, { size: 2.6, color: '#ffe08a', alpha: 0.7, life: 0.9 }); fx.emit('motes', nv.pos, { n: 26, color: '#ffe08a', r: 0.7 }); }
        if (QUESTS[ev.q]?.scene) ui.playScene(ev.q); else ui.questDoneBanner(ev.q, ev.pick);
        break;
      }
      case 'emote': { const v = entities.get(ev.id); if (ev.e !== 'sit') v?.playEmote(ev.e); if (ev.id === me && ev.e === 'sit' && local) local.sitting = true; if (ev.text) ui.chat(ev.text, '#ffb070'); break; }
      case 'craft': { const v = entities.get(ev.id); if (v) fx.emit('sparks', v.pos.clone().add(V(0, 1.2, 0)), { n: 12, color: '#ffd080' }); break; }
      case 'salv': { const v = entities.get(ev.id); if (v) { v.startSalvage(ev); fx.emit('drops', V(ev.x, ev.y + 0.1, ev.z), { n: 8, color: '#cfe8ff' }); } if (ev.id === me) sfx.play('splat', 0.5); break; }
      case 'salvstop': entities.get(ev.id)?.stopSalvage(); break;
      case 'salvdone': { const v = entities.get(ev.id); v?.stopSalvage(); fx.emit('drops', V(ev.x, ev.y + 0.1, ev.z), { n: 16, color: '#cfe8ff' }); if (ev.id === me) sfx.play('splat', 0.8); break; }
      case 'mount': { const v = entities.get(ev.id); if (v) { v.setMounted(!!ev.on); fx.emit('smoke', v.pos.clone().add(V(0, 0.6, 0)), { n: 8 }); if (ev.id === me) sfx.play('puff', 0.7); } break; }
      case 'ach': ui.achToast(ev.id); sfx.play('levelup', 0.8); break;
      case 'invite': ui.invitePopup(ev); sfx.play('ui'); break;
      case 'duelAsk': ui.duelPopup(ev); sfx.play('ui'); break;
      case 'questShare': ui.sharePopup(ev); sfx.play('ui'); break;
      case 'guildAsk': ui.guildPopup(ev); sfx.play('ui'); break;
      case 'gchat': if (botHid(ev, 'guild')) break; ui.chat(ev.text, '#7aff9a', `<span style="color:#7aff9a">Guild</span>] [<span style="color:${CLASSES[ev.cls]?.color || '#fff'}">${shownName(ev.from, ev.bot)}</span>`, ev.links); break;
      case 'mailNew': sfx.play('ui'); break;
      case 'claim': ui.claimCard(ev); sfx.play('ui'); break;
      case 'rare': ui.ping(ev.x, ev.z, '#e0e8ff'); sfx.play('ui'); break;
      case 'recall': game.casting = { cast: ev.secs, t0: performance.now() / 1000, name: 'Homeward Compass' }; break;
      case 'recallStop': if (game.casting?.name === 'Homeward Compass') game.casting = null; break;
      case 'whisper': if (botHid(ev, 'whisper')) break; ui.chat(ev.text, '#e8a0ff', `<span style="color:#e8a0ff">${ev.out ? 'To ' + shownName(ev.to, ev.bot) : shownName(ev.from, ev.bot) + ' whispers'}</span>`, ev.links); if (!ev.out) sfx.play('ui', 0.5); break;
      case 'say': if (botHid(ev, 'say')) break; ui.chat(ev.text, '#fff4d8', `<span style="color:#ffe8b0">Say</span>] [<span style="color:${CLASSES[ev.cls]?.color || '#fff'}">${shownName(ev.from, ev.bot)}</span>`, ev.links); break;
      case 'ptradeAsk': ui.ptradeAsk(ev); sfx.play('ui'); break;
      case 'pchat': if (botHid(ev, 'party')) break; ui.chat(ev.text, '#9ac8ff', `<span style="color:#7ab0ff">Party</span>] [<span style="color:#7ab0ff">${shownName(ev.from, ev.bot)}</span>`, ev.links); break; // (shown as [Party] [Name], like guild chat)
      case 'sail': startCrossing(ev.to, ev.from); break;
      case 'lift': startLift(ev.to, ev.from); break;
      case 'haul': startHaul(ev.to, ev.from); break;
      case 'rope': startRope(ev.to, ev.from); break;
      case 'drink': { const v = entities.get(ev.id); if (v) fx.emit('motes', v.pos, { n: 20, color: '#ff8080', r: 0.5 }); break; }
    }
  }

  // ------------------------------------------------------------------ input
  const keys = new Set();
  let moveTo = null, interactTarget = null;
  const mouse = new THREE.Vector2(), ray = new THREE.Raycaster();
  let mouseGround = null;
  const vel = V();
  let airY = 0, airV = 0, onGround = true;
  addEventListener('keydown', (e) => {
    if (!entered || !local) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (ui.keyCapture) { e.preventDefault(); ui.keyCapture(e.code); return; }
    if (crossing) { if (crossing.t > 1.2) crossing.t = Math.max(crossing.t, (crossing.haul ? HAUL : crossing.lift ? LIFT : CROSS).out); return; }
    if (ui.scene) { ui.endScene(); if (e.code === 'Escape') return; }
    keys.add(e.code);
    if (e.code === 'Enter') { document.querySelector('.chat-in')?.focus(); e.preventDefault(); return; }
    if (e.code === 'Escape') { const open = Object.values(ui.windows).some((w) => w?.isConnected); if (!open && !game.target) ui.toggle('options'); else { if (game.target) game.setTarget(null); ui.closeAll(); } return; }
    const act = actionFor(e.code);
    // the dodge (S1): on Shift it is a tap on its own (Shift held with 1-0 still casts the second bar), on any other key at once
    if (act === 'dodge') { if (/^Shift/.test(e.code)) { if (!e.repeat) game.shiftTap = { at: performance.now(), used: false }; } else if (!e.repeat) game.dodge(); return; }
    if (game.shiftTap && /^Digit/.test(e.code)) game.shiftTap.used = true;
    if (act === 'autorun') { game.autoRun = !game.autoRun; return; }
    if (act === 'fwd' || act === 'back') game.autoRun = false;
    if (act === 'hideui') { ui.root.classList.toggle('ui-hidden'); return; }
    if (act === 'target') { e.preventDefault(); tabTarget(); return; }
    if (act === 'jump' && ramc.driving()) { ramc.strike(); e.preventDefault(); return; } // (at the Ram Engine's levers Space strikes the ram)
    if (act === 'jump' && onGround && !local.dead) { jump(); e.preventDefault(); }
    if (act === 'interact') { const it = game.nearInteract; if (it) doInteract(it); return; }
    if (act === 'recall') { game.send({ t: 'recall' }); return; }
    if (act === 'zoomIn' || e.code === 'NumpadAdd') { ui.miniZoom(1); return; }
    if (act === 'zoomOut' || e.code === 'NumpadSubtract') { ui.miniZoom(-1); return; }
    if (act === 'ride') { ride(); return; }
    if (act === 'potion') { ui.usePotion?.(); return; }
    const win = ['char', 'bags', 'quests', 'skills', 'talents', 'ach', 'journal', 'options', 'map', 'help', 'meter', 'loot'].includes(act) ? act : null;
    if (win) { ui.toggle(win); return; }
    // (S6) the two pinned fusions on their own keys (Q and E by default; Z hides the interface and C opens the character
    // window, so the design's Z and C clash)
    const pin = act === 'pin1' || act === 'pin2' ? Number(act[3]) - 1 : -1;
    if (pin >= 0) { if (!e.repeat) ui.combat?.pin(pin); return; }
    const plainK = SETTINGS.fuseAlt ? !e.altKey : e.altKey; // (Alt casts B plain; the option "fuse only with Alt" turns it round)
    const sx = act && act.match(/^skill(\d+)$/);
    if (sx) { const sk = kitOf(game.cls)[Number(sx[1]) - 1]; if (sk) { if (sk.draw && !e.repeat) game.holdKey = e.code; if (!e.repeat || !sk.draw) useSkill(sk.id, 0, { plain: plainK, hold: !!sk.draw }); } return; } // (S11: a draw is held while the key is down)
    const m = e.code.match(/^Digit(\d)$/);
    if (m) {
      const idx = (Number(m[1]) + 9) % 10 + (e.shiftKey ? 10 : 0);
      const sk = kitOf(game.cls)[idx];
      if (sk && sk.draw) { if (!e.repeat) { game.holdKey = e.code; useSkill(sk.id, 0, { plain: plainK, hold: true }); } } else if (sk) useSkill(sk.id, 0, { plain: plainK }); // (Alt: B plain on purpose, never a fusion; S11: a draw is held while the key is down)
    }
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (game.holdKey && game.holdKey === e.code) releaseDraw();
    const st = game.shiftTap;
    if (st && actionFor(e.code) === 'dodge') { game.shiftTap = null; if (!st.used && performance.now() - st.at < 350 && entered && local && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) game.dodge(); }
  });
  const canvas = engine.renderer.domElement;
  // no browser context menu anywhere in the game (right mouse turns the camera); text boxes keep theirs
  document.addEventListener('contextmenu', (e) => { if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault(); });
  canvas.addEventListener('pointermove', (e) => { mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
  // left click acts on press; right click acts on release, only if the mouse was not dragged (camera turn)
  const onClick = (e, button, noWalk) => {
    if (!entered || !local) return;
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const hit = pickEntity();
    if (hit) {
      if (hit.id !== game.localId) game.setTarget(hit.id);
      // right-click on another player (not a companion or adventurer): Whisper, Invite, Trade, Inspect, Add friend...
      if (button === 2 && hit.ty === 'p' && hit.id !== game.localId && hit.data?.n && hit.data?.ti?.[0] !== '<') { ui.playerMenu(hit.id, hit.data.n, e.clientX, e.clientY); return; }
      if (button === 2 || hit.ty === 'n' || (hit.ty === 'm' && hit.dead)) interact(hit);
      return;
    }
    const node = pickNode();
    if (node) { interactNode(node); return; }
    if (button === 0 && !noWalk) { const g = groundPoint(); if (g) { moveTo = g; interactTarget = null; fx.ring(g, '#ffe08a', 0.6, 0.35); } }
  };
  // a finger on a touch device is read by the touch controls instead (stick, camera drag, tap to target)
  canvas.addEventListener('pointerdown', (e) => { if (e.button === 0 && !(touch && e.pointerType === 'touch')) onClick(e, 0); });
  canvas.addEventListener('pointerup', (e) => { if (e.button === 2 && !rig.rightDragged) onClick(e, 2); });

  function jump() { if (onGround && local && !local.dead) { airV = 6.5; onGround = false; } }
  function ride() { if (game.you?.runabout || game.you?.crawler) game.send({ t: 'mount' }); else ui.error('You do not own a runabout yet. Gearwright Ottmar at the Sunmere gate sells them from level 10.'); }
  // what the touch controls can do (ui/touch.js); the stick itself is read in the frame loop below
  let touch = null;
  const touchActs = {
    // a tap on the world: target what is under the finger (a second tap on a foe attacks, on an NPC or a body walks up to it)
    tapAt(x, y) {
      if (!entered || !local) return;
      if (crossing) { if (crossing.t > 1.2) crossing.t = Math.max(crossing.t, (crossing.haul ? HAUL : crossing.lift ? LIFT : CROSS).out); return; }
      if (ui.scene) { ui.endScene(); return; }
      const before = game.target;
      mouse.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
      const hit = pickEntity();
      if (hit && hit.ty === 'm' && !hit.dead && hit.id !== before) { game.setTarget(hit.id); return 'target'; }
      onClick({ clientX: x, clientY: y }, 0, true);
      return hit ? 'hit' : pickNode() ? 'node' : null;
    },
    interact() { const it = game.nearInteract; if (it) { doInteract(it); return true; } return false; },
    jump: () => (ramc.driving() ? ramc.strike() : jump()), ride,
    dodge: () => game.dodge?.(), // (S1: the dodge button and the stick flick; the stick's direction, back with none) // (at the Ram Engine's levers the jump button strikes the ram)
    autorun() { game.autoRun = !game.autoRun; return game.autoRun; },
    nextTarget() { tabTarget(); },
    clearTarget() { game.setTarget(null); },
    busy: () => !!(crossing || ui.scene),
    skip() { if (crossing) { if (crossing.t > 1.2) crossing.t = Math.max(crossing.t, (crossing.haul ? HAUL : crossing.lift ? LIFT : CROSS).out); return true; } if (ui.scene) { ui.endScene(); return true; } return false; },
  };

  // walk-up interaction (F): talk, loot, gather
  function doInteract(it) {
    if (it.door) {
      sfx.play('ui');
      if (!it.door.exit && !it.door.open && game.you?.level >= 23) { ui.doorChoice(it.door.id, (mode) => game.send({ t: 'door', id: it.door.id, heroic: mode !== 'normal', tempest: mode === 'tempest', veteran: mode === 'veteran' })); return; }
      game.send({ t: 'door', id: it.door.id, exit: !!it.door.exit }); return;
    }
    if (it.salvage) { game.send({ t: 'salvage' }); return; }
    if (it.sail) { game.send({ t: 'sail', npc: it.sail }); sfx.play('ui'); return; }
    if (it.ram) { ramc.act(it.ram, it.pile); return; } // the Ram Engine: levers, piles, load, repair
    if (it.qobj) { game.send({ t: 'useobj', id: it.qobj.id }); local.ry = Math.atan2(it.qobj.x - local.pos.x, it.qobj.z - local.pos.z); return; }
    if (it.node) game.send({ t: 'gather', id: it.node.id });
    else if (it.ty === 'n') { game.send({ t: 'npc', id: it.id }); local.ry = Math.atan2(it.pos.x - local.pos.x, it.pos.z - local.pos.z); }
    else if (it.ty === 'm' && it.dead) game.send({ t: 'loot', id: it.id });
    sfx.play('ui');
  }
  function findInteract() {
    let best = null, bd = 4.2;
    for (const v of entities.views.values()) {
      if (v === local) continue;
      const ok = (v.ty === 'n' && v.root.visible !== false) || (v.ty === 'm' && v.dead && v.sparkle);
      if (!ok) continue;
      const d = v.pos.distanceTo(local.pos);
      if (d < bd) { bd = d; best = v; }
    }
    for (const n of game.nodes.values()) { if (!n.ready) continue; const d = n.mesh.position.distanceTo(local.pos); if (d < Math.min(bd, 3)) { bd = d; best = { node: n }; } }
    for (const o of qobjects.usable()) { const d = Math.hypot(o.x - local.pos.x, o.z - local.pos.z); if (d < Math.min(bd + 0.3, 3.6)) { bd = d; best = { qobj: o }; } }
    for (const dr of world.doors || []) { const d = Math.hypot(dr.x - local.pos.x, dr.z - local.pos.z); if (d < Math.min(bd + 0.5, 4.5)) { bd = d; best = { door: dr }; } }
    // the foot of the steam ship's gangway in Harrowmouth: board for the Cinder Reach (once Chapter 29 has put you aboard)
    if (game.you?.done?.m_c29_aboard) for (const gw of GANGWAYS) { const d = Math.hypot(gw.x - local.pos.x, gw.z - local.pos.z); if (d < Math.min(bd, 2.6)) { bd = d; best = { sail: gw.npc, label: gw.label }; } }
    // the Ram Engine's walk-up actions while its run is on (at its levers: step down, always)
    { const r = ramc.interact(local.pos); if (r && (r.d === 0 || r.d < Math.min(bd + 0.2, 3.4))) { bd = r.d; best = r; } }
    // nothing else at hand: by the water with a salvage hook, offer a cast
    if (!best && !local.salvage && game.you?.bag?.some((b) => b.id === 'hook' || b.id === 'fishline') && !game.you.mounted) {
      game._wT = (game._wT || 0) + 1;
      if (game._wT % 10 === 0) game._water = waterNear(local.pos.x, local.pos.z, local.ry);
      if (game._water) best = { salvage: game._water };
    }
    return best;
  }

  function groundPoint() {
    ray.setFromCamera(mouse, engine.camera);
    const ground = world.areaTerrain().group.children;
    const hits = world.indoor ? ray.intersectObjects(world.floorPick || world.floors, true).filter((h) => h.point.y < 0.6) : ray.intersectObjects(ground, false);
    return hits.length ? hits[0].point.clone() : null;
  }
  function pickEntity() {
    ray.setFromCamera(mouse, engine.camera);
    let best = null, bd = 1e9;
    const p = V();
    for (const v of entities.views.values()) {
      // test against a vertical capsule approximated by points along the body
      const h = v.height || 2, r = Math.max(0.6, v.radius || 0.5) + 0.25;
      for (let k = 0.2; k <= 0.9; k += 0.35) {
        p.copy(v.pos); p.y += h * k;
        const d = ray.ray.distanceSqToPoint(p);
        if (d < r * r) { const dc = p.distanceTo(engine.camera.position); if (dc < bd) { bd = dc; best = v; } }
      }
    }
    return best;
  }
  function pickNode() {
    ray.setFromCamera(mouse, engine.camera);
    for (const n of game.nodes.values()) { if (!n.ready) continue; const p = n.mesh.position.clone().add(V(0, 0.3, 0)); if (ray.ray.distanceSqToPoint(p) < 0.5) return n; }
    return null;
  }
  function interact(v) {
    if (v.ty === 'm' && !v.dead) { if (!game.you.dead) { const auto = kitOf(game.cls).find((s) => s.lvl <= game.you.level && s.target === 'enemy' && !s.cd && !s.cast); if (auto) useSkill(auto.id); } return; }
    interactTarget = v;
    moveTo = null;
  }
  function interactNode(n) { interactTarget = { node: n }; moveTo = null; }

  function tabTarget() {
    const fwd = rig.axes().fwd;
    let best = null, bs = -1e9;
    for (const v of entities.views.values()) {
      if (v.ty !== 'm' || v.dead || v.root.visible === false) continue;
      const d = v.pos.distanceTo(local.pos);
      if (d > 40 || !dungeonSight(local.pos.x, local.pos.z, v.pos.x, v.pos.z)) continue; // (never a foe behind dungeon rock)
      const dir = v.pos.clone().sub(local.pos).setY(0).normalize();
      // practice dummies come last: Tab is for real foes, a dummy only when nothing else is about
      const score = -d + dir.dot(fwd) * 8 + (v.id === game.target ? -1000 : 0) + (v.def?.dummy ? -60 : 0);
      if (score > bs) { bs = score; best = v; }
    }
    if (best) game.setTarget(best.id);
  }

  // ------------------------------------------------------------------ skills
  // qUntil: a press held in the input buffer (S1, shared/feel.js BUFFER 0.3 s), retried every frame until it is legal
  // o.plain: Alt held (B plain on purpose). S2 fusions (shared/fusions.js): B pressed in the link A opened plays the fusion
  // at once (prediction) and tells the server the chain it cast (chain: A, accepted up to 0.15 s late); the server's cast
  // event swaps the clip if it decided otherwise
  // (S11) the Ranger's held draw (Piercing Arrow): the clip runs to full draw (CHOREO drawHold.at) and waits there while the
  // key or the touch is held; letting go after 0.25 s looses at once (the clip jumps to its release), a tap draws to full and
  // looses by itself, as the server does (sim.js on_release). Other heroes' held draws follow the server's 'loose'
  function holdDraw(v, sk) {
    const def = CHOREO[clipOf(sk.id)], act = v.anim?.action;
    if (!def?.drawHold || !act) return;
    (game.drawHolds ||= new Set()).add(v.drawHold = { v, act, def, t0: performance.now() / 1000, max: sk.draw.max || 2.5, released: false });
  }
  function loose(dh) {
    if (!dh || dh.released) return;
    dh.released = true;
    const act = dh.act, held = performance.now() / 1000 - dh.t0;
    if (act !== dh.v.anim?.action) return;
    act.speed = dh.speed || act.speed || 1;
    if (held >= 0.25 || dh.remote) { const rt = dh.def.drawHold.rel * dh.def.dur - 0.06; if (act.time < rt) act.time = rt; }
  }
  function releaseDraw() {
    game.holdKey = null;
    const dh = local?.drawHold;
    if (!dh || dh.released) return;
    game.send({ t: 'release' });
    loose(dh);
  }
  function stepDrawHolds() {
    for (const dh of game.drawHolds || []) {
      const act = dh.act;
      if (act !== dh.v.anim?.action || (dh.released && act.speed)) { game.drawHolds.delete(dh); if (dh.v.drawHold === dh) dh.v.drawHold = null; continue; }
      if (dh.released) continue;
      if (performance.now() / 1000 - dh.t0 > dh.max) { loose(dh); continue; }
      const at = dh.def.drawHold.at * dh.def.dur;
      if (act.time >= at && act.speed) { dh.speed = act.speed; act.speed = 0; act.time = at; }
    }
  }
  function useSkill(id, qUntil, o = {}) {
    const y = game.you, base = (y?.web && ui.eff?.[id]) || skillOf(id); // (S5: the hero's compiled kit with the Web on it, as the server reads p.eff: High Arc's and Sightline's range, Short Hop's cooldown)
    if (!base || base.from || !y || !local || local.dead) return;
    if (!qUntil) { game.pressedSkill = id; setTimeout(() => { if (game.pressedSkill === id) game.pressedSkill = null; }, 120); }
    if (base.lvl > y.level) return ui.error(`Requires level ${base.lvl}.`);
    const now = game.serverTime();
    const fu = o.plain ? null : predictFusion(base, now);
    const ch = game.chain && game.chain.id === base.id && now - game.chain.at <= CHAIN_RESET ? game.chain : null;
    const sk = (fu && ((y.web && ui.eff?.[fu.f.id]) || fu.f)) || (base.chain ? stepOf(base, ch ? (ch.step % base.chain.length) + 1 : 1) : base);
    // a fusion key pressed while A still winds up is held to A's contact + the buffer (the server holds it the same way)
    const lc = game.lastCast;
    if (!fu && !o.plain && lc && !lc.done && now < lc.at && FUSE[game.cls]) {
      const f2 = FUSE[game.cls][lc.id + '>' + id];
      if (f2 && fusionUnlocked(y, f2) && !((y.cds[f2.id] || 0) > lc.at)) { game.qSkill = { id, until: qUntil || lc.at + BUFFER, o }; return; }
    }
    // the first legal moment: the cooldown, the lock of the last plain skill (feel.js, 0.45-0.9 s) and the cancel point of
    // the clip playing (its contact + 0.12 s, or the end of a dodge's evade); a press inside the buffer is held, the
    // latest press wins (riding/sitting loops never block). A fusion skips A's lock
    const cutAt = local.anim.busy && local.anim.action?.clip?.mask === 'full' && !local.anim.action.clip.loop ? game.cutT || 0 : 0;
    // (S5) a fusion waits for A's cancel point (its contact + 0.12 s, game.cutT) unless Hair Trigger fires it on the contact
    const legal = Math.max(y.cds[id] || 0, fu ? Math.max(y.cds[fu.f.id] || 0, y.web && ui.tmods?.contactFire ? 0 : game.cutT || 0) : 0, sk.gcd && !fu ? Math.max(y.gcd || 0, cutAt) : 0);
    // (no early grace: the server holds a press that comes in early and fires it on its next tick, so a client that went
    // 0.05 s early ran its swing and contact 2-3 frames ahead of the server's damage, flinch and number; S1 feel review)
    if (legal > now + 0.005) {
      if (legal - now <= BUFFER + 0.05 && (!qUntil || now <= qUntil)) { game.qSkill = { id, until: qUntil || now + BUFFER, o }; return; }
      if (qUntil) return;
      if ((y.cds[id] || 0) > now + 0.05) return ui.error('Not ready yet.');
      return;
    }
    game.qSkill = null;
    const cost = fu ? skillCost(base, ui.tmods) + (fu.f.extra || 0) : skillCost(sk, ui.tmods);
    if (y.res < cost && fu && y.res >= skillCost(base, ui.tmods)) return useSkill(id, qUntil, { ...o, plain: true }); // (enough for plain B, not the fusion: B plain, as the server does)
    if (y.res < cost) return ui.error(`Not enough ${CLASSES[game.cls].resource}.`);
    if (!onGround && (sk.tags || []).includes('leap') && !sk.airCast) return ui.error('You must be on the ground to leap.'); // (Iron Comet lifts this, S5)
    if (y.mounted) { y.mounted = false; local.setMounted(false); }
    let tgtV = game.target ? entities.get(game.target) : null;
    let ground = null;
    const foe = (v) => v && !v.dead && (v.ty === 'm' || (v.ty === 'p' && y.duel && v.id === y.duel.with && now >= y.duel.start));
    if (sk.target === 'enemy') {
      if (!foe(tgtV) && fu?.L.tgt) tgtV = entities.get(fu.L.tgt);
      if (!foe(tgtV)) {
        // auto-target the nearest enemy in range
        let best = null, bd = sk.range + 2;
        for (const v of entities.views.values()) if (v.ty === 'm' && !v.dead) { const d = v.pos.distanceTo(local.pos); if (d < bd && dungeonSight(local.pos.x, local.pos.z, v.pos.x, v.pos.z)) { bd = d; best = v; } }
        if (!best) return ui.error('You need a target.');
        tgtV = best; game.setTarget(best.id);
      }
      const d = tgtV.pos.distanceTo(local.pos);
      if (d > sk.range + (tgtV.radius || 0.5) + 0.5) return ui.error('Out of range.');
    } else if (sk.target === 'ally') {
      if (!tgtV || tgtV.ty !== 'p' || tgtV.dead || tgtV.id === y.duel?.with) tgtV = local;
    } else if (sk.target === 'ground') {
      ground = foe(tgtV) ? tgtV.pos.clone() : (touch ? null : groundPoint()) || local.pos.clone().add(rig.axes().fwd.multiplyScalar(8));
    } else tgtV = null;
    // face the target
    const look = tgtV && tgtV !== local ? tgtV.pos : ground;
    // On the run, an attack that plays over the running legs ('blend') no longer snaps the whole body onto the target
    // (a ranger kiting fires about once a second, and each snap swung hips, legs and all up to 180 deg in one frame,
    // then swung them back: the body lurched one way and the other). See the frame step: a shot or throw keeps the legs
    // on the run and twists the upper body onto the target; a melee swing turns the body over ~0.15 s.
    local.aimRy = null; local.aimShot = (sk.range || 0) > 6;
    if (look) {
      const yaw = Math.atan2(look.x - local.pos.x, look.z - local.pos.z);
      if (local.speed > 0.5 && CHOREO[sk.choreo || id]?.mask === 'blend') local.aimRy = yaw; else local.ry = yaw;
    }
    // optimistic local cooldown so the bar reacts instantly
    y.res -= cost;
    if (base.charges > 1) { const n = Math.max(0, (y.skc?.[id] ?? base.charges) - 1); (y.skc ||= {})[id] = n; if (!n) y.cds[id] = now + base.cd; } // (S8: Desert Step's charges; the server's word follows)
    else if (base.cd) y.cds[id] = now + base.cd;
    if (fu) y.cds[fu.f.id] = now + fu.f.cd;
    const fe = skillFeel(sk);
    if (sk.gcd) y.gcd = now + fe.win.lock;
    game.cutT = now + fe.win.cancel; // (a dodge or the next skill may cut the follow-through from here)
    // the link is spent; this cast's own contact may open the next one (frame step: the predicted link)
    game.plink = null; y.link = null;
    game.chain = base.chain && !fu ? { id, step: sk.step, at: now } : null;
    const tgtId = tgtV && tgtV !== local ? tgtV.id : tgtV === local ? game.localId : null;
    const hitEnd = (sk.hit?.t || 0) + Math.max(0, (sk.hit?.n || 1) - 1) * (sk.hit?.gap || 0);
    game.lastCast = { id: sk.id, sk, t0: now, at: now + (sk.hit?.t || 0), end: now + hitEnd, lock: fe.win.lock, tgt: tgtId, done: !!sk.from };
    game.pred = { base: id, as: sk.id, at: now };
    game.send({ t: 'cast', skill: id, chain: fu ? fu.L.from : undefined, plain: o.plain || undefined, target: tgtId, gx: ground?.x, gz: ground?.z, hold: sk.draw && o.hold && !fu ? 1 : undefined });
    local.playSkill(clipOf(sk.id, sk.step, sk.formChoreo), tgtV && tgtV !== local ? tgtV : tgtV === local ? local : null, ground, fx);
    if (sk.draw && o.hold && !fu) holdDraw(local, sk); else game.holdKey = null; // (S11: the arrow waits on the string at full draw until the key comes up)
    if (sk.cast) game.casting = { name: sk.name, cast: sk.cast, t0: performance.now() / 1000 };
    moveTo = null;
    qwalk.stop('manual'); // (a skill means a fight, or something you chose to do here)
    // (no sound on the key press: the clip's whoosh lands 0.08-0.12 s before the contact, choreo.js)
  }
  // the fusion B would make now (S2 prediction): the server's link (you.link) or the one predicted from this client's own
  // contact (game.plink), an authored pair, unlocked, not cooling, inside the window with the 0.15 s grace, and its gate
  // as far as the client can see it (a lifted machine is in the air on screen; a staggered one is reeling or kneeling)
  function predictFusion(B, now) {
    const y = game.you, fuse = FUSE[game.cls];
    if (!fuse) return null;
    const opening = (y.buffs || []).some((b) => b.name === 'Opening');
    const seen = (v, st) => (st === 'lifted' ? v?.react?.kind === 'air' : st === 'staggered' ? v?.react?.kind === 'stag' || v?.react?.kind === 'broken' || (v?.stunUntil || 0) > performance.now() : false);
    for (const L of [game.plink, y.link]) {
      if (!L) continue;
      const f = fuse[L.from + '>' + B.id];
      if (!f || !fusionUnlocked(y, f) || (y.cds[f.id] || 0) > now + 0.02 || now > L.until + LINK.grace) continue;
      const tv = f.target === 'enemy' ? (game.target && entities.get(game.target)) || (L.tgt && entities.get(L.tgt)) : null;
      if (f.target === 'enemy' && L.tgt && entities.get(L.tgt)?.dead) continue;
      if (gateOk(f, L, tv, opening, seen)) return { f, L };
    }
    return null;
  }
  // this client's own link (S2): at its own cast's contact frame, a core skill that reached a live machine opens the window
  // here at once (the server's you.link follows a round trip later and wins where they differ)
  function predictLink(now) {
    const c = game.lastCast;
    if (!c || c.done || now < c.at) return;
    c.done = true;
    const sk = c.sk;
    if (!sk || sk.from || (sk.chain && sk.step < sk.steps)) return;
    let landed = sk.target !== 'enemy';
    if (!landed) { const t = c.tgt && entities.get(c.tgt); landed = !!t && !t.dead && t.pos.distanceTo(local.pos) <= (sk.hit?.r || sk.range || 4) + (t.radius || 0.5) + 1.5; }
    if (!landed) return;
    game.plink = { from: sk.id, at: now, until: Math.max(now + LINK.win + (game.you?.web ? (ui.tmods?.linkWin || 0) + (ui.tmods?.linkSk?.[sk.id] || 0) : 0), c.t0 + c.lock + LINK.afterLock), landed: sk.target === 'enemy', done: true, step: sk.step || 0, tgt: c.tgt, parried: false, local: true };
  }

  // ------------------------------------------------------------------ dodge (S1, combat_design.md 2.4)
  // the way you are moving (keys or the stick), flat, or null when nothing is held
  function heldDir() {
    const { fwd, right } = rig.axes(), d = V();
    if (keys.has(keyFor('fwd')) || keys.has('ArrowUp')) d.add(fwd);
    if (keys.has(keyFor('back')) || keys.has('ArrowDown')) d.sub(fwd);
    if (keys.has(keyFor('right')) || keys.has('ArrowRight')) d.add(right);
    if (keys.has(keyFor('left')) || keys.has('ArrowLeft')) d.sub(right);
    const st = touch?.stick;
    if (st && st.mag > 0.12) d.addScaledVector(fwd, -st.y).addScaledVector(right, st.x);
    return d.lengthSq() > 1e-4 ? d.setY(0).normalize() : null;
  }
  // a roll the way you move, or a hop back with nothing held. Charges are kept here as the server keeps them; a press in a
  // skill's wind-up is held to its contact (the buffer)
  function dodge(dir, qUntil) {
    const y = game.you;
    if (!local || local.dead || !y || y.dead || crossing || ramc.driving()) return;
    const now = game.serverTime(), D = y.web ? dodgeWith(game.cls, ui.tmods) : dodgeFor(game.cls); // (the Web's Quick Feet, Momentum, Iron Comet, as the server counts them)
    const c = (game.dodgeC ||= { n: D.charges, next: 0 });
    while (c.n < D.charges && c.next && now >= c.next) { c.n++; c.next = c.n < D.charges ? c.next + D.regen : 0; }
    const legal = Math.max(c.n < 1 ? c.next : 0, local.anim.busy ? (game.cutT || 0) : 0);
    if (legal > now + 0.02) {
      if (legal - now <= BUFFER + 0.05 && (!qUntil || now <= qUntil)) game.qDodge = { dir: dir ? dir.clone() : null, until: qUntil || now + BUFFER };
      else if (!qUntil && c.n < 1) ui.error('No dodge left.');
      return;
    }
    game.qDodge = null;
    c.n--; if (!c.next) c.next = now + D.regen;
    if (y.mounted) { y.mounted = false; local.setMounted(false); }
    game.casting = null; moveTo = null; interactTarget = null; qwalk.stop('manual');
    local.aimRy = null;
    if (D.shieldStep) dir = V(Math.sin(local.ry), 0, Math.cos(local.ry)); // (Oathbound's Shield Step: 2 m forward behind the shield, S5)
    if (D.brace) dir = null; // (S9: the Warden braces where he stands, facing the way he faces)
    if (dir) local.ry = Math.atan2(dir.x, dir.z);
    const back = !dir, w = dir || V(-Math.sin(local.ry), 0, -Math.cos(local.ry));
    // (S10) the Deadeye's Slide with Snap Shot held (its key or the wheel's first button): a shot fired out of the slide
    const tgF = game.target && entities.get(game.target);
    const fire = !!D.slide && !back && !!tgF && !tgF.dead && (keys.has(keyFor('skill1')) || keys.has('Digit1') || !!touch?.held?.(0));
    game.send({ t: 'dodge', dx: +w.x.toFixed(3), dz: +w.z.toFixed(3), fire: fire ? 1 : undefined, target: fire ? game.target : undefined });
    local.playSkill((D.shieldStep ? 'dodges_' : back || D.brace ? 'dodgeb_' : fire ? 'dodgef_' : 'dodge_') + game.cls, fire ? tgF : null, null, fx); // (S9 Brace: in place, both the same clip)
    game.cutT = now + (D.shieldStep || D.brace ? D.block : DODGE.evade); // (skills cut in once the evade is over; the Warden's Brace once its block is)
    game.chain = null; game.lastCast = null; game.plink = { from: 'dodge', at: now, until: now + D.dur + LINK.win + (y.web ? ui.tmods?.linkWin || 0 : 0), landed: true, done: true, step: 0, tgt: null, parried: false, local: true }; // (S2: the dodge is an input)
    game.dodgeAt = now;
  }
  // (a plain { x, z } from a script or the touch layer is made a vector: the buffer clones it)
  game.dodge = (dir) => dodge(dir === 'back' ? null : dir ? (dir.isVector3 ? dir : V(dir.x || 0, 0, dir.z || 0).normalize()) : heldDir());

  // ------------------------------------------------------------------ frame
  let sendT = 0;
  engine.updaters.add((dtRaw) => {
    const ts = fx.timeScale();
    const dt = dtRaw * ts;
    fx.update(dtRaw);
    if (!entered || !local) {
      // login showcase: slow orbit + periodic skill demonstrations
      show.t += dtRaw;
      rig.yawTarget = -0.5 + Math.sin(show.t * 0.15) * 0.5;
      if (show.view) {
        show.view.update(dt, false);
        show.view.pos.copy(show.pos); show.view.target.copy(show.pos);
        show.next -= dtRaw;
        if (show.next <= 0 && !show.view.anim.busy) {
          const list = kitOf(show.cls).filter((s) => !CHOREO[s.id]?.endRoot);
          const sk = list[Math.floor(Math.random() * list.length)];
          show.view.playSkill(sk.id, null, null, fx);
          show.next = 3.2;
        }
      }
      rig.update(dtRaw, show.pos.clone().add(V(0, 0.1, 0)));
      world.update(dtRaw, G.time.value, show.pos);
      ambient.update(dtRaw, show.pos);
      world.grass.userData.setPushers([{ x: show.pos.x, y: show.pos.y, z: show.pos.z, r: 1.2 }]);
      engine.updateShadow(show.pos, 20);
      sfx.voice('menu'); // (VA.1 voice ambience on the login screen)
      return;
    }
    const y = game.you;
    const dead = !!y?.dead;
    // ---- the input buffer (S1): a held skill or dodge press goes off on the first legal frame, or is dropped after 0.3 s
    if (game.qDodge && !dead) { const q = game.qDodge; game.qDodge = null; dodge(q.dir, q.until); }
    if (local && !dead) predictLink(game.serverTime()); // (S2: the link from this client's own contact)
    if (game.qSkill && !dead) { const q = game.qSkill; game.qSkill = null; useSkill(q.id, q.until, q.o); }
    if (game.drawHolds?.size) stepDrawHolds(); // (S11: held draws wait at full draw)
    // the stick flick (phones, option "dodgeFlick", on by default): out past 0.75 of the radius within 0.12 s of the push
    // and let go within 0.3 s dodges that way; an ordinary push to run is held, so it never dodges
    if (touch?.stick && SETTINGS.dodgeFlick !== false && !dead) {
      const st = touch.stick, m = st.mag || 0, fk = (game.flick ||= { t: -1, peak: null });
      if (m > 0.2 && fk.t < 0) { fk.t = 0; fk.peak = null; } else if (fk.t >= 0) fk.t += dtRaw;
      if (fk.t >= 0 && fk.t <= 0.12 && m > 0.75) { const { fwd, right } = rig.axes(); fk.peak = V().addScaledVector(fwd, -st.y).addScaledVector(right, st.x).setY(0).normalize(); }
      if (fk.t >= 0 && m < 0.2) { if (fk.peak && fk.t <= 0.3) dodge(fk.peak); fk.t = -1; fk.peak = null; }
      else if (fk.t > 0.3) fk.peak = null;
    }
    // ---- movement
    const { fwd, right } = rig.axes();
    const dir = V();
    // at the Ram Engine's levers the keys and the stick drive the engine, not the hero (W S forward and back, A D turn)
    const ramDrv = ramc.driving();
    let ramIn = null;
    if (ramDrv) {
      const k = (a, b) => keys.has(keyFor(a)) || keys.has(b), st = touch?.stick, sOn = st && st.mag > 0.12;
      ramIn = document.activeElement?.tagName === 'INPUT' ? { f: 0, t: 0 } : { f: (k('fwd', 'ArrowUp') ? 1 : 0) - (k('back', 'ArrowDown') ? 1 : 0) + (sOn ? -st.y : 0), t: (k('right', 'ArrowRight') ? 1 : 0) - (k('left', 'ArrowLeft') ? 1 : 0) + (sOn ? st.x : 0) };
      game.autoRun = false; moveTo = null; interactTarget = null; if (qwalk.active) qwalk.stop('manual');
    }
    if (!dead && !ramDrv && document.activeElement?.tagName !== 'INPUT') {
      if (keys.has(keyFor('fwd')) || keys.has('ArrowUp')) dir.add(fwd);
      if (keys.has(keyFor('back')) || keys.has('ArrowDown')) dir.sub(fwd);
      if (keys.has(keyFor('right')) || keys.has('ArrowRight')) dir.add(right);
      if (keys.has(keyFor('left')) || keys.has('ArrowLeft')) dir.sub(right);
      if (game.autoRun && !keys.has(keyFor('fwd')) && !keys.has(keyFor('back'))) dir.add(fwd);
      // the touch stick: up on the stick is away from the camera; pulling it back stops auto-run
      const st = touch?.stick;
      if (st && st.mag > 0.12) {
        if (game.autoRun && st.y > 0.35) game.autoRun = false;
        if (game.autoRun) dir.set(0, 0, 0);
        dir.addScaledVector(fwd, -st.y).addScaledVector(right, st.x);
      }
    }
    if (dead) game.autoRun = false;
    // the quest walk ends at any movement of your own: a key, the stick, auto-run, a click on the ground or on something
    if (qwalk.active && (dir.lengthSq() > 0 || moveTo || interactTarget)) qwalk.stop('manual');
    if (dir.lengthSq() > 0) { moveTo = null; interactTarget = null; }
    else if (qwalk.active && !dead) {
      if (!qwalk.steer(local.pos, dir)) dir.set(0, 0, 0);
      // riding: off the runabout at a house door (mounts stay outside), once
      else if (y?.mounted && qwalk.nextIndoors(local.pos) && !(game._qwDis > performance.now())) { game._qwDis = performance.now() + 1500; game.send({ t: 'mount' }); }
    } else if (interactTarget) {
      const tp = interactTarget.node ? interactTarget.node.mesh.position : interactTarget.pos;
      const d = tp.distanceTo(local.pos);
      if (d < (interactTarget.node ? 2.5 : 3.5)) {
        if (interactTarget.node) game.send({ t: 'gather', id: interactTarget.node.id });
        else if (interactTarget.ty === 'n') { game.send({ t: 'npc', id: interactTarget.id }); local.ry = Math.atan2(tp.x - local.pos.x, tp.z - local.pos.z); }
        else if (interactTarget.ty === 'm' && interactTarget.dead) game.send({ t: 'loot', id: interactTarget.id });
        interactTarget = null;
      } else dir.subVectors(tp, local.pos).setY(0);
    } else if (moveTo) {
      dir.subVectors(moveTo, local.pos).setY(0);
      if (dir.length() < 0.25) { moveTo = null; dir.set(0, 0, 0); }
    }
    const ox = local.pos.x, oz = local.pos.z; // where this frame's move started (the world edge slides from here)
    // a full-body one-shot (a skill, a cheer) holds you in place; looping poses (riding, sitting) never do
    const busyFull = local.anim.busy && local.anim.action?.clip?.mask === 'full' && !local.anim.action.clip.loop;
    const casting = game.casting && game.casting.cast > 0;
    let speed = 0;
    if (dir.lengthSq() > 0 && !busyFull && !casting && !dead) {
      dir.normalize();
      const buffSpeed = (y.buffs || []).filter((b) => b.name && /Tea|Vigor|Cloak/.test(b.name)).length ? 1.3 : 1;
      speed = CLASSES[game.cls].speed * buffSpeed * (y.speedMul || 1) * (y.mounted ? mountSpeed(y) : 1);
      if (touch?.stick && touch.stick.mag > 0.12 && touch.stick.mag < 0.55 && !game.autoRun) speed *= 0.45; // a light push walks
      local.pos.addScaledVector(dir, speed * dt);
      const want = Math.atan2(dir.x, dir.z);
      let dr = want - local.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      // an attack that plays over running ('blend') keeps the body on its target; the legs strafe or backpedal
      const blendBusy = local.anim.busy && local.anim.action?.clip?.mask === 'blend';
      if (!blendBusy) local.ry += dr * (1 - Math.exp(-dt * 15.5)); // (exponential: the turn feels the same at a 30 fps cap as at 60)
    } else if (casting && dir.lengthSq() > 0 && game.casting) {
      // moving cancels a cast
    }
    if (local.aimRy != null) {
      // a running attack's aim (see useSkill), while its clip plays; dropped once the clip is over
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      if (!(local.anim.busy && local.anim.action?.clip?.mask === 'blend')) local.aimRy = null;
      else if (local.aimShot) {
        // shots and throws: the hips stay with the run (the travel direction) and the upper body twists up to AIM_TWIST
        // onto the target; only a target further round than that turns the body, by the rest, at the running turn rate
        const base = speed > 0 ? Math.atan2(dir.x, dir.z) : local.ry;
        const want = local.aimRy - Math.max(-AIM_TWIST, Math.min(AIM_TWIST, wrap(local.aimRy - base)));
        local.ry += wrap(want - local.ry) * (1 - Math.exp(-dt * 12)); // (the same pace at 30 fps as at 60)
      } else local.ry += wrap(local.aimRy - local.ry) * (1 - Math.exp(-dt * 20)); // melee: within 2% of the target by the hit
    }
    // the upper-body twist onto the target (anim.js eases it in and out)
    local.anim.aimTwist = local.aimRy != null && local.aimShot ? Math.max(-AIM_TWIST - 0.2, Math.min(AIM_TWIST + 0.2, Math.atan2(Math.sin(local.aimRy - local.ry), Math.cos(local.aimRy - local.ry)))) : 0;
    // skill root motion (dashes, leaps, rolls)
    const travel = local.anim.consumeTravel();
    // (walked in short steps against the walls, buildings and house walls, and stopped where they block, like walking:
    // a push back such as Recoil Jump never ends inside or beyond a wall; shared/sweep.js)
    if (travel) sweepMove(local.pos, Math.sin(local.ry) * travel, Math.cos(local.ry) * travel, 0.45, (q, r) => world.collide(q, r), local.pos.x < 700 ? houseCrosses : null);
    else world.collide(local.pos, 0.45);
    const through = local.anim.busy && local.anim.action?.clip?.through; // (Pierce the Line runs through the line, S5)
    for (const v of entities.views.values()) {
      if (through) break;
      if (v === local || v.dead || v.ty === 'p' || v.root.visible === false) continue; // (story-hidden NPCs are not there yet)
      const rr = (v.radius || 0.5) + 0.45;
      const dx = local.pos.x - v.pos.x, dz = local.pos.z - v.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-5) { const d = Math.sqrt(d2); local.pos.x = v.pos.x + (dx / d) * rr; local.pos.z = v.pos.z + (dz / d) * rr; }
    }
    townsfolk.collide(local.pos, 0.45); // villagers stand firm: the player slides round them
    world.collide(local.pos, 0.45); // and never gets pushed into a wall by one
    ramc.update(dt, local, ramIn); // the Ram Engine's pose, gates and panel; at its levers the hero stands behind its frame
    ramc.collide(local.pos);
    if (ramDrv) { const s2 = ramc.seat(); local.pos.x = s2.x; local.pos.z = s2.z; local.ry = s2.ry; }
    if (local.pos.x < 700 && ox < 700) [local.pos.x, local.pos.z] = clampWorld(local.pos.x, local.pos.z, ox, oz, 5);
    // no riding into a house (the server would put you back): stop at the door and say why, now and then
    if (y?.mounted && local.pos.x < 700 && houseAt(local.pos.x, local.pos.z, false) && !houseAt(ox, oz, false)) {
      local.pos.x = ox; local.pos.z = oz;
      if (performance.now() - (game._mountErrT || -1e9) > 2000) { game._mountErrT = performance.now(); ui.error('Leave your mount outside.'); }
    }
    // jump / gravity
    const gy = heightAt(local.pos.x, local.pos.z);
    if (!onGround) { airV -= 18 * dt; airY += airV * dt; if (airY <= 0) { airY = 0; airV = 0; onGround = true; fx.emit('dust', local.pos.clone().setY(gy + 0.1), { n: 4, size: 0.6 }); } }
    local.pos.y = gy + airY;
    local.speed = speed;
    qwalk.update(dt, local.pos); // (arrival, re-planning, the trail)
    // footsteps: a puff from the stepping foot each stride, by the ground underfoot; ripples when wading
    if (onGround && speed > 1.5 && !local.dead && !game.you?.mounted) {
      game._stepT = (game._stepT || 0) + dt * (speed > 5 ? 3.1 : 2.2);
      if (game._stepT >= 1) {
        game._stepT -= 1; game._stepSide = -(game._stepSide || 1);
        const s = game._stepSide * 0.14, fp = local.pos.clone().add(V(Math.cos(local.ry) * s, 0.05, -Math.sin(local.ry) * s));
        const wl = waterAt(fp.x, fp.z);
        if (wl !== null && wl > gy + 0.03) {
          fp.y = wl + 0.02; fx.ring(fp, '#d8f0f4', 0.55, 0.6); fx.emit('drops', fp, { n: 3 });
        } else {
          const gw = T.groundWeights(fp.x, fp.z);
          const isle = world.area === 'reach', rime = world.area === 'rime' || world.area === 'heights';
          const tide = world.area === 'tidewater'; // (its splat's snow channel carries wet mud)
          const col = tide ? (gw.snow > 0.4 ? '#3e382e' : gw.sand > 0.4 ? '#8a8884' : gw.path > 0.3 || gw.cobble > 0.3 ? '#9a8a70' : gw.foundry > 0.4 ? '#3a3430' : null) : rime ? (gw.sand > 0.5 ? '#8a8c90' : gw.lush > 0.5 ? '#dceaf4' : gw.cobble > 0.5 ? '#c8ccd0' : '#f2f6fa') : isle ? (gw.sand > 0.4 ? '#4a4644' : gw.path > 0.3 || gw.foundry > 0.3 ? '#7c746c' : '#5e5854') : gw.snow > 0.4 ? '#eef2f6' : gw.sand > 0.4 ? '#e2c48e' : gw.path > 0.4 || gw.foundry > 0.4 ? '#a8946e' : null;
          if (col) fx.emit('dust', fp, { n: speed > 5 ? 3 : 2, color: col, size: 0.5, speed: 0.5, alpha: 0.55 });
        }
      }
    }
    if (speed > 0 && local.sitting) { local.sitting = false; local.anim.stop(); }
    local.data = { ...local.data, a: !onGround, t: game.target };
    // ---- network
    sendT += dtRaw;
    if (sendT > 0.1) { sendT = 0; game.send({ t: 'pos', x: +local.pos.x.toFixed(2), y: +local.pos.y.toFixed(2), z: +local.pos.z.toFixed(2), ry: +local.ry.toFixed(3), s: +speed.toFixed(1), air: !onGround }); }
    // ---- world + entities
    entities.update(dt);
    for (const n of game.nodes.values()) if (n.mesh.visible && n.mesh.position.distanceToSquared(local.pos) < 4900) n.mesh.userData.update(dt, G.time.value);
    // click-to-move and walking up to something: the view drifts in behind the hero
    rig.followK = ((moveTo || interactTarget || qwalk.active) && speed > 0) || (ramDrv && Math.abs(ramc.pose.v) > 0.1) ? 0.9 : 0; rig.followYaw = (ramDrv ? ramc.pose.ry : local.ry) + Math.PI;
    rig.update(dtRaw, local.pos);
    // what the mouse is over (desktop): a faint ring and rim, and a hand cursor
    if (!touch && !rig.rightDown) { game._hovT = (game._hovT || 0) + 1; if (game._hovT % 3 === 0) { const hv = pickEntity(); game.hover = hv && hv !== local ? hv : null; canvas.style.cursor = game.hover ? 'pointer' : ''; } }
    else game.hover = null;
    // a target left far behind (a long walk, a teleport) is dropped, and a conversation ends when you walk away
    if (game.target && game.target !== game.localId) { const tv = entities.get(game.target); if (!tv || tv.pos.distanceToSquared(local.pos) > 3600) game.setTarget(null); }
    { const dw = ui.windows.dialog; if (dw?._npc) { if (!dw.isConnected) dw._npc = null; else { const nv = entities.get(dw._npc); if (nv && nv.pos.distanceToSquared(local.pos) > 81) { dw.remove(); dw._npc = null; } } } }
    targetfx.update(dtRaw, game.target ? entities.get(game.target) : null, game.hover, game.you, ui);
    G.playerPos.value.copy(local.pos);
    G.canopy.value.x = world.area === 'weald' && !crossing ? 1 : 0; // (the wood's crowns open round the hero)
    rig.updateFade(local.pos);
    const pushers = [{ x: local.pos.x, y: local.pos.y, z: local.pos.z, r: 1.4 }];
    for (const v of entities.views.values()) { if (pushers.length >= 8) break; if (v !== local && !v.dead && v.pos.distanceToSquared(local.pos) < 900) pushers.push({ x: v.pos.x, y: v.pos.y, z: v.pos.z, r: (v.radius || 0.5) * 2 + 0.8 }); }
    world.grass.userData.setPushers(pushers);
    // a teleport (a jump of over 40 m in a frame): the stutter of arriving says nothing about the place, so dynamic
    // resolution starts that place afresh from the preset's ratio (engine.afterTeleport)
    { const lp = game._lastPos || (game._lastPos = local.pos.clone()); if (lp.distanceToSquared(local.pos) > 1600) engine.afterTeleport?.(); lp.copy(local.pos); }
    const D = world.setIndoor(local.pos);
    const area = D ? 'dungeon' : areaOf(local.pos.x, local.pos.z);
    world.setArea(area);
    engine.setIndoor(D ? D.theme : null);
    if (!D) engine.setOutdoorTheme(area === 'reach' || area === 'rime' || area === 'heights' || area === 'tidewater' || area === 'rainward' || area === 'weald' ? area : 'valley');
    // the Far Vale snow and the Glass Waste salt are near-white ground: raise the bloom threshold there like the Heights
    engine._brightGround = !D && area !== 'heights' && ((local.pos.x < -270 && local.pos.z < -240) || (local.pos.z > 300 && local.pos.x < 140 && local.pos.x > -140));
    // weather follows the shared clock and the ground you stand on (none underground)
    ui.exploreTick(local.pos);
    const wt = window.WEATHER_FORCE || weatherAt(local.pos.x, local.pos.z, game.serverTime());
    // the first few minutes after you log in are always fair (rain, sand and snow fronts build in afterwards)
    // (not in the Rainward Gorge: its rain is the world's, the same for everyone there, and the slips run on it)
    if (!window.WEATHER_FORCE && area !== 'rainward' && area !== 'weald') { const since = (performance.now() - (game._enterAt ||= performance.now())) / 1000, calm = Math.min(1, Math.max(0, (since - 240) / 90)); if (calm < 1) { wt.rain *= calm; wt.sand *= calm; } }
    const wk = Math.min(1, dtRaw * (D ? 4 : 0.35)) + (game._lastArea !== area ? 1 : 0); game._lastArea = area; // a new area: its weather at once
    weather.rain += ((D ? 0 : wt.rain) - weather.rain) * wk; weather.sand += ((D ? 0 : wt.sand) - weather.sand) * wk; weather.snow += ((D ? 0 : wt.snow || 0) - weather.snow) * wk;
    weather.ash = (weather.ash || 0) + ((D ? 0 : wt.ash || 0) - (weather.ash || 0)) * Math.min(1, dtRaw * 2);
    weather.blizzard = (weather.blizzard || 0) + ((D ? 0 : wt.blizzard || 0) - (weather.blizzard || 0)) * wk;
    const night = window.NIGHT_FORCE ?? nightAt(game.serverTime());
    world.night = D ? 0 : night; world.rain = weather.rain; world.sand = weather.sand;
    sfx.voice(voiceContext({ dungeon: !!D, night, x: local.pos.x, z: local.pos.z }), !!local.anim?.combatTarget); // (VA.1 voice ambience)
    // (on the Heights a blizzard is a squall of blown snow: the air closes in white, renderer setWeather's squall)
    const squall = !D && area === 'heights' ? Math.min(1, weather.blizzard * 1.15) : 0;
    // (in the Rainward Gorge a downpour closes the air in grey-green, heavier than the Heights' squall: renderer setWeather's pour)
    const pour = !D && area === 'rainward' ? Math.min(1, (wt.pour ?? weather.rain) * weather.rain * 1.1) : 0;
    engine.setWeather(weather.rain, weather.sand, D ? 0 : night, weather.snow, weather.blizzard, squall, pour);
    // (in the Russet Weald the gale is the world's, on the shared clock: the crowns thrash, the leaves stream, the wind roars)
    const weald = !D && area === 'weald' ? wt.gale || 0 : 0;
    if (weald) G.windStrength.value += 1.5 * weald;
    // (v112) dark glass by day, like the CGTrader shells' windows; the lamps behind the panes come on as dusk deepens
    // (lit 0 until the night value passes 0.12, full by 0.6) up to the same 2.75 glow at night as before
    const glass = getMat('glassWarm'), lit = D ? 1 : Math.min(1, Math.max(0, (night - 0.12) / 0.48)), litS = lit * lit * (3 - 2 * lit);
    glass.emissiveIntensity = D ? 1.35 : 2.75 * litS;
    G.winLit.value = D ? 0 : litS; // (LF.1) the CGTrader shells' window panes and the window glow on the walls below them
    { const C = (game._glassC ||= [glass.color.clone().setHex(0x30363c), glass.color.clone().setHex(0xffc860)]); glass.color.lerpColors(C[0], C[1], litS); }
    rain.userData.set(local.pos, weather.rain, G.windDir.value, pour);
    // the island's ash falls through the snow flakes, grey and slower; the valley's snow stays white
    if (snow.userData.ashKind !== (area === 'reach')) { snow.userData.ashKind = area === 'reach'; snow.userData.setKind(area === 'reach'); }
    // (in a blizzard the flakes drive sideways on a hard wind)
    const gale = !D && area === 'heights' ? 0.6 : 0; // the Heights' wind never drops: the flakes always drive
    { const wsc = 1 + Math.max(weather.blizzard, gale) * 5; game._wv = (game._wv || V2()).set(G.windDir.value.x * wsc, G.windDir.value.y * wsc); }
    snow.userData.set(local.pos, area === 'reach' ? weather.ash : Math.min(1, weather.snow + squall * 0.3), game._wv, 1 + squall * 1.4);
    sfx.loop('rain', weather.rain * 0.35); sfx.loop('wind', Math.max(weather.sand * 0.6, weather.snow * 0.3, weather.blizzard * 0.75, gale * 0.5 + weather.blizzard * 0.3, weald * 0.65));
    // the clouds run fast over the Heights
    if (gale || weald > 0.3) { G.cloudOffset.value.x += dtRaw * 0.0042; G.cloudOffset.value.y += dtRaw * 0.0024; }
    // ambience: water near the stream, falls, mill and fountain; a breeze outdoors; crackle near fires
    if (!D) {
      const px = local.pos.x, pz = local.pos.z;
      let wv = 0, hum = 0;
      if (area === 'reach') {
        // the island: surf on the shore, louder the nearer the sea; a low rumble round the old works where the furnaces still burn
        wv = 0.3 * (1 - Math.min(1, Math.max(0, -reachShore(px, pz)) / 32));
        for (const W of REACH.works) hum = Math.max(hum, 0.2 * (1 - Math.min(1, Math.hypot(px - W.x, pz - W.z) / (W.r * 2.6))));
      } else if (area === 'rime') {
        // the Rime Steps: surf on the shingle, the meltwater running in the channels, the mill wheels' low churn at the works
        wv = 0.26 * (1 - Math.min(1, Math.max(0, -rimeShore(px, pz)) / 30));
        wv = Math.max(wv, 0.24 * (1 - Math.min(1, Math.max(0, rimeChannel(px, pz).d - 2) / 18)));
        for (const W of RIME.works) hum = Math.max(hum, 0.16 * (1 - Math.min(1, Math.hypot(px - W.x, pz - W.z) / (W.r * 2.6))));
      } else if (area === 'tidewater') {
        // Tidewater Sound: the sea along the shore and the Sound, louder nearer the water; the creak of the mill wheels
        wv = 0.26 * (1 - Math.min(1, Math.max(0, tidewaterShoreDist(px, pz)) / 30));
        for (const M of TIDEWATER.mills) hum = Math.max(hum, 0.12 * (1 - Math.min(1, Math.hypot(px - M.x, pz - M.z) / 22)));
      } else if (area === 'rainward') {
        // the Rainward Gorge: the river all along the gorge floor, louder by the falls and when it pours; the lane wheels' creak
        wv = (0.2 + 0.08 * weather.rain) * (1 - Math.min(1, Math.max(0, rainwardRiverDist(px, pz)) / 34));
        for (const F of RAINWARD.falls) wv = Math.max(wv, 0.34 * (1 - Math.min(1, Math.hypot(px - F.x, pz - riverZ(F.x)) / 40)));
        for (const Wh of world.rainwardWheels || []) hum = Math.max(hum, 0.08 * (1 - Math.min(1, Math.hypot(px - Wh.g.position.x, pz - Wh.g.position.z) / 14)));
      } else if (area === 'heights') {
        // the Windward Heights: no water at all, only the wind; a low creak and rumble near any engine that is turning
        for (const E of world.heightsEngines || []) if (E.w > 0.05) hum = Math.max(hum, 0.14 * Math.min(1, E.w) * (1 - Math.min(1, Math.hypot(px - E.x, pz - E.z) / 34)));
      } else {
        if (px > -80 && px < 100 && pz > -30 && pz < 45) wv = Math.max(wv, 0.22 * (1 - Math.min(1, streamInfo(px, pz).d / 16)));
        for (const [wx, wz, r, g] of [[-46.4, 8.7, 22, 0.45], [-66, -8, 22, 0.4], [0, 0, 14, 0.18], [150, -187, 45, 0.5]]) wv = Math.max(wv, g * (1 - Math.min(1, Math.hypot(px - wx, pz - wz) / r)));
      }
      sfx.loop('water', wv); sfx.loop('hum', hum); sfx.loop('breeze', (area === 'reach' ? 0.07 : area === 'rime' ? 0.09 : area === 'heights' ? 0.16 : area === 'tidewater' ? 0.1 : area === 'rainward' ? 0.06 : area === 'weald' ? 0.09 : 0.04) + 0.05 * G.windStrength.value);
      game.fireT = (game.fireT || 0) - dtRaw;
      if (game.fireT <= 0) { game.fireT = 0.35 + Math.random() * 0.6; const near = (world.spots || []).some((s) => s.fire && (s.x - px) ** 2 + (s.z - pz) ** 2 < 100); if (near) sfx.play('fire', 0.35); }
    } else {
      sfx.loop('breeze', 0);
      // the Deepway and the Makers' Hall: running water everywhere, a low hum from the deep wells
      const deep = D.theme === 'deep', furnace = D.theme === 'furnace', sluice = D.theme === 'sluice', dam = D.theme === 'dam', pump = D.theme === 'pump' || D.theme === 'mills' || D.theme === 'seagate' || D.theme === 'adits' || D.theme === 'cutting', shop = D.theme === 'workshop' || D.theme === 'lofts'; // the Makers' Rest: only the engines' hum in the walls // the Pump Works: dripping water and the hum of the engines // the casting hall: a low roar from the furnace and bellows; the sluices: running water and the turbines' hum; the Great Dam: heavier water and a deep hum from the lake behind it
      sfx.loop('water', deep ? 0.1 : sluice ? 0.16 : dam ? 0.2 : pump ? 0.12 : 0); sfx.loop('hum', deep ? 0.22 : furnace ? 0.24 : sluice ? 0.12 : dam ? 0.16 : pump ? 0.18 : shop ? 0.14 : 0);
      // nearby automata at work: brush drums swishing, counterweight chains clinking
      game.machT = (game.machT || 0) - dtRaw;
      if (deep && game.machT <= 0) {
        game.machT = 0.45 + Math.random() * 0.5;
        let bd = 1e9, kind = null;
        for (const e of entities.views.values()) { if (e.ty !== 'm' || e.dead) continue; const k = e.data.k || ''; if (!/sweeper|oldbrush|cwengine|weight|firstengine|masterpattern/.test(k)) continue; const d = (e.pos.x - local.pos.x) ** 2 + (e.pos.z - local.pos.z) ** 2; if (d < bd) { bd = d; kind = k; } }
        if (kind && bd < 18 * 18) sfx.play(/sweeper|oldbrush/.test(kind) ? 'brush' : 'chain', 1 - Math.sqrt(bd) / 18);
      }
    }
    world.update(dtRaw, G.time.value, local.pos);
    engine.setHouseLight(world.house ? 1 : 0); // a warmer, brighter fill while you stand in a house (eased in the engine)
    ambient.update(dtRaw, local.pos, D ? D.theme : null, weather);
    townsfolk.update(dt, local.pos, engine.camera, world.night);
    qobjects.update(dt, G.time.value, local.pos);
    engine.updateShadow(rig.focus, Math.min(80, Math.max(16, rig.dist * 1.25)));
    // story-timed NPCs (npcSeen): only there for the part of the story that needs them
    if (game.you) for (const v of entities.views.values()) if (v.ty === 'n' && v.npc && (v.npc.seenFrom || v.npc.seenUntil)) v.root.visible = npcSeen(v.npc, game.you.done);
    game.nearInteract = local.dead ? null : findInteract();
    ui.setPrompt(game.nearInteract);
    ui.update(dtRaw, engine.camera);
    // footsteps
    if (speed > 0 && onGround && !y.mounted) { game.stepT = (game.stepT || 0) + dt * speed * 0.42; if (game.stepT > 1) { game.stepT = 0; sfx.play('step'); } }
    sfx.loop('engine', y.mounted ? 0.06 + Math.min(1, speed / 10) * 0.12 : 0);
    if (crossing) updateCrossing(dtRaw);
  });

  // ------------------------------------------------------------------ the crossing: fade, the steam ship at sea, fade, arrival
  // (the server has already moved you; this is only the picture in between). Any key skips to the arrival.
  const GANGWAYS = [{ x: 444, z: 80.6, npc: 'n_hm_haroun', label: 'Board the ship to the Cinder Reach' }];
  const CROSS = { inA: 0.6, inB: 1.5, out: 6.2, back: 7.0, end: 7.9 };
  let crossing = null, crossShip = null;
  function crossOverlay() {
    let f = document.querySelector('.cross-fade');
    if (!f) { f = document.createElement('div'); f.className = 'cross-fade'; Object.assign(f.style, { position: 'fixed', inset: '0', background: '#000', pointerEvents: 'none', zIndex: 60, opacity: '0' }); document.body.appendChild(f); }
    return f;
  }
  // each crossing: where the ship is seen at sea (in the area you arrive in), the way it steams (f), the side the camera
  // hangs off (side), and the line under the picture
  const ROUTES = {
    'valley>reach': { start: [REACH.minX - 150, -1196], f: [1, 0], side: [0, 1], say: 'The ship steams out past the harbour wall and east over the open sea. Hours later the black beaches of the Cinder Reach come up out of the haze.' },
    'reach>valley': { start: [560, 74], f: [-1, 0], side: [0, 1], say: 'The ship turns west, and the smoke of the Cinder Reach sinks into the sea behind you. Harrowmouth harbour wall comes up out of the evening.' },
    'reach>rime': { start: [338, -1560], f: [0, -1], side: [-1, 0], say: 'The ship steams north along the cold coast, the armoured bow shouldering through the first floes. On the second morning the white walls of the Rime Steps close round a grey shingle bay.' },
    'rime>reach': { start: [334, -1316], f: [0, 1], side: [-1, 0], say: 'The ship pushes south out of the ice and down the coast. The cold falls away behind you, and the smoke of the Cinder Reach rises out of the sea.' },
    'rime>valley': { start: [560, 74], f: [-1, 0], side: [0, 1], say: 'The ship runs south past the Cinder Reach and west over the open sea. Days later Harrowmouth harbour wall comes up out of the evening.' },
    // Tidewater Sound (Chapter 41): in from the open sea to the east, heading west up the Sound towards the Sea Gate's open bay
    'rime>tidewater': { start: [722, -2549], f: [-1, 0], side: [0, -1], say: 'The ship steams south-west round the cold cape, the floes thinning to grey water. At dusk a sound opens in the cliffs, and across its mouth stands a great gate of the Makers, one bay hanging open.' },
    'tidewater>rime': { start: [338, -1560], f: [0, -1], side: [-1, 0], say: 'The ship runs out of the Sound on the ebb and back round the cold cape. On the second morning the white walls of the Rime Steps close round the grey shingle bay.' },
    'tidewater>valley': { start: [560, 74], f: [-1, 0], side: [0, 1], say: 'The ship runs out of the Sound, round the cold cape and south past the Rime Steps and the Cinder Reach. Days later Harrowmouth harbour wall comes up out of the evening.' },
  };
  const ARRIVE = { reach: ['The Cinder Reach', 'Level 40-45'], rime: ['The Rime Steps', 'Level 45-50'], valley: ['Harrowmouth', 'Level 28-30'], heights: ['The Windward Heights', 'Level 50-55'], rimelift: ['The Dam Crown', 'The Rime Steps'], tidewater: ['Tidewater Sound', 'Level 55-60'], rainward: ['The Rainward Gorge', 'Level 60-65'], weald: ['The Russet Weald', 'Level 65-70'], tidemills: ['The Tide Mills', 'Tidewater Sound'], slip: ['The Slip', 'The Rainward Gorge'] };
  const dockShips = () => [world.reachShip, world.rimeShip, world.tidewaterShip].filter(Boolean);
  function startCrossing(to, from) {
    if (crossing) endCrossing();
    const f = crossOverlay(); f.style.transition = 'none'; f.style.opacity = '1';
    if (!crossShip) { crossShip = buildSteamship({ iceBow: true }); crossShip.name = 'crossShip'; }
    crossShip.userData.iceBow.visible = to === 'rime' || from === 'rime' || to === 'tidewater' || from === 'tidewater' || !!game.you?.done?.m_c33_refit;
    const R = ROUTES[`${from}>${to}`] || ROUTES[to === 'valley' ? 'reach>valley' : to === 'rime' ? 'reach>rime' : to === 'tidewater' ? 'rime>tidewater' : 'valley>reach'];
    // (in the Sound the ship rides on the tide, like the one at the quay)
    const start = V(R.start[0], to === 'tidewater' ? tideLevel() : 0, R.start[1]), fw = V(R.f[0], 0, R.f[1]), side = V(R.side[0], 0, R.side[1]);
    crossShip.position.copy(start); crossShip.rotation.y = Math.atan2(fw.x, fw.z); crossShip.visible = true;
    engine.scene.add(crossShip);
    // the ship at the far pier is the one at sea: hidden until you are back on the shore
    if (world.reachShip) world.reachShip.visible = to !== 'reach';
    if (world.rimeShip) world.rimeShip.visible = to !== 'rime';
    if (world.tidewaterShip) world.tidewaterShip.visible = to !== 'tidewater';
    const cap = document.createElement('div');
    cap.className = 'scene-bars';
    cap.innerHTML = `<div class="sb-top"></div><div class="sb-bot"><div class="sb-line">${R.say}</div><div class="sb-skip">Press any key to skip</div></div>`;
    cap.style.zIndex = 61;
    document.body.appendChild(cap);
    ui.root.classList.add('in-scene');
    crossing = { to, t: 0, fw, side, start, cap, shown: false, back: false };
    sfx.play('puff', 0.6);
  }
  function updateCrossing(dt) {
    if (crossing.rope) { updateRope(dt); return; }
    if (crossing.haul) { updateHaul(dt); return; }
    if (crossing.lift) { updateLift(dt); return; }
    const C = crossing, f = crossOverlay();
    C.t += dt;
    if (C.t >= CROSS.back && !C.back) {
      // the camera comes back to you on the far shore while the screen is dark
      C.back = true; crossShip.visible = false; engine.scene.remove(crossShip);
      for (const sh of dockShips()) sh.visible = true;
      C.cap.classList.remove('on', 'say'); setTimeout(() => C.cap.remove(), 700);
      ui.root.classList.remove('in-scene');
      f.style.transition = 'opacity 0.9s ease-out'; f.style.opacity = '0';
      if (game.you?.name) ui.zoneBanner(...(ARRIVE[C.to] || ARRIVE.valley));
    }
    if (C.t >= CROSS.end) { crossing = null; return; }
    if (C.back) return;
    if (C.t >= CROSS.inA && !C.shown) { C.shown = true; f.style.transition = `opacity ${CROSS.inB - CROSS.inA}s ease-in-out`; f.style.opacity = '0'; C.cap.classList.add('on'); setTimeout(() => C.cap?.classList.add('say'), 500); }
    if (C.t >= CROSS.out && !C.fading) { C.fading = true; f.style.transition = `opacity ${CROSS.back - CROSS.out - 0.1}s ease-in`; f.style.opacity = '1'; }
    // the ship steams on at a slow cruise; the camera hangs off its bow quarter and drifts aft along the hull
    const k = C.t / CROSS.back, sp = crossShip.position;
    sp.copy(C.start).addScaledVector(C.fw, 5.2 * C.t);
    crossShip.userData.update?.(dt, G.time.value);
    const ang = 0.95 - k * 0.75, dist = 44 - k * 6;
    const cam = engine.camera;
    cam.position.set(sp.x + (C.fw.x * Math.cos(ang) + C.side.x * Math.sin(ang)) * dist, 9.5 + k * 2.5, sp.z + (C.fw.z * Math.cos(ang) + C.side.z * Math.sin(ang)) * dist);
    cam.lookAt(sp.x + C.fw.x * 2, 5.5, sp.z + C.fw.z * 2);
    G.fadeOn.value = 0;
    engine.updateShadow(sp, 34);
  }
  function endCrossing() {
    if (!crossing) return;
    if (crossing.rope) { endRope(); return; }
    if (crossing.haul) { endHaul(); return; }
    if (crossing.lift) { endLift(); return; }
    crossing.cap?.remove(); crossShip.visible = false; engine.scene.remove(crossShip);
    for (const sh of dockShips()) sh.visible = true;
    ui.root.classList.remove('in-scene');
    const f = crossOverlay(); f.style.transition = 'none'; f.style.opacity = '0';
    crossing = null;
  }
  // ------------------------------------------------------------------ the lift: fade, a short shot of the cage on the cliff, fade
  // Up (to the Heights): the cage climbs out of the cloud to the landing deck while the counterweight drops past it. Down (to
  // the Dam Crown): the cage comes down the tall headframe by the dam's north tower and settles at its foot. The server has
  // already moved you; you are hidden while the cage is the picture. Any key skips to the arrival.
  const LIFT = { inA: 0.5, inB: 1.3, out: 5.0, back: 5.8, end: 6.6 };
  // where the cage starts (off: metres from its rest), where the camera stands (and how far it rises), per end
  const LIFT_SHOT = {
    heights: { rig: 'heights', from: -24, cam: [383, 60.5, -2083], up: 1.8 },
    rimelift: { rig: 'rime', from: 15, cam: [626, 45.5, -1703], up: 1.2 },
  };
  function startLift(to) {
    if (crossing) endCrossing();
    const f = crossOverlay(); f.style.transition = 'none'; f.style.opacity = '1';
    const S = LIFT_SHOT[to] || LIFT_SHOT.heights, rig = world.liftRigs?.[S.rig];
    const cap = document.createElement('div');
    cap.className = 'scene-bars';
    const say = to === 'rimelift' ? 'The cage drops off the edge of the Heights and down through the cloud. The wind falls away, and the cold blue of the Rime Steps closes round you.' : 'The counterweight drops past you into the cloud and the cage climbs the cliff, up through the white and out into the wind and the sun.';
    cap.innerHTML = `<div class="sb-top"></div><div class="sb-bot"><div class="sb-line">${say}</div><div class="sb-skip">Press any key to skip</div></div>`;
    cap.style.zIndex = 61;
    document.body.appendChild(cap);
    ui.root.classList.add('in-scene');
    crossing = { lift: true, to, t: 0, S, rig, cap, shown: false, back: false, chainT: 0 };
    rig?.userData.set(S.from);
    sfx.play('chain', 0.7);
  }
  function updateLift(dt) {
    const C = crossing, f = crossOverlay();
    C.t += dt;
    if (local?.root) local.root.visible = C.back;
    if (C.t >= LIFT.back && !C.back) {
      C.back = true; C.rig?.userData.set(0);
      if (local?.root) local.root.visible = true;
      C.cap.classList.remove('on', 'say'); setTimeout(() => C.cap.remove(), 700);
      ui.root.classList.remove('in-scene');
      f.style.transition = 'opacity 0.9s ease-out'; f.style.opacity = '0';
      if (game.you?.name) ui.zoneBanner(...(ARRIVE[C.to] || ARRIVE.heights));
    }
    if (C.t >= LIFT.end) { crossing = null; return; }
    if (C.back) return;
    if (C.t >= LIFT.inA && !C.shown) { C.shown = true; f.style.transition = `opacity ${LIFT.inB - LIFT.inA}s ease-in-out`; f.style.opacity = '0'; C.cap.classList.add('on'); setTimeout(() => C.cap?.classList.add('say'), 500); }
    if (C.t >= LIFT.out && !C.fading) { C.fading = true; f.style.transition = `opacity ${LIFT.back - LIFT.out - 0.1}s ease-in`; f.style.opacity = '1'; }
    // the cage runs to its rest over the shot (steady, then easing into the stop); the rope clinks on the drum
    const k = Math.min(1, Math.max(0, (C.t - 0.3) / (LIFT.out - 0.1)));
    const run = k < 0.8 ? (k / 0.8) * 0.9 : 0.9 + (1 - Math.pow(1 - (k - 0.8) / 0.2, 2)) * 0.1;
    C.rig?.userData.set(C.S.from * (1 - run));
    C.chainT -= dt; if (C.chainT <= 0) { C.chainT = 0.38 + Math.random() * 0.2; sfx.play('chain', 0.5); }
    const cam = engine.camera, cp = C.rig ? C.rig.userData.cagePos() : V(C.S.cam[0], 50, C.S.cam[2] - 10);
    cam.position.set(C.S.cam[0], C.S.cam[1] + k * C.S.up, C.S.cam[2]);
    cam.lookAt(cp.x, cp.y + 1.6, cp.z);
    G.fadeOn.value = 0;
    engine.updateShadow(cp, 30);
  }
  function endLift() {
    const C = crossing;
    C.cap?.remove(); C.rig?.userData.set(0);
    if (local?.root) local.root.visible = true;
    ui.root.classList.remove('in-scene');
    const f = crossOverlay(); f.style.transition = 'none'; f.style.opacity = '0';
    crossing = null;
  }
  // ------------------------------------------------------------------ the haul road (Chapter 45): fade, the haulier pulling its
  // wagon the last stretch of the road, fade. Up (to the Rainward Gorge): along the haul road in the rain onto the stand at the
  // road head. Down (to the Tide Mills): onto its stand between the mills, its front to the hills again (the quest object
  // there hides while the train is the picture). The server has already moved you; you ride the wagon, so you are hidden.
  const HAUL = { inA: 0.5, inB: 1.3, out: 5.6, back: 6.4, end: 7.2 };
  const HAUL_SHOT = {
    rainward: { from: [385, -2960.2], to: [398, -2962.2], cam: [383, 7.5, -2968],  say: 'The haulier pulls the empty wagon north out of the Tide Mills and up the river into the hills. Rain closes in, the walls of a deep green gorge rise on either side, and at dusk the road ends at a stand under dripping rock.' },
    tidemills: { from: [557, -2590], to: [557, -2600], cam: [546, 9.5, -2588], say: 'The haulier lets the wagon down the haul road out of the gorge, the brake hissing on every steep stretch, out of the rain and along the river to its stand between the Tide Mills.' },
  };
  let haulTrain = null;
  function startHaul(to) {
    if (crossing) endCrossing();
    const f = crossOverlay(); f.style.transition = 'none'; f.style.opacity = '1';
    const S = HAUL_SHOT[to] || HAUL_SHOT.rainward;
    if (haulTrain) engine.scene.remove(haulTrain);
    haulTrain = buildHaulTrain({ wound: true, load: to === 'tidemills' ? 14 : 0, seed: 1720 });
    const dx = S.to[0] - S.from[0], dz = S.to[1] - S.from[1];
    haulTrain.rotation.y = Math.atan2(dx, dz);
    engine.scene.add(haulTrain);
    const stand = to === 'tidemills' ? qobjects.list.find((o) => o.kind === 'twhaul') : null;
    if (stand) stand.root.visible = false;
    const cap = document.createElement('div');
    cap.className = 'scene-bars';
    cap.innerHTML = `<div class="sb-top"></div><div class="sb-bot"><div class="sb-line">${S.say}</div><div class="sb-skip">Press any key to skip</div></div>`;
    cap.style.zIndex = 61;
    document.body.appendChild(cap);
    ui.root.classList.add('in-scene');
    crossing = { haul: true, to, t: 0, S, cap, stand, shown: false, back: false, len: Math.hypot(dx, dz) };
    sfx.play('chain', 0.6);
  }
  function updateHaul(dt) {
    const C = crossing, f = crossOverlay();
    C.t += dt;
    if (local?.root) local.root.visible = C.back;
    if (C.t >= HAUL.back && !C.back) {
      C.back = true;
      if (local?.root) local.root.visible = true;
      if (haulTrain) { engine.scene.remove(haulTrain); haulTrain = null; }
      if (C.stand) C.stand.root.visible = true;
      C.cap.classList.remove('on', 'say'); setTimeout(() => C.cap.remove(), 700);
      ui.root.classList.remove('in-scene');
      f.style.transition = 'opacity 0.9s ease-out'; f.style.opacity = '0';
      if (game.you?.name) ui.zoneBanner(...(ARRIVE[C.to] || ARRIVE.rainward));
    }
    if (C.t >= HAUL.end) { crossing = null; return; }
    if (C.back || !haulTrain) return;
    if (C.t >= HAUL.inA && !C.shown) { C.shown = true; f.style.transition = `opacity ${HAUL.inB - HAUL.inA}s ease-in-out`; f.style.opacity = '0'; C.cap.classList.add('on'); setTimeout(() => C.cap?.classList.add('say'), 500); }
    if (C.t >= HAUL.out && !C.fading) { C.fading = true; f.style.transition = `opacity ${HAUL.back - HAUL.out - 0.1}s ease-in`; f.style.opacity = '1'; }
    // the train rolls steadily and eases onto its stand; the camera stands off the road and watches it come in
    const k = Math.min(1, Math.max(0, C.t / (HAUL.out - 0.2))), run = k < 0.75 ? k / 0.75 * 0.85 : 0.85 + (1 - Math.pow(1 - (k - 0.75) / 0.25, 2)) * 0.15;
    const x = C.S.from[0] + (C.S.to[0] - C.S.from[0]) * run, z = C.S.from[1] + (C.S.to[1] - C.S.from[1]) * run, y = heightAt(x, z);
    haulTrain.position.set(x, y, z);
    const speed = k < 0.75 ? C.len * 0.85 / ((HAUL.out - 0.2) * 0.75) : C.len * 0.3 * (1 - (k - 0.75) / 0.25) / ((HAUL.out - 0.2) * 0.25);
    haulTrain.userData.update(dt, G.time.value, speed);
    const cam = engine.camera;
    cam.position.set(C.S.cam[0], heightAt(C.S.cam[0], C.S.cam[2]) + C.S.cam[1] * 0.6, C.S.cam[2]);
    cam.lookAt(x, y + 1.4, z);
    G.fadeOn.value = 0;
    engine.updateShadow(haulTrain.position, 30);
  }
  function endHaul() {
    const C = crossing;
    C.cap?.remove();
    if (haulTrain) { engine.scene.remove(haulTrain); haulTrain = null; }
    if (C.stand) C.stand.root.visible = true;
    if (local?.root) local.root.visible = true;
    ui.root.classList.remove('in-scene');
    const f = crossOverlay(); f.style.transition = 'none'; f.style.opacity = '0';
    crossing = null;
  }
  // ------------------------------------------------------------------ the ropeway (Chapter 49): fade, the car coming down the
  // last stretch of the rope to its station, fade. Over the ridge (to the Russet Weald): down the east rope off the bank onto
  // the lower station, beside the car parked on the west rope. Back (to the Slip): down off the cliff into the upper station
  // on the west rope, beside the old car on the east rope. Halfway the car stops on a sheave and sways, then goes on. The
  // server has already moved you; you ride the car, so you are hidden. Any key skips to the arrival.
  const ROPE_SHOT = {
    weald: { rope: () => world.wealdRope, side: 1, stop: 5.6, from: 2, cam: [16, 7, -6], say: 'The car climbs the rope over the head of the Slip and into the cloud. Over the ridge the rain falls away, and the rope runs down over a dry wood in autumn, copper and gold leaf on grey trunks. Halfway down a sheave seizes and the car hangs, swaying, until the crew free it.' },
    slip: { rope: () => world.slipRope, side: -1, stop: -5.8, from: 2, cam: [-8, 5, 14], say: 'The car climbs out of the wood and over the ridge, and drops down the cliff through the cloud and the rain to the station at the head of the Slip.' },
  };
  let ropeCar = null;
  const ropeYAt = (run, z) => { for (let i = 0; i < run.length - 1; i++) { const [z0, y0] = run[i], [z1, y1] = run[i + 1]; if ((z - z0) * (z - z1) <= 0) return y0 + (y1 - y0) * ((z - z0) / (z1 - z0 || 1)); } return run[run.length - 1][1]; };
  function startRope(to) {
    if (crossing) endCrossing();
    const f = crossOverlay(); f.style.transition = 'none'; f.style.opacity = '1';
    const S = ROPE_SHOT[to] || ROPE_SHOT.weald, R = S.rope();
    if (ropeCar) engine.scene.remove(ropeCar);
    ropeCar = ropeCarMesh(2591);
    if (R) engine.scene.add(ropeCar);
    const cap = document.createElement('div');
    cap.className = 'scene-bars';
    cap.innerHTML = `<div class="sb-top"></div><div class="sb-bot"><div class="sb-line">${S.say}</div><div class="sb-skip">Press any key to skip</div></div>`;
    cap.style.zIndex = 61;
    document.body.appendChild(cap);
    ui.root.classList.add('in-scene');
    // (the car runs from a point on the rope's run, between its second tower and the next, to its stop by the station)
    const z0 = R ? (R.run[S.from][0] + R.run[S.from + 1][0]) / 2 : 0, z1 = R ? R.run[0][0] + S.stop : 0;
    crossing = { haul: true, rope: true, to, t: 0, S, R, z0, z1, cap, shown: false, back: false };
    sfx.play('chain', 0.6);
  }
  function updateRope(dt) {
    const C = crossing, f = crossOverlay();
    C.t += dt;
    if (local?.root) local.root.visible = C.back;
    if (C.t >= HAUL.back && !C.back) {
      C.back = true;
      if (local?.root) local.root.visible = true;
      if (ropeCar) { engine.scene.remove(ropeCar); ropeCar = null; }
      C.cap.classList.remove('on', 'say'); setTimeout(() => C.cap.remove(), 700);
      ui.root.classList.remove('in-scene');
      f.style.transition = 'opacity 0.9s ease-out'; f.style.opacity = '0';
      if (game.you?.name) ui.zoneBanner(...(ARRIVE[C.to] || ARRIVE.weald));
    }
    if (C.t >= HAUL.end) { crossing = null; return; }
    if (C.back || !ropeCar || !C.R) return;
    if (C.t >= HAUL.inA && !C.shown) { C.shown = true; f.style.transition = `opacity ${HAUL.inB - HAUL.inA}s ease-in-out`; f.style.opacity = '0'; C.cap.classList.add('on'); setTimeout(() => C.cap?.classList.add('say'), 500); }
    if (C.t >= HAUL.out && !C.fading) { C.fading = true; f.style.transition = `opacity ${HAUL.back - HAUL.out - 0.1}s ease-in`; f.style.opacity = '1'; }
    // steady down the rope, a stop on the seized sheave (the car swaying on its hanger), then on and easing into the station
    const k = Math.min(1, Math.max(0, C.t / (HAUL.out - 0.2)));
    const run = k < 0.35 ? (k / 0.35) * 0.45 : k < 0.55 ? 0.45 : 0.45 + (1 - Math.pow(1 - (k - 0.55) / 0.45, 2)) * 0.55;
    const z = C.z0 + (C.z1 - C.z0) * run, x = C.R.x + C.S.side * C.R.gauge / 2, y = ropeYAt(C.R.run, z) - CAR_HANG - 0.1;
    const sway = k > 0.35 && k < 0.7 ? Math.sin((k - 0.35) * 40) * 0.07 * (1 - (k - 0.35) / 0.35) : 0;
    ropeCar.position.set(x, y, z); ropeCar.rotation.set(sway, 0, 0);
    if (k > 0.35 && k < 0.36 && !C.stopped) { C.stopped = true; sfx.play('clang', 0.5); }
    const cam = engine.camera, cx = x + C.S.cam[0], cz = C.z1 + C.S.cam[2];
    cam.position.set(cx, heightAt(cx, cz) + C.S.cam[1] + (1 - run) * 6, cz);
    cam.lookAt(x, y + 1.2, z);
    G.fadeOn.value = 0;
    engine.updateShadow(ropeCar.position, 30);
  }
  function endRope() {
    const C = crossing;
    C.cap?.remove();
    if (ropeCar) { engine.scene.remove(ropeCar); ropeCar = null; }
    if (local?.root) local.root.visible = true;
    ui.root.classList.remove('in-scene');
    const f = crossOverlay(); f.style.transition = 'none'; f.style.opacity = '0';
    crossing = null;
  }
  game.crossing = () => crossing; // for the off-screen checks
  engine.start((frame) => frame());
}
