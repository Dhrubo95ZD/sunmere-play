// Touch controls for phones and tablets (only built when engine/platform.js says IS_TOUCH; the desktop never loads them).
// The fingers on the 3D view (stick, drag-to-look, pinch, taps) are read by ui/touchinput.js; this module draws the
// controls and the phone HUD around them (mobile-hud.css, all of it under html.mobile):
//   left thumb: a floating stick under the thumb (a faint ring marks its home); a light push walks, a full push runs
//   right thumb: the skill arc (a big attack, an inner ring of four, an outer ring with Jump, two more skills, the page
//     chip and Target), cooldown sweeps, a gold flash when a skill is ready, a red tint when out of resource
//   the round Interact button (Talk, Loot, Gather, Open) beside the arc whenever something is in reach
//   bottom centre: the quick bar (tonic, food, ride, auto-run)
//   top: unit frame and a one-line quest pill (left), the target frame (centre), Menu and Bag, the minimap and the
//     camera-distance button (right); a chat icon with an unread count and short toasts; the menu drawer from the right
// Windows get tap-to-select (tooltip and an action button: Equip / Use / Sell / Unequip / Deposit) and long-press tooltips.
import { CLASSES, OLD_TO_NEW } from '/sunmere-play/shared/classes.js';
import { kitOf } from '/sunmere-play/shared/kit.js';
import { FUSION_BY_ID, fusionUnlocked } from '/sunmere-play/shared/fusions.js';
import { ITEMS } from '/sunmere-play/shared/data.js';
import { skillCost } from '/sunmere-play/shared/talents.js';
import { icon, skillIcon, menuArt, miscArt } from './icons.js';
import { IS_TOUCH } from '../engine/platform.js';
import { SETTINGS, TOUCH_EVENT } from '../engine/settings.js';
import { initTouchInput } from './touchinput.js';
import { fuseFor, morph, haptic, pinsOf, pinCast } from './combathud.js'; // (S6: the morphing wheel, drag-fuse, two-finger plain, pinned chips)

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const itemDef = (it) => (it?.gear ? it.gear : it?.id ? { ...ITEMS[it.id], id: it.id } : null);
const SLOTS = 7; // attack + six on the arc; later pages keep the attack and show the next six
const CAM_LABEL = { close: 'Near', normal: 'Mid', far: 'Far' };

