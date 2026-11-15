import { itemPainter, LEGACY_ICON } from './itemIcons.js';
import { ITEM_ICONS } from './icons/items/manifest.js';
import { TALENT_ICONS } from './icons/talents/manifest.js';
import { ACH_ICONS } from './icons/ach/manifest.js';
import { BUFF_ICONS } from './icons/buffs/manifest.js';
import { FACTION_ICONS } from './icons/factions/manifest.js';
import { HOME_ICONS } from './icons/home/manifest.js';
import { MENU_ICONS } from './icons/menu/manifest.js';
import { MISC_ICONS } from './icons/misc/manifest.js';
// Procedurally painted ability / item icons (no crosses or star shapes).
const cache = new Map();

function frame(x, S, base) {
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, shade(base, 1.35)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, 0.45));
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // painterly vignette
  const v = x.createRadialGradient(S * 0.4, S * 0.35, S * 0.1, S / 2, S / 2, S * 0.75);
  v.addColorStop(0, 'rgba(255,255,255,0.18)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = v; x.fillRect(0, 0, S, S);
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k), g = Math.min(255, ((n >> 8) & 255) * k), b = Math.min(255, (n & 255) * k);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const METAL = ['#fff6d8', '#e8c26a', '#7a5420'];
function metalGrad(x, x0, y0, x1, y1, pal = METAL) { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, pal[0]); g.addColorStop(0.5, pal[1]); g.addColorStop(1, pal[2]); return g; }

