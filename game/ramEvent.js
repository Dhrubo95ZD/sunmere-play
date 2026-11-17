// The Ram Engine on the client (LF.6, shared/ramEngine.js): draws the engine where ev 'ram' puts it (eased between the
// tally's ten updates a second), its wheels, tracks, ram stroke and stack smoke, the gates' cracks and fall, what each hero
// carries from the piles, and the hero at the levers. It offers the walk-up actions (F, or the phone's Interact button):
// take or leave the levers, pick up a ram weight or a sack of coal, load it, repair the frame; and a small panel with the
// same buttons and, at the levers, Forward, Back, Turn and Strike (held buttons for the mouse and the phone; the keys W S
// A D and Space and the phone's stick work too). The server decides everything: this only sends { t: 'ram', op }.
import * as THREE from 'three';
import { RAM, ramLever, ramEdgeDist } from '/sunmere-play/shared/ramEngine.js';
import { buildCarried } from '../assets/ramEngine.js';
import { setRamGates } from './ramLayout.js';
import { IS_TOUCH } from '../engine/platform.js';

const fw = (ry) => [Math.sin(ry), Math.cos(ry)];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createRamEvent({ game, world, ui, fx, sfx, entities, rig }) {
  const P = RAM.park;
  const eng = world.ramEngine; // (built with the world, before its static parts are frozen: ramLayout.js)
  const H = (x, z) => world.terrain.height(x, z);
  const pose = { x: P.x, z: P.z, ry: P.ry, v: 0 };
  let S = null, at = 0, seq = null, gates = RAM.gates.map((g) => g.hp), sendT = 0, lastIn = { f: 0, t: 0 }, hold = { f: 0, t: 0 };
  const carried = new Map();
  const place = () => {
    eng.position.set(pose.x, 0, pose.z);
    // sit on the ground under the frame (the average of the four corners), pitched and rolled with it
    const [fx2, fz2] = fw(pose.ry), rx = fz2, rz = -fx2, L = RAM.engine.halfL * 0.8, W2 = RAM.engine.halfW * 0.8;
    const hf = H(pose.x + fx2 * L, pose.z + fz2 * L), hb = H(pose.x - fx2 * L, pose.z - fz2 * L), hr = H(pose.x + rx * W2, pose.z + rz * W2), hl = H(pose.x - rx * W2, pose.z - rz * W2);
    eng.position.y = (hf + hb + hr + hl) / 4;
    eng.rotation.set(0, 0, 0);
    eng.rotateY(pose.ry);
    eng.rotateX(-Math.atan2(hf - hb, 2 * L));
    eng.rotateZ(Math.atan2(hr - hl, 2 * W2));
  };
  place();
  setRamGates(world, gates);

  // ---- the panel (a small box at the left; on phones a touch panel with big buttons)
  const panel = document.createElement('div');
  panel.className = 'ram-panel hidden';
  panel.innerHTML = `<div class="rp-h">The Ram Engine <span class="rp-t"></span></div>
    <div class="rp-bar rp-hp"><i></i><span></span></div><div class="rp-bar rp-st"><i></i><span></span></div>
    <div class="rp-w"></div><div class="rp-s"></div>
    <div class="rp-drive"><button data-h="t-1">Turn left</button><button data-h="f1">Forward</button><button data-h="t1">Turn right</button><button data-h="f-1">Back</button><button class="rp-strike" data-op="strike">Strike</button></div>
    <div class="rp-acts"></div>${IS_TOUCH ? '' : '<div class="rp-keys">At the levers: W S drive, A D turn, Space strikes, F steps down</div>'}`;
  const $p = (s) => panel.querySelector(s);
  const stop = (e) => { e.stopPropagation(); };
  panel.addEventListener('pointerdown', stop); panel.addEventListener('click', stop);
  for (const b of panel.querySelectorAll('[data-h]')) {
    const [k, v] = [b.dataset.h[0], Number(b.dataset.h.slice(1))];
    const on = (e) => { e.preventDefault(); hold[k] = v; b.classList.add('on'); };
    const off = () => { if (hold[k] === v) hold[k] = 0; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  }
  panel.addEventListener('click', (e) => { const b = e.target.closest('[data-op]'); if (b) act(b.dataset.op, b.dataset.pile); });

  const me = () => game.localId;
  const driving = () => !!(S && S.on && S.dr && S.dr === me());
  function act(op, pile) {
    if (op === 'pick') game.send({ t: 'ram', op, pile });
    else game.send({ t: 'ram', op });
    sfx?.play('ui');
  }
  // the walk-up action at hand (F): nearest first
  function interact(pos) {
    if (!S?.on) return null;
    if (driving()) return { ram: 'leave', label: 'Step down from the levers', d: 0 };
    const E = { x: pose.x, z: pose.z, ry: pose.ry }, lv = ramLever(E), dl = Math.hypot(pos.x - lv.x, pos.z - lv.z), de = ramEdgeDist(E, pos.x, pos.z);
    const carry = S.ca;
    if (carry && de < RAM.engine.hand - 0.3) return { ram: 'load', label: carry === 1 ? 'Load the ram weight' : 'Feed the coal into the firebox', d: de };
    if (!carry) {
      let best = null;
      for (const Pl of RAM.piles) { const d = Math.hypot(pos.x - Pl.x, pos.z - Pl.z); if (d < 2.8 && (!best || d < best.d)) best = { ram: 'pick', pile: Pl.id, label: Pl.kind === 'weight' ? 'Pick up a ram weight' : 'Pick up a sack of steam coal', d }; }
      if (best) return best;
      if (dl < 2.6 && (!S.dr || S.db)) return { ram: 'drive', label: 'Take the Ram Engine’s levers', d: dl };
      if (de < RAM.engine.hand - 0.3 && S.hp < S.mh) return { ram: 'repair', label: 'Repair the Ram Engine', d: de };
    }
    return null;
  }

  function onEv(ev) {
    const was = S;
    S = ev; at = performance.now();
    // a new run (or the first word of one): the banner card
    if (ev.on && !was?.on) ui.ramStart?.();
    if (seq != null && ev.sq !== seq) strike();
    seq = ev.sq;
    // a gate's blow: dust and chips off it (the ram's own blow lands on it the same frame)
    for (let i = 0; i < ev.g.length; i++) if (ev.g[i] < gates[i]) { const G = RAM.gates[i], p = new THREE.Vector3(G.x, H(G.x, G.z) + 2, G.z - 0.3); fx.emit('dust', p, { n: 18, size: 1.4, color: '#b8ad98' }); fx.emit('shards', p, { n: 16, color: '#7a6248' }); if (ev.g[i] <= 0) { fx.emit('dust', p.setY(p.y - 1), { n: 30, size: 2.2, color: '#b8ad98' }); sfx?.play('thud'); } }
    if (ev.g.some((h, i) => h > gates[i])) setRamGates(world, ev.g); // (walled up again: at once)
    gates = ev.g.slice();
    if (!ev.on && ev.end) { hold = { f: 0, t: 0 }; }
    // what everyone near is carrying
    const want = new Map((ev.cr || []).map(([id, k]) => [id, k === 1 ? 'weight' : 'coal']));
    for (const [id, c] of carried) if (want.get(id) !== c.kind || c.mesh.parent !== entities.get(id)?.root) { c.mesh.parent?.remove(c.mesh); carried.delete(id); }
    for (const [id, kind] of want) if (!carried.has(id)) { const v = entities.get(id); if (!v) continue; const m = buildCarried(kind); m.position.set(0, 1.05, 0.42); v.root.add(m); carried.set(id, { kind, mesh: m }); }
    ui.setRam?.(ev);
  }
  function strike() {
    eng.userData.ram.strike();
    setTimeout(() => {
      const [fx2, fz2] = fw(pose.ry), k = eng.userData.ram.headZ(), p = new THREE.Vector3(pose.x + fx2 * k, eng.position.y + 1.9, pose.z + fz2 * k);
      fx.emit('dust', p, { n: 14, size: 1.1, color: '#b8ad98' }); fx.emit('sparks', p, { n: 10, color: '#ffd090' });
      const L = game.playerPos?.(); if (!L || Math.hypot(L.x - p.x, L.z - p.z) < 30) { rig?.addShake(0.35); sfx?.play('thud'); sfx?.play('clang', 0.6); }
    }, 150);
  }

  // every frame: the engine's pose eased toward the tally's (and carried on along its heading by its speed), the gates'
  // fall, the panel, and the driver's input (keys, stick or held buttons; sent ten times a second and on any change)
  function update(dt, local, input) {
    if (S) {
      const age = Math.min(0.25, (performance.now() - at) / 1000), [fx2, fz2] = fw(S.ry);
      const tx = S.x + fx2 * S.v * age, tz = S.z + fz2 * S.v * age, k = 1 - Math.exp(-dt * 9);
      if (Math.hypot(tx - pose.x, tz - pose.z) > 12) { pose.x = tx; pose.z = tz; pose.ry = S.ry; } // (a reset to the park)
      else { pose.x += (tx - pose.x) * k; pose.z += (tz - pose.z) * k; pose.ry += wrap(S.ry - pose.ry) * k; }
      pose.v = S.on ? S.v : 0;
      place();
    }
    eng.userData.ram.set({ v: pose.v, w: S?.w ?? RAM.engine.weightsStart, stall: !!S?.stall });
    if (local && Math.hypot(local.pos.x - pose.x, local.pos.z - pose.z) < 160) eng.userData.ram.update(dt);
    setRamGates(world, gates, dt);
    // the driver's input
    if (driving()) {
      // (in quarter steps, and a change at most twenty times a second: the phone's stick moves a little every frame, and a
      // message each frame at 120 Hz overflowed the server's 60-a-second allowance and closed the connection)
      const q4 = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 4) / 4;
      const f = q4((input?.f || 0) + hold.f), t = q4((input?.t || 0) + hold.t);
      sendT -= dt;
      if (sendT <= 0 || ((f !== lastIn.f || t !== lastIn.t) && sendT <= 0.05)) { sendT = 0.1; lastIn = { f, t }; game.send({ t: 'ram', op: 'in', f, tn: t }); }
    } else if (lastIn.f || lastIn.t) { lastIn = { f: 0, t: 0 }; }
    panelT -= dt;
    if (panelT <= 0) { panelT = 0.2; drawPanel(local); }
  }
  let panelT = 0;
  function drawPanel(local) {
    if (!panel.isConnected) { if (!ui.hud?.isConnected) return; ui.hud.appendChild(panel); } // (the HUD is built on entering the world)
    const on = !!S?.on && local && !game.you?.dead;
    const near = on && (driving() || Math.hypot(local.pos.x - pose.x, local.pos.z - pose.z) < 16 || S.ca || RAM.piles.some((Pl) => Math.hypot(local.pos.x - Pl.x, local.pos.z - Pl.z) < 6));
    panel.classList.toggle('hidden', !near);
    if (!near) return;
    const left = Math.max(0, Math.round(S.left - (performance.now() - at) / 1000));
    $p('.rp-t').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $p('.rp-hp i').style.width = `${(100 * S.hp) / S.mh}%`; $p('.rp-hp span').textContent = `Frame ${S.hp} / ${S.mh}${S.stall ? ' (stalled)' : ''}`;
    $p('.rp-st i').style.width = `${S.st}%`; $p('.rp-st span').textContent = `Steam ${S.st}`;
    $p('.rp-w').innerHTML = `Ram weights <b>${'<i class="on"></i>'.repeat(S.w)}${'<i></i>'.repeat(Math.max(0, RAM.engine.weightsMax - S.w))}</b>`;
    const gi = S.g.findIndex((h) => h > 0);
    const what = gi >= 0 ? `${RAM.gates[gi].name[0].toUpperCase() + RAM.gates[gi].name.slice(1)}: ${S.g[gi]} of ${S.gm[gi]} left` : S.boss ? 'The Wall-Layer is out: break it' : 'The gates are down';
    const who = driving() ? 'You are at the levers' : S.dr ? `${S.dn}${S.db ? ' (bot)' : ''} at the levers` : 'The levers are free';
    $p('.rp-s').innerHTML = `${what}<br>${who}${S.reach ? ' · <b>ram head in reach</b>' : ''}${S.ca ? `<br>Carrying ${S.ca === 1 ? 'a ram weight' : 'a sack of coal'}` : ''}`;
    panel.classList.toggle('drv', driving());
    $p('.rp-strike').classList.toggle('ready', !!(S.reach && S.w > 0 && S.cd <= 0 && !S.stall));
    // the walk-up actions as buttons
    const it = local ? interact(local.pos) : null, btns = [];
    if (it && it.ram !== 'leave') btns.push(`<button data-op="${it.ram}"${it.pile ? ` data-pile="${it.pile}"` : ''}>${it.label}</button>`);
    if (driving()) btns.push('<button data-op="leave">Step down</button>');
    if (S.ca && !(it?.ram === 'load')) btns.push('<button data-op="drop">Put it down</button>');
    const html = btns.join('');
    const acts = $p('.rp-acts'); if (acts._h !== html) { acts._h = html; acts.innerHTML = html; }
  }
  // the hero at the levers: stands on the ground behind the frame, facing along it
  function seat() { const lv = ramLever(pose); return { x: lv.x, z: lv.z, ry: pose.ry }; }
  // walking into the engine: pushed out of its frame (not while at its levers)
  function collide(pos, r = 0.45) {
    if (driving()) return;
    const [fx2, fz2] = fw(pose.ry), dx = pos.x - pose.x, dz = pos.z - pose.z, a = dx * fx2 + dz * fz2, b = dx * fz2 - dz * fx2;
    const hl = RAM.engine.halfL + r, hw = RAM.engine.halfW + r;
    if (Math.abs(a) >= hl || Math.abs(b) >= hw) return;
    const pa = hl - Math.abs(a), pb = hw - Math.abs(b);
    let na = a, nb = b;
    if (pa < pb) na = Math.sign(a || 1) * hl; else nb = Math.sign(b || 1) * hw;
    pos.x = pose.x + na * fx2 + nb * fz2; pos.z = pose.z + na * fz2 - nb * fx2;
  }
  return { onEv, update, interact, act, driving, seat, collide, strike: () => { if (driving()) act('strike'); }, pose };
}
