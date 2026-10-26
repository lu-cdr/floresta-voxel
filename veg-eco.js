/* veg-eco.js — grade ecológica leve (GDD §5.1/§5.2), sem three.js e sem DOM.
   Umidade, luz, fertilidade, declive e solo por bloco do terreno + adequação por espécie
   e o fator que mais limita ("pouca luz", "solo seco"...). Determinística: só depende da entrada. */
import { clamp01, smoothstep, SPECIES } from './veg-core.js';

// tipos de solo pintáveis; o índice é o valor guardado na máscara (Uint8)
export const SOILS = [
  // grass: quanto da grama pintada o solo sustenta (areia rala, rocha quase nua)
  { key: 'terra', label: 'Terra', color: null, base: .6, mix: 0, grass: 1 },
  { key: 'areia', label: 'Areia', color: '#d6c08c', base: .3, mix: .75, grass: .35 },
  { key: 'rocha', label: 'Rocha', color: '#8e8a82', base: .1, mix: .8, grass: .08 },
  { key: 'humus', label: 'Húmus', color: '#4d3727', base: .95, mix: .7, grass: 1 },
];
// faixas ideais de umidade/luz, peso por solo e declive tolerado (0..1; 1 = 2 blocos de desnível)
export const PREFS = {
  carvalho: { moist: [.35, .75], light: [.4, 1], soil: { terra: 1, areia: .5, rocha: .15, humus: 1 }, slope: .5 },
  betula: { moist: [.3, .7], light: [.6, 1], soil: { terra: 1, areia: .8, rocha: .3, humus: .9 }, slope: .5 },
  cerejeira: { moist: [.4, .7], light: [.5, 1], soil: { terra: 1, areia: .4, rocha: .1, humus: 1 }, slope: .4 },
  pinheiro: { moist: [.15, .6], light: [.3, 1], soil: { terra: .9, areia: 1, rocha: .6, humus: .7 }, slope: .8 },
  arbusto: { moist: [.2, .8], light: [.15, .9], soil: { terra: .8, areia: .8, rocha: .4, humus: .8 }, slope: .6 },
};
// copa: [raio em blocos, força da sombra]
const CROWN = { carvalho: [2.5, .75], betula: [2, .7], cerejeira: [2.8, .75], pinheiro: [1.6, .7], arbusto: [.9, .2] };
const SOIL_MOIST = [0, -.2, -.25, .15];
const SEASON_MOIST = [.1, -.1, 0, .05];