// plain line glyphs (circles, squares, arrows only)
const GLYPH = {
  jump: '<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4.5v7h-5v-7H5z"/></svg>',
  dodge: '<svg viewBox="0 0 24 24"><path d="M3 17c2.5-6 8-9.5 14-8.2l-.6-3.3L22 10.4l-6.3 3 .7-3.1C11.6 9.6 7.6 12.4 5.6 17z"/></svg>', // (S1: a swept arrow, the roll)
  ride: '<svg viewBox="0 0 24 24"><circle cx="6.5" cy="16.5" r="3.5"/><circle cx="17.5" cy="16.5" r="3.5"/><path d="M6.5 16.5L10 9h5l2.5 7.5M10 9H7.5M14 9l1-3h3" fill="none" stroke-width="2"/></svg>',
  run: '<svg viewBox="0 0 24 24"><path d="M5 6l6 6-6 6V6zm7 0l6 6-6 6V6z"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke-width="2.2"/><circle cx="12" cy="12" r="2.4"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke-width="2.2"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M8 7V5.5C8 3.6 9.8 2.5 12 2.5s4 1.1 4 3V7h3.2c1 0 1.8.8 1.8 1.8V19c0 1.4-1.1 2.5-2.5 2.5h-13C4.1 21.5 3 20.4 3 19V8.8C3 7.8 3.8 7 4.8 7zm2 0h4V5.5c0-.6-.9-1-2-1s-2 .4-2 1zM6 12h12v2.2H6z" fill-rule="evenodd"/></svg>',
  char: '<svg viewBox="0 0 24 24"><rect x="8" y="2.5" width="8" height="8" rx="2"/><path d="M4 21.5c0-5.5 3.6-9 8-9s8 3.5 8 9z"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M3 5.5C3 4.1 4.1 3 5.5 3h13C19.9 3 21 4.1 21 5.5v9c0 1.4-1.1 2.5-2.5 2.5H10l-5 4v-4h.5C4.1 17 3 15.9 3 14.5z"/></svg>',
  page: '<svg viewBox="0 0 24 24"><path d="M4 9h12V5l6 7-6 7v-4H4z"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke-width="2.4"/><path d="M8 12.5l3 3 5.5-6.5" fill="none" stroke-width="2.6"/></svg>',
  talk: '<svg viewBox="0 0 24 24"><path d="M3 6c0-1.7 1.3-3 3-3h12c1.7 0 3 1.3 3 3v7c0 1.7-1.3 3-3 3h-7l-5 4v-4c-1.7 0-3-1.3-3-3z"/></svg>',
  loot: '<svg viewBox="0 0 24 24"><path d="M3 9h18v11H3zM5 4h14l2 4H3z"/><path d="M10 12h4v3h-4z" fill="#2a1a06"/></svg>',
  gather: '<svg viewBox="0 0 24 24"><path d="M12 21V9M12 9c0-3 2-6 7-6 0 4-3 6-7 6zM12 13c0-2.5-2-5-6-5 0 3.5 2.5 5 6 5z" stroke-width="2.2" fill="currentColor"/></svg>',
  door: '<svg viewBox="0 0 24 24"><path d="M5 21V5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v16zM14 11.5a1.3 1.3 0 1 0 0 .1z"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.6" fill="#2a1a06"/></svg>',
  // menu tiles with no painted icon
  news: '<svg viewBox="0 0 24 24"><path d="M4 4h13v16H6c-1.1 0-2-.9-2-2zM17 8h3v10c0 1.1-.9 2-2 2h-1z"/><path d="M7 8h7M7 12h7M7 16h5" stroke="#2a1a06" stroke-width="1.6"/></svg>',
  loothist: '<svg viewBox="0 0 24 24"><path d="M3 9h18v11H3zM5 4h14l2 4H3z"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3c0-1.7 1.3-2.8 2.9-2.8s2.9 1 2.9 2.6c0 2.2-2.9 2.4-2.9 4.6M12 16.6v.6" fill="none" stroke="#2a1a06" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
// the drawer: every window the desktop menu bar reaches (painted icons from ui/icons, line glyphs for the rest)
const MENU = [
  ['char', 'Character'], ['bags', 'Backpack'], ['skills', 'Skills'], ['talents', 'Skill Web'], ['quests', 'Quest Log'], ['map', 'World Map'],
  ['journal', 'Journal'], ['ach', 'Achievements'], ['recall', 'Homeward'], ['meter', 'Damage Meter'], ['social', 'Players'], ['loot', 'Loot History'], ['options', 'Options'],
  ['help', 'How to Play'], ['news', 'What’s New'], ['chat', 'Chat'],
];
const MENU_GLYPH = { char: GLYPH.char, bags: GLYPH.bag, loot: GLYPH.loothist, news: GLYPH.news, help: GLYPH.help, chat: GLYPH.chat, social: GLYPH.chat, map: GLYPH.target, recall: GLYPH.page };

// phone layout: a short landscape screen (or any narrow one); re-checked on rotation and resize
const phoneCheck = () => { document.documentElement.classList.toggle('phone', Math.min(innerWidth, innerHeight) < 560 || innerWidth < 720); };
// the classes go on at once (the login screen needs them too); the desktop never gets them
if (IS_TOUCH) {
  document.documentElement.classList.add('touch');
  phoneCheck();
  addEventListener('resize', phoneCheck);
  // no page zoom or pan under the fingers, and the page may run under a notch (the CSS keeps clear of it with safe-area insets)
  const vp = $('meta[name="viewport"]');
  if (vp) vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
}

export function initTouch({ game, ui, rig, canvas, act }) {
  const root = document.documentElement;
  // the touch HUD is styled under html.mobile (mobile-hud.css): a touch screen that platform.js did not call mobile (a
  // touch laptop in tablet mode) still gets the touch layout, so it gets the class for CSS too (IS_MOBILE is unchanged)
  root.classList.add('mobile');
  const T = SETTINGS.touch; // kept current in place by touchSettingsChanged()
  canvas.style.touchAction = 'none';
  const chatIn = $('.chat-in', ui.root);
  if (chatIn) { chatIn.placeholder = 'Say something'; chatIn.setAttribute('enterkeyhint', 'send'); }

  const hud = ui.hud || $('.hud', ui.root);
  const tc = el('div', 'tc');
  tc.innerHTML = `
    <div class="tc-home"></div>
    <div class="tc-stick"><div class="tc-base"></div><div class="tc-knob"></div></div>
    <div class="tc-wheel"></div>
    <button class="tc-b tc-jump" data-a="jump" aria-label="Jump">${GLYPH.jump}</button>
    <button class="tc-b tc-dodge" data-a="dodge" aria-label="Dodge">${GLYPH.dodge}<span class="tc-dp"></span></button>
    <button class="tc-b tc-pin hidden" data-a="pin0" aria-label="Pinned fusion 1"><img alt=""><i class="tc-cd"></i></button>
    <button class="tc-b tc-pin hidden" data-a="pin1" aria-label="Pinned fusion 2"><img alt=""><i class="tc-cd"></i></button>
    <button class="tc-b tc-tgt" data-a="target" aria-label="Next target">${GLYPH.target}</button>
    <button class="tc-b tc-int hidden" data-a="interact" aria-label="Interact"><img alt=""><span class="tc-intg"></span></button>
    <div class="tc-intl hidden"></div>
    <div class="tc-qb">
      <button class="tc-b tc-q tc-pot" data-a="pot" aria-label="Healing tonic"><img alt=""><span class="tc-n"></span></button>
      <button class="tc-b tc-q tc-food" data-a="food" aria-label="Food"><img alt=""><span class="tc-n"></span></button>
      <button class="tc-b tc-ride" data-a="ride" aria-label="Ride">${GLYPH.ride}</button>
      <button class="tc-b tc-run" data-a="run" aria-label="Auto-run">${GLYPH.run}</button>
    </div>
    <button class="tc-b tc-cam" data-a="cam" aria-label="Camera distance">${GLYPH.cam}<b></b></button>
    <div class="tc-top">
      <button class="tc-t" data-a="menu" aria-label="Menu">${GLYPH.menu}</button>
      <button class="tc-t" data-a="bags" aria-label="Backpack">${GLYPH.bag}</button>
    </div>
    <button class="tc-t tc-chat" data-a="chat" aria-label="Chat">${GLYPH.chat}<i class="tc-dot"></i></button>
    <div class="tc-toasts"></div>
    <button class="tc-pill" aria-label="Quests"><i class="tc-pi">!</i><span class="tc-pt"></span><b class="tc-pn"></b><i class="tc-pc"></i></button>
    <div class="tc-vig"></div>
    <div class="tc-act hidden"><button class="tc-go"></button><button class="tc-link">Link in chat</button><button class="tc-close">Close</button></div>`;
  hud.appendChild(tc);
  const stickEl = $('.tc-stick', tc), knob = $('.tc-knob', tc), homeEl = $('.tc-home', tc), wheel = $('.tc-wheel', tc);
  const intBtn = $('.tc-int', tc), intLab = $('.tc-intl', tc), camBtn = $('.tc-cam', tc), pill = $('.tc-pill', tc), vig = $('.tc-vig', tc);
  const tracker = $('.quest-tracker', ui.root);
  const prompt = $('.prompt', ui.root);

  // ------------------------------------------------------------------ geometry: one unit u (1 on a 412-tall phone)
  const safeEl = el('div', 'tc-safe'); tc.appendChild(safeEl); // padded by env(safe-area-inset-*), read back in pixels
  const safe = () => {
    const cs = getComputedStyle(safeEl);
    return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
  };
  const G = { W: 0, H: 0, u: 1, hu: 1, sb: { l: 0, r: 0, t: 0, b: 0 }, A: { x: 0, y: 0 }, home: { x: 0, y: 0 }, R: 56 };
  const measure = () => {
    const W = innerWidth, H = innerHeight, sb = safe();
    const u0 = clamp(H / 412, 0.85, 1.25);
    Object.assign(G, { W, H, sb, u: u0 * T.btnScale, hu: u0 * T.uiScale, u0 });
    return G;
  };
  // mirrored for left-handed play: every control's x flips
  const mx = (x) => (T.leftHanded ? G.W - x : x);
  const put = (e, x, y, size) => { if (!e) return; size = Math.max(44, size); /* never under 44 px to the finger */ e.style.width = e.style.height = size + 'px'; e.style.transform = `translate(${Math.round(mx(x) - size / 2)}px, ${Math.round(y - size / 2)}px)`; };
  const polar = (r, deg) => ({ x: G.A.x + r * Math.cos((deg * Math.PI) / 180), y: G.A.y - r * Math.sin((deg * Math.PI) / 180) });

  // the stick's zone: the left 45% below the frame and tracker band (mirrored for left-handed play)
  const zoneTest = (x, y) => {
    const left = T.leftHanded ? x > G.W * 0.55 : x < G.W * 0.45;
    return left && y > G.sb.t + 120 * G.u0 ? 'stick' : 'cam';
  };
  // the stick rests at home (a faint ring marks it); touchinput.js moves the base under the thumb and the knob with it
  const placeStickHome = () => {
    G.home = { x: mx(G.sb.l + 28 * G.u + 56 * G.u), y: G.H - G.sb.b - 28 * G.u - 56 * G.u };
    homeEl.style.transform = `translate(${G.home.x}px, ${G.home.y}px)`;
    input?.placeHome();
  };

  // ------------------------------------------------------------------ fingers on the 3D view (ui/touchinput.js)
  let input = null, eatClick = 0;
  input = initTouchInput({
    canvas, rig, act, game, zoneTest, stickEl, knobEl: knob,
    geom: () => ({ R: G.R, home: G.home }), safe,
    onDown: () => { closeMenus(); collapseTracker(); },
    onTap: () => { eatClick = performance.now(); }, // the click after a tap lands on whatever it opened (a dialog, the loot window): not on it
  });
  const cam = input.cam; // touchcam.js: presets, pinch, drag
  game.touchcam = cam;

  // ------------------------------------------------------------------ the skill wheel
  // 7 slots a page: the user's wheel for this class (SETTINGS.touch.wheel[cls], written by the Skills sheet) or learn
  // order; later pages keep the attack slot and show the next six skills not on the first page
  let page = 0, slots = [], builtKey = '', pages = 1;
  const wheelPages = () => {
    const y = game.you, all = kitOf(game.cls);
    const known = all.filter((s) => s.lvl <= (y?.level || 1));
    const byId = Object.fromEntries(all.map((s) => [s.id, s]));
    for (const [old, o] of Object.entries(OLD_TO_NEW)) if (!byId[old] && o.to && byId[o.to]) byId[old] = byId[o.to]; // (S2: an old wheel slot keeps its place where its skill survives)
    const mine = Array.isArray(T.wheel?.[game.cls]) ? T.wheel[game.cls].slice(0, SLOTS) : null;
    let first;
    if (mine && mine.some(Boolean)) {
      first = Array.from({ length: SLOTS }, (_, i) => (known.includes(byId[mine[i]]) ? byId[mine[i]] : null)); // a saved skill above your level stays an empty ring
      first = first.map((s, i) => (s && first.indexOf(s) < i ? null : s)); // (two old slots that became one skill)
      if (!first[0]) first[0] = known.find((s) => !first.includes(s)) || null; // the big button is never empty while a skill is known
    } else first = Array.from({ length: SLOTS }, (_, i) => known[i] || null);
    const rest = known.filter((s) => !first.includes(s));
    const out = [first];
    for (let i = 0; i < rest.length; i += SLOTS - 1) out.push([first[0], ...Array.from({ length: SLOTS - 1 }, (_, k) => rest[i + k] || null)]);
    return out;
  };
  const buildWheel = () => {
    const y = game.you;
    if (!y) return;
    const P = wheelPages();
    pages = P.length; page = Math.min(page, pages - 1);
    builtKey = `${game.cls}:${y.level}:${JSON.stringify(T.wheel?.[game.cls] || null)}`;
    const shown = P[page];
    wheel.innerHTML = shown.map((s, i) => (s
      ? `<button class="tc-sk ${i ? '' : 'main'}" data-i="${i}" aria-label="${s.name}"><img src="${skillIcon(s)}" alt=""><i class="tc-cd"></i><span class="tc-cdt"></span><i class="tc-ring"></i><i class="tc-fzw"></i><b class="tc-fzq">?</b></button>`
      : `<div class="tc-sk tc-empty ${i ? '' : 'main'}" data-i="${i}"></div>`)).join('')
      + `<button class="tc-sk tc-page${pages > 1 ? '' : ' hidden'}" aria-label="Next skills">${GLYPH.page}<b>${page + 1}/${pages}</b></button>`;
    slots = shown.map((s, i) => { const b = wheel.querySelector(`[data-i="${i}"]`); return { s, el: b, cd: s && $('.tc-cd', b), cdt: s && $('.tc-cdt', b), left: 0, img: s && $('img', b), base: s && skillIcon(s), fzw: s && $('.tc-fzw', b) }; });
    for (const S of slots) {
      if (!S.s) continue;
      let hold = null;
      S.el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); closeMenus();
        // (S6) a second finger on the same button within 150 ms is a two-finger tap: B plain (the option "fuse only with a
        // two-finger tap" turns it round). A tap on a morphed button waits 70 ms for that second finger; any other goes at once
        const now = performance.now(), tw = fingers.find((f) => f.S === S && now - f.t < 150 && f.id !== e.pointerId);
        fingers = fingers.filter((f) => now - f.t < 400);
        const me = { S, t: now, id: e.pointerId, wait: 0 };
        fingers.push(me);
        if (tw) { if (tw.wait) { clearTimeout(tw.wait); tw.wait = 0; useSkill(S.s, { plain: !T2() }); } return; }
        const st = fuseFor(game, ui, S.s.id, game.serverTime());
        if (st && !st.cooling) me.wait = setTimeout(() => { me.wait = 0; useSkill(S.s, { plain: T2() }); }, 70);
        else useSkill(S.s, { plain: !!st && T2(), hold: !!S.s.draw }); // (S11: a draw is held while the finger stays on the button)
        dragS = { S, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
        clearTimeout(hold);
        if (S.s.draw) return; // (no tip while a draw is held)
        hold = setTimeout(() => { if (dragS?.moved) return; ui.showTip({ currentTarget: S.el }, S.el.dataset.fz ? ui.fuseTip(S.el.dataset.fz, S.s) : ui.skillTip(S.s)); tipShownAt = performance.now(); }, 550);
      });
      const off = () => { clearTimeout(hold); if (S.s.draw) game.releaseDraw?.(); };
      S.el.addEventListener('pointerup', off); S.el.addEventListener('pointercancel', off); S.el.addEventListener('pointerleave', off);
    }
    $('.tc-page', wheel).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (pages < 2) return; page = (page + 1) % pages; buildWheel(); game.sfx?.play('ui'); });
    layout();
  };
  // a damaging skill with no foe targeted picks one: the nearest in range inside a 120 degree cone in front of the camera,
  // else the nearest within 25 m (game.useSkill then checks the range itself)
  const isFoe = (v) => v && v.ty === 'm' && !v.dead && v.root?.visible !== false;
  const autoTarget = (s) => {
    if (s.target !== 'enemy' || isFoe(game.entities.get(game.target))) return;
    const me = game.playerPos(), fwd = rig.axes?.().fwd;
    let cone = null, cd = Infinity, near = null, nd = 25;
    for (const v of game.entities.views.values()) {
      if (!isFoe(v)) continue;
      const dx = v.pos.x - me.x, dz = v.pos.z - me.z, d = Math.hypot(dx, dz);
      if (d < nd && !v.def?.dummy) { nd = d; near = v; }
      if (d <= (s.range || 4) + (v.radius || 0.5) + 0.5 && fwd) {
        const cos = (dx * fwd.x + dz * fwd.z) / (Math.max(1e-3, d) * Math.max(1e-3, Math.hypot(fwd.x, fwd.z)));
        if ((cos >= 0.5 || d < 1.5) && d < cd) { cd = d; cone = v; }
      }
    }
    const pick = cone || near;
    if (pick) game.setTarget(pick.id);
  };
  const useSkill = (s, o) => { autoTarget(s); game.useSkill(s.id, o); };
  // (S6) drag-fuse: slide the thumb from A (a wheel button or the dodge) onto B and lift. A went off on the press; the lift
  // presses B into A's window, or holds it in the buffer while A still winds up. The button under the thumb is lit
  let fingers = [], dragS = null;
  const T2 = () => !!SETTINGS.fuseAlt; // (the option turns the two-finger tap round: two fingers fuse, one casts plain)
  const slotUnder = (x, y) => { const e = document.elementFromPoint(x, y)?.closest?.('.tc-sk[data-i]'); return e ? slots[Number(e.dataset.i)] : null; };
  const dragMove = (e) => {
    const d = dragS; if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 18) d.moved = true;
    if (!d.moved) return;
    const T = slotUnder(e.clientX, e.clientY), over = T && T !== d.S && T.s ? T : null;
    if (over !== d.over) { d.over?.el.classList.remove('tc-drop'); over?.el.classList.add('tc-drop'); d.over = over; }
  };
  const dragEnd = (e) => {
    const d = dragS; if (!d || e.pointerId !== d.id) return;
    dragS = null; d.over?.el.classList.remove('tc-drop');
    if (!d.moved || e.type === 'pointercancel') return;
    const T = slotUnder(e.clientX, e.clientY);
    if (T && T !== d.S && T.s) { useSkill(T.s); haptic('light'); game.dragFused = (game.dragFused || 0) + 1; }
  };
  addEventListener('pointermove', dragMove, true); addEventListener('pointerup', dragEnd, true); addEventListener('pointercancel', dragEnd, true);

  // where everything sits (spec section 2): computed from the screen so it scales from a 360-tall phone to a tablet
  function layout() {
    phoneCheck();
    measure();
    const { W, H, sb, u } = G, hu = G.hu;
    G.R = 56 * u;
    G.A = { x: W - sb.r - 66 * u, y: H - sb.b - 64 * u };
    // the HUD first (the arc keeps clear of it): units and insets for mobile-hud.css, then the camera-distance button
    // by the minimap's bottom-left, clear of the map's box
    for (const [k, v] of [['--u', u], ['--hu', hu], ['--sl', sb.l + 'px'], ['--sr', sb.r + 'px'], ['--st', sb.t + 'px'], ['--sb', sb.b + 'px']]) hud.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v);
    tc.style.setProperty('--u', u.toFixed(3));
    tc.style.setProperty('--ui', T.uiScale);
    root.classList.toggle('lefty', !!T.leftHanded);
    const mmL = W - sb.r - 8 - 104 * hu, mmB = sb.t + 22 * hu + 104 * hu;
    camBtn.style.width = camBtn.style.height = Math.round(36 * hu) + 'px';
    camBtn.style.transform = `translate(${Math.round(mmL - 6 - 36 * hu)}px, ${Math.round(mmB - 36 * hu)}px)`;
    // the arc: attack, an inner ring of four (r 118u), an outer ring (r 180u) of Jump, two skills, the page chip, Target.
    // Its top (Target, 202u over the attack's centre) stays under the corner block above it: the minimap, its button
    // and Menu/Bag (or, left-handed, the unit frame, quest pill and chat icon); big buttons on a short screen draw the
    // arc in a little (k), never the attack button
    let lim = sb.t;
    for (const e of tc.parentElement.querySelectorAll(T.leftHanded ? '.player-frame, .tc-pill, .tc-chat' : '.minimap canvas, .tc-cam, .tc-top')) {
      const r = e.getBoundingClientRect();
      if (r.height && getComputedStyle(e).display !== 'none') lim = Math.max(lim, r.bottom);
    }
    const k = clamp((G.A.y - lim - 6) / (202 * u), 0.72, 1), a = u * k;
    const inner = [180, 150, 120, 90], outer = { 5: 158, 6: 134 };
    slots.forEach((S, i) => {
      if (i === 0) put(S.el, G.A.x, G.A.y, 88 * u);
      else if (i <= 4) { const p = polar(118 * a, inner[i - 1]); put(S.el, p.x, p.y, 54 * a); }
      else { const p = polar(180 * a, outer[i]); put(S.el, p.x, p.y, 54 * a); }
    });
    let p = polar(180 * a, 182); put($('.tc-jump', tc), p.x, p.y, 58 * a);
    put($('.tc-dodge', tc), p.x - 64 * a, p.y + 4 * a, 52 * a); // (S1: the dodge, just left of Jump)
    p = polar(180 * a, 110); put($('.tc-page', wheel), p.x, p.y, 44 * a);
    // (S6) the two pinned-fusion chips above the arc: the page chip's place (the new kit has one page) and up beside it
    const pins = tc.querySelectorAll('.tc-pin');
    if (pins.length) { put(pins[0], p.x, p.y, 46 * a); const q = polar(232 * a, 124); put(pins[1], q.x, q.y, 46 * a); }
    p = polar(180 * a, 86); put($('.tc-tgt', tc), p.x, p.y, 44 * a);
    G.arcK = k;
    // Interact: left of the arc, a little above the attack button; its label chip under it
    const I = { x: G.A.x - 262 * u, y: G.A.y - 104 * u };
    put(intBtn, I.x, I.y, 64 * u);
    intLab.style.transform = `translate(calc(${Math.round(mx(I.x))}px - 50%), ${Math.round(I.y + 32 * u + 4)}px)`;
    // the quick bar: four 44u buttons, 8u apart, centred, 10u off the bottom
    const qb = $('.tc-qb', tc), n = [...qb.children].filter((b) => b.style.display !== 'none').length;
    const qw = n * Math.max(44, 44 * u) + (n - 1) * 8 * u;
    qb.style.left = Math.round(W / 2 - qw / 2) + 'px'; qb.style.bottom = Math.round(sb.b + 10 * u) + 'px';
    qb.style.gap = Math.round(8 * u) + 'px';
    for (const b of qb.children) b.style.width = b.style.height = Math.round(Math.max(44, 44 * u)) + 'px';
    placeStickHome();
  }
  addEventListener('resize', () => { layout(); setTimeout(layout, 300); });
  addEventListener('orientationchange', () => setTimeout(layout, 300));
  addEventListener(TOUCH_EVENT, () => { buildWheel(); layout(); camLabel(); });

  // ------------------------------------------------------------------ buttons
  const quick = { pot: null, food: null };
  const pickQuick = () => {
    const bag = game.you?.bag || [];
    let pot = null, food = null, pv = -1, fv = -1;
    bag.forEach((it, i) => {
      const d = itemDef(it), us = d?.use;
      if (!us || d.slot !== 'use' || (d.lvl && d.lvl > (game.you.level || 1))) return;
      if (us.food && (us.heal || 0) >= fv) { fv = us.heal || 0; food = { i, d, n: it.n || 1 }; }
      else if (!us.food && (us.heal || us.res) && (us.heal || 0) + (us.res || 0) * 0.5 >= pv) { pv = (us.heal || 0) + (us.res || 0) * 0.5; pot = { i, d, n: it.n || 1 }; }
    });
    for (const [k, q] of [['pot', pot], ['food', food]]) {
      const b = $('.tc-' + k, tc), was = quick[k];
      quick[k] = q;
      b.classList.toggle('empty', !q);
      if (q && (was?.d?.id !== q.d.id)) $('img', b).src = icon(q.d.icon || 'potion', '#3a3226', 64);
      if (!q) $('img', b).removeAttribute('src');
      $('.tc-n', b).textContent = q && q.n > 1 ? q.n : '';
    }
  };
  // the camera distance: Near, Mid, Far (SETTINGS.touch.camPreset; touchcam.js listens for the change event)
  // (Free camera on: the button reads Reset and puts the view back behind the hero instead)
  const camLabel = () => { $('b', camBtn).textContent = SETTINGS.freeCam ? 'Reset' : CAM_LABEL[T.camPreset] || 'Mid'; };
  const cycleCam = () => { if (SETTINGS.freeCam) cam.resetView(); else cam.cyclePreset(); camLabel(); }; // saves and tells the listeners
  camLabel();
  // the round buttons act on the press (no delay in a fight); the top buttons and Interact open things, so they act on
  // the click (a press would leave the click to land on whatever just opened under the finger)
  tc.addEventListener('click', (e) => {
    const b = e.target.closest('.tc-t, .tc-int, .tc-pill');
    if (!b) return;
    e.stopPropagation();
    b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140);
    if (b === pill) { toggleTracker(); return; }
    const a = b.dataset.a;
    if (a !== 'menu' && a !== 'chat') closeMenus();
    if (a === 'menu') toggleMenu();
    else if (a === 'chat') toggleChat();
    else if (a === 'interact') act.interact();
    else if (a === 'bags') ui.toggle(a);
  });
  let tgtHold = null;
  tc.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.tc-b');
    if (!b || b === intBtn) return;
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.a;
    b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140);
    closeMenus();
    if (a === 'jump') act.jump();
    else if (a === 'dodge') { act.dodge?.(); dragS = { S: null, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; }
    else if (a === 'pin0' || a === 'pin1') { const id = pinsOf(game.cls)[a === 'pin0' ? 0 : 1]; if (id) pinCast(game, ui, id); else ui.openBook?.(); }
    else if (a === 'target') {
      // a tap steps to the next foe; a long press clears the target
      clearTimeout(tgtHold);
      let fired = false;
      tgtHold = setTimeout(() => { fired = true; act.clearTarget(); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 200); }, 550);
      const up = () => { clearTimeout(tgtHold); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); if (!fired) act.nextTarget(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
    else if (a === 'ride') act.ride();
    else if (a === 'run') b.classList.toggle('on', act.autorun());
    else if (a === 'cam') cycleCam();
    else if (a === 'pot' || a === 'food') {
      const q = quick[a];
      if (!q) return ui.error(a === 'pot' ? 'No healing tonic in your bags.' : 'No food in your bags.');
      game.send({ t: 'use', slot: q.i }); game.sfx?.play('ui');
    }
  });

  // the Interact button stands in for the "F" pill (which mobile-hud.css hides): Talk, Loot, Gather, Open
  if (prompt) { const pk = $('.pk', prompt); if (pk) pk.innerHTML = GLYPH.hand; prompt.addEventListener('click', (e) => { e.stopPropagation(); act.interact(); }); }
  let intKey = '';
  const updateInteract = () => {
    const it = game.nearInteract, text = prompt && !prompt.classList.contains('hidden') ? ($('.pt', prompt)?.textContent || '') : '';
    const on = !!(it && text);
    if (!on) { if (intKey) { intKey = ''; intBtn.classList.add('hidden'); intLab.classList.add('hidden'); } return; }
    const verb = it.ty === 'n' ? 'Talk' : it.ty === 'm' ? 'Loot' : it.node ? (it.node.item === 'c37_block' ? 'Chip' : 'Gather') : it.door ? 'Enter' : it.salvage ? 'Cast' : it.sail ? 'Board' : 'Use';
    const key = (it.id || it.node?.id || it.qobj?.id || it.door?.id || verb) + ':' + text;
    if (key === intKey) return;
    intKey = key;
    // an NPC shows its class portrait or the sign of its trade (the target frame's art); the rest a verb glyph
    const nl = it.ty === 'n' ? it.npc?.look : null;
    const src = it.ty === 'n' ? (nl && CLASSES[nl] ? `/sunmere-play/ui/classes/${nl}.webp` : miscArt(it.npc?.vendor ? 'npc_vendor' : it.npc?.quests?.length ? 'npc_quest' : 'npc')) : null;
    const img = $('img', intBtn), g = $('.tc-intg', intBtn);
    if (src) { img.src = src; img.style.display = ''; g.innerHTML = ''; }
    else { img.removeAttribute('src'); img.style.display = 'none'; g.innerHTML = it.ty === 'm' ? GLYPH.loot : it.node ? GLYPH.gather : it.door ? GLYPH.door : it.ty === 'n' ? GLYPH.talk : GLYPH.hand; }
    intLab.textContent = it.ty === 'n' ? `Talk · ${it.name}` : text.length > 22 ? verb : text;
    intBtn.classList.remove('hidden'); intLab.classList.remove('hidden');
    intBtn.classList.remove('pop'); void intBtn.offsetWidth; intBtn.classList.add('pop');
  };
  // the target frame: a tap clears the target; the percentage readout is our own (ui.js writes "hp / max")
  const tf = $('.target-frame', ui.root);
  tf?.addEventListener('click', () => act.clearTarget());
  const tfPct = tf ? el('b', 'tc-tfp') : null;
  if (tfPct) $('.bar.hp', tf)?.appendChild(tfPct);

  // ------------------------------------------------------------------ the quest pill (the tracker, one line)
  // Collapsed: one line for the first quest (the Main Story when tracked). A tap opens the full tracker under it (three
  // quests at most, scrolls); moving or 8 s closes it again. A quest line opens it in the quest log (ui.js wires that).
  let trackOpen = false, trackT = 0;
  const pillText = () => {
    if (!tracker) return null;
    const first = $('.msq-box', tracker) || $('.qt', tracker);
    if (!first) return null;
    const line = ($('.msq-g, .qt-g', first)?.textContent || $('.msq-n, .qt-n', first)?.textContent || '').replace(/^\s*-\s*/, '').trim();
    const m = line.match(/:\s*(\d+)\s*\/\s*(\d+)\s*(\(Complete\))?\s*$/);
    const done = /\(Complete\)/.test(line) || first.classList.contains('done') || first.classList.contains('ready');
    return { text: m ? line.slice(0, m.index).trim() : line.replace(/\s*\(Complete\)\s*$/, ''), n: m ? `${m[1]}/${m[2]}` : done ? '✓' : '', done, story: first.classList.contains('msq-box') };
  };
  let pillKey = '';
  const updatePill = () => {
    const P = pillText();
    const key = P ? P.text + '|' + P.n + '|' + P.done : '';
    pill.classList.toggle('hidden', !P);
    if (key !== pillKey) {
      pillKey = key;
      if (P) { $('.tc-pt', pill).textContent = P.text; $('.tc-pn', pill).textContent = P.n; pill.classList.toggle('done', P.done); pill.classList.toggle('story', P.story); }
    }
    // three quests at most in the open list
    if (trackOpen && tracker) { let k = 0; for (const q of tracker.querySelectorAll('.msq-box, .qt')) { k++; q.classList.toggle('tc-over', k > 3); } }
  };
  function toggleTracker(force) {
    trackOpen = force ?? !trackOpen;
    trackT = 0;
    hud.classList.toggle('qt-open', trackOpen);
    pill.classList.toggle('on', trackOpen);
    if (trackOpen) updatePill();
  }
  function collapseTracker() { if (trackOpen) toggleTracker(false); }

  // ------------------------------------------------------------------ menu drawer and chat
  let menu = null;
  function toggleMenu() {
    if (menu) { closeMenus(); return; }
    closeMenus();
    const tile = (k, n) => { const a = k === 'chat' || k === 'news' || k === 'help' ? null : menuArt(k); return `<button data-w="${k}">${a ? `<img src="${a}" alt="">` : `<i class="tcm-g">${MENU_GLYPH[k] || GLYPH.menu}</i>`}<span>${n}</span>${k === 'recall' ? '<em class="tcm-cd"></em>' : ''}</button>`; };
    menu = el('div', 'tc-menu', `<div class="tcm-drawer"><div class="tcm-h"><span>Menu</span><button class="tcm-x" aria-label="Close">${'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>'}</button></div><div class="tcm-grid">${MENU.map(([k, n]) => tile(k, n)).join('')}</div></div>`);
    ui.root.appendChild(menu);
    if (T.leftHanded) menu.classList.add('lefty');
    const rb = $('[data-w="recall"]', menu), left = (game.you?.recallReady || 0) - Date.now();
    if (rb && left > 0) { rb.classList.add('cooling'); $('.tcm-cd', rb).textContent = `${Math.ceil(left / 60000)} min`; }
    requestAnimationFrame(() => menu?.classList.add('on'));
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !e.target.closest('.tcm-drawer')) { closeMenus(); return; }
      if (b.classList.contains('tcm-x')) { closeMenus(); return; }
      const w = b.dataset.w;
      if (!w) return;
      closeMenus();
      if (w === 'recall') game.send({ t: 'recall' }); else if (w === 'chat') toggleChat(true); else ui.toggle(w);
    });
    $('[data-a="menu"]', tc).classList.add('on');
  }
  function closeMenus() {
    if (menu) { menu.remove(); menu = null; $('[data-a="menu"]', tc)?.classList.remove('on'); }
  }
  const chat = $('.chat', ui.root);
  if (chat && !$('.chat-send', chat)) {
    const send = el('button', 'chat-send', 'Send');
    chat.appendChild(send);
    send.addEventListener('click', () => { chatIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  }
  if (chat && !$('.chat-x', chat)) {
    const x = el('button', 'chat-x', '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>');
    x.setAttribute('aria-label', 'Close chat');
    chat.prepend(x);
    x.addEventListener('click', (e) => { e.stopPropagation(); toggleChat(false); });
  }
  let unread = 0;
  const dot = $('.tc-dot', tc), toasts = $('.tc-toasts', tc);
  const setUnread = (n) => { unread = n; dot.textContent = n > 9 ? '9+' : n ? String(n) : ''; dot.classList.toggle('on', n > 0); };
  function toggleChat(force) {
    const open = force ?? !hud.classList.contains('chat-open');
    hud.classList.toggle('chat-open', open);
    $('[data-a="chat"]', tc).classList.toggle('on', open);
    setUnread(0);
    toasts.innerHTML = '';
    if (open) { const lg = $('.chat-log', chat); if (lg) lg.scrollTop = lg.scrollHeight; }
    else chatIn?.blur();
  }
  // new lines while the chat is closed: a count on the icon; system and party lines also show as a one-line toast
  // (two at most, 4 s); emotes and yells (the world's chatter) only count
  const AMBIENT = new Set(['rgb(255, 176, 112)', 'rgb(255, 154, 64)']);
  const toast = (line) => {
    const t = el('div', 'tc-toast');
    t.innerHTML = line.innerHTML; t.style.color = line.style.color;
    t.querySelectorAll('.cl-n').forEach((n) => n.remove());
    toasts.appendChild(t);
    while (toasts.children.length > 2) toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4000);
  };
  const log = $('.chat-log', ui.root);
  if (log) new MutationObserver((muts) => {
    if (hud.classList.contains('chat-open')) return;
    for (const m of muts) for (const line of m.addedNodes) {
      if (!(line instanceof HTMLElement)) continue;
      setUnread(unread + 1);
      const player = /^\s*\[/.test(line.textContent) && !/\[Party\]/.test(line.textContent);
      if (!player && !AMBIENT.has(line.style.color)) toast(line);
    }
  }).observe(log, { childList: true });

  // ------------------------------------------------------------------ the offline chip: 5 s at the top, then a dot
  const off = $('.offline-tag', ui.root);
  let offT = null;
  const updateOffline = () => {
    if (!off || off.classList.contains('hidden')) return;
    if (offT === null) { offT = performance.now(); off.classList.remove('tc-dotted'); }
    else if (performance.now() - offT > 5000) off.classList.add('tc-dotted');
  };
  off?.addEventListener('click', () => { offT = performance.now(); off.classList.remove('tc-dotted'); });

  // ------------------------------------------------------------------ windows: tap to select, long-press for tooltips
  // An item tap shows its tooltip and an action bar (the right-click of the desktop); a second tap on it does the action.
  const CELL = '.bslot:not(.empty), .cw-slot:not(.empty), .cw-gr:not(.none)';
  const actBar = $('.tc-act', tc);
  document.body.appendChild(actBar); // above the windows and the tooltip
  let sel = null, tipShownAt = 0, press = null;
  const keyOf = (c) => {
    const w = c.closest('.window');
    const wcls = w ? [...w.classList].find((k) => k.startsWith('w-')) : '';
    return { wcls, sel: c.classList.contains('bslot') ? `.bslot[data-i="${c.dataset.i}"]` : c.classList.contains('cw-gr') ? `.cw-gr[data-s="${c.dataset.s}"]` : `.cw-slot[data-s="${c.dataset.s}"]` };
  };
  const findSel = () => (sel ? $(`.window.${sel.wcls} ${sel.sel}`) : null);
  const actionFor = (c) => {
    if (!c) return null;
    if (!c.classList.contains('bslot')) return 'Unequip';
    const it = ui.you?.bag?.[Number(c.dataset.i)], d = itemDef(it);
    if (!d) return null;
    if (ui.storeOpen) return 'Deposit';
    if (ui.postWrite) return 'Attach';
    if (ui.outfitFor && ui.windows.outfit?.isConnected) return 'Give';
    if (ui.vendorOpen) return 'Sell';
    if (d.slot === 'use') return 'Use';
    if (d.stats) return 'Equip';
    return null;
  };
  const showTipOn = (target) => {
    // the tooltips are wired to mouseenter: send one to the element and its parents until a tooltip shows
    ui.hideTip();
    for (let n = target; n && n !== ui.root && n !== document.body; n = n.parentElement) {
      n.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      if (ui.tip.style.display === 'block') { tipShownAt = performance.now(); const at = n.getBoundingClientRect(); placeTip(at); requestAnimationFrame(() => placeTip(at)); setTimeout(() => placeTip(at), 150); return true; }
      if (n.classList?.contains('window')) break;
    }
    return false;
  };
  // on a phone the tooltip sits clear of the finger: at the side of the screen away from the item
  const placeTip = (n) => {
    if (!root.classList.contains('phone') || ui.tip.style.display !== 'block') return;
    const t = ui.tip, r = t.getBoundingClientRect(), e = n, sb = safe(); // n: the item's rectangle when it was picked (a refresh may replace the element)
    const left = e.left + e.width / 2 > innerWidth / 2; // the item is on the right: the tooltip goes to the left edge, and so on
    t.style.left = (left ? Math.max(sb.l + 8, e.left - r.width - 12) : Math.min(innerWidth - sb.r - r.width - 8, e.right + 12)) + 'px';
    t.style.top = Math.max(8, Math.min(innerHeight - r.height - 72, e.top - 20)) + 'px'; // clear of the action bar
  };
  const select = (c) => {
    sel = keyOf(c);
    document.querySelectorAll('.tc-sel').forEach((x) => x.classList.remove('tc-sel'));
    c.classList.add('tc-sel');
    showTipOn(c);
    const a = actionFor(c);
    $('.tc-go', actBar).textContent = a || '';
    $('.tc-go', actBar).classList.toggle('hidden', !a);
    actBar.classList.remove('hidden');
  };
  const deselect = () => {
    sel = null; actBar.classList.add('hidden');
    document.querySelectorAll('.tc-sel').forEach((x) => x.classList.remove('tc-sel'));
  };
  const doAction = () => {
    const c = findSel();
    if (!c) { deselect(); ui.hideTip(); return; }
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));
    deselect(); ui.hideTip();
  };
  actBar.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('.tc-go')) doAction();
    else if (e.target.closest('.tc-link')) { const c = findSel(); if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); deselect(); ui.hideTip(); }
    else { deselect(); ui.hideTip(); }
  });
  actBar.addEventListener('pointerdown', (e) => e.stopPropagation());

  // a long touch anywhere in the interface shows that thing's tooltip (and does not also click it)
  let lastType = 'mouse';
  addEventListener('pointerdown', (e) => {
    lastType = e.pointerType;
    if (e.pointerType !== 'touch') return;
    const t = e.target;
    if (t.closest?.('.tc-act')) return;
    if (t === canvas || t.closest?.('.tc, .tc-menu')) {
      if (ui.tip.style.display === 'block' && performance.now() - tipShownAt > 200) ui.hideTip();
      if (t === canvas) deselect();
      return;
    }
    if (performance.now() - tipShownAt > 200 && !t.closest?.(CELL)) ui.hideTip();
    if (sel && !t.closest?.(CELL)) deselect();
    clearTimeout(press?.timer);
    press = { x: e.clientX, y: e.clientY, t, timer: setTimeout(() => {
      press = null;
      const c = t.closest?.(CELL);
      if (c) select(c); else if (!showTipOn(t)) return;
      eatClick = performance.now();
    }, 480) };
  }, true);
  addEventListener('pointermove', (e) => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) { clearTimeout(press.timer); press = null; } }, true);
  addEventListener('pointerup', () => { if (press) { clearTimeout(press.timer); press = null; } }, true);
  addEventListener('pointercancel', () => { if (press) { clearTimeout(press.timer); press = null; } }, true);
  addEventListener('click', (e) => {
    if (lastType !== 'touch') return;
    // a tap on the 3D view may open a dialog or the loot window: the click that follows must not land on it
    if (eatClick && performance.now() - eatClick < 900 && !e.target.closest?.('.tc')) { eatClick = 0; e.stopPropagation(); e.preventDefault(); return; }
    eatClick = 0;
    const c = e.target.closest?.(CELL);
    if (c && !e.shiftKey) {
      const k = keyOf(c);
      if (sel && sel.wcls === k.wcls && sel.sel === k.sel && findSel() === c) { doAction(); return; }
      select(c);
    }
  }, true);
  // a tap also sends the browser's stand-in mouse events: their hover would re-show or hide the tooltip at the desktop spot
  for (const t of ['mouseenter', 'mouseleave', 'mouseover', 'mouseout']) addEventListener(t, (e) => { if (e.isTrusted && lastType === 'touch') e.stopPropagation(); }, true);
  // the system long-press menu never reaches the game (the bags would read it as a right-click)
  addEventListener('contextmenu', (e) => { if (e.isTrusted && lastType === 'touch') { e.preventDefault(); e.stopPropagation(); } }, true);

  // ------------------------------------------------------------------ rectangles the nameplates keep clear of
  const rectOf = (e) => { if (!e || !e.isConnected) return null; const r = e.getBoundingClientRect(); return r.width && r.height && getComputedStyle(e).visibility !== 'hidden' ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null; };
  const union = (list) => { const rs = list.filter(Boolean); if (!rs.length) return null; return { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) }; };
  let rectCache = null, rectT = 0;
  const hudRects = () => {
    const now = performance.now();
    if (rectCache && now - rectT < 250) return rectCache;
    rectT = now;
    const q = (s) => $(s, ui.root);
    rectCache = [
      rectOf(q('.player-frame')), rectOf(q('.target-frame')),
      union([rectOf(q('.minimap')), rectOf($('.tc-top', tc)), rectOf(camBtn)]),
      union([...wheel.querySelectorAll('.tc-sk')].map(rectOf).concat([rectOf($('.tc-jump', tc)), rectOf($('.tc-dodge', tc)), rectOf($('.tc-tgt', tc))])),
      trackOpen ? union([rectOf(pill), rectOf(tracker)]) : rectOf(pill),
      rectOf($('.tc-chat', tc)), rectOf($('.tc-qb', tc)), rectOf(intBtn),
    ].filter(Boolean);
    return rectCache;
  };

  // ------------------------------------------------------------------ S6: the dodge's charges and the pinned chips
  const dodgeBtn = $('.tc-dodge', tc), dp = $('.tc-dp', dodgeBtn), pinEls = [...tc.querySelectorAll('.tc-pin')];
  let dpKey = '', pinKey = '';
  function updateKit2(t) {
    const y = game.you, c = game.dodgeC;
    const k = c ? `${c.n}` : 'x';
    if (k !== dpKey) { dpKey = k; dp.innerHTML = Array.from({ length: Math.max(2, c?.n || 0) }, (_, i) => `<i class="${!c || i < c.n ? 'on' : ''}"></i>`).join(''); }
    const pins = pinsOf(game.cls), pk = pins.join('|') + ':' + y.level;
    if (pk !== pinKey) {
      pinKey = pk;
      pinEls.forEach((b, i) => { const f = pins[i] && FUSION_BY_ID[pins[i]]; b.classList.remove('hidden'); b.classList.toggle('empty', !f); b.classList.toggle('locked', !!f && !fusionUnlocked(y, f)); const im = $('img', b); if (f) im.src = skillIcon(f); else im.removeAttribute('src'); });
    }
    pinEls.forEach((b, i) => { const f = pins[i] && FUSION_BY_ID[pins[i]]; if (!f) return; const l = Math.max(y.cds?.[f.id] || 0, y.cds?.[f.to] || 0) - t, cd = $('.tc-cd', b), bg = l > 0 ? `conic-gradient(rgba(0,0,0,.7) ${Math.min(1, l / (f.cd || 1)) * 360}deg, transparent 0)` : 'none'; if (cd.style.background !== bg) cd.style.background = bg; });
  }

  // ------------------------------------------------------------------ the per-frame state of the wheel and buttons
  let qT = 0, last = performance.now(), lastHp = 1, rideOk = null, buffN = -1;
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = (now - last) / 1000; last = now;
    const y = game.you;
    if (!y) return;
    if (builtKey !== `${game.cls}:${y.level}:${JSON.stringify(T.wheel?.[game.cls] || null)}`) buildWheel();
    const t = game.serverTime(), res = y.res, kit2 = true;
    for (const S of slots) {
      const s = S.s;
      if (!s) continue;
      const own = y.cds?.[s.id] || 0, gcd = s.gcd ? y.gcd || 0 : 0;
      const cdEnd = Math.max(own, gcd), cdLen = own > t && own >= gcd ? s.cd || 1 : 1, left = cdEnd - t;
      if (left > 0) { S.cd.style.background = `conic-gradient(rgba(0,0,0,.7) ${Math.min(1, left / cdLen) * 360}deg, transparent 0)`; S.cdt.textContent = left > 1.5 ? Math.ceil(left) : ''; }
      else if (S.cd.style.background !== 'none') { S.cd.style.background = 'none'; S.cdt.textContent = ''; }
      // a gold flash when a real cooldown (not the global one) runs out
      if (S.left > 1.2 && left <= 0) { S.el.classList.remove('ready'); void S.el.offsetWidth; S.el.classList.add('ready'); }
      S.left = left;
      S.el.classList.toggle('nores', res < skillCost(s, ui.tmods));
      S.el.classList.toggle('pressed', game.pressedSkill === s.id);
      if (kit2) morph(S, fuseFor(game, ui, s.id, t)); // (S6: the button shows the fusion it would cast in A's window)
    }
    if (kit2) updateKit2(t);
    // a red pulse at the screen's edge when a hit takes you under 35%
    const hp = y.maxHp ? y.hp / y.maxHp : 1;
    if (hp < 0.35 && hp < lastHp - 0.005 && !y.dead) { vig.classList.remove('on'); void vig.offsetWidth; vig.classList.add('on'); }
    lastHp = hp;
    // moving folds the quest list away; so does 8 s
    if (trackOpen) { trackT += dt; if (trackT > 8 || (input?.stick?.mag || 0) > 0.2) collapseTracker(); }
    updateInteract();
    qT += dt;
    if (qT > 0.4) {
      qT = 0;
      pickQuick();
      $('.tc-run', tc).classList.toggle('on', !!game.autoRun);
      $('.tc-ride', tc).classList.toggle('on', !!y.mounted);
      const ok = !!(y.runabout || y.crawler);
      if (ok !== rideOk) { rideOk = ok; $('.tc-ride', tc).style.display = ok ? '' : 'none'; layout(); }
      const sheet = Object.values(ui.windows).some((w) => w?.isConnected && !w.classList.contains('w-loot'));
      tc.classList.toggle('has-win', sheet);
      hud.classList.toggle('tc-sheet', sheet);
      const nb = $('.player-frame .buffs', ui.root)?.childElementCount || 0;
      if (nb !== buffN) { const was = buffN > 0; buffN = nb; hud.classList.toggle('has-buffs', nb > 0); if (was !== nb > 0 && T.leftHanded) layout(); const bx = $('.player-frame .buffs', ui.root); if (bx) bx.dataset.more = nb > 6 ? `+${nb - 6}` : ''; }
      if (tfPct) { const w = parseFloat($('.bar.hp i', tf)?.style.width || '100'); tfPct.textContent = tf.classList.contains('friendly') && !game.entities.get(game.target)?.data?.c ? '' : Math.round(w) + '%'; }
      updatePill();
      updateOffline();
      if (sel && !findSel()) deselect();
      else if (sel) findSel()?.classList.add('tc-sel');
    }
  };
  buildWheel();
  layout();
  requestAnimationFrame(tick);
  game.touch = { get stick() { return input?.stick; }, layout, buildWheel, hudRects, zoneTest, toggleTracker, toggleMenu, toggleChat, G }; // the off-screen checks read these too
  return { get stick() { return input?.stick; } };
}
