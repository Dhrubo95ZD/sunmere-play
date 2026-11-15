// Sound effects synthesized from filtered noise only (no music, no pitched tones).
import { SETTINGS } from '../engine/settings.js';
export class SFX {
  constructor() {
    this.ctx = null;
    this.last = {};
    this.volume = SETTINGS.volume;
    // fall silent whenever the game window is not the one you are using (a film, another app)
    const bg = () => this.applyVolume();
    addEventListener('blur', bg); addEventListener('focus', bg); document.addEventListener('visibilitychange', bg);
    const unlock = () => { this.init(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.level();
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // brown noise for rumbles
    this.brown = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lastOut = (lastOut + 0.02 * w) / 1.02; b[i] = lastOut * 3.5; }
  }
  level() {
    const away = SETTINGS.bgMute && (document.hidden || !document.hasFocus());
    return SETTINGS.muted || away ? 0 : SETTINGS.volume;
  }
  applyVolume() { if (this.master) this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.08); }
  // one noise burst: filter type/freq sweep, gain envelope
  burst({ type = 'bandpass', f0 = 1000, f1 = f0, q = 0.8, a = 0.005, d = 0.2, gain = 0.4, brown = false, delay = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 1.5, a + d + 0.05);
  }
  // a continuous noise bed (rain hiss, storm wind) faded to the given level
  loop(name, gain) {
    if (!this.ctx) return;
    this.loops = this.loops || {};
    let L = this.loops[name];
    if (!L) {
      if (gain < 0.005) return;
      const c = this.ctx, src = c.createBufferSource();
      // a source's buffer can be set only once, so pick it up front
      src.buffer = name === 'wind' || name === 'water' || name === 'engine' || name === 'hum' ? this.brown : this.noise; src.loop = true;
      const f = c.createBiquadFilter();
      if (name === 'wind') { f.type = 'lowpass'; f.frequency.value = 600; }
      else if (name === 'water') { f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.7; }
      else if (name === 'breeze') { f.type = 'lowpass'; f.frequency.value = 420; }
      else if (name === 'engine') { f.type = 'lowpass'; f.frequency.value = 170; f.Q.value = 2.5; }
      else if (name === 'hum') { f.type = 'lowpass'; f.frequency.value = 95; f.Q.value = 4; } // the Deepway: water moving in the deep wells
      else { f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.35; }
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      L = this.loops[name] = { g };
    }
    L.g.gain.setTargetAtTime(Math.max(0, gain), this.ctx.currentTime, 0.6);
  }
  play(name, vol = 1) {
    if (!this.ctx) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 35) return;
    this.last[name] = now;
    const v = vol;
    switch (name) {
      case 'swing': this.burst({ f0: 2200, f1: 500, q: 1.2, a: 0.03, d: 0.16, gain: 0.25 * v }); break;
      case 'whoosh': case 'throw': this.burst({ f0: 1400, f1: 300, q: 0.9, a: 0.06, d: 0.26, gain: 0.28 * v }); break;
      case 'hit': this.burst({ type: 'lowpass', f0: 2600, f1: 600, q: 0.7, a: 0.002, d: 0.12, gain: 0.5 * v }); this.burst({ type: 'lowpass', f0: 300, f1: 90, a: 0.002, d: 0.14, gain: 0.5 * v, brown: true }); break;
      case 'thud': this.burst({ type: 'lowpass', f0: 500, f1: 80, q: 0.8, a: 0.003, d: 0.22, gain: 0.8 * v, brown: true }); break;
      case 'clang': this.burst({ type: 'highpass', f0: 3000, f1: 2000, q: 0.7, a: 0.001, d: 0.18, gain: 0.35 * v }); this.burst({ type: 'bandpass', f0: 1800, f1: 1200, q: 1.4, a: 0.001, d: 0.25, gain: 0.25 * v }); break;
      case 'boom': this.burst({ type: 'lowpass', f0: 900, f1: 40, q: 0.6, a: 0.005, d: 0.9, gain: 1.0 * v, brown: true }); this.burst({ type: 'lowpass', f0: 3000, f1: 200, a: 0.002, d: 0.25, gain: 0.4 * v }); break;
      case 'glass': for (let i = 0; i < 5; i++) this.burst({ type: 'highpass', f0: 4000 + Math.random() * 3000, q: 1, a: 0.001, d: 0.05 + Math.random() * 0.08, gain: 0.18 * v, delay: i * 0.025 }); break;
      case 'fire': for (let i = 0; i < 6; i++) this.burst({ type: 'bandpass', f0: 600 + Math.random() * 1500, q: 0.6, a: 0.01, d: 0.1, gain: 0.15 * v, delay: Math.random() * 0.5 }); this.burst({ type: 'lowpass', f0: 800, f1: 200, a: 0.05, d: 0.7, gain: 0.25 * v }); break;
      case 'hiss': this.burst({ type: 'highpass', f0: 3000, f1: 5000, q: 0.5, a: 0.05, d: 0.6, gain: 0.18 * v }); break;
      case 'splat': this.burst({ type: 'lowpass', f0: 900, f1: 200, a: 0.002, d: 0.18, gain: 0.5 * v }); break;
      case 'puff': this.burst({ type: 'lowpass', f0: 1200, f1: 300, q: 0.5, a: 0.03, d: 0.4, gain: 0.35 * v }); break;
      case 'heal': this.burst({ type: 'bandpass', f0: 2500, f1: 4500, q: 0.4, a: 0.25, d: 0.6, gain: 0.12 * v }); break;
      case 'shout': this.burst({ type: 'bandpass', f0: 500, f1: 300, q: 0.7, a: 0.05, d: 0.5, gain: 0.6 * v, brown: true }); this.burst({ type: 'lowpass', f0: 1500, f1: 400, a: 0.05, d: 0.5, gain: 0.25 * v }); break;
      case 'bow': this.burst({ type: 'highpass', f0: 1500, f1: 800, q: 0.7, a: 0.001, d: 0.06, gain: 0.3 * v }); this.burst({ f0: 1800, f1: 400, q: 1, a: 0.02, d: 0.18, gain: 0.18 * v, delay: 0.02 }); break;
      case 'tick': this.burst({ type: 'highpass', f0: 5000, q: 0.7, a: 0.001, d: 0.015, gain: 0.25 * v }); break;
      case 'grind': for (let i = 0; i < 8; i++) this.burst({ type: 'bandpass', f0: 2500 + Math.random() * 2000, q: 0.8, a: 0.005, d: 0.05, gain: 0.12 * v, delay: i * 0.06 }); break;
      // the Makers' automata: a sweeper's brush drum, a counterweight's chain
      case 'brush': for (let i = 0; i < 3; i++) this.burst({ type: 'bandpass', f0: 3200 + Math.random() * 1200, f1: 1800, q: 0.5, a: 0.04, d: 0.22, gain: 0.07 * v, delay: i * 0.11 }); break;
      case 'chain': for (let i = 0; i < 3; i++) this.burst({ type: 'highpass', f0: 3800 + Math.random() * 1800, q: 1.4, a: 0.001, d: 0.06, gain: 0.1 * v, delay: i * 0.07 + Math.random() * 0.03 }); break;
      case 'step': this.burst({ type: 'lowpass', f0: 700, f1: 200, a: 0.002, d: 0.07, gain: 0.12 * v }); break;
      case 'ui': this.burst({ type: 'highpass', f0: 2500, q: 0.6, a: 0.001, d: 0.03, gain: 0.15 * v }); break;
      case 'loot': this.burst({ type: 'highpass', f0: 3500, f1: 5000, q: 0.5, a: 0.01, d: 0.12, gain: 0.15 * v }); break;
      // hot steel into water (a Prismatic find, upgrades from +7): a hard sizzle onset, a long falling hiss, a few crackles
      case 'quench':
        this.burst({ type: 'highpass', f0: 2500, f1: 6000, q: 0.4, a: 0.01, d: 0.25, gain: 0.3 * v });
        this.burst({ type: 'bandpass', f0: 5200, f1: 1600, q: 0.45, a: 0.08, d: 1.5, gain: 0.2 * v, delay: 0.06 });
        this.burst({ type: 'lowpass', f0: 600, f1: 120, q: 0.6, a: 0.02, d: 0.5, gain: 0.25 * v, brown: true });
        for (let i = 0; i < 6; i++) this.burst({ type: 'highpass', f0: 4500 + Math.random() * 2500, q: 0.8, a: 0.001, d: 0.02 + Math.random() * 0.03, gain: 0.09 * v, delay: 0.15 + Math.random() * 0.9 });
        break;
      // a smith's hammer on the anvil: three blows, the last the heaviest (an upgrade step)
      case 'hammer':
        for (let i = 0; i < 3; i++) {
          const k = i === 2 ? 1.3 : 0.85, t = i * 0.26;
          this.burst({ type: 'highpass', f0: 3200, f1: 2200, q: 0.7, a: 0.001, d: 0.14, gain: 0.3 * v * k, delay: t });
          this.burst({ type: 'bandpass', f0: 2000, f1: 1500, q: 1.2, a: 0.001, d: 0.2, gain: 0.2 * v * k, delay: t });
          this.burst({ type: 'lowpass', f0: 420, f1: 90, q: 0.7, a: 0.002, d: 0.16, gain: 0.45 * v * k, brown: true, delay: t });
        }
        break;
      // the Deadeye's pistols, all filtered noise (no tones): a black-powder shot is a sharp crack, a body of mid noise,
      // a low thump and a short hiss tail; a heavy charge adds a longer boom
      case 'shot':
        this.burst({ type: 'highpass', f0: 2600, f1: 1200, q: 0.7, a: 0.001, d: 0.05, gain: 0.45 * v });
        this.burst({ type: 'bandpass', f0: 900, f1: 280, q: 0.6, a: 0.002, d: 0.13, gain: 0.4 * v });
        this.burst({ type: 'lowpass', f0: 320, f1: 60, q: 0.7, a: 0.002, d: 0.22, gain: 0.55 * v, brown: true });
        this.burst({ type: 'highpass', f0: 3200, f1: 2400, q: 0.4, a: 0.02, d: 0.3, gain: 0.06 * v, delay: 0.03 });
        break;
      case 'shotbig':
        this.burst({ type: 'highpass', f0: 2200, f1: 900, q: 0.7, a: 0.001, d: 0.07, gain: 0.55 * v });
        this.burst({ type: 'lowpass', f0: 700, f1: 45, q: 0.6, a: 0.004, d: 0.6, gain: 0.85 * v, brown: true });
        this.burst({ type: 'highpass', f0: 3000, f1: 2000, q: 0.4, a: 0.03, d: 0.45, gain: 0.08 * v, delay: 0.04 });
        break;
      // a hammer falling, a lock snapped shut: two tiny dry ticks
      case 'click': this.burst({ type: 'highpass', f0: 4800, q: 0.8, a: 0.001, d: 0.012, gain: 0.3 * v }); this.burst({ type: 'highpass', f0: 3600, q: 0.8, a: 0.001, d: 0.016, gain: 0.22 * v, delay: 0.035 }); break;
      case 'thump': this.burst({ type: 'lowpass', f0: 420, f1: 80, q: 0.7, a: 0.003, d: 0.18, gain: 0.6 * v, brown: true }); this.burst({ type: 'lowpass', f0: 1400, f1: 300, a: 0.01, d: 0.2, gain: 0.18 * v }); break;
      // powder poured from the flask (a soft sandy hiss), a ramrod seated (two short dull taps)
      case 'pour': this.burst({ type: 'bandpass', f0: 3200, f1: 2600, q: 0.5, a: 0.05, d: 0.32, gain: 0.08 * v }); break;
      case 'ram': for (let i = 0; i < 2; i++) this.burst({ type: 'lowpass', f0: 900, f1: 250, q: 0.8, a: 0.002, d: 0.05, gain: 0.25 * v, delay: i * 0.11 }); break;
      case 'levelup': for (let i = 0; i < 4; i++) this.burst({ type: 'bandpass', f0: 1500 + i * 800, q: 0.5, a: 0.05, d: 0.5, gain: 0.12 * v, delay: i * 0.12 }); break;
    }
  }
}
