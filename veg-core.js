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
    flora: {
      samambaia: { leaves: ['#8a4a1c', '#a8741f', '#7a5a1e', '#b8832a'] },
      flor: { stem: '#5a5a24', petals: ['#c4473a', '#e0a040', '#d8782a', '#b5352f'] },
      musgo: { leaves: ['#4f5e24', '#5e6a26', '#44521f'] },
      moita: { stem: '#4a3424', leaves: ['#8a5a1f', '#9a6a24', '#7a4a1c', '#a8741f'] },
      frutos: { stem: '#4a3424', leaves: ['#7a5a22', '#8a6a28', '#6a4a1c'], fruit: ['#b5352f', '#7a2a5a'] },
      junco: { leaves: ['#a08a3a', '#8a7a30', '#b09a48'], tip: '#5a3a20' },
    },
    rock: { stone: ['#8a8274', '#7a7266', '#9a9282', '#6e665a'], moss: ['#6a6a2a', '#5e5e24', '#7a7430'] },
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
    flora: {
      samambaia: { leaves: ['#3f8a30', '#4f9a3c', '#357a2e', '#5aa844'] },
      flor: { stem: '#3f7a2c', petals: ['#f0f0e8', '#e8c040', '#c4527d', '#8a6ad0', '#e86a4a', '#6aa0e0'] },
      musgo: { leaves: ['#4a8a34', '#3f7a2c', '#5a9a3c'] },
      moita: { stem: '#4a3424', leaves: ['#4f8a34', '#41772d', '#5f9a3c', '#6aa848'] },
      frutos: { stem: '#4a3424', leaves: ['#3f7a2c', '#4f8a34', '#357a2e'], fruit: ['#f0f0e8', '#f4c8d8'] },
      junco: { leaves: ['#5a9a3c', '#4a8a30', '#6aa848'], tip: '#6a8a3a' },
    },
    rock: { stone: ['#8e8a7e', '#7e7a70', '#a09a8c', '#706c62'], moss: ['#4f8a34', '#5f9a3c', '#41772d'] },
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
    flora: {
      samambaia: { leaves: ['#2a6a26', '#357a2e', '#1f5a22', '#3f8a32'] },
      flor: { stem: '#2f6a26', petals: ['#d84a4a', '#f0d040', '#f0f0e8'] },
      musgo: { leaves: ['#2f6a2a', '#256024', '#3a7430'] },
      moita: { stem: '#3e2c1e', leaves: ['#2f6a26', '#356d2a', '#255c24', '#3c7f32'] },
      frutos: { stem: '#3e2c1e', leaves: ['#2a5e24', '#356d2a', '#244f20'], fruit: ['#c4304a', '#3a2a6a'] },
      junco: { leaves: ['#3f7a2c', '#4a8a34', '#356d2a'], tip: '#5a3a20' },
    },
    rock: { stone: ['#86847a', '#76746a', '#96948a', '#6a685e'], moss: ['#356d2a', '#2f6a26', '#41772d'] },
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
    flora: {
      samambaia: { leaves: ['#3a5a44', '#44624a', '#32503c'] },
      flor: { stem: '#5a6a52', petals: ['#d8dce4', '#b8bcd0'] },
      musgo: { leaves: ['#4a6a4c', '#3f5e44', '#56745a'] },
      moita: { stem: '#3e2c1e', leaves: ['#5a6a52', '#4a5a44', '#6a6a5a'] },
      frutos: { stem: '#3e2c1e', leaves: ['#4a5a44', '#5a5a4c', '#3f5e44'], fruit: ['#b03030'] },
      junco: { leaves: ['#a89a78', '#988a68', '#b8aa88'], tip: '#4a3a2a' },
    },
    rock: { stone: ['#8c8a88', '#7c7a78', '#9c9a98', '#6c6a68'], moss: ['#4a6a4c', '#3f5e44', '#56745a'] },
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
    // sub-bosque: candidatos por m², quanto da máscara de árvores vira intenção de flora, mistura
    // margin: intenção automática na beira d'água (onde o junco gosta)
    flora: { density: 1.2, variants: 3, underTrees: .7, margin: .8, mix: { samambaia: 1, flor: 1, musgo: .8, moita: .6, frutos: .35, junco: 3 } },
    // rochas: chance por candidato, variantes por tipo, quanto nascem sozinhas em solo de rocha/encosta, mistura
    rocks: { density: .55, variants: 3, auto: .6, mix: { seixo: 1, pedra: .8, matacao: .4, afloramento: .25 } },
    // tick = dias desde o início; começa no 1º dia do outono, combinando com o estilo padrão.
    // seasonal: o estilo segue a estação (seasonStyle) em vez de ficar fixo.
    // epoch: dia em que o modo Ecossistema começou (idade das árvores sem registro em plants)
    ecology: { mode: 'criativo', tick: 24, dayTime: .42, seasonLen: 12, seasonal: true, epoch: null, plants: {} },
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
    // máscara acima de 1 = mata adensada pelo pincel: ignora o ruído de densidade e aperta o espaçamento
    const extra = clamp01(c.m - 1);
    const dens = sampleField(fields.density, c.x, c.z);
    const prob = Math.min(1, c.m) * lerp(lerp(1, smoothstep(p.densityCut - .15, p.densityCut + .15, dens), p.densityInfluence), 1, extra);
    if (hash3(c.i, c.j, seed + 3) > prob) continue;
    if (slopeAt && slopeAt(c.x, c.z) > p.maxSlope) continue;
    const r = lerp(p.spacingMin, p.spacingMax, sampleField(fields.spacing, c.x, c.z)) * (1 - .5 * extra);
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
      id: c.i + ',' + c.j,
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

