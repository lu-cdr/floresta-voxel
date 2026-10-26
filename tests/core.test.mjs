import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, scatterTrees, scatterGrass, genTreeVoxels, meshVoxels, variantSeed, STYLES, SPECIES_KEYS } from '../veg-core.js';
import { makeWorld } from './helpers.mjs';

const P = defaultProject();
P.size = 64;

test('mesma semente e máscara dão a mesma floresta', () => {
  const a = scatterTrees(makeWorld(P).cfg), b = scatterTrees(makeWorld(P).cfg);
  assert.ok(a.length > 50, `poucas árvores (${a.length})`);
  assert.deepEqual(a, b);
});

test('mesma variante dá a mesma malha voxel', () => {
  for (const sp of SPECIES_KEYS) {
    const seed = variantSeed(sp, 1, 0, P.seed);
    const m1 = meshVoxels(genTreeVoxels(sp, .4, seed, STYLES['Outono ICQR'], P.species), .25);
    const m2 = meshVoxels(genTreeVoxels(sp, .4, seed, STYLES['Outono ICQR'], P.species), .25);
    assert.ok(m1.voxels > 0, sp);
    assert.deepEqual(m1.position, m2.position, sp);
    assert.deepEqual(m1.color, m2.color, sp);
  }
});

test('apagar um canto não reembaralha árvores distantes', () => {
  const base = makeWorld(P), full = scatterTrees(base.cfg);
  const erased = makeWorld(P);
  const { n } = erased;
  // borracha num quadrado de 10×10 unidades no canto (-32..-22)
  for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) erased.treeMask[j * n + i] = 0;
  const after = scatterTrees(erased.cfg);
  const far = t => t.x > -10 || t.z > -10;  // ≥ 12 unidades da borda apagada
  const key = t => `${t.x.toFixed(4)},${t.z.toFixed(4)},${t.key},${t.scale.toFixed(4)}`;
  const A = full.filter(far).map(key).sort(), B = after.filter(far).map(key).sort();
  assert.deepEqual(B, A);
  assert.ok(after.length < full.length, 'a borracha deveria ter removido árvores');
});

test('grama é determinística por chunk', () => {
  const w = makeWorld(P);
  const cfg = { x0: 0, z0: 0, x1: 16, z1: 16, seed: P.seed + 77, maskAt: () => 1, heightAt: w.cfg.heightAt, fields: P.fields, p: P.grass };
  assert.deepEqual(scatterGrass(cfg), scatterGrass(cfg));
});
