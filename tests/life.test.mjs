import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, LIFE, lifeOf, stageKey, deadVariant, genTreeVoxels, meshVoxels, scatterTrees, defaultProject, STYLES, SPECIES_KEYS } from '../veg-core.js';

const style = STYLES['Outono ICQR'];
const doScatter = () => {
  const P = defaultProject();
  return scatterTrees({ size: 40, seed: 7, maskAt: () => 1, speciesMaskAt: null, heightAt: () => 0, slopeAt: null, fields: P.fields, p: P.trees });
};

test('scatter: ids estáveis e únicos', () => {
  const a = doScatter(), b = doScatter();
  assert.ok(a.length > 20);
  assert.deepEqual(a.map(t => t.id), b.map(t => t.id));
  assert.equal(new Set(a.map(t => t.id)).size, a.length);
  assert.match(a[0].id, /^\d+,\d+$/);
});

test('lifeOf: determinístico', () => {
  const t = { id: '3,4', species: 'carvalho' }, eco = { tick: 100, epoch: 24, plants: { '3,4': 10 } };
  assert.deepEqual(lifeOf(t, eco, 5, .8), lifeOf(t, eco, 5, .8));
});

test('lifeOf: todos os estágios em ordem, rebrota depois de C dias', () => {
  for (const sp of SPECIES_KEYS) for (const suit of [1, .5]) {
    const t = { id: '1,2', species: sp }, plants = { '1,2': 0 };
    const L0 = lifeOf(t, { tick: 0, epoch: 0, plants }, 9, suit), C = L0.lifespan + 60;
    assert.equal(L0.stage, 'broto');
    const seen = [];
    for (let d = 0; d < C; d++) {
      const L = lifeOf(t, { tick: d, epoch: 0, plants }, 9, suit);
      if (seen[seen.length - 1] !== L.stage) seen.push(L.stage);
    }
    assert.deepEqual(seen, STAGES, sp);
    const R = lifeOf(t, { tick: Math.ceil(C), epoch: 0, plants }, 9, suit);
    assert.equal(R.stage, 'broto');
    assert.ok(R.age >= C);
  }
});

test('lifeOf: tick antes de brotar é broto com idade 0', () => {
  const L = lifeOf({ id: 'a', species: 'pinheiro' }, { tick: 3, epoch: 0, plants: { a: 20 } }, 1, 1);
  assert.equal(L.stage, 'broto'); assert.equal(L.age, 0);
});

test('lifeOf: implícita começa adulta ou velha', () => {
  for (let i = 0; i < 200; i++) for (const sp of SPECIES_KEYS) for (const suit of [1, .3, 0]) {
    const L = lifeOf({ id: i + ',' + i * 3, species: sp }, { tick: 50, epoch: 50, plants: {} }, 3, suit);
    assert.ok(L.implicit);
    assert.ok(['adulta', 'velha'].includes(L.stage), `${sp} ${suit} ${L.stage}`);
  }
});

test('lifeOf: suit baixo encurta a vida e diminui a escala', () => {
  const t = { id: '5,5', species: 'carvalho' }, eco = { tick: 80, epoch: 0, plants: { '5,5': 0 } };
  const hi = lifeOf(t, eco, 2, 1), lo = lifeOf(t, eco, 2, .2);
  assert.ok(lo.lifespan < hi.lifespan);
  assert.ok(lo.scale < hi.scale);
  assert.ok(hi.lifespan >= LIFE.carvalho * .75 - 1e-9);
});

test('stageKey', () => {
  assert.deepEqual(STAGES.map(stageKey), ['', '', '', '', ':morta', ':toco']);
});

test('deadVariant: morta e toco', () => {
  const tree = genTreeVoxels('carvalho', .5, 1234, style);
  const n0 = tree.grid.map.size;
  const snapshot = [...tree.grid.map.values()].map(v => v.type).join('');
  const m = deadVariant(tree, 'morta', style), s = deadVariant(tree, 'toco', style);
  assert.equal([...tree.grid.map.values()].map(v => v.type).join(''), snapshot);
  assert.equal(tree.grid.map.size, n0);
  for (const d of [m, s]) {
    assert.ok(d.grid.has && d.grid.map && d.height > 0 && d.trunkW === tree.trunkW);
    assert.ok([...d.grid.map.values()].every(v => v.type === 1));
    const mesh = meshVoxels(d, style.voxel);
    assert.ok(mesh.position.length > 0);
    assert.ok(mesh.veg.every((x, i) => i % 2 || x === 0)); // leaf = 0
  }
  assert.ok(m.grid.map.size < n0 && m.grid.map.size > 0);
  assert.ok(s.grid.map.size < m.grid.map.size);
  assert.ok(meshVoxels(s, style.voxel).height <= .76);
  assert.deepEqual(meshVoxels(deadVariant(tree, 'morta', style), style.voxel).color, meshVoxels(m, style.voxel).color);
  assert.deepEqual(meshVoxels(deadVariant(tree, 'toco', style), style.voxel).position, meshVoxels(s, style.voxel).position);
});

test('deadVariant: todas as espécies funcionam; mede tempo no carvalho', () => {
  for (const sp of SPECIES_KEYS) {
    const tree = genTreeVoxels(sp, .5, 99, style);
    for (const k of ['morta', 'toco']) assert.ok(meshVoxels(deadVariant(tree, k, style), style.voxel).index.length > 0, sp + k);
  }
  const tree = genTreeVoxels('carvalho', .5, 1234, style);
  const t0 = performance.now(); const mm = meshVoxels(deadVariant(tree, 'morta', style), style.voxel); const t1 = performance.now();
  console.log(`deadVariant+meshVoxels carvalho: ${(t1 - t0).toFixed(1)} ms (${mm.voxels} voxels)`);
});