/* ---------- sub-bosque (GDD §5.2) ----------
   Plantas minúsculas em voxels de meia escala (o chamador usa meshVoxels(planta, style.voxel * .5)).
   Tipos: 1 caule, 2 folha (o shader balança e colore), 3 acento (pétalas). */
// moita/frutos: arbustos baixos (não confundir com a espécie de árvore 'arbusto'); junco: só na margem d'água
export const FLORA = {
  samambaia: { label: 'Samambaia' }, flor: { label: 'Flores' }, musgo: { label: 'Musgo' },
  // rare: chance extra de nascer — arbustos servem em quase todo lugar e cobririam o chão
  moita: { label: 'Arbusto', rare: .3 }, frutos: { label: 'Arbusto com frutos', rare: .3 }, junco: { label: 'Junco' },
};
export const FLORA_KEYS = Object.keys(FLORA);
// multiplicador por estação (primavera, verão, outono, inverno): flor só no calor, frutos e junco somem no frio
const FLORA_SEASON = { flor: [1.3, 1, .4, 0], frutos: [.7, 1, 1, .5], junco: [1, 1, 1, .6] };

export function genFloraVoxels(kind, shapeT, seed, style) {
  const R = rng(seed), P = perlin(seed % 1000), g = voxelGrid();
  const t = clamp01(shapeT + (R() - .5) * .2);
  const pal = style.flora[kind] || STYLES['Outono ICQR'].flora[kind]; // paleta salva antes deste tipo existir
  const leafCols = (pal.leaves || pal.petals).map(hexToRgb);
  const leaf = (x, y, z, type = 2) => {
    const n = P.noise3(x * .5 + 40, y * .5, z * .5);
    const c = leafCols[Math.min(leafCols.length - 1, Math.floor(clamp01(n * .5 + .5 + (R() - .5) * .4) * leafCols.length))];
    g.put(x, y, z, type, shiftHsl(c, 0, 0, (R() - .5) * .06 + y * .012));
  };
  if (kind === 'samambaia') {
    const H = Math.round(lerp(3, 6, t)), nf = 5 + Math.round(R() * 2 + t * 2), reach = 1.5 + H * .7;
    for (let y = 0; y < H; y++) leaf(0, y, 0);               // fronde central, reta
    for (let f = 0; f < nf; f++) {
      const a = (f / nf) * Math.PI * 2 + R() * .6, ca = Math.cos(a), sa = Math.sin(a);
      const len = Math.round(reach * (.8 + R() * .35)) + 1, hh = (H - 1) * (.75 + R() * .25);
      for (let s = 1; s <= len; s++) {
        const u = s / len, d = u * reach;
        const x = Math.round(ca * d), z = Math.round(sa * d), y = Math.round(hh * Math.sin(Math.PI * u * .8));
        leaf(x, y, z);
        if (s > 1 && s % 2 === 0) { leaf(x + Math.round(-sa), y, z + Math.round(ca)); leaf(x + Math.round(sa), y, z + Math.round(-ca)); } // folíolos
      }
    }
  } else if (kind === 'flor') {
    const Hs = Math.round(lerp(2, 4, t)), nh = 1 + Math.round(R() * 1.2 + t), petals = pal.petals.map(hexToRgb);
    const stem = hexToRgb(pal.stem), pick = () => petals[Math.floor(R() * petals.length)];
    const head = (cx, y, cz, col, mid) => {
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
        g.put(cx + dx, y, cz + dz, 3, dx || dz ? shiftHsl(col, 0, 0, (R() - .5) * .05) : mid);
    };
    for (let y = 0; y < Hs; y++) g.put(0, y, 0, 1, shiftHsl(stem, 0, 0, (R() - .5) * .05), true);
    const c0 = pick();
    head(0, Hs, 0, c0, shiftHsl(c0, .02, 0, -.15));
    for (let h = 1; h < nh; h++) {
      const a = R() * Math.PI * 2, dx = Math.round(Math.cos(a) * 2), dz = Math.round(Math.sin(a) * 2), y = Math.max(1, Hs - 1 - Math.floor(R() * 2));
      g.put(Math.sign(dx), y - 1, Math.sign(dz), 1, stem, true);
      g.put(dx, y, dz, 1, stem, true);
      const c = pick();
      head(dx, y + 1, dz, c, shiftHsl(c, .02, 0, -.15));
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (R() < .5) leaf(dx, 0, dz);
    leaf(0, 1, R() < .5 ? 1 : -1);
  } else if (kind === 'moita' || kind === 'frutos') {
    // arbusto: galhos curtos e uma copa em domo achatado, com buracos de ruído; frutos salpicados por fora
    const rr = lerp(kind === 'frutos' ? 3 : 3.5, kind === 'frutos' ? 4.5 : 5.5, t), H = Math.round(rr * (.9 + R() * .3)), ri = Math.ceil(rr) + 1;
    const stem = hexToRgb(pal.stem);
    for (let y = 0; y < 2; y++) g.put(0, y, 0, 1, stem, true);
    for (let y = 1; y <= H + 1; y++) for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
      const u = Math.hypot(dx, dz) / rr, w = (y - H * .45) / (H * .6);
      if (u * u + w * w < 1 - P.noise3(dx * .45, y * .45, dz * .45) * .5 && R() > .06) leaf(dx, y, dz);
    }
    const fruit = (pal.fruit || []).map(hexToRgb);
    if (fruit.length) for (const v of g.map.values()) {
      if (v.type !== 2 || R() > .14) continue;
      const out = !g.has(v.x + Math.sign(v.x), v.y, v.z) || !g.has(v.x, v.y + 1, v.z) || !g.has(v.x, v.y, v.z + Math.sign(v.z));
      if (out) { v.type = 3; v.col = shiftHsl(fruit[Math.floor(R() * fruit.length)], 0, 0, (R() - .5) * .06); }
    }
  } else if (kind === 'junco') {
    // touceira de hastes retas, levemente inclinadas para fora; algumas com a espiga escura na ponta
    const n = 6 + Math.round(R() * 4 + t * 4), tip = hexToRgb(pal.tip);
    for (let s = 0; s < n; s++) {
      const a = R() * Math.PI * 2, r0 = R() * 1.6, H = Math.round(lerp(6, 11, t) * (.7 + R() * .4)), lean = .12 + R() * .1;
      let x = 0, z = 0;
      for (let y = 0; y < H; y++) {
        x = Math.round(Math.cos(a) * (r0 + y * lean)); z = Math.round(Math.sin(a) * (r0 + y * lean));
        leaf(x, y, z);
      }
      if (R() < .45) for (let y = H; y < H + 2; y++) g.put(x, y, z, 3, shiftHsl(tip, 0, 0, (R() - .5) * .05));
    }
  } else { // musgo: almofada baixa e irregular
    const rr = lerp(2, 3.5, t), ri = Math.ceil(rr * 1.3) + 1;
    for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.hypot(dx, dz), edge = rr * (.78 + .3 * P.noise2(dx * .6 + seed % 97, dz * .6));
      if (d > edge && !(dx === 0 && dz === 0)) continue;
      leaf(dx, 0, dz);
      if (d < edge * .6 && R() < .65) leaf(dx, 1, dz);
    }
  }
  let maxY = 0;
  for (const v of g.map.values()) maxY = Math.max(maxY, v.y);
  return { grid: g, height: maxY + 1, trunkW: 1 };
}

