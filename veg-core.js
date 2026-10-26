/* veg-core.js — núcleo procedural de vegetação voxel (sem dependência de three.js)
   Reaproveita o que o ICQR ensinou: tronco + galhos que caminham subindo + copa em
   blobs recortados por ruído, cores com variação de luminosidade e só as faces
   visíveis no mesh. Aqui sem a máscara do QR, e com ruído Perlin controlando
   espaçamento, densidade, tamanho, formato, cor e espécie de cada árvore. */

/* ---------- aleatório determinístico ---------- */
// f.state() devolve o estado interno; rng(f.state()) segue exatamente a mesma sequência
export function rng(seed) {
  const f = function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  f.state = () => seed | 0;
  return f;
}
export function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
// hash de inteiros → [0,1): o mesmo ponto sempre dá o mesmo número, independente da ordem
export function hash3(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ h >>> 15, 0x85ebca6b); h = Math.imul(h ^ h >>> 13, 0xc2b2ae35);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------- ruído Perlin (versão "improved", 2D e 3D) ---------- */
const perlinCache = new Map();
export function perlin(seed = 0) {
  if (perlinCache.has(seed)) return perlinCache.get(seed);
  const R = rng(seed * 7919 + 13);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const g2 = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const g3 = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  const n = {
    // saída aproximadamente em [-1, 1]
    noise2(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const a = P[X] + Y, b = P[X + 1] + Y;
      return lerp(lerp(g2(P[a], x, y), g2(P[b], x - 1, y), u), lerp(g2(P[a + 1], x, y - 1), g2(P[b + 1], x - 1, y - 1), u), v) * 0.85;
    },
    noise3(x, y, z) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = fade(x), v = fade(y), w = fade(z);
      const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
      return lerp(
        lerp(lerp(g3(P[AA], x, y, z), g3(P[BA], x - 1, y, z), u), lerp(g3(P[AB], x, y - 1, z), g3(P[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(g3(P[AA + 1], x, y, z - 1), g3(P[BA + 1], x - 1, y, z - 1), u), lerp(g3(P[AB + 1], x, y - 1, z - 1), g3(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    },
  };
  perlinCache.set(seed, n);
  return n;
}

/* ---------- campo de ruído configurável (o que o menu de debug edita) ----------
   fbm de Perlin → [0,1], com contraste, viés e inversão. Os parâmetros são lidos
   a cada amostra, então mexer no menu muda o campo na hora. */
export function defaultField(seed, freq = 0.04, extra = {}) {
  return { seed, freq, octaves: 3, lacunarity: 2, gain: 0.5, contrast: 1.4, bias: 0, invert: false, ox: 0, oz: 0, ...extra };
}
export function sampleField(f, x, z) {
  const P = perlin(f.seed | 0);
  let amp = 1, fr = f.freq, sum = 0, norm = 0;
  for (let o = 0; o < f.octaves; o++) {
    sum += P.noise2((x + f.ox) * fr + o * 17.3, (z + f.oz) * fr - o * 9.1) * amp;
    norm += amp; amp *= f.gain; fr *= f.lacunarity;
  }
  let v = 0.5 + 0.5 * (sum / norm) * 1.6;
  v = (v - 0.5) * f.contrast + 0.5 + f.bias;
  v = clamp01(v);
  return f.invert ? 1 - v : v;
}

/* ---------- cor ---------- */
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
}
export function rgbToHsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
export function hslToRgb([h, s, l]) {
  h = ((h % 1) + 1) % 1;
  if (s === 0) return [l, l, l];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
export function shiftHsl(rgb, dh = 0, ds = 0, dl = 0) {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb([h + dh, clamp01(s + ds), clamp01(l + dl)]);
}
const toLin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
export const srgbToLinear = rgb => rgb.map(toLin);

/* ---------- espécies ----------
   Cada parâmetro é [mínimo, máximo]; o "formato" t ∈ [0,1] de cada árvore
   (vindo do ruído de formato) escolhe o ponto entre os dois. Medidas em unidades
   de mundo (1 = um bloco do terreno). */
export const SPECIES = {
  carvalho: { label: 'Carvalho', kind: 'folhosa', height: [3.4, 5.6], trunkW: [2, 3], canopy: [1.7, 2.8], branches: [4, 8], flat: [1.25, 1.8], holes: [0.12, 0.32], lean: [0, 0.35], trunkFrac: [0.45, 0.6] },
  betula: { label: 'Bétula', kind: 'folhosa', height: [5, 7.4], trunkW: [1, 2], canopy: [0.9, 1.5], branches: [3, 6], flat: [1.0, 1.3], holes: [0.2, 0.4], lean: [0, 0.25], trunkFrac: [0.5, 0.65], stripes: true },
  cerejeira: { label: 'Cerejeira', kind: 'folhosa', height: [2.6, 3.8], trunkW: [2, 2], canopy: [2.1, 3.1], branches: [5, 9], flat: [1.6, 2.3], holes: [0.18, 0.36], lean: [0.1, 0.5], trunkFrac: [0.4, 0.55] },
  pinheiro: { label: 'Pinheiro', kind: 'conifera', height: [5.5, 9.5], trunkW: [1, 2], canopy: [1.2, 2.1], tiers: [3, 6], clear: [0.12, 0.3], holes: [0.0, 0.18], lean: [0, 0.15] },
  arbusto: { label: 'Arbusto', kind: 'arbusto', height: [0.6, 1.3], trunkW: [1, 1], canopy: [0.55, 1.1], blobs: [1, 3], holes: [0.05, 0.2], flowers: [0, 0.12], lean: [0, 0] },
};
export const SPECIES_KEYS = Object.keys(SPECIES);

/* ---------- estilos (o "design document" da vegetação) ----------
   Um estilo é um JSON com as paletas por espécie, terreno, céu e luz.
   Folhas e madeira continuam escuras o bastante para a sombra dura ler bem,
   como no ICQR. */
export const STYLES = {
  'Outono ICQR': {
    voxel: 0.25, snow: 0,
    sky: '#ebe5d9', fog: '#e4dccd', sun: '#fff1dc', hemiSky: '#fffaf0', hemiGround: '#b3a894',
    terrain: { low: '#c9b48a', mid: '#8f7f2c', high: '#7a6f2a', cliff: '#9a8162', grass: '#7f7a2e', litter: '#8a5a2a' },
    grass: { base: '#5e6a26', tip: '#a49432' },
    species: {
      carvalho: { leaves: ['#c8621f', '#ad3c19', '#c97a22', '#9c4c18', '#bb6a24'], wood: '#553826' },
      betula: { leaves: ['#d1a235', '#c08a2a', '#ddb447', '#b37a22'], wood: '#e8e0d0', wood2: '#3a3128' },
      cerejeira: { leaves: ['#b5352f', '#9c2b2a', '#c4473a', '#8a2626'], wood: '#4a3024' },
      pinheiro: { leaves: ['#2f5a33', '#3a6a3a', '#27502d', '#335f36'], wood: '#4f3a2a' },
      arbusto: { leaves: ['#8a6a24', '#7a5a1f', '#9a7a2c'], wood: '#4a3424', flowers: ['#c4473a', '#e0a040'] },
    },
  },
  'Primavera': {
    voxel: 0.25, snow: 0,
    sky: '#eef0e6', fog: '#e6eadc', sun: '#fff6e6', hemiSky: '#fbfff4', hemiGround: '#a9b390',
    terrain: { low: '#d6c79a', mid: '#5f9a3c', high: '#4f8a34', cliff: '#9b8a6a', grass: '#4f8a34', litter: '#6f8a3e' },
    grass: { base: '#3f7a2c', tip: '#8cc05a' },
    species: {
      carvalho: { leaves: ['#468a35', '#357a2e', '#539a3c', '#2a6428', '#3c8232'], wood: '#583a26' },
      betula: { leaves: ['#7ab348', '#69a33c', '#8cc05a', '#5c9634'], wood: '#ece6da', wood2: '#3a3128' },
      cerejeira: { leaves: ['#c4527d', '#a83f68', '#cf6690', '#953560', '#b84a74'], wood: '#5e3d2a' },
      pinheiro: { leaves: ['#2e6a3a', '#3a7a44', '#245a30', '#336f3c'], wood: '#4f3a2a' },
      arbusto: { leaves: ['#4f8a34', '#41772d', '#5f9a3c'], wood: '#4a3424', flowers: ['#f0f0e8', '#e8c040', '#c4527d'] },
    },
  },
  'Verão denso': {
    voxel: 0.25, snow: 0,
    sky: '#e3ecef', fog: '#d6e2e2', sun: '#fff4d6', hemiSky: '#f4fbff', hemiGround: '#8f9c78',
    terrain: { low: '#cdbf8e', mid: '#407f30', high: '#356d2a', cliff: '#8a7b5c', grass: '#3d7a2e', litter: '#4a6a2a' },
    grass: { base: '#2f6a26', tip: '#6aa83c' },
    species: {
      carvalho: { leaves: ['#2f6f2a', '#3c7f32', '#255c24', '#468a35'], wood: '#4f3422' },
      betula: { leaves: ['#4f9a3c', '#3f8a30', '#5ca848'], wood: '#e6e0d2', wood2: '#33291f' },
      cerejeira: { leaves: ['#3a7a34', '#2e6a2c', '#468a3e'], wood: '#4a3024' },
      pinheiro: { leaves: ['#1f4f2e', '#28603a', '#1a4428'], wood: '#45321f' },
      arbusto: { leaves: ['#356d2a', '#2a5e24', '#41772d'], wood: '#3e2c1e', flowers: ['#d84a4a', '#f0d040'] },
    },
  },
  'Inverno': {
    voxel: 0.25, snow: 0.85,
    sky: '#e8edf2', fog: '#dfe6ee', sun: '#f4f6ff', hemiSky: '#f6faff', hemiGround: '#a8b0b8',
    terrain: { low: '#e9eef2', mid: '#dde5ec', high: '#f2f5f8', cliff: '#8c8a88', grass: '#9aa79a', litter: '#8f8578', snow: '#f4f7fa' },
    grass: { base: '#6f7f68', tip: '#c8d2c4' },
    species: {
      carvalho: { leaves: ['#6a5442', '#5a4636', '#7a624e'], wood: '#4a3a2e' },
      betula: { leaves: ['#8a7a5a', '#7a6a4c'], wood: '#ece8e0', wood2: '#33291f' },
      cerejeira: { leaves: ['#5a4a42', '#6a564c'], wood: '#45302a' },
      pinheiro: { leaves: ['#1f4a38', '#285844', '#1a4030'], wood: '#45321f' },
      arbusto: { leaves: ['#5a6a52', '#4a5a44'], wood: '#3e2c1e', flowers: ['#b03030'] },
    },
    snowColor: '#f4f7fa',
  },
};

/* ---------- estações e luz do dia ---------- */
export const SEASONS = [
  { key: 'primavera', label: 'Primavera', style: 'Primavera' },
  { key: 'verao', label: 'Verão', style: 'Verão denso' },
  { key: 'outono', label: 'Outono', style: 'Outono ICQR' },
  { key: 'inverno', label: 'Inverno', style: 'Inverno' },
];
// eco.tick = dias desde o início; eco.seasonLen = dias por estação
export function seasonAt(eco) {
  const len = Math.max(1, eco.seasonLen | 0), tick = Math.max(0, eco.tick | 0), n = Math.floor(tick / len);
  const index = n % 4, day = tick % len + 1;
  return { index, key: SEASONS[index].key, label: SEASONS[index].label, day, seasonLen: len, phase: (day - 1) / len, year: Math.floor(n / 4) };
}

const HEX = /^#[0-9a-f]{6}$/i;
const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((c, i) => lerp(c, B[i], t))); };
// mistura pura (não muta): hex em sRGB, números em lerp, arrays ciclando o menor, objetos recursivos
export function blendStyle(a, b, t) {
  t = clamp01(t);
  if (a === undefined) return structuredClone(b);
  if (b === undefined) return structuredClone(a);
  if (typeof a === 'string' && typeof b === 'string' && HEX.test(a) && HEX.test(b)) return mixHex(a, b, t);
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (!a.length || !b.length) return structuredClone(a.length ? a : b);
    return Array.from({ length: Math.max(a.length, b.length) }, (_, k) => blendStyle(a[k % a.length], b[k % b.length], t));
  }
  if (isObj(a) && isObj(b)) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = blendStyle(a[k], b[k], t);
    return out;
  }
  return structuredClone(t < .5 ? a : b);
}
// preset da estação atual, mexendo para o da próxima no fim da estação
export function seasonStyle(eco, { voxel } = {}) {
  const s = seasonAt(eco), t = smoothstep(.7, 1, s.phase);
  const a = STYLES[SEASONS[s.index].style], b = STYLES[SEASONS[(s.index + 1) % 4].style];
  const out = t > 0 ? blendStyle(a, b, t) : structuredClone(a);
  if (voxel != null) out.voxel = voxel;
  return out;
}

/* dayTime ∈ [0,1): amanhecer .25, meio-dia .5, anoitecer .75. Dia = sol (58° · arco, azimute
   -70°→+70°); noite = lua (35°, fraca). A direção só troca com a intensidade em zero. */
export function lightAt(dayTime, style) {
  const d = ((dayTime % 1) + 1) % 1, s = Math.sin(2 * Math.PI * (d - .25)); // altura normalizada: >0 dia
  const arc = s > 0 ? (d - .25) / .5 : (d >= .75 ? d - .75 : d + .25) / .5;
  const night = 1 - smoothstep(-.2, .12, s), warm = 1 - smoothstep(0, .4, Math.abs(s));
  const moon = smoothstep(0, .2, -s);
  const sunColor = mixHex(mixHex(style.sun, '#f2b27a', warm), '#9fb0d8', moon);
  const dusk = c => mixHex(mixHex(c, '#f0c8a0', .35 * warm), '#1d2433', night);
  return {
    sunEl: s > 0 ? 58 * s : 35 * -s,
    sunAz: lerp(-70, 70, arc),
    sunI: s > 0 ? smoothstep(0, .3, s) : .18 * smoothstep(0, .3, -s),
    hemiI: lerp(.35, 1, smoothstep(-.15, .25, s)),
    sunColor, sky: dusk(style.sky), fog: dusk(style.fog), night,
  };
}

/* ---------- projeto (formato "veg-forest") ----------
   v1: protótipo (terreno, campos, máscaras de árvore/grama/espécie).
   v2: + ecology (relógio, estações, modo) e photo. Árvores sem entrada em
   ecology.plants são adultas, então um projeto v1 abre exatamente igual. */
export const PROJECT_VERSION = 2;
export function defaultProject() {
  return {
    format: 'veg-forest', version: PROJECT_VERSION,
    size: 96, seed: 1234,
    style: structuredClone(STYLES['Outono ICQR']),
    styleName: 'Outono ICQR',
    terrain: { field: defaultField(11, .022, { octaves: 4, contrast: 1.2 }), amp: 5, step: .5 },
    fields: {
      density: defaultField(21, .035),
      spacing: defaultField(31, .05),
      size: defaultField(41, .06),
      shape: defaultField(51, .08),
      color: defaultField(61, .045),
      species: defaultField(71, .03, { octaves: 2, contrast: 1.8 }),
      grassDensity: defaultField(81, .07),
      grassHeight: defaultField(91, .09),
    },
    trees: {
      spacingMin: 1.6, spacingMax: 4.2, densityInfluence: .85, densityCut: .45,
      sizeMin: .75, sizeMax: 1.3, sizeJitter: .25,
      shapeBuckets: 4, variants: 3, shapeJitter: .2,
      hueRange: .035, satRange: .15, valRange: .14, colorJitter: .5,
      speciesJitter: .15, maxSlope: 1.6,
      mix: { carvalho: 1, betula: .6, cerejeira: .35, pinheiro: .8, arbusto: .7 },
    },
    species: structuredClone(SPECIES),
    grass: { density: 16, heightMin: .22, heightMax: .75, noiseInfluence: .7, lean: .5, width: .07, style: 'voxel', underTrees: true },
    wind: { strength: .45, freq: 1.2, dir: 35, gust: .6 },
    // tick = dias desde o início; começa no 1º dia do outono, combinando com o estilo padrão.
    // seasonal: o estilo segue a estação (seasonStyle) em vez de ficar fixo.
    ecology: { mode: 'criativo', tick: 24, dayTime: .42, seasonLen: 12, seasonal: true, plants: {} },
    photo: { frame: 'nenhuma', showMeta: true },
    masks: null, // preenchido ao salvar
  };
}

// completa o que falta em `val` com `def`, recursivamente; arrays e valores de `val` vencem
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function fillDefaults(val, def) {
  if (!isObj(val) || !isObj(def)) return val === undefined ? structuredClone(def) : val;
  const out = { ...val };
  for (const [k, d] of Object.entries(def)) out[k] = fillDefaults(val[k], d);
  return out;
}

/* Abre qualquer versão conhecida e devolve um projeto atual completo.
   Idempotente; não altera o objeto recebido. `baked` é só saída, nunca entrada. */
export function migrateProject(j) {
  if (!isObj(j) || j.format !== 'veg-forest') throw new Error('Não é um projeto de floresta.');
  if ((j.version | 0) > PROJECT_VERSION) throw new Error(`Projeto da versão ${j.version}; este editor lê até a ${PROJECT_VERSION}.`);
  const src = structuredClone(j);
  delete src.baked;
  const def = defaultProject();
  // estilo incompleto se completa pelo preset de mesmo nome, não sempre pelo padrão
  if (STYLES[src.styleName]) def.style = structuredClone(STYLES[src.styleName]);
  const out = fillDefaults(src, def);
  // v1 → v2: o estilo escolhido continua fixo; a estação inicial é a do estilo, se for um preset
  if ((j.version | 0) < 2) {
    const si = SEASONS.findIndex(x => x.style === src.styleName);
    out.ecology.seasonal = false;
    out.ecology.tick = (si < 0 ? 2 : si) * out.ecology.seasonLen;
  }
  // v2 inicial (só existiu em 2026-10-26) guardava ecology.season à parte do tick
  if (src.ecology && 'season' in src.ecology) {
    out.ecology.tick = (src.ecology.season | 0) * out.ecology.seasonLen + (src.ecology.tick | 0);
    if (!('seasonal' in src.ecology)) out.ecology.seasonal = false;
    delete out.ecology.season;
  }
  out.version = PROJECT_VERSION;
  return out;
}

/* ---------- voxels de uma árvore ---------- */
const OFF = 128, SPAN = 256;
const vkey = (x, y, z) => ((y + 16) * SPAN + (z + OFF)) * SPAN + (x + OFF);

function voxelGrid() {
  const map = new Map();
  return {
    map,
    get: (x, y, z) => map.get(vkey(x, y, z)),
    has: (x, y, z) => map.has(vkey(x, y, z)),
    put(x, y, z, type, col, force) {
      if (y < 0 || Math.abs(x) >= OFF - 1 || Math.abs(z) >= OFF - 1 || y > 230) return;
      const k = vkey(x, y, z), e = map.get(k);
      if (e && e.type === 1 && !force) return; // madeira tem prioridade sobre folha
      map.set(k, { x, y, z, type, col });
    },
  };
}

// params da espécie interpolados pelo formato t, com um pouco de acaso por árvore
function resolveParams(sp, t, R) {
  const o = {};
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) o[k] = lerp(v[0], v[1], clamp01(t + (R() - .5) * .25));
    else o[k] = v;
  }
  return o;
}

