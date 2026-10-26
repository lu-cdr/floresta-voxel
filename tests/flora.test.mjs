import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, SEASONS, FLORA, FLORA_KEYS, genFloraVoxels, scatterFlora, meshVoxels } from '../veg-core.js';
import { PREFS, SOILS, suitability, explainCell } from '../veg-eco.js';

const dump = pl => [...pl.grid.map.values()].map(v => [v.x, v.y, v.z, v.type, ...v.col.map(c => c.toFixed(4))].join(',')).join('|');
const RANGE = { samambaia: [3, 6], flor: [3, 5], musgo: [1, 2] };

test('flora: contrato de constantes e estilos', () => {
  assert.deepEqual(FLORA_KEYS, ['samambaia', 'flor', 'musgo']);
  for (const k of FLORA_KEYS) assert.ok(FLORA[k].label && PREFS[k]);
  for (const [n, s] of Object.entries(STYLES)) {
    assert.ok(s.flora.samambaia.leaves.length && s.flora.musgo.leaves.length, n);
    assert.ok(s.flora.flor.stem && s.flora.flor.petals.length, n);
  }
  assert.ok(STYLES['Primavera'].flora.flor.petals.length > STYLES['Inverno'].flora.flor.petals.length);
});

test('genFloraVoxels: determinístico, não vazio, alturas e mesh', () => {
  for (const [name, style] of Object.entries(STYLES)) for (const kind of FLORA_KEYS) for (const t of [0, .5, 1]) {
    for (let seed = 1; seed <= 12; seed++) {
      const a = genFloraVoxels(kind, t, seed, style), b = genFloraVoxels(kind, t, seed, style);
      assert.equal(dump(a), dump(b), `${name} ${kind}`);
      assert.ok(a.grid.map.size > 0 && a.trunkW === 1);
      const [lo, hi] = RANGE[kind];
      assert.ok(a.height >= lo && a.height <= hi, `${kind} t=${t} seed=${seed} altura ${a.height}`);
      for (const v of a.grid.map.values()) assert.ok(v.col.length === 3 && [1, 2, 3].includes(v.type));
    }
    const m = meshVoxels(genFloraVoxels(kind, t, 3, style), style.voxel * .5);
    assert.ok(m.position.length > 0 && m.index.length > 0 && m.voxels > 0);
  }
});

test('genFloraVoxels: semente muda a planta, flor tem pétalas e caule, musgo é largo', () => {
  const st = STYLES['Primavera'];
  assert.notEqual(dump(genFloraVoxels('samambaia', .5, 1, st)), dump(genFloraVoxels('samambaia', .5, 2, st)));
  for (let seed = 1; seed <= 20; seed++) {
    const f = [...genFloraVoxels('flor', .5, seed, st).grid.map.values()].map(v => v.type);
    assert.ok(f.includes(3) && f.includes(1));
    const m = genFloraVoxels('musgo', .5, seed, st), xs = [...m.grid.map.values()].map(v => v.x);
    assert.ok(Math.max(...xs) - Math.min(...xs) + 1 >= 3);
    assert.ok([...m.grid.map.values()].every(v => v.type === 2));
  }
});

const base = (over = {}) => ({
  x0: 0, z0: 0, x1: 16, z1: 16, seed: 7, maskAt: () => 1, suitAt: () => .8, heightAt: () => 0, blockedAt: null,
  season: 0, p: { density: 1.2, variants: 3, mix: { samambaia: 1, flor: 1, musgo: 1 } }, ...over,
});
const kinds = a => new Set(a.map(f => f.kind));

test('scatterFlora: determinístico e com o formato do contrato', () => {
  const a = scatterFlora(base()), b = scatterFlora(base());
  assert.deepEqual(a, b);
  assert.ok(a.length > 30);
  for (const f of a) {
    assert.ok(f.scale >= .7 && f.scale <= 1.3 && f.variant >= 0 && f.variant < 3);
    assert.equal(f.key, 'f:' + f.kind + ':' + f.variant);
    assert.ok(f.x >= 0 && f.x < 16 && f.z >= 0 && f.z < 16);
  }
});

test('scatterFlora: localidade entre chunks', () => {
  const left = c => scatterFlora(base({ x0: 0, x1: 16, ...c }));
  const right = c => scatterFlora(base({ x0: 16, x1: 32, ...c }));
  const m = x => (x < 16 ? 1 : .2);
  assert.deepEqual(left({ maskAt: x => 1 }), left({ maskAt: x => 1 }));
  // mudar a máscara só no chunk da direita não altera o da esquerda e vice-versa
  const L1 = left({ maskAt: (x) => (x < 16 ? 1 : 0) }), L2 = left({ maskAt: (x) => (x < 16 ? 1 : .3) });
  assert.deepEqual(L1, L2);
  const R1 = right({ maskAt: (x) => (x >= 16 ? .7 : 1) }), R2 = right({ maskAt: (x) => (x >= 16 ? .7 : 0) });
  assert.deepEqual(R1, R2);
  assert.ok(m(1) > m(20));
});

test('scatterFlora: sombra úmida dá samambaia/musgo, sol dá flores', () => {
  const sombra = (k) => (k === 'flor' ? 0 : .9), sol = k => (k === 'flor' ? .9 : .05);
  const s = scatterFlora(base({ suitAt: sombra }));
  assert.ok(s.length > 20 && kinds(s).has('samambaia') && kinds(s).has('musgo') && !kinds(s).has('flor'));
  const o = scatterFlora(base({ suitAt: sol }));
  const nf = o.filter(f => f.kind === 'flor').length;
  assert.ok(nf > 20 && nf > o.length * .8);
});

test('scatterFlora: inverno sem flores, outono menos que primavera, máscara 0 vazia, bloqueio', () => {
  assert.ok(!kinds(scatterFlora(base({ season: 3 }))).has('flor'));
  const cnt = s => scatterFlora(base({ season: s, suitAt: () => 1, p: { density: 1.2, variants: 1, mix: { samambaia: 0, flor: 1, musgo: 0 } } })).length;
  assert.ok(cnt(2) < cnt(0) && cnt(3) === 0);
  assert.equal(scatterFlora(base({ maskAt: () => 0 })).length, 0);
  assert.equal(scatterFlora(base({ blockedAt: () => true })).length, 0);
  assert.equal(scatterFlora(base({ suitAt: () => 0 })).length, 0);
});

test('eco: suitability e explainCell funcionam com as chaves de flora', () => {
  const n = 4, mk = (moisture, light) => ({ size: n, moisture: new Float32Array(n * n).fill(moisture), light: new Float32Array(n * n).fill(light), fertility: new Float32Array(n * n).fill(.5), slope: new Float32Array(n * n), soil: new Uint8Array(n * n) });
  const sombra = mk(.8, .2), sol = mk(.5, .9);
  assert.ok(suitability('samambaia', sombra, 0) > suitability('samambaia', sol, 0));
  assert.ok(suitability('musgo', sombra, 0) > suitability('musgo', sol, 0));
  assert.ok(suitability('flor', sol, 0) > suitability('flor', sombra, 0));
  assert.equal(explainCell(sombra, 0, 'flor').limit, 'pouca luz');
  assert.equal(SOILS.length, 4);
  assert.equal(SEASONS.length, 4);
});