/* Distribuição do sub-bosque por chunk: mesmo esquema de scatterGrass (hash da posição, então
   pintar num canto não muda outro chunk). A espécie sai dos pesos adequação × mix × estação. */
export function scatterFlora(cfg) {
  const { x0, z0, x1, z1, seed, maskAt, suitAt, heightAt, blockedAt, p } = cfg;
  const season = Math.min(3, Math.max(0, cfg.season | 0));
  const NK = FLORA_KEYS.length, out = [], w = new Array(NK).fill(0), step = 1 / Math.sqrt(Math.max(.01, p.density));
  const mul = FLORA_KEYS.map(k => FLORA_SEASON[k]?.[season] ?? 1);
  for (let z = z0; z < z1; z += step) for (let x = x0; x < x1; x += step) {
    const ix = Math.round(x * 64), iz = Math.round(z * 64);
    const px = x + hash3(ix, iz, seed) * Math.min(step, x1 - x), pz = z + hash3(ix, iz, seed + 1) * Math.min(step, z1 - z);
    const m = maskAt(px, pz);
    if (m <= 0) continue;
    if (blockedAt && blockedAt(px, pz)) continue;
    let sum = 0;
    for (let k = 0; k < NK; k++) { w[k] = clamp01(suitAt(FLORA_KEYS[k], px, pz)) * Math.max(0, p.mix[FLORA_KEYS[k]] ?? 0) * mul[k]; sum += w[k]; }
    if (sum <= 0) continue;
    let target = hash3(ix, iz, seed + 2) * sum, c = 0;
    while (c < NK - 1 && target >= w[c]) { target -= w[c]; c++; }
    if (w[c] <= 0) c = w.findIndex(v => v > 0);
    const kind = FLORA_KEYS[c], suit = clamp01(suitAt(kind, px, pz) * mul[c]);
    if (hash3(ix, iz, seed + 3) > m * suit * (FLORA[kind].rare ?? 1)) continue;
    const variant = Math.floor(hash3(ix, iz, seed + 4) * Math.max(1, p.variants | 0));
    out.push({
      kind, x: px, y: heightAt(px, pz), z: pz,
      rot: hash3(ix, iz, seed + 5) * Math.PI * 2, scale: lerp(.7, 1.3, hash3(ix, iz, seed + 6)),
      variant, key: 'f:' + kind + ':' + variant,
    });
  }
  return out;
}