/* Gera os voxels. Tipos: 1 madeira, 2 folha, 3 acento (flor / neve).
   Devolve também a altura em voxels para normalizar o vento. */
export function genTreeVoxels(speciesKey, shapeT, seed, style, speciesOverrides) {
  const base = { ...SPECIES[speciesKey], ...(speciesOverrides?.[speciesKey] || {}) };
  const R = rng(seed);
  const P = perlin(seed % 1000);
  const V = style.voxel;
  const L = resolveParams(base, shapeT, R);
  const g = voxelGrid();

  const H = Math.max(3, Math.round(L.height / V));
  const W = Math.max(1, Math.round(L.trunkW));
  const t0 = -Math.floor(W / 2);
  const leanA = R() * Math.PI * 2;
  const leanDX = Math.cos(leanA) * L.lean, leanDZ = Math.sin(leanA) * L.lean;
  const trunkAt = k => [Math.round(leanDX * k * k / H * .35), Math.round(leanDZ * k * k / H * .35)];

  const blob = (cx, cy, cz, r, flat, holes) => {
    const ri = Math.ceil(r * 1.2);
    for (let di = -ri; di <= ri; di++) for (let dk = -ri; dk <= ri; dk++) for (let dl = -ri; dl <= ri; dl++) {
      const x = cx + di, y = cy + dk, z = cz + dl;
      if (y < 1) continue;
      const d = Math.sqrt(di * di + (dk * flat) ** 2 + dl * dl);
      const edge = r * (.82 + .32 * P.noise3(x * .21, y * .21, z * .21));
      if (d > edge) continue;
      // buracos: ruído de frequência mais alta abre a copa deixando galhos à mostra
      if (P.noise3(x * .33 + 91, y * .33, z * .33) > 1 - holes * 1.5 && d > r * .35) continue;
      g.put(x, y, z, 2, null);
    }
  };
  const line = (x0, y0, z0, x1, y1, z1, th) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(lerp(x0, x1, s / n)), y = Math.round(lerp(y0, y1, s / n)), z = Math.round(lerp(z0, z1, s / n));
      for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) g.put(x + a, y, z + b, 1, null, true);
    }
  };

  if (base.kind === 'folhosa') {
    const top = Math.round(H * L.trunkFrac);
    for (let k = 0; k < top + 2; k++) {
      const [ox, oz] = trunkAt(k);
      for (let a = 0; a < W; a++) for (let b = 0; b < W; b++) g.put(t0 + a + ox, k, t0 + b + oz, 1, null, true);
    }
    // raízes
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (R() < .35) continue;
      const len = 1 + Math.floor(R() * 2);
      for (let s = 1; s <= len; s++) g.put(dx > 0 ? t0 + W - 1 + s : dx < 0 ? t0 - s : t0 + Math.floor(R() * W), s === len ? 0 : 0, dz > 0 ? t0 + W - 1 + s : dz < 0 ? t0 - s : t0 + Math.floor(R() * W), 1, null, true);
    }
    const cr = L.canopy / V;
    const [tx, tz] = trunkAt(top);
    const nb = Math.round(L.branches);
    const ends = [];
    for (let b = 0; b < nb; b++) {
      const a = (b / nb) * Math.PI * 2 + R() * .7;
      const k0 = Math.round(top * (.6 + R() * .4));
      const [bx, bz] = trunkAt(k0);
      const len = cr * (.45 + R() * .45);
      const ex = bx + Math.cos(a) * len, ez = bz + Math.sin(a) * len;
      const ey = k0 + len * (.5 + R() * .5) + (H - top) * .25;
      line(bx, k0, bz, ex, ey, ez, R() < .4 && W > 1 ? 2 : 1);
      ends.push([Math.round(ex), Math.round(ey), Math.round(ez), cr * (.42 + R() * .22)]);
    }
    ends.push([tx, Math.round(H - cr * .55 / L.flat), tz, cr * (.55 + R() * .15)]);
    for (const [x, y, z, r] of ends) blob(x, y, z, r, L.flat, L.holes);
  } else if (base.kind === 'conifera') {
    for (let k = 0; k < H; k++) {
      const [ox, oz] = trunkAt(k);
      for (let a = 0; a < W; a++) for (let b = 0; b < W; b++) g.put(t0 + a + ox, k, t0 + b + oz, 1, null, true);
    }
    const k0 = Math.round(H * L.clear), R0 = L.canopy / V, tiers = L.tiers;
    for (let k = k0; k <= H + 1; k++) {
      const f = (k - k0) / (H + 1 - k0);
      const phase = (f * tiers) % 1;
      const r = R0 * Math.pow(1 - f, .95) * (.5 + .5 * (1 - phase)) + .6;
      const [ox, oz] = trunkAt(k);
      const ri = Math.ceil(r + 1);
      for (let di = -ri; di <= ri; di++) for (let dl = -ri; dl <= ri; dl++) {
        const x = t0 + ox + di, z = t0 + oz + dl;
        const d = Math.hypot(di, dl);
        if (d > r * (.85 + .3 * P.noise3(x * .3, k * .3, z * .3))) continue;
        if (P.noise3(x * .4 + 7, k * .4, z * .4) > 1 - L.holes * 1.6 && d > 1.5) continue;
        g.put(x, k, z, 2, null);
      }
    }
  } else { // arbusto
    const cr = L.canopy / V;
    const nbl = Math.round(L.blobs);
    for (let k = 0; k < Math.max(1, Math.round(H * .25)); k++) g.put(0, k, 0, 1, null, true);
    for (let b = 0; b < nbl; b++) {
      const a = R() * Math.PI * 2, d = b === 0 ? 0 : cr * (.4 + R() * .4);
      blob(Math.round(Math.cos(a) * d), Math.round(cr * .55 + R() * 1.5), Math.round(Math.sin(a) * d), cr * (.6 + R() * .35), 1.35, L.holes);
    }
  }

  // tipos originais (madeira/folha) em ordem de iteração + estado do rng: o suficiente para recolorir
  let maxY = 0;
  for (const v of g.map.values()) maxY = Math.max(maxY, v.y);
  const tree = { grid: g, height: maxY + 1, trunkW: W, seed, speciesKey, flowerP: L.flowers, stripes: !!base.stripes, rngState: R.state(), kinds: Uint8Array.from(g.map.values(), v => v.type) };
  return colorTree(tree, style);
}

