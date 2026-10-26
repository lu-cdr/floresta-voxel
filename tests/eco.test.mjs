import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEco, suitability, suitabilityGrid, explainCell, SOILS } from '../veg-eco.js';

const S = 40, H = S / 2;
const at = (i, j) => j * S + i;
const mk = (hf, o = {}) => {
  const heights = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) heights[at(i, j)] = hf(i, j);
  return computeEco({ size: S, heights, amp: 10, soilAt: () => 0, trees: [], season: 1, ...o });
};
const tree = (i, j, species, scale = 1) => ({ x: i - H + .5, z: j - H + .5, species, scale });

test('determinismo', () => {
  const f = (i, j) => Math.sin(i * .3) * 3 + Math.cos(j * .2) * 2 + 5;
  const T = () => [tree(5, 5, 'carvalho'), tree(6, 7, 'pinheiro')];
  const a = mk(f, { trees: T() }), b = mk(f, { trees: T() });
  for (const k of ['moisture', 'light', 'fertility', 'slope', 'soil']) assert.deepEqual(a[k], b[k]);
});

test('valores em [0,1] e sem NaN', () => {
  const e = mk((i, j) => (i * 7 + j * 13) % 11, { trees: [tree(5, 5, 'carvalho', 2), tree(5, 6, 'arbusto')], soilAt: (i, j) => (i + j) % 4 });
  for (const k of ['moisture', 'light', 'fertility', 'slope']) for (const v of e[k]) assert.ok(v >= 0 && v <= 1, k);
  for (const v of suitabilityGrid('betula', e)) assert.ok(v >= 0 && v <= 1);
});

test('baixada mais úmida que o topo (rampa)', () => {
  const e = mk((i) => i * .25);
  assert.ok(e.moisture[at(2, 20)] > e.moisture[at(37, 20)]);
});

test('escoamento acumula no fundo de um vale em V', () => {
  const e = mk((i, j) => Math.abs(i - 20) * .3 + (S - j) * .02);   // fundo em i=20, desce para j=S-1
  assert.ok(e.moisture[at(20, 30)] > e.moisture[at(20, 3)]);
  assert.ok(e.moisture[at(20, 30)] > e.moisture[at(10, 30)]);
});

test('árvore reduz a luz no bloco e não a 10 blocos', () => {
  const e = mk(() => 0, { trees: [tree(10, 10, 'carvalho')] });
  assert.ok(e.light[at(10, 10)] < .5);
  assert.equal(e.light[at(20, 10)], 1);
});

test('sombra sazonal: folhosa menor no inverno, pinheiro igual', () => {
  const luz = (sp, season) => mk(() => 0, { trees: [tree(10, 10, sp)], season }).light[at(10, 10)];
  assert.ok(luz('carvalho', 3) > luz('carvalho', 1));
  assert.equal(luz('pinheiro', 3), luz('pinheiro', 1));
});

test('solo: húmus mais fértil que rocha; areia mais seca que terra', () => {
  const e = mk(() => 3, { soilAt: (i) => (i < 10 ? 3 : i < 20 ? 2 : i < 30 ? 1 : 0) });
  assert.ok(e.fertility[at(5, 5)] > e.fertility[at(15, 5)]);
  assert.ok(e.moisture[at(25, 5)] < e.moisture[at(35, 5)]);
  assert.equal(e.soil[at(25, 5)], 1);
});

test('pinheiro mais adequado que cerejeira em areia seca', () => {
  const e = mk(() => 8, { soilAt: () => 1 });
  assert.ok(suitability('pinheiro', e, at(5, 5)) > suitability('cerejeira', e, at(5, 5)));
});

test('explainCell: pouca luz sob copa densa para bétula', () => {
  const e = mk(() => 0, { trees: [tree(10, 10, 'carvalho'), tree(10, 10, 'carvalho'), tree(10, 10, 'carvalho')] });
  const r = explainCell(e, at(10, 10), 'betula');
  assert.equal(r.limit, 'pouca luz');
  assert.equal(r.soil, SOILS[0].label);
  assert.equal(explainCell(mk(() => 0), at(5, 5), 'betula').limit, '');
});

test('platô sem NaN', () => {
  const e = mk(() => 4);
  for (const k of ['moisture', 'light', 'fertility', 'slope']) for (const v of e[k]) assert.ok(Number.isFinite(v));
  assert.ok(Number.isFinite(suitability('carvalho', e, 0)));
});

test('desempenho 160×160 com 2000 árvores', () => {
  const size = 160, heights = new Float32Array(size * size), trees = [];
  for (let k = 0; k < heights.length; k++) heights[k] = Math.round(Math.sin(k % size * .1) * 3 + Math.cos(Math.floor(k / size) * .13) * 3 + 6);
  const sp = ['carvalho', 'betula', 'cerejeira', 'pinheiro', 'arbusto'];
  for (let i = 0; i < 2000; i++) trees.push({ x: (i * 37 % 160) - 80, z: (i * 91 % 160) - 80, species: sp[i % 5], scale: 1 });
  const a = { size, heights, amp: 12, soilAt: () => 0, trees, season: 0 };
  computeEco(a);
  const t0 = performance.now(); for (let r = 0; r < 10; r++) computeEco(a);
  const ms = (performance.now() - t0) / 10;
  console.log(`computeEco 160x160, 2000 árvores: ${ms.toFixed(1)} ms`);
  assert.ok(ms < 50);
});