/* ---------- rochas ----------
   Blocos de pedra em voxel do mundo: elipsoide com ruído (pedra, matacão), camadas que encolhem
   para cima (afloramento) ou um punhado de seixos. Um pouco enterradas para assentar no degrau.
   Tipos de voxel: 1 pedra (sem vento), 2 musgo (recebe o tint como folha), 3 neve. */
export const ROCKS = {
  seixo: { label: 'Seixos', r: [2.5, 3.5], big: false }, // r: raio da pegada em voxels (min, max)
  pedra: { label: 'Pedras', r: [2.5, 4], big: false },
  matacao: { label: 'Matacões', r: [5, 8], big: true },
  afloramento: { label: 'Afloramento', r: [7, 11], big: true },
};
export const ROCK_KEYS = Object.keys(ROCKS);
// voxels enterrados: a grade não guarda y < 0, então a rocha é gerada ROCK_SINK acima e o chamador a desce
export const ROCK_SINK = 2;
const rockPalette = style => style.rock || STYLES['Outono ICQR'].rock; // estilo próprio antigo sem rocha
// raio da pegada em metros de uma variante (o scatter e a geração usam a mesma conta)
export const rockRadius = (kind, shapeT, voxel) => lerp(ROCKS[kind].r[0], ROCKS[kind].r[1], shapeT) * voxel;