/* Cores finais, flores e neve em quem está exposto em cima. Recolore no lugar, repetindo
   a mesma sequência aleatória da geração (estado do rng guardado na árvore). */
export function colorTree(tree, style) {
  const { grid: g, seed, speciesKey, flowerP, stripes, kinds } = tree;
  const R = rng(tree.rngState), P = perlin(seed % 1000), maxY = tree.height - 1;
  const pal = style.species[speciesKey];
  const leafCols = pal.leaves.map(hexToRgb), woodCol = hexToRgb(pal.wood);
  const leafAt = (x, y, z, H) => {
    // manchas de cor por ruído (como os "clumps" do ICQR) + topo um pouco mais claro
    const n = P.noise3(x * .11 + 40, y * .11, z * .11);
    const idx = Math.min(leafCols.length - 1, Math.floor(clamp01(n * .5 + .5 + (R() - .5) * .35) * leafCols.length));
    return shiftHsl(leafCols[idx], 0, 0, (y / Math.max(1, H) - .6) * .06 + (R() - .5) * .05);
  };
  const woodAt = (x, y, z) => {
    if (stripes && pal.wood2 && hash3(x * 3 + z, y, seed) < .2) return hexToRgb(pal.wood2);
    return shiftHsl(woodCol, 0, 0, (R() - .5) * .05);
  };
  const flowers = (pal.flowers || []).map(hexToRgb);
  const snowCol = hexToRgb(style.snowColor || '#f4f7fa');
  let i = 0;
  for (const v of g.map.values()) {
    v.type = kinds[i++];
    if (v.type === 1) v.col = woodAt(v.x, v.y, v.z);
    else {
      v.col = leafAt(v.x, v.y, v.z, maxY);
      const exposedUp = !g.has(v.x, v.y + 1, v.z);
      if (flowers.length && flowerP && R() < flowerP && exposedUp) { v.type = 3; v.col = flowers[Math.floor(R() * flowers.length)]; }
    }
    if (style.snow > 0 && !g.has(v.x, v.y + 1, v.z) && hash3(v.x, v.z, seed) < style.snow && v.y > 1) {
      v.type = 3; v.col = shiftHsl(snowCol, 0, 0, (R() - .5) * .03);
    }
  }
  return tree;
}

