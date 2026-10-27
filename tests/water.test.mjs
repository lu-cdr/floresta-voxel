import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, scatterTrees } from '../veg-core.js';
import { computeEco } from '../veg-eco.js';
import { WATER_NONE, hasWater, carveHeights, waterFlow, buildWaterGeometry, packWater, unpackWater } from '../veg-water.js';
import { makeWorld } from './helpers.mjs';

// terreno em escada: 3 degraus de .5 descendo em x (colunas 0-3 alto, 4-7 meio, 8-11 baixo)
const S = 12;
const stairs = () => { const h = new Float32Array(S * S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) h[j * S + i] = (2 - Math.floor(i / 4)) * .5; return h; };
// rio na linha j=5 atravessando os degraus, nível de cada bloco = sua altura (como o pincel faz descendo)
const river = base => { const w = new Float32Array(S * S).fill(WATER_NONE); for (let i = 0; i < S; i++) w[5 * S + i] = base[5 * S + i]; return w; };

test('leito é escavado só onde há água, 1 degrau na margem', () => {
  const base = stairs(), w = river(base), h = carveHeights(base, w, S, .5);
  for (let k = 0; k < S * S; k++) {
    if (hasWater(w[k])) assert.ok(Math.abs(h[k] - (w[k] - .5)) < 1e-6, `bloco ${k}`);
    else assert.equal(h[k], base[k]);
  }
});

test('meio do lago é mais fundo que a margem', () => {
  const base = new Float32Array(S * S), w = new Float32Array(S * S).fill(WATER_NONE);
  for (let j = 3; j < 8; j++) for (let i = 3; i < 8; i++) w[j * S + i] = 0;
  const h = carveHeights(base, w, S, .5);
  assert.equal(h[5 * S + 5], -1);
  assert.equal(h[3 * S + 5], -.5);
});

test('rio corre degrau abaixo e vira cachoeira em cada queda', () => {
  const base = stairs(), w = river(base), h = carveHeights(base, w, S, .5);
  const dir = waterFlow(w, S);
  for (let i = 0; i < S; i++) assert.ok(dir[(5 * S + i) * 2] > .5, `coluna ${i} deveria correr para +x`);
  const g = buildWaterGeometry({ size: S, water: w, heights: h });
  assert.equal(g.blocks, S);
  assert.equal(g.falls, 2); // dois degraus
  assert.equal(g.position.length / 3, g.depth.length);
  assert.equal(g.water.length / 4, g.depth.length);
});

test('lago sem saída fica parado', () => {
  const w = new Float32Array(S * S).fill(WATER_NONE);
  for (let j = 3; j < 8; j++) for (let i = 3; i < 8; i++) w[j * S + i] = 0;
  assert.ok(waterFlow(w, S).every(v => v === 0));
});

test('salvar e abrir a água preserva os níveis', () => {
  const base = stairs(), w = river(base), back = unpackWater(packWater(w));
  for (let k = 0; k < w.length; k++) assert.equal(hasWater(back[k]), hasWater(w[k]));
  for (let k = 0; k < w.length; k++) if (hasWater(w[k])) assert.ok(Math.abs(back[k] - w[k]) < .006);
});

test('perto da água o chão é mais úmido; sem água nada muda', () => {
  const base = stairs(), w = river(base);
  const e0 = computeEco({ size: S, heights: base, amp: 1, soilAt: () => 0, trees: [], season: 1 });
  const e1 = computeEco({ size: S, heights: base, amp: 1, soilAt: () => 0, trees: [], season: 1, water: w });
  const e2 = computeEco({ size: S, heights: base, amp: 1, soilAt: () => 0, trees: [], season: 1, water: null });
  assert.deepEqual(e0.moisture, e2.moisture);
  assert.ok(e1.moisture[6 * S + 2] > e0.moisture[6 * S + 2]);
  assert.ok(e1.moisture[6 * S + 2] - e0.moisture[6 * S + 2] > e1.moisture[11 * S + 2] - e0.moisture[11 * S + 2]);
});

test('máscara de árvores acima de 1 adensa a mata', () => {
  const P = defaultProject(); P.size = 48;
  const n = P.size * 2;
  const normal = scatterTrees(makeWorld(P).cfg).length;
  const dense = scatterTrees(makeWorld(P, { treeMask: new Float32Array(n * n).fill(2) }).cfg).length;
  assert.ok(dense > normal * 1.5, `${normal} → ${dense}`);
});

test('margem: faixa 1 colada na água, faixa 2 no bloco seguinte, água e longe ficam 0', async () => {
  const { shoreBands } = await import('../veg-water.js');
  const base = stairs(), w = river(base), b = shoreBands(w, S);
  for (let i = 0; i < S; i++) {
    assert.equal(b[5 * S + i], 0, 'água não é margem');
    assert.equal(b[4 * S + i], 1); assert.equal(b[6 * S + i], 1);
    assert.equal(b[3 * S + i], 2); assert.equal(b[7 * S + i], 2);
    assert.equal(b[1 * S + i], 0);
  }
  assert.ok(shoreBands(new Float32Array(S * S).fill(WATER_NONE), S).every(v => v === 0));
});

test('espuma fraca na beira da água, forte só sob a cachoeira', async () => {
  const SHORE_FOAM = Math.fround((await import('../veg-water.js')).SHORE_FOAM); // o atributo é Float32
  const base = stairs(), w = river(base), g = buildWaterGeometry({ size: S, water: w, heights: carveHeights(base, w, S, .5) });
  const foam = [];
  for (let v = 0; v < g.depth.length; v++) if (g.water[v * 4 + 2] === 0 && g.normal[v * 3 + 1] === 1) foam.push(g.water[v * 4 + 3]);
  assert.ok(foam.every(f => f === SHORE_FOAM || f === 1), 'rio de 1 bloco: toda borda de superfície toca terra ou queda');
  // lago 3×3: o bloco do meio não encosta em terra, então sem espuma nos cantos internos
  const lw = new Float32Array(S * S).fill(WATER_NONE);
  for (let j = 4; j < 7; j++) for (let i = 4; i < 7; i++) lw[j * S + i] = 0;
  const L = buildWaterGeometry({ size: S, water: lw, heights: carveHeights(new Float32Array(S * S), lw, S, .5) });
  const vals = new Set(); for (let v = 0; v < L.depth.length; v++) if (L.normal[v * 3 + 1] === 1) vals.add(L.water[v * 4 + 3]);
  assert.deepEqual([...vals].sort(), [0, SHORE_FOAM]);
});