export function genRockVoxels(kind, shapeT, seed, style, { moss = false } = {}) {
  const R = rng(seed), P = perlin(seed % 1000), g = voxelGrid();
  const pal = rockPalette(style), stone = pal.stone.map(hexToRgb), mossC = pal.moss.map(hexToRgb);
  const rad = lerp(ROCKS[kind].r[0], ROCKS[kind].r[1], shapeT);
  const put = (x, y, z) => g.put(x, y + ROCK_SINK, z, 1, stone[0]);
  // elipsoide alongado e girado, superfície mexida por ruído; y < 0 fica enterrado
  const blob = (cx, cz, r, hk) => {
    const a = R() * Math.PI, ca = Math.cos(a), sa = Math.sin(a), ex = 1 + R() * .45, H = r * hk, ri = Math.ceil(r * ex) + 1;
    for (let y = -2; y <= Math.ceil(H * 1.2); y++) for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
      const u = (dx * ca + dz * sa) / (r * ex), v = (-dx * sa + dz * ca) / r, w = (y + .5) / H;
      if (u * u + v * v + w * w < 1 - P.noise3((cx + dx) * .3, y * .3, (cz + dz) * .3) * .45) put(cx + dx, y, cz + dz);
    }
  };
  if (kind === 'seixo') {
    const n = 3 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const d = k ? rad * (.35 + R() * .55) : 0, a = R() * Math.PI * 2;
      blob(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 1 + R() * 1.1, .7 + R() * .3);
    }
  } else if (kind === 'afloramento') {
    // estratos: cada camada é um contorno ruidoso menor que o de baixo
    const H = Math.round(lerp(3, 5, shapeT)), ri = Math.ceil(rad * 1.6) + 1, ex = 1 + R() * .5;
    for (let y = -2; y <= H; y++) {
      const yy = Math.max(0, y), ry = rad * Math.pow(1 - yy / (H + 1), .7);
      for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
        if (Math.hypot(dx / ex, dz) / ry + P.noise2(dx * .22 + yy * 3.1, dz * .22) * .35 < 1) put(dx, y, dz);
      }
    }
  } else blob(0, 0, rad, kind === 'matacao' ? .8 : .7);
  // cor: faixas de ruído (estratos no afloramento), musgo e neve no que fica exposto em cima
  const snowCol = hexToRgb(style.snowColor || '#f4f7fa');
  for (const v of g.map.values()) {
    const y = v.y - ROCK_SINK, n = P.noise3(v.x * .18 + 7, y * (kind === 'afloramento' ? .6 : .18), v.z * .18);
    v.col = shiftHsl(stone[Math.min(stone.length - 1, Math.floor(clamp01(n * .5 + .5 + (R() - .5) * .3) * stone.length))], 0, 0, (R() - .5) * .04 + y * .006);
    const up = !g.has(v.x, v.y + 1, v.z);
    if (moss && up && P.noise3(v.x * .25, v.y * .25 + 30, v.z * .25) > -.15) { v.type = 2; v.col = mossC[Math.floor(R() * mossC.length)]; }
    if (style.snow > 0 && up && y >= 0 && hash3(v.x, v.z, seed) < style.snow) { v.type = 3; v.col = shiftHsl(snowCol, 0, 0, (R() - .5) * .03); }
  }
  let maxY = 0;
  for (const v of g.map.values()) maxY = Math.max(maxY, v.y);
  return { grid: g, height: maxY + 1, trunkW: 1, radius: rad };
}

/* Distribuição: grade com jitter por hash da célula, como as árvores (pintar num canto não mexe no
   resto). maskAt = intenção (pintada ou automática, 0..1); roughAt = quão rochoso é o lugar (0..1),
   puxa para matacões e afloramentos; blockedAt(x, z, r) = água; groundAt(x, z, r) = altura onde
   assentar (o chamador usa o mínimo da pegada para não ficar flutuando). */