/* ---------- mesher: só faces expostas + oclusão de ambiente por vértice ----------
   Atributos: position, normal, color (linear, já com AO), veg = (folha 0/1, peso do vento). */
const FACES = (() => {
  // para cada direção: eixo, sinal, eixos u e v com u×v = normal (sentido anti-horário visto de fora)
  const ax = [[0, 1, 2], [1, 2, 0], [2, 0, 1]]; // [eixo, u, v]
  const out = [];
  for (const [a, u, v] of ax) for (const s of [1, -1]) out.push({ a, s, u: s > 0 ? u : v, v: s > 0 ? v : u });
  return out;
})();
const AO_CURVE = [0.5, 0.68, 0.84, 1];

export function meshVoxels(tree, V) {
  const { grid, height, trunkW } = tree;
  const occ = (x, y, z) => grid.has(x, y, z) ? 1 : 0;
  const pos = [], nor = [], col = [], veg = [], idx = [];
  const center = trunkW % 2 ? 0.5 : 0;
  const p = [0, 0, 0], q = [0, 0, 0];
  for (const vx of grid.map.values()) {
    const lin = srgbToLinear(vx.col);
    const leaf = vx.type === 2 ? 1 : 0;
    const hN = vx.y / Math.max(1, height);
    const sway = vx.type === 1 ? Math.pow(hN, 2.2) * .35 : Math.pow(hN, 1.4);
    for (const F of FACES) {
      p[0] = vx.x; p[1] = vx.y; p[2] = vx.z;
      p[F.a] += F.s;
      if (occ(p[0], p[1], p[2])) continue;
      const base = pos.length / 3;
      const ao = [];
      for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        q[0] = p[0]; q[1] = p[1]; q[2] = p[2];
        q[F.u] += cu ? 1 : -1; const s1 = occ(q[0], q[1], q[2]);
        q[F.u] -= cu ? 1 : -1; q[F.v] += cv ? 1 : -1; const s2 = occ(q[0], q[1], q[2]);
        q[F.u] += cu ? 1 : -1; const c = occ(q[0], q[1], q[2]);
        const a = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
        ao.push(a);
        const corner = [vx.x, vx.y, vx.z];
        if (F.s > 0) corner[F.a] += 1;
        corner[F.u] += cu; corner[F.v] += cv;
        pos.push((corner[0] - center) * V, corner[1] * V, (corner[2] - center) * V);
        const n = [0, 0, 0]; n[F.a] = F.s; nor.push(n[0], n[1], n[2]);
        const k = AO_CURVE[a];
        col.push(lin[0] * k, lin[1] * k, lin[2] * k);
        veg.push(leaf, sway);
      }
      if (ao[0] + ao[2] > ao[1] + ao[3]) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }
  return {
    position: new Float32Array(pos), normal: new Float32Array(nor), color: new Float32Array(col),
    veg: new Float32Array(veg), index: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    height: height * V, voxels: grid.map.size,
  };
}

