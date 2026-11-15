// Zone ambience: particles around the camera focus that sell each biome.
import * as THREE from 'three';
import { TEX } from './fx.js';
import { G } from '../engine/globals.js';

const C = (h) => new THREE.Color(h);
const r = (a, b) => a + (b - a) * Math.random();

export class Ambient {
  constructor(fx, terrain) {
    this.fx = fx;
    this.T = terrain;
    this.acc = { motes: 0, dust: 0, ember: 0, ash: 0, leaf: 0, pollen: 0 };
  }
  update(dt, focus, indoor = null, weather = null) {
    if (indoor) {
      // underground: dust hanging in the lamplight, embers from the foundry fires
      const R = 22;
      this.acc.motes += dt * 10;
      while (this.acc.motes > 1) { this.acc.motes--; const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, r(0.4, 3), focus.z + Math.sin(a) * d); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(r(-0.08, 0.08), r(-0.04, 0.04), r(-0.08, 0.08)), age: 0, life: r(4, 7), size: r(0.04, 0.07), tex: TEX.glow, alpha: indoor === 'workshop' ? 0.28 : 0.5, rot: 0, color: C(indoor === 'vault' ? '#f0d8a0' : indoor === 'workshop' ? '#b89868' : '#d8c8b0'), fadeIn: 1.5, fadePow: 2 }); }
      // the Sluice Galleries and the Great Dam: fine spray and frost drifting down through the lamplight, now and then a drip off the icicles
      if (indoor === 'sluice' || indoor === 'dam' || indoor === 'pump' || indoor === 'mills' || indoor === 'seagate') { this.acc.ash += dt * (indoor === 'dam' ? 15 : 12); while (this.acc.ash > 1) { this.acc.ash--; const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, r(1.5, 4.5), focus.z + Math.sin(a) * d); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(r(-0.15, 0.15), r(-0.5, -0.2), r(-0.15, 0.15)), age: 0, life: r(3, 6), size: r(0.04, 0.08), tex: TEX.glow, alpha: 0.7, rot: 0, color: C('#e8f4ff'), fadeIn: 0.8, fadePow: 2 }); } }
      if (indoor === 'foundry' || indoor === 'ore' || indoor === 'furnace') { this.acc.ember += dt * (indoor === 'furnace' ? 20 : 14); while (this.acc.ember > 1) { this.acc.ember--; const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, r(0.1, 1.5), focus.z + Math.sin(a) * d); this.fx.add.spawn({ pos: p, vel: new THREE.Vector3(r(-0.3, 0.3), r(0.5, 1.4), r(-0.3, 0.3)), age: 0, life: r(1.5, 3), size: r(0.04, 0.07), tex: TEX.glow, alpha: 1, rot: 0, color: C('#ffb050'), c2: C('#ff3010'), drag: 0.3, fadeIn: 0.3 }); } }
      return;
    }
    const g = this.T.groundWeights(focus.x, focus.z);
    const alt = this.T.altAt?.(focus.x, focus.z);
    if (alt?.theme === 'tidewater') return this.tide(dt, focus, g);
    if (alt?.theme === 'rainward') return this.gorge(dt, focus, g, weather);
    if (alt) return alt.theme === 'rime' || alt.theme === 'heights' ? this.rime(dt, focus, g, weather, alt.theme === 'heights') : this.reach(dt, focus, g);
    if (weather?.rain > 0.05) {
      // rain: small splashes on the ground round the hero
      this.acc.splash = (this.acc.splash || 0) + dt * 70 * weather.rain;
      while (this.acc.splash > 1) { this.acc.splash--; const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 18; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, 0, focus.z + Math.sin(a) * d); p.y = this.T.walk ? this.T.walk(p.x, p.z) + 0.05 : this.T.height(p.x, p.z) + 0.05; this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(0, 0.6, 0), age: 0, life: 0.25, size: r(0.08, 0.16), tex: TEX.puff, alpha: 0.55, rot: r(0, 6), color: C('#e0ecf4'), grow: 2.5 }); }
    }
    if (weather?.sand > 0.05) {
      // sandstorm: thick dust rolling along with the wind
      const wd2 = G.windDir.value;
      this.acc.storm = (this.acc.storm || 0) + dt * 30 * weather.sand;
      while (this.acc.storm > 1) { this.acc.storm--; const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 24; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, 0, focus.z + Math.sin(a) * d); p.y = this.T.height(p.x, p.z) + r(0.2, 3); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd2.x * r(6, 10), r(-0.2, 0.4), wd2.y * r(6, 10)), age: 0, life: r(1.5, 3), size: r(2.5, 5), tex: TEX.puff, alpha: 0.28, rot: r(0, 6), spin: r(-0.5, 0.5), color: C('#d8b47c'), grow: 1.3, fadeIn: 0.4 }); }
    }
    const wd = G.windDir.value, ws = G.windStrength.value;
    const R = 26;
    const at = (h0, h1) => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, 0, focus.z + Math.sin(a) * d); p.y = this.T.height(p.x, p.z) + r(h0, h1); return p; };
    const emit = (key, rate, fn) => { this.acc[key] += rate * dt; while (this.acc[key] > 1) { this.acc[key]--; fn(); } };
    const lush = g.lush, desert = g.sand > 0.5 ? g.sand : 0, foundry = g.foundry || 0, green = Math.max(0, 1 - desert - foundry);
    // glade: soft floating lights
    if (lush > 0.2) emit('motes', 26 * lush, () => {
      const p = at(0.3, 4);
      this.fx.add.spawn({ pos: p, vel: new THREE.Vector3(r(-0.2, 0.2), r(0.05, 0.3), r(-0.2, 0.2)), age: 0, life: r(4, 7), size: r(0.06, 0.13), tex: TEX.glow, alpha: 0.9, rot: 0, color: C(Math.random() < 0.6 ? '#d8ff9a' : '#fff0a0'), fadeIn: 1.2, fadePow: 2, swirl: r(-0.4, 0.4), cx: p.x + r(-2, 2), cz: p.z + r(-2, 2) });
    });
    // desert: wisps of sand riding the wind
    if (desert > 0.3) emit('dust', 9 * desert, () => {
      const p = at(0.1, 1.2);
      this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * r(3, 6) * ws, r(0, 0.3), wd.y * r(3, 6) * ws), age: 0, life: r(2, 3.5), size: r(1.2, 2.6), tex: TEX.puff, alpha: 0.22, rot: r(0, 6), spin: r(-0.4, 0.4), color: C('#e8cc96'), grow: 1.2, fadeIn: 0.6, drag: 0.1 });
    });
    // foundry: embers rise from the furnaces, ash drifts down
    if (foundry > 0.2) {
      emit('ember', 22 * foundry, () => { const p = at(0.1, 2); this.fx.add.spawn({ pos: p, vel: new THREE.Vector3(r(-0.3, 0.3) + wd.x * 0.4, r(0.6, 1.8), r(-0.3, 0.3) + wd.y * 0.4), age: 0, life: r(2, 4), size: r(0.04, 0.08), tex: TEX.glow, alpha: 1, rot: 0, color: C('#ffb050'), c2: C('#ff3010'), drag: 0.3, fadeIn: 0.3 }); });
      emit('ash', 14 * foundry, () => { const p = at(3, 8); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * 0.8, r(-0.6, -0.25), wd.y * 0.8), age: 0, life: r(5, 8), size: r(0.05, 0.1), tex: TEX.shard, alpha: 0.7, rot: r(0, 6), spin: r(-2, 2), color: C('#5a5450'), fadeIn: 0.5 }); });
    }
    // woods and meadows: a leaf now and then, and pollen in the light
    if (green > 0.3) {
      emit('leaf', (1.2 + g.forest * 4) * green, () => { const p = at(3, 7); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * 1.2 * ws, r(-0.9, -0.5), wd.y * 1.2 * ws), age: 0, life: r(5, 8), size: r(0.12, 0.18), tex: TEX.leaf, alpha: 1, rot: r(0, 6), spin: r(-3, 3), color: C(['#8aa83a', '#c8b040', '#6a8a2a', '#d89a3a'][Math.floor(Math.random() * 4)]), fadeIn: 0.5, swirl: r(-1, 1), cx: p.x, cz: p.z }); });
      emit('pollen', 6 * green, () => { const p = at(0.5, 3); this.fx.add.spawn({ pos: p, vel: new THREE.Vector3(wd.x * 0.4, r(0, 0.15), wd.y * 0.4), age: 0, life: r(3, 5), size: r(0.03, 0.05), tex: TEX.glow, alpha: 0.6, rot: 0, color: C('#fff8e0'), fadeIn: 1, fadePow: 2 }); });
    }
  }

  // Tidewater Sound: a needle now and then under the planted rows, a few sparks off the tar yards' hearths; nothing alive
  tide(dt, focus, g) {
    const wd = G.windDir.value, ws = G.windStrength.value, R = 24;
    const at = (h0, h1) => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, 0, focus.z + Math.sin(a) * d); p.y = this.T.height(p.x, p.z) + r(h0, h1); return p; };
    const emit = (key, rate, fn) => { this.acc[key] = (this.acc[key] || 0) + rate * dt; while (this.acc[key] > 1) { this.acc[key]--; fn(); } };
    if (g.forest > 0.2) emit('leaf', 3 * g.forest, () => { const p = at(3, 7); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * 1.2 * ws, r(-0.9, -0.5), wd.y * 1.2 * ws), age: 0, life: r(5, 8), size: r(0.08, 0.12), tex: TEX.leaf, alpha: 1, rot: r(0, 6), spin: r(-2, 2), color: C('#5a6a3a'), fadeIn: 0.5 }); });
    if ((g.foundry || 0) > 0.3) emit('ember', 8 * g.foundry, () => { const p = at(0.8, 1.6); this.fx.add.spawn({ pos: p, vel: new THREE.Vector3(r(-0.3, 0.3) + wd.x * 0.4, r(0.5, 1.4), r(-0.3, 0.3) + wd.y * 0.4), age: 0, life: r(1.5, 3), size: r(0.04, 0.07), tex: TEX.glow, alpha: 1, rot: 0, color: C('#ffb050'), c2: C('#ff3010'), drag: 0.3, fadeIn: 0.3 }); });
  }

  // the Rainward Gorge: rain splashing on the ground round the hero (thick in a downpour), a fine wet mist hanging low in the
  // air when it is dry, a needle now and then under the planted timber; nothing alive (a quiet, dripping forest)
  gorge(dt, focus, g, weather) {
    const wd = G.windDir.value, ws = G.windStrength.value, R = 22, rain = weather?.rain || 0;
    const at = (h0, h1) => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, 0, focus.z + Math.sin(a) * d); p.y = this.T.height(p.x, p.z) + r(h0, h1); return p; };
    const emit = (key, rate, fn) => { this.acc[key] = (this.acc[key] || 0) + rate * dt; while (this.acc[key] > 1) { this.acc[key]--; fn(); } };
    if (rain > 0.05) emit('splash', 110 * rain, () => { const p = at(0.05, 0.05); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(0, 0.7, 0), age: 0, life: 0.25, size: r(0.08, 0.18), tex: TEX.puff, alpha: 0.55, rot: r(0, 6), color: C('#dce8ec'), grow: 2.5 }); });
    emit('mist', 0.6 * (1 - rain * 0.6), () => { const p = at(0.4, 2.2); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * 0.3 * ws, r(0, 0.05), wd.y * 0.3 * ws), age: 0, life: r(6, 10), size: r(2.0, 3.5), tex: TEX.puff, alpha: 0.05, rot: r(0, 6), spin: r(-0.1, 0.1), color: C('#dfe6e2'), grow: 1.2, fadeIn: 2 }); });
    if (g.forest > 0.2) emit('leaf', 2 * g.forest, () => { const p = at(3, 7); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * 0.8 * ws, r(-1.0, -0.6), wd.y * 0.8 * ws), age: 0, life: r(5, 8), size: r(0.07, 0.1), tex: TEX.leaf, alpha: 1, rot: r(0, 6), spin: r(-2, 2), color: C('#4a5a32'), fadeIn: 0.5 }); });
  }

  // the Rime Steps: spindrift skimming the snow on the wind (thick in a blizzard), glints of frost on the ice and the snow,
  // and fine ice dust hanging in the air
  // (the Windward Heights, gale: the spindrift never stops, low and fast along the ground, and streams off every crest)
  rime(dt, focus, g, weather, gale = false) {
    const wd = G.windDir.value, ws = G.windStrength.value, R = 26, blz = Math.max(weather?.blizzard || 0, gale ? 0.35 : 0);
    const at = (h0, h1) => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, 0, focus.z + Math.sin(a) * d); p.y = this.T.height(p.x, p.z) + r(h0, h1); return p; };
    const emit = (key, rate, fn) => { this.acc[key] = (this.acc[key] || 0) + rate * dt; while (this.acc[key] > 1) { this.acc[key]--; fn(); } };
    emit('drift', 4 + 26 * blz, () => { const p = at(0.05, 0.8 + blz * 2); const k = 3 + blz * 6; this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * r(k, k * 1.6) * ws, r(0, 0.25), wd.y * r(k, k * 1.6) * ws), age: 0, life: r(1.5, 3), size: r(1.0, 2.4) * (1 + blz), tex: TEX.puff, alpha: 0.2 + blz * 0.12, rot: r(0, 6), spin: r(-0.5, 0.5), color: C('#eef4fa'), grow: 1.3, fadeIn: 0.4, drag: 0.1 }); });
    if (gale) emit('stream', 22, () => { const p = at(0.02, 0.35); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * r(7, 11), r(0, 0.15), wd.y * r(7, 11)), age: 0, life: r(0.8, 1.6), size: r(0.5, 1.1), tex: TEX.puff, alpha: 0.22, rot: r(0, 6), spin: r(-0.3, 0.3), color: C('#f4f8fc'), grow: 1.8, fadeIn: 0.25, drag: 0.05 }); });
    if (g.lush > 0.3 || g.snow > 0.5) emit('motes', 10, () => { const p = at(0.02, 0.15); this.fx.add.spawn({ pos: p, vel: new THREE.Vector3(0, 0, 0), age: 0, life: r(0.4, 0.9), size: r(0.03, 0.06), tex: TEX.glow, alpha: 0.8, rot: 0, color: C('#e8f4ff'), fadeIn: 0.2, fadePow: 2 }); });
    emit('pollen', 5, () => { const p = at(0.5, 4); this.fx.add.spawn({ pos: p, vel: new THREE.Vector3(wd.x * 0.5, r(-0.1, 0.05), wd.y * 0.5), age: 0, life: r(3, 5), size: r(0.02, 0.04), tex: TEX.glow, alpha: 0.5, rot: 0, color: C('#f4faff'), fadeIn: 1, fadePow: 2 }); });
  }

  // the Cinder Reach: grey ash flecks drifting on the wind, embers lifting off the glowing seams and round the old works,
  // and wisps of black sand along the beaches (no leaves, no pollen, no glade lights)
  reach(dt, focus, g) {
    const wd = G.windDir.value, ws = G.windStrength.value, R = 26;
    const at = (h0, h1) => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R; const p = new THREE.Vector3(focus.x + Math.cos(a) * d, 0, focus.z + Math.sin(a) * d); p.y = this.T.height(p.x, p.z) + r(h0, h1); return p; };
    const emit = (key, rate, fn) => { this.acc[key] = (this.acc[key] || 0) + rate * dt; while (this.acc[key] > 1) { this.acc[key]--; fn(); } };
    emit('ash', 9, () => { const p = at(3, 9); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * 0.9 * ws, r(-0.5, -0.2), wd.y * 0.9 * ws), age: 0, life: r(5, 8), size: r(0.05, 0.1), tex: TEX.shard, alpha: 0.65, rot: r(0, 6), spin: r(-2, 2), color: C('#5e5854'), fadeIn: 0.5 }); });
    const heat = Math.max(g.lush * 2, g.foundry || 0);
    if (heat > 0.1) emit('ember', 18 * Math.min(1, heat), () => { const p = at(0.1, 1.5); this.fx.add.spawn({ pos: p, vel: new THREE.Vector3(r(-0.3, 0.3) + wd.x * 0.4, r(0.6, 1.6), r(-0.3, 0.3) + wd.y * 0.4), age: 0, life: r(1.5, 3.5), size: r(0.04, 0.07), tex: TEX.glow, alpha: 1, rot: 0, color: C('#ffb050'), c2: C('#ff3010'), drag: 0.3, fadeIn: 0.3 }); });
    if (g.sand > 0.5) emit('dust', 5 * g.sand, () => { const p = at(0.1, 0.9); this.fx.alpha.spawn({ pos: p, vel: new THREE.Vector3(wd.x * r(3, 5) * ws, r(0, 0.2), wd.y * r(3, 5) * ws), age: 0, life: r(2, 3), size: r(1.0, 2.0), tex: TEX.puff, alpha: 0.16, rot: r(0, 6), spin: r(-0.4, 0.4), color: C('#5a5652'), grow: 1.2, fadeIn: 0.6, drag: 0.1 }); });
  }
}