export function scatterRocks(cfg) {
  const { size, seed, voxel, maskAt, kindAt, roughAt, mossAt, groundAt, blockedAt, p } = cfg;
  const half = size / 2, cell = 1.1, n = Math.ceil(size / cell), cands = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -half + (i + hash3(i, j, seed)) * cell, z = -half + (j + hash3(i, j, seed + 1)) * cell;
    if (Math.abs(x) > half - 1 || Math.abs(z) > half - 1) continue;
    const m = maskAt(x, z);
    if (m <= .001 || hash3(i, j, seed + 3) > m * p.density) continue;
    cands.push({ i, j, x, z, pr: hash3(i, j, seed + 2) });
  }
  cands.sort((a, b) => a.pr - b.pr);
  const grid = new Map(), B = 3, out = [];
  const bk = (a, b) => a + ',' + b;
  for (const c of cands) {
    let kind;
    const forced = kindAt ? kindAt(c.x, c.z) : -1;
    if (forced >= 0) kind = ROCK_KEYS[forced];
    else {
      const rough = roughAt ? clamp01(roughAt(c.x, c.z)) : 0;
      const w = ROCK_KEYS.map(k => Math.max(0, p.mix[k] ?? 0) * (ROCKS[k].big ? lerp(.6, 2.5, rough) : 1));
      let t = hash3(c.i, c.j, seed + 4) * w.reduce((a, b) => a + b, 0), k = 0;
      while (k < w.length - 1 && t >= w[k]) { t -= w[k]; k++; }
      if (!w[k]) continue;
      kind = ROCK_KEYS[k];
    }
    const variant = Math.floor(hash3(c.i, c.j, seed + 5) * Math.max(1, p.variants | 0));
    const scale = lerp(.8, 1.2, hash3(c.i, c.j, seed + 6));
    const r = rockRadius(kind, bucketT(variant, p.variants), voxel) * scale;
    if (blockedAt && blockedAt(c.x, c.z, r)) continue;
    const bx = Math.floor(c.x / B), bz = Math.floor(c.z / B), reach = Math.ceil((r + 2.8) / B);
    let ok = true;
    for (let dz = -reach; dz <= reach && ok; dz++) for (let dx = -reach; dx <= reach && ok; dx++) {
      for (const o of grid.get(bk(bx + dx, bz + dz)) || []) if ((o.x - c.x) ** 2 + (o.z - c.z) ** 2 < ((r + o.r) * .85) ** 2) { ok = false; break; }
    }
    if (!ok) continue;
    const moss = mossAt ? mossAt(c.x, c.z) > .55 : false;
    const rock = {
      id: c.i + ',' + c.j, kind, x: c.x, z: c.z, y: groundAt(c.x, c.z, r), r, scale, variant, moss,
      rot: Math.floor(hash3(c.i, c.j, seed + 7) * 4) * Math.PI / 2 + (hash3(c.i, c.j, seed + 8) - .5) * .5,
      key: 'r:' + kind + ':' + variant + (moss ? ':m' : ''),
    };
    out.push(rock);
    if (!grid.has(bk(bx, bz))) grid.set(bk(bx, bz), []);
    grid.get(bk(bx, bz)).push(rock);
  }
  return out;
}

/* ---------- ciclo de vida (GDD §5.3) ----------
   Estágios discretos derivados do tempo: nada é simulado por quadro. Dias; 1 ano = 4 × seasonLen.
   Vida da árvore = média da espécie × acaso do id × adequação do lugar; depois de morta (12 dias)
   e toco (48), rebrota no mesmo lugar e o ciclo recomeça (age % C), sempre de forma determinística. */