export function computeEco({ size, heights, amp, soilAt, trees, season }) {
  const n = size * size, half = size / 2, inv = amp > 0 ? 1 / amp : 0;
  const slope = new Float32Array(n), moisture = new Float32Array(n), light = new Float32Array(n).fill(1);
  const fertility = new Float32Array(n), soil = new Uint8Array(n), flow = new Float32Array(n).fill(1);
  let hmin = Infinity, hmax = -Infinity;
  for (let k = 0; k < n; k++) { const h = heights[k]; if (h < hmin) hmin = h; if (h > hmax) hmax = h; }
  const span = hmax > hmin ? 1073741824 / (hmax - hmin) : 0;   // 2^30 níveis; chave = nível·2^20 + k (exata em float64)
  const keys = new Float64Array(n);
  for (let j = 0, k = 0; j < size; j++) for (let i = 0; i < size; i++, k++) {
    const h = heights[k];
    let d = 0;
    if (i > 0) d = Math.max(d, Math.abs(h - heights[k - 1]));
    if (i < size - 1) d = Math.max(d, Math.abs(h - heights[k + 1]));
    if (j > 0) d = Math.max(d, Math.abs(h - heights[k - size]));
    if (j < size - 1) d = Math.max(d, Math.abs(h - heights[k + size]));
    slope[k] = clamp01(d * .5);
    soil[k] = soilAt(i, j);
    keys[k] = Math.floor((h - hmin) * span) * 1048576 + k;
  }
  // escoamento D8: do mais alto ao mais baixo, cada bloco despeja no vizinho estritamente mais baixo
  keys.sort();
  let maxFlow = 1;
  for (let q = n - 1; q >= 0; q--) {
    const k = keys[q] % 1048576, i = k % size, j = (k - i) / size, h = heights[k];
    let best = h, bk = -1;
    for (let dj = -1; dj <= 1; dj++) {
      const jj = j + dj; if (jj < 0 || jj >= size) continue;
      for (let di = -1; di <= 1; di++) {
        const ii = i + di; if ((di === 0 && dj === 0) || ii < 0 || ii >= size) continue;
        const kk = jj * size + ii;
        if (heights[kk] < best) { best = heights[kk]; bk = kk; }
      }
    }
    if (bk >= 0) { flow[bk] += flow[k]; if (flow[bk] > maxFlow) maxFlow = flow[bk]; }
  }
  const lf = maxFlow > 1 ? 1 / Math.log(maxFlow) : 0, sm = SEASON_MOIST[season] ?? 0;
  for (let k = 0; k < n; k++) moisture[k] = .15 + .5 * (1 - clamp01(heights[k] * inv)) + .35 * Math.log(flow[k]) * lf;
  // desfoque leve de 1 passo (reaproveita `flow` como temporário)
  for (let j = 0, k = 0; j < size; j++) for (let i = 0; i < size; i++, k++) {
    const m = moisture[k];
    flow[k] = .5 * m + .125 * ((i > 0 ? moisture[k - 1] : m) + (i < size - 1 ? moisture[k + 1] : m) + (j > 0 ? moisture[k - size] : m) + (j < size - 1 ? moisture[k + size] : m));
  }
  for (let k = 0; k < n; k++) moisture[k] = clamp01(flow[k] + SOIL_MOIST[soil[k]] + sm);
  // sombra de copa: cada árvore carimba um disco só na própria caixa (custo ∝ árvores × área da copa)
  for (const t of trees) {
    const c = CROWN[t.species] ?? CROWN.carvalho, r = c[0] * (t.scale ?? 1);
    let s = c[1];
    if (season === 3 && SPECIES[t.species]?.kind === 'folhosa') s *= .35;
    const cx = t.x + half - .5, cz = t.z + half - .5, r2 = r * r;   // em coordenadas de centro de bloco
    const i0 = Math.max(0, Math.ceil(cx - r)), i1 = Math.min(size - 1, Math.floor(cx + r));
    const j0 = Math.max(0, Math.ceil(cz - r)), j1 = Math.min(size - 1, Math.floor(cz + r));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = (i - cx) * (i - cx) + (j - cz) * (j - cz);
      if (d2 >= r2) continue;
      light[j * size + i] *= 1 - s * (1 - smoothstep(.35, 1, Math.sqrt(d2) / r));
    }
  }
  for (let k = 0; k < n; k++) {
    light[k] = clamp01(light[k]);
    fertility[k] = clamp01(SOILS[soil[k]].base + .2 * moisture[k] + .15 * (1 - light[k]));
  }
  return { size, moisture, light, fertility, slope, soil };
}

// 1 dentro da faixa; fora, cai suave até .1
const band = (v, [lo, hi]) => { const d = v < lo ? lo - v : v > hi ? v - hi : 0; return .1 + .9 * (1 - smoothstep(0, .3, d)); };
const slopeF = (s, tol) => 1 - .9 * smoothstep(tol, tol + .4, s);
const F = [0, 0, 0, 0];   // fatores reutilizados (moisture, light, soil, slope) — sem alocação por bloco
function factors(species, eco, k) {
  const p = PREFS[species];
  F[0] = band(eco.moisture[k], p.moist); F[1] = band(eco.light[k], p.light);
  F[2] = p.soil[SOILS[eco.soil[k]].key] ?? .5; F[3] = slopeF(eco.slope[k], p.slope);
  return F[0] * F[1] * F[2] * F[3];
}
export const suitability = (species, eco, k) => factors(species, eco, k);
// qualidade do lugar para viver (água, solo, encosta), sem a luz: a própria copa não pune a árvore.
// Competição por luz entre árvores fica para o Marco 2.
export const siteQuality = (species, eco, k) => (factors(species, eco, k), F[0] * F[2] * F[3]);
export function suitabilityGrid(species, eco) {
  const out = new Float32Array(eco.size * eco.size);
  for (let k = 0; k < out.length; k++) out[k] = factors(species, eco, k);
  return out;
}
export function explainCell(eco, k, species) {
  const suit = factors(species, eco, k), p = PREFS[species];
  let limit = '';
  if (suit < .75) {
    let w = 0;
    for (let q = 1; q < 4; q++) if (F[q] < F[w]) w = q;
    limit = w === 0 ? (eco.moisture[k] < p.moist[0] ? 'solo seco' : 'solo encharcado')
      : w === 1 ? (eco.light[k] < p.light[0] ? 'pouca luz' : 'luz demais')
      : w === 2 ? 'solo pobre' : 'encosta íngreme';
  }
  return { moisture: eco.moisture[k], light: eco.light[k], fertility: eco.fertility[k], slope: eco.slope[k], soil: SOILS[eco.soil[k]].label, suit, limit };
}