/* ---------- distribuição (scatter) ----------
   Candidatos num grid com jitter; cada candidato tira seus números de um hash da
   célula, então pintar num canto não embaralha a floresta do outro lado.
   - densidade: máscara pintada × campo de densidade decide se nasce
   - espaçamento: raio mínimo varia pelo campo de espaçamento (clareiras x mata fechada)
   - espécie, tamanho, formato e cor saem de campos próprios, com jitter. */
export function scatterTrees(cfg) {
  const { size, seed, maskAt, speciesMaskAt, heightAt, slopeAt, fields, p } = cfg;
  const half = size / 2;
  const cell = Math.max(.35, p.spacingMin * .6);
  const n = Math.ceil(size / cell);
  const cands = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -half + (i + hash3(i, j, seed)) * cell;
    const z = -half + (j + hash3(i, j, seed + 1)) * cell;
    if (Math.abs(x) > half - .5 || Math.abs(z) > half - .5) continue;
    const m = maskAt(x, z);
    if (m <= 0.001) continue;
    cands.push({ i, j, x, z, m, pr: hash3(i, j, seed + 2) });
  }
  cands.sort((a, b) => a.pr - b.pr);

  const maxR = p.spacingMax;
  const bucket = Math.max(1, maxR);
  const hashGrid = new Map();
  const bk = (x, z) => Math.floor(x / bucket) + ',' + Math.floor(z / bucket);
  const trees = [];
  const weights = SPECIES_KEYS.map(k => Math.max(0, p.mix[k] ?? 0));
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;

  for (const c of cands) {
    const dens = sampleField(fields.density, c.x, c.z);
    const prob = c.m * lerp(1, smoothstep(p.densityCut - .15, p.densityCut + .15, dens), p.densityInfluence);
    if (hash3(c.i, c.j, seed + 3) > prob) continue;
    if (slopeAt && slopeAt(c.x, c.z) > p.maxSlope) continue;
    const r = lerp(p.spacingMin, p.spacingMax, sampleField(fields.spacing, c.x, c.z));
    const bx = Math.floor(c.x / bucket), bz = Math.floor(c.z / bucket);
    let ok = true;
    for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1 && ok; dx++) {
      const list = hashGrid.get((bx + dx) + ',' + (bz + dz));
      if (!list) continue;
      for (const o of list) if ((o.x - c.x) ** 2 + (o.z - c.z) ** 2 < ((r + o.r) / 2) ** 2) { ok = false; break; }
    }
    if (!ok) continue;

    // espécie: campo de ruído percorre os pesos acumulados → manchas da mesma espécie
    let species;
    const forced = speciesMaskAt ? speciesMaskAt(c.x, c.z) : -1;
    if (forced >= 0) species = SPECIES_KEYS[forced];
    else {
      const sv = clamp01(sampleField(fields.species, c.x, c.z) + (hash3(c.i, c.j, seed + 4) - .5) * p.speciesJitter);
      let acc = 0, target = sv * wSum;
      species = SPECIES_KEYS[SPECIES_KEYS.length - 1];
      for (let s = 0; s < SPECIES_KEYS.length; s++) { acc += weights[s]; if (target <= acc && weights[s] > 0) { species = SPECIES_KEYS[s]; break; } }
      if (!weights[SPECIES_KEYS.indexOf(species)]) continue;
    }

    const sizeV = clamp01(sampleField(fields.size, c.x, c.z) + (hash3(c.i, c.j, seed + 5) - .5) * p.sizeJitter);
    const shapeV = clamp01(sampleField(fields.shape, c.x, c.z) + (hash3(c.i, c.j, seed + 6) - .5) * p.shapeJitter);
    const colV = sampleField(fields.color, c.x, c.z);
    const cj = hash3(c.i, c.j, seed + 7) - .5;
    const bucketN = Math.max(1, p.shapeBuckets | 0);
    const shapeBucket = Math.min(bucketN - 1, Math.floor(shapeV * bucketN));
    const variant = Math.floor(hash3(c.i, c.j, seed + 8) * Math.max(1, p.variants | 0));
    const t = {
      species, x: c.x, z: c.z, y: heightAt(c.x, c.z), r,
      scale: lerp(p.sizeMin, p.sizeMax, sizeV),
      rot: hash3(c.i, c.j, seed + 9) * Math.PI * 2,
      shape: shapeBucket, variant,
      key: species + ':' + shapeBucket + ':' + variant,
      // deslocamento HSV aplicado só nas folhas, no shader
      tint: [(colV - .5) * 2 * p.hueRange + cj * p.colorJitter * p.hueRange,
             (colV - .5) * 2 * p.satRange + cj * p.colorJitter * p.satRange,
             (colV - .5) * 2 * p.valRange - cj * p.colorJitter * p.valRange],
    };
    trees.push(t);
    const kk = bk(c.x, c.z);
    if (!hashGrid.has(kk)) hashGrid.set(kk, []);
    hashGrid.get(kk).push(t);
  }
  return trees;
}