export const STAGES = ['broto', 'jovem', 'adulta', 'velha', 'morta', 'toco'];
export const STAGE_LABELS = { broto: 'broto', jovem: 'jovem', adulta: 'adulta', velha: 'velha', morta: 'morta em pé', toco: 'toco' };
// ~10 anos para o carvalho (1 ano = 48 dias): a floresta muda devagar, alguns por cento por estação
export const LIFE = { carvalho: 480, betula: 280, cerejeira: 320, pinheiro: 560, arbusto: 180 };
const DEAD_DAYS = 12, REGROW_GAP = 60; // toco dura 48 dias (REGROW_GAP − DEAD_DAYS)

export function lifeOf(tree, eco, seed, suit = 1) {
  const su = clamp01(suit), hid = hashStr(tree.id);
  const h1 = hash3(hid, seed | 0, 1), h2 = hash3(hid, seed | 0, 2);
  const lifespan = (LIFE[tree.species] ?? 400) * (.75 + .5 * h1) * (.5 + .5 * su);
  const C = lifespan + REGROW_GAP;
  const plants = eco.plants || {}, implicit = plants[tree.id] === undefined;
  const lo = Math.min(30, .8 * lifespan); // vida muito curta: a idade inicial ainda cai em adulta/velha
  const born = implicit ? eco.epoch - (lo + h2 * (.85 * lifespan - lo)) : plants[tree.id];
  const age = Math.max(0, eco.tick - born), a = age % C;
  const aEnd = .8 * lifespan, jEnd = Math.min(30, 6 + (aEnd - 6) * .5);
  const live = .75 + .25 * su;
  let stage, scale;
  if (a < 6) { stage = 'broto'; scale = lerp(.15, .3, a / 6) * live; }
  else if (a < jEnd) { stage = 'jovem'; scale = lerp(.35, .8, (a - 6) / (jEnd - 6)) * live; }
  else if (a < aEnd) { stage = 'adulta'; scale = lerp(.85, 1, (a - jEnd) / (aEnd - jEnd)) * live; }
  else if (a < lifespan) { stage = 'velha'; scale = 1.05 * live; }
  else if (a < lifespan + DEAD_DAYS) { stage = 'morta'; scale = 1; }
  else { stage = 'toco'; scale = 1; }
  return { stage, age, cycleAge: a, lifespan, born, implicit, scale };
}
// sufixo da chave de variante: vivos usam a chave normal
export const stageKey = stage => stage === 'morta' ? ':morta' : stage === 'toco' ? ':toco' : '';

/* Árvore morta em pé / toco a partir de uma árvore gerada: só madeira (tipo 1 original),
   sem folha (veg leaf = 0 → sem cor sazonal nem tremulação). Não muta a original. */
export function deadVariant(tree, kind, style) {
  const src = tree.grid, kinds = tree.kinds, W = tree.trunkW;
  const g = voxelGrid(), cut = Math.max(2, Math.round(.7 / style.voxel));
  const cx = -Math.floor(W / 2) + W / 2 - .5; // eixo do tronco, em índices de célula
  const keep = [];
  let i = 0;
  for (const v of src.map.values()) {
    const t = kinds ? kinds[i] : v.type; i++;
    if (t !== 1) continue;
    if (kind === 'toco' && (v.y >= cut || Math.hypot(v.x - cx, v.z - cx) > W + 1)) continue;
    keep.push(v);
  }
  let top = 0;
  for (const v of keep) top = Math.max(top, v.y);
  for (const v of keep) {
    const n = hash3(v.x, v.y, (tree.seed | 0) + 77) - .5;
    const [r, gg, b] = v.col || [.3, .22, .15], l = (r + gg + b) / 3;
    const gray = [lerp(r, l, .55), lerp(gg, l, .55), lerp(b, l, .55)]; // desbotada
    const col = shiftHsl(gray, 0, 0, n * .08 - .02 + (kind === 'toco' && v.y === top ? .1 : 0)); // topo do toco: anéis mais claros
    g.put(v.x, v.y, v.z, 1, col, true);
  }
  let maxY = 0;
  for (const v of g.map.values()) maxY = Math.max(maxY, v.y);
  return { grid: g, height: g.map.size ? maxY + 1 : 1, trunkW: W, seed: tree.seed, speciesKey: tree.speciesKey, flowerP: 0, stripes: false, kinds: Uint8Array.from(g.map.values(), () => 1), dead: kind };
}