const DRAW = {
  blade(x, S, a = -0.8, len = 0.7) {
    x.save(); x.translate(S / 2, S / 2); x.rotate(a);
    x.fillStyle = metalGrad(x, -6, 0, 6, 0, ['#ffffff', '#cfd6e0', '#6a7280']);
    x.beginPath(); x.moveTo(-5, S * 0.18); x.lineTo(5, S * 0.18); x.lineTo(4, -S * len * 0.5); x.lineTo(0, -S * len * 0.6); x.lineTo(-4, -S * len * 0.5); x.closePath(); x.fill();
    x.fillStyle = metalGrad(x, -12, 0, 12, 0); x.beginPath(); x.arc(0, S * 0.2, 8, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#4a2e1a'; x.fillRect(-3, S * 0.22, 6, S * 0.16);
    x.restore();
  },
  slash(x, S, n = 1, color = '#fff4c0') {
    for (let i = 0; i < n; i++) {
      x.strokeStyle = color; x.lineCap = 'round';
      const off = (i - (n - 1) / 2) * S * 0.16;
      for (let w = 9; w > 0; w -= 3) { x.globalAlpha = w === 9 ? 0.25 : w === 6 ? 0.5 : 1; x.lineWidth = w; x.beginPath(); x.arc(S * 0.15 + off, S * 0.85 + off * 0.3, S * 0.62, -Math.PI * 0.45, -Math.PI * 0.05); x.stroke(); }
      x.globalAlpha = 1;
    }
  },
  shield(x, S, kind = 'kite') {
    x.save(); x.translate(S / 2, S / 2);
    x.fillStyle = metalGrad(x, -S * 0.3, -S * 0.3, S * 0.3, S * 0.3);
    x.beginPath();
    if (kind === 'round') x.arc(0, 0, S * 0.32, 0, Math.PI * 2);
    else { x.moveTo(0, S * 0.36); x.quadraticCurveTo(S * 0.32, S * 0.1, S * 0.3, -S * 0.22); x.lineTo(-S * 0.3, -S * 0.22); x.quadraticCurveTo(-S * 0.32, S * 0.1, 0, S * 0.36); }
    x.fill();
    x.fillStyle = '#2c4a9a'; x.beginPath();
    if (kind === 'round') x.arc(0, 0, S * 0.24, 0, Math.PI * 2);
    else { x.moveTo(0, S * 0.28); x.quadraticCurveTo(S * 0.24, S * 0.08, S * 0.23, -S * 0.16); x.lineTo(-S * 0.23, -S * 0.16); x.quadraticCurveTo(-S * 0.24, S * 0.08, 0, S * 0.28); }
    x.fill();
    x.fillStyle = metalGrad(x, -8, -8, 8, 8); x.beginPath(); x.arc(0, 0, S * 0.08, 0, Math.PI * 2); x.fill();
    x.restore();
  },
  arrow(x, S, a = -0.78, n = 1, spread = 0.25) {
    for (let i = 0; i < n; i++) {
      x.save(); x.translate(S / 2, S / 2); x.rotate(a + (i - (n - 1) / 2) * spread);
      x.strokeStyle = '#d8b878'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, S * 0.36); x.lineTo(0, -S * 0.3); x.stroke();
      x.fillStyle = '#e8eef4'; x.beginPath(); x.moveTo(0, -S * 0.42); x.lineTo(6, -S * 0.28); x.lineTo(-6, -S * 0.28); x.fill();
      x.fillStyle = '#f0ece0'; x.beginPath(); x.moveTo(0, S * 0.26); x.lineTo(7, S * 0.38); x.lineTo(0, S * 0.33); x.lineTo(-7, S * 0.38); x.fill();
      x.restore();
    }
  },
  flask(x, S, color = '#ff9a30', big = 1) {
    x.save(); x.translate(S / 2, S * 0.55); x.scale(big, big);
    const g = x.createRadialGradient(-6, 0, 2, 0, 4, S * 0.3); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, color); g.addColorStop(1, shade(color, 0.4));
    x.fillStyle = g; x.beginPath(); x.arc(0, 6, S * 0.24, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(-6, -S * 0.32, 12, S * 0.2);
    x.fillStyle = '#7a5230'; x.fillRect(-7, -S * 0.38, 14, 8);
    x.restore();
  },
  burst(x, S, color = '#ffb040') {
    const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S * 0.45);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = color; x.lineWidth = 3;
    for (const r of [0.22, 0.34]) { x.beginPath(); x.arc(S / 2, S / 2, S * r, 0, Math.PI * 2); x.stroke(); }
  },
  flame(x, S, color = '#ff8a20') {
    for (const [s, c] of [[1, color], [0.65, '#ffd060'], [0.35, '#fff8d0']]) {
      x.fillStyle = c; x.beginPath();
      x.moveTo(S / 2, S * (0.12 + (1 - s) * 0.3)); x.bezierCurveTo(S * (0.5 + 0.32 * s), S * 0.45, S * (0.5 + 0.28 * s), S * 0.8, S / 2, S * 0.88);
      x.bezierCurveTo(S * (0.5 - 0.28 * s), S * 0.8, S * (0.5 - 0.32 * s), S * 0.45, S / 2, S * (0.12 + (1 - s) * 0.3)); x.fill();
    }
  },
  swirl(x, S, color = '#e8d8a0') {
    x.strokeStyle = color; x.lineCap = 'round';
    for (let i = 0; i < 3; i++) { x.lineWidth = 6 - i * 1.5; x.beginPath(); x.arc(S / 2, S / 2, S * (0.14 + i * 0.1), i * 2, i * 2 + Math.PI * 1.3); x.stroke(); }
  },
  heart(x, S, color = '#ff6060') {
    x.fillStyle = color; x.beginPath(); x.moveTo(S / 2, S * 0.78);
    x.bezierCurveTo(S * 0.1, S * 0.5, S * 0.2, S * 0.18, S / 2, S * 0.35); x.bezierCurveTo(S * 0.8, S * 0.18, S * 0.9, S * 0.5, S / 2, S * 0.78); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.ellipse(S * 0.36, S * 0.38, 6, 4, -0.6, 0, Math.PI * 2); x.fill();
  },
  leaf(x, S, color = '#7ac04a') {
    x.fillStyle = color; x.beginPath(); x.moveTo(S * 0.2, S * 0.8); x.quadraticCurveTo(S * 0.15, S * 0.2, S * 0.82, S * 0.18); x.quadraticCurveTo(S * 0.8, S * 0.8, S * 0.2, S * 0.8); x.fill();
    x.strokeStyle = shade(color, 0.6); x.lineWidth = 2.5; x.beginPath(); x.moveTo(S * 0.2, S * 0.8); x.lineTo(S * 0.72, S * 0.28); x.stroke();
  },
  gear(x, S, color = '#e0b050') {
    x.save(); x.translate(S / 2, S / 2);
    x.fillStyle = metalGrad(x, -S / 3, -S / 3, S / 3, S / 3, ['#fff2c0', color, '#6a4a18']);
    x.beginPath();
    const n = 12;
    for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n; x.lineTo(Math.cos(a0) * S * 0.36, Math.sin(a0) * S * 0.36); x.lineTo(Math.cos(a0 + 0.12) * S * 0.36, Math.sin(a0 + 0.12) * S * 0.36); x.lineTo(Math.cos(a1) * S * 0.28, Math.sin(a1) * S * 0.28); x.lineTo(Math.cos(a1 + 0.14) * S * 0.28, Math.sin(a1 + 0.14) * S * 0.28); }
    x.closePath(); x.fill();
    x.fillStyle = '#2a1e10'; x.beginPath(); x.arc(0, 0, S * 0.1, 0, Math.PI * 2); x.fill();
    x.restore();
  },
  hammer(x, S) {
    x.save(); x.translate(S / 2, S / 2); x.rotate(-0.7);
    x.fillStyle = '#6a4a2a'; x.fillRect(-3, -S * 0.1, 6, S * 0.48);
    x.fillStyle = metalGrad(x, -S * 0.25, 0, S * 0.25, 0, ['#d8dce4', '#7a808c', '#3a3e48']); x.fillRect(-S * 0.24, -S * 0.32, S * 0.48, S * 0.22);
    x.fillStyle = '#e8c26a'; x.fillRect(-S * 0.27, -S * 0.33, 5, S * 0.24); x.fillRect(S * 0.24 - 2, -S * 0.33, 5, S * 0.24);
    x.restore();
  },
  cloud(x, S, color = '#b8b8b0') {
    x.fillStyle = color;
    for (const [cx, cy, r] of [[0.35, 0.58, 0.18], [0.55, 0.48, 0.22], [0.7, 0.62, 0.16], [0.48, 0.66, 0.18]]) { x.beginPath(); x.arc(S * cx, S * cy, S * r, 0, Math.PI * 2); x.fill(); }
  },
  ring(x, S, color = '#ffd870') { x.strokeStyle = color; x.lineWidth = 5; x.beginPath(); x.arc(S / 2, S / 2, S * 0.32, 0, Math.PI * 2); x.stroke(); x.lineWidth = 2; x.beginPath(); x.arc(S / 2, S / 2, S * 0.2, 0, Math.PI * 2); x.stroke(); },
  boot(x, S) { x.fillStyle = '#7a5232'; x.beginPath(); x.moveTo(S * 0.35, S * 0.2); x.lineTo(S * 0.55, S * 0.2); x.lineTo(S * 0.55, S * 0.6); x.lineTo(S * 0.8, S * 0.68); x.lineTo(S * 0.8, S * 0.8); x.lineTo(S * 0.3, S * 0.8); x.closePath(); x.fill(); },
  fist(x, S) { x.fillStyle = '#c8cdd6'; x.beginPath(); x.roundRect(S * 0.28, S * 0.3, S * 0.44, S * 0.42, 8); x.fill(); x.fillStyle = '#8a909c'; for (let i = 0; i < 4; i++) x.fillRect(S * 0.3 + i * S * 0.1, S * 0.32, 3, S * 0.16); },
  banner(x, S) { x.fillStyle = '#6a4a2a'; x.fillRect(S * 0.24, S * 0.12, 4, S * 0.76); x.fillStyle = '#2c4a9a'; x.beginPath(); x.moveTo(S * 0.28, S * 0.16); x.lineTo(S * 0.78, S * 0.16); x.lineTo(S * 0.78, S * 0.56); x.lineTo(S * 0.53, S * 0.68); x.lineTo(S * 0.28, S * 0.56); x.fill(); x.fillStyle = '#e8c26a'; x.beginPath(); x.arc(S * 0.53, S * 0.36, S * 0.1, 0, Math.PI * 2); x.fill(); },
  bow(x, S) { x.strokeStyle = '#a8784a'; x.lineWidth = 5; x.beginPath(); x.arc(S * 0.15, S * 0.5, S * 0.42, -1.1, 1.1); x.stroke(); x.strokeStyle = '#e8e0c8'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(S * 0.34, S * 0.12); x.lineTo(S * 0.34, S * 0.88); x.stroke(); },
  potion(x, S) { DRAW.flask(x, S, '#ff5050'); },
  person(x, S, color = '#e8c26a') { x.fillStyle = color; x.beginPath(); x.arc(S / 2, S * 0.3, S * 0.12, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(S * 0.3, S * 0.82); x.quadraticCurveTo(S / 2, S * 0.35, S * 0.7, S * 0.82); x.fill(); },
  drop(x, S, color = '#8ae040') { x.fillStyle = color; x.beginPath(); x.moveTo(S / 2, S * 0.15); x.bezierCurveTo(S * 0.8, S * 0.55, S * 0.75, S * 0.85, S / 2, S * 0.85); x.bezierCurveTo(S * 0.25, S * 0.85, S * 0.2, S * 0.55, S / 2, S * 0.15); x.fill(); },
  crater(x, S) { x.fillStyle = '#3a2a1a'; x.beginPath(); x.ellipse(S / 2, S * 0.62, S * 0.34, S * 0.14, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#e8d0a0'; x.lineWidth = 2; for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.1 + i * 0.13); x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * S * 0.12, S * 0.55 + Math.sin(a) * S * 0.12); x.lineTo(S / 2 + Math.cos(a) * S * 0.38, S * 0.55 + Math.sin(a) * S * 0.38); x.stroke(); } },
  lantern(x, S) { x.fillStyle = '#c89a40'; x.fillRect(S * 0.36, S * 0.2, S * 0.28, 5); x.fillRect(S * 0.36, S * 0.72, S * 0.28, 5); const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S * 0.3); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#c8ff8a'); g.addColorStop(1, 'rgba(120,200,80,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); },
};

// icon key -> painter
const MAP = {
  slash: (x, S) => DRAW.blade(x, S, -0.8), twin: (x, S) => { DRAW.blade(x, S, -0.6); DRAW.slash(x, S, 2); }, rise: (x, S) => { DRAW.blade(x, S, 0.5); DRAW.slash(x, S, 1); },
  arc: (x, S) => { DRAW.slash(x, S, 3, '#ffe8a0'); }, thrust: (x, S) => DRAW.blade(x, S, -1.57, 0.8), stab: (x, S) => DRAW.blade(x, S, Math.PI, 0.8),
  shield: (x, S) => DRAW.shield(x, S), stance: (x, S) => { DRAW.shield(x, S); DRAW.ring(x, S, '#9ac8ff'); }, bastion: (x, S) => { DRAW.burst(x, S, '#ffd060'); DRAW.shield(x, S); },
  banner: DRAW.banner, leap: (x, S) => { DRAW.blade(x, S, Math.PI * 0.85); DRAW.crater(x, S); }, heart: (x, S) => DRAW.heart(x, S, '#ffd070'),
  spin: (x, S) => { DRAW.swirl(x, S, '#ffe8a0'); DRAW.blade(x, S, -0.4, 0.5); }, fist: DRAW.fist, disc: (x, S) => DRAW.shield(x, S, 'round'),
  parry: (x, S) => { DRAW.blade(x, S, -0.5); DRAW.burst(x, S, 'rgba(255,255,255,0.6)'); }, charge: (x, S) => { DRAW.shield(x, S); DRAW.slash(x, S, 2, '#e8d8b0'); },
  shout: (x, S) => { DRAW.ring(x, S, '#ff9a6a'); DRAW.person(x, S, '#ffd8b0'); }, wave: (x, S) => { DRAW.slash(x, S, 2, '#e8c890'); DRAW.cloud(x, S, '#c8a878'); }, crown: (x, S) => { DRAW.burst(x, S, '#ffd060'); DRAW.blade(x, S, Math.PI * 0.85); },
  arrow: (x, S) => DRAW.arrow(x, S), aim: (x, S) => { DRAW.ring(x, S, '#ff7050'); DRAW.arrow(x, S); }, twinarrow: (x, S) => DRAW.arrow(x, S, -0.78, 2), rain: (x, S) => DRAW.arrow(x, S, Math.PI, 3, 0.2),
  cripple: (x, S) => { DRAW.arrow(x, S, 0.4); DRAW.boot(x, S); }, backflip: (x, S) => { DRAW.swirl(x, S, '#c8e0a0'); DRAW.person(x, S, '#e8f0d0'); }, pierce: (x, S) => DRAW.arrow(x, S, -1.57),
  trap: (x, S) => DRAW.gear(x, S, '#8a8a90'), barrage: (x, S) => DRAW.arrow(x, S, -0.78, 4, 0.12), dagger: (x, S) => DRAW.blade(x, S, 0.7, 0.45), mark: (x, S) => DRAW.ring(x, S, '#ff5040'),
  blast: (x, S) => { DRAW.burst(x, S, '#ff8a30'); DRAW.arrow(x, S); }, kick: DRAW.boot, smoke: (x, S) => DRAW.cloud(x, S), arcing: (x, S) => DRAW.arrow(x, S, 0.3), breath: (x, S) => { DRAW.swirl(x, S, '#e8ffd0'); },
  fan: (x, S) => DRAW.arrow(x, S, -1.57, 5, 0.22), pin: (x, S) => DRAW.arrow(x, S, Math.PI), roll: (x, S) => DRAW.swirl(x, S, '#d8c890'), storm: (x, S) => { DRAW.burst(x, S, '#ffe0a0'); DRAW.arrow(x, S, Math.PI, 5, 0.15); },
  flame: (x, S) => DRAW.flame(x, S), acid: (x, S) => DRAW.flask(x, S, '#8ae040'), gear: (x, S) => DRAW.gear(x, S), frost: (x, S) => DRAW.cloud(x, S, '#d8f0ff'), volatile: (x, S) => DRAW.flask(x, S, '#c070ff', 1.15),
  tar: (x, S) => DRAW.drop(x, S, '#2a2018'), spark: (x, S) => { DRAW.gear(x, S); DRAW.burst(x, S, 'rgba(255,200,80,0.7)'); }, burst: (x, S) => DRAW.burst(x, S, '#ffd090'), potion: (x, S) => DRAW.flask(x, S, '#ff5050'),
  grenade: (x, S) => DRAW.flask(x, S, '#5a5a5a'), cloud: (x, S) => DRAW.cloud(x, S, '#8ac050'), flash: (x, S) => DRAW.burst(x, S, '#ffffff'), catalyst: (x, S) => { DRAW.flask(x, S, '#c49aff'); DRAW.ring(x, S, '#e0c0ff'); },
  chain: (x, S) => { DRAW.flask(x, S, '#ff9a30', 0.7); }, firewave: (x, S) => { DRAW.flame(x, S); DRAW.slash(x, S, 1, '#ffb050'); }, vault: (x, S) => DRAW.swirl(x, S, '#e0c890'), elixir: (x, S) => DRAW.flask(x, S, '#60d0ff'),
  clock: (x, S) => { DRAW.gear(x, S, '#d0a040'); DRAW.ring(x, S, '#ff4030'); }, cask: (x, S) => { DRAW.burst(x, S, '#ff7020'); DRAW.flame(x, S); },
  step: (x, S) => DRAW.cloud(x, S, '#e8cc96'), feint: (x, S) => { DRAW.blade(x, S, -0.2, 0.5); DRAW.swirl(x, S, '#ffe0b0'); }, flameblade: (x, S) => { DRAW.flame(x, S, '#ff6020'); DRAW.blade(x, S, -0.8, 0.6); },
  evade: (x, S) => { DRAW.swirl(x, S, '#f0d8a0'); DRAW.person(x, S, '#ffe8c0'); }, rend: (x, S) => DRAW.slash(x, S, 3, '#ffd0a0'), whirlwind: (x, S) => { DRAW.swirl(x, S, '#e8c890'); DRAW.cloud(x, S, '#d8bc88'); },
  sweep: (x, S) => { DRAW.slash(x, S, 1); DRAW.boot(x, S); }, execute: (x, S) => { DRAW.blade(x, S, Math.PI * 0.8, 0.7); DRAW.burst(x, S, 'rgba(255,90,40,0.6)'); }, cloak: (x, S) => DRAW.cloud(x, S, '#c8b080'),
  hammer: DRAW.hammer, pound: (x, S) => { DRAW.crater(x, S); DRAW.hammer(x, S); }, wall: (x, S) => { DRAW.shield(x, S); DRAW.crater(x, S); }, iron: (x, S) => { DRAW.ring(x, S, '#c8d8ff'); DRAW.fist(x, S); },
  fissure: (x, S) => DRAW.crater(x, S), toss: (x, S) => { DRAW.swirl(x, S, '#c8d8ff'); DRAW.hammer(x, S); }, combo: (x, S) => { DRAW.shield(x, S); DRAW.slash(x, S, 2); }, ring: (x, S) => { DRAW.ring(x, S, '#ffe0a0'); DRAW.hammer(x, S); },
  stand: (x, S) => { DRAW.heart(x, S, '#ff7050'); }, stomp: (x, S) => { DRAW.boot(x, S); DRAW.ring(x, S, '#c8b090'); }, shatter: (x, S) => { DRAW.hammer(x, S); DRAW.burst(x, S, 'rgba(200,210,230,0.6)'); },
  deflect: (x, S) => { DRAW.shield(x, S); DRAW.arrow(x, S, 2.4); }, pulverize: (x, S) => { DRAW.hammer(x, S); DRAW.slash(x, S, 3, '#c8d8ff'); }, crater: (x, S) => { DRAW.crater(x, S); DRAW.burst(x, S, 'rgba(255,220,160,0.5)'); },
  salve: (x, S) => DRAW.drop(x, S, '#8aff6a'), staff: (x, S) => { x.fillStyle = '#7a5230'; x.save(); x.translate(S / 2, S / 2); x.rotate(-0.7); x.fillRect(-3, -S * 0.4, 6, S * 0.8); x.restore(); DRAW.lantern(x, S); },
  dart: (x, S) => DRAW.arrow(x, S, -0.78), leaf: (x, S) => DRAW.leaf(x, S), net: (x, S) => DRAW.ring(x, S, '#c8b080'), tonic: (x, S) => DRAW.flask(x, S, '#60ff9a'), flurry: (x, S) => DRAW.slash(x, S, 3, '#c8ff9a'),
  powder: (x, S) => DRAW.cloud(x, S, '#e8d890'), bloom: (x, S) => { DRAW.burst(x, S, '#c8ff9a'); DRAW.leaf(x, S); }, bandage: (x, S) => { x.fillStyle = '#efe6d0'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.25, 0, Math.PI * 2); x.fill(); x.fillStyle = '#c8b890'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.1, 0, Math.PI * 2); x.fill(); },
  antidote: (x, S) => DRAW.flask(x, S, '#9adcff'), seed: (x, S) => { DRAW.drop(x, S, '#8a6a3a'); DRAW.leaf(x, S, '#6aa83a'); }, bark: (x, S) => DRAW.shield(x, S, 'round'), lantern: DRAW.lantern,
  brew: (x, S) => DRAW.flask(x, S, '#9affc0', 1.1), swift: (x, S) => { DRAW.boot(x, S); DRAW.leaf(x, S, '#c8e070'); }, uproot: (x, S) => { DRAW.crater(x, S); DRAW.leaf(x, S); }, sap: (x, S) => DRAW.drop(x, S, '#ffb040'),
  remedy: (x, S) => { DRAW.burst(x, S, '#d0ffb0'); DRAW.heart(x, S, '#8aff8a'); },
  // items
  ring_item: (x, S) => DRAW.ring(x, S), mushroom: (x, S) => { x.fillStyle = '#e8e0c8'; x.fillRect(S * 0.44, S * 0.45, S * 0.12, S * 0.35); x.fillStyle = '#c8ff8a'; x.beginPath(); x.arc(S / 2, S * 0.45, S * 0.26, Math.PI, 0); x.fill(); },
  bread: (x, S) => { x.fillStyle = '#c8904a'; x.beginPath(); x.ellipse(S / 2, S * 0.56, S * 0.32, S * 0.2, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#8a5a2a'; x.lineWidth = 3; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(S / 2 + i * 10 - 4, S * 0.46); x.lineTo(S / 2 + i * 10 + 4, S * 0.62); x.stroke(); } },
  scrap: (x, S) => DRAW.gear(x, S, '#8a7a60'), spring: (x, S) => DRAW.swirl(x, S, '#c8c8c8'), sword: (x, S) => DRAW.blade(x, S), boots: DRAW.boot, gloves: DRAW.fist, helm: (x, S) => { x.fillStyle = metalGrad(x, 0, 0, S, S, ['#ffffff', '#b8bec8', '#5a606a']); x.beginPath(); x.arc(S / 2, S * 0.55, S * 0.3, Math.PI, 0); x.lineTo(S * 0.8, S * 0.78); x.lineTo(S * 0.2, S * 0.78); x.fill(); x.fillStyle = '#111'; x.fillRect(S * 0.3, S * 0.52, S * 0.4, 5); },
  chest: (x, S) => { x.fillStyle = metalGrad(x, 0, 0, S, S, ['#ffffff', '#b8bec8', '#5a606a']); x.beginPath(); x.moveTo(S * 0.25, S * 0.25); x.lineTo(S * 0.75, S * 0.25); x.lineTo(S * 0.7, S * 0.8); x.lineTo(S * 0.3, S * 0.8); x.fill(); },
  legs: (x, S) => { x.fillStyle = '#8a8070'; x.fillRect(S * 0.3, S * 0.2, S * 0.17, S * 0.6); x.fillRect(S * 0.53, S * 0.2, S * 0.17, S * 0.6); }, shoulders: (x, S) => { x.fillStyle = metalGrad(x, 0, 0, S, S); x.beginPath(); x.arc(S * 0.3, S * 0.55, S * 0.2, Math.PI, 0); x.arc(S * 0.7, S * 0.55, S * 0.2, Math.PI, 0); x.fill(); },
  cloak_item: (x, S) => { x.fillStyle = '#4a6a2a'; x.beginPath(); x.moveTo(S * 0.35, S * 0.2); x.lineTo(S * 0.65, S * 0.2); x.lineTo(S * 0.8, S * 0.85); x.lineTo(S * 0.2, S * 0.85); x.fill(); },
  charm: (x, S) => DRAW.drop(x, S, '#c8ff8a'), cloth: (x, S) => DRAW.cloud(x, S, '#a89878'),
  flask: (x, S) => DRAW.flask(x, S, '#c8a050', 1), blade: (x, S) => DRAW.blade(x, S), boot: (x, S) => DRAW.boot(x, S), person: (x, S) => DRAW.person(x, S),
  satchel: (x, S) => {
    x.lineCap = 'round';
    x.strokeStyle = '#5a3e1c'; x.lineWidth = S * 0.06; x.beginPath(); x.moveTo(S * 0.3, S * 0.42); x.quadraticCurveTo(S * 0.5, S * 0.06, S * 0.7, S * 0.42); x.stroke();
    x.fillStyle = '#a07e46'; x.strokeStyle = '#3a2810'; x.lineWidth = S * 0.03;
    x.beginPath(); x.roundRect(S * 0.2, S * 0.38, S * 0.6, S * 0.44, S * 0.08); x.fill(); x.stroke();
    x.fillStyle = '#7a5a2c'; x.beginPath(); x.moveTo(S * 0.2, S * 0.42); x.lineTo(S * 0.8, S * 0.42); x.lineTo(S * 0.74, S * 0.62); x.lineTo(S * 0.26, S * 0.62); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#e0b84a'; x.fillRect(S * 0.46, S * 0.57, S * 0.08, S * 0.09);
  },
  head: (x, S) => MAP.helm(x, S), feet: DRAW.boot, hands: DRAW.fist, weapon: (x, S) => DRAW.blade(x, S), offhand: (x, S) => DRAW.shield(x, S), trinket: (x, S) => DRAW.ring(x, S), back: (x, S) => MAP.cloak_item(x, S),
  // quest giver fallback: a plain timber notice board on one post with a square red wax seal (no flag)
  notice: (x, S) => {
    x.fillStyle = '#5a3e1c'; x.fillRect(S * 0.46, S * 0.5, S * 0.08, S * 0.36);
    x.fillStyle = '#a07e46'; x.strokeStyle = '#3a2810'; x.lineWidth = S * 0.03;
    x.fillRect(S * 0.2, S * 0.16, S * 0.6, S * 0.4); x.strokeRect(S * 0.2, S * 0.16, S * 0.6, S * 0.4);
    x.fillStyle = '#efe0b8'; x.fillRect(S * 0.28, S * 0.22, S * 0.3, S * 0.28);
    x.fillStyle = '#b02e12'; x.fillRect(S * 0.6, S * 0.36, S * 0.12, S * 0.12);
  },
  stun: (x, S) => { DRAW.hammer(x, S); x.fillStyle = '#ffe060'; x.fillRect(S * 0.56, S * 0.16, S * 0.26, S * 0.06); x.fillRect(S * 0.62, S * 0.28, S * 0.2, S * 0.06); }, // a hammer blow, no rings root: (x, S) => DRAW.leaf(x, S, '#6a8a3a'), slow: DRAW.boot,
};

// painted item art (generated on the GPU by tools/gen_icons.py) wins over the drawn icons when it exists
export function itemArt(key) {
  for (const k of [key, LEGACY_ICON[key]]) {
    if (!k) continue;
    const safe = String(k).replace('~', '_');
    if (ITEM_ICONS.has(safe)) return `/sunmere-play/ui/icons/items/${safe}.webp`;
  }
  return null;
}
export function icon(key, color = '#5a4a3a', size = 64) {
  const art = itemArt(key);
  if (art) return art;
  const k = key + color + size;
  if (cache.has(k)) return cache.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  frame(x, size, color);
  const fn = itemPainter(key) || itemPainter(LEGACY_ICON[key] || '') || MAP[key] || MAP[key + '_item'] || ((xx, SS) => { xx.fillStyle = '#c8b48a'; xx.fillRect(SS * 0.3, SS * 0.3, SS * 0.4, SS * 0.4); });
  x.save();
  try { fn(x, size); } catch (e) { DRAW.burst(x, size); }
  x.restore();
  // bevel
  x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, size - 3, size - 3);
  x.strokeStyle = 'rgba(255,240,200,0.25)'; x.lineWidth = 1; x.strokeRect(3.5, 3.5, size - 7, size - 7);
  const url = c.toDataURL();
  cache.set(k, url);
  return url;
}

// Painted ability art (Codex sheets sliced by tools/slice_icons.py), one file per skill id.
export function skillIcon(skill) { return `/sunmere-play/ui/icons/${skill.id}.webp`; }

// Painted Codex art listed by tools/art_manifests.mjs. Each returns null when the file is missing, so callers keep
// their procedural or skill-icon fallback.
const art = (set, dir, k) => (k && set.has(k) ? `/sunmere-play/ui/icons/${dir}/${k}.webp` : null);
export const talentArt = (t) => art(TALENT_ICONS, 'talents', t.id);
export const pathArt = (cls, P) => art(TALENT_ICONS, 'talents', `path_${cls}_${P.name.toLowerCase().replace(/[^a-z]/g, '')}`);
const BUFF_KEY = { Stunned: 'stun', Rooted: 'root', Slowed: 'slow', Sharpened: 'sharpened', Riveted: 'riveted', 'Well Fed': 'wellfed', Hearty: 'hearty', Oiled: 'oiled' };
export const buffArt = (b) => art(BUFF_ICONS, 'buffs', BUFF_KEY[b.name] || (b.icon ? null : 'generic'));
export const achArt = (a) => `/sunmere-play/ui/icons/ach/${ACH_ICONS.has(a.id) ? a.id : a.cat.toLowerCase()}.webp`;
export const factionArt = (id) => art(FACTION_ICONS, 'factions', id);
export const homeArt = (id) => art(HOME_ICONS, 'home', id);
export const menuArt = (id) => art(MENU_ICONS, 'menu', id);
export const miscArt = (id) => art(MISC_ICONS, 'misc', id);