// formato t do balde (centro do intervalo), usado para gerar a variante
export const bucketT = (b, n) => (b + .5) / Math.max(1, n);
export const variantSeed = (species, b, v, worldSeed) => hashStr(species + '|' + b + '|' + v + '|' + worldSeed);

/* ---------- grama ----------
   Lâminas por célula, com densidade = máscara pintada × campo; altura e cor por campos. */
export function scatterGrass(cfg) {
  const { x0, z0, x1, z1, seed, maskAt, heightAt, fields, p, blockedAt } = cfg;
  const blades = [];
  const step = 1 / Math.max(1, Math.round(Math.sqrt(p.density)));
  for (let z = z0; z < z1; z += step) for (let x = x0; x < x1; x += step) {
    const ix = Math.round(x * 64), iz = Math.round(z * 64);
    const px = x + hash3(ix, iz, seed) * step, pz = z + hash3(ix, iz, seed + 1) * step;
    const m = maskAt(px, pz);
    if (m <= 0) continue;
    const d = sampleField(fields.grassDensity, px, pz);
    if (hash3(ix, iz, seed + 2) > m * lerp(1, smoothstep(.25, .6, d), p.noiseInfluence)) continue;
    if (blockedAt && blockedAt(px, pz)) continue;
    const hv = sampleField(fields.grassHeight, px, pz);
    blades.push({
      x: px, z: pz, y: heightAt(px, pz),
      h: lerp(p.heightMin, p.heightMax, clamp01(hv + (hash3(ix, iz, seed + 3) - .5) * .4)),
      rot: hash3(ix, iz, seed + 4) * Math.PI,
      lean: (hash3(ix, iz, seed + 5) - .5) * p.lean,
      c: clamp01(hv * .6 + hash3(ix, iz, seed + 6) * .4),
    });
  }
  return blades;
}
