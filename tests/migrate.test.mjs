import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultProject, migrateProject, PROJECT_VERSION, STYLES } from '../veg-core.js';

const v1 = JSON.parse(readFileSync(new URL('./fixtures/projeto-v1.json', import.meta.url), 'utf8'));

test('projeto v1 abre como versão atual sem perder nada', () => {
  const p = migrateProject(v1);
  assert.equal(p.version, PROJECT_VERSION);
  assert.equal(p.seed, 777);
  assert.equal(p.trees.spacingMin, 1.9);
  assert.equal(p.wind.strength, .8);
  assert.deepEqual(p.masks, v1.masks);
  assert.deepEqual(p.style, v1.style);
  assert.deepEqual(p.ecology, defaultProject().ecology);
  assert.deepEqual(p.ecology.plants, {}, 'v1 não tem plantas com idade: todas adultas');
});

test('migração é idempotente e não altera a entrada', () => {
  const before = JSON.stringify(v1);
  const once = migrateProject(v1);
  assert.equal(JSON.stringify(v1), before);
  assert.deepEqual(migrateProject(once), once);
  assert.deepEqual(migrateProject(defaultProject()), defaultProject());
});

test('campos faltando vêm dos defaults, inclusive aninhados', () => {
  const j = structuredClone(v1);
  delete j.trees.mix.arbusto; delete j.wind; delete j.style.grass;
  j.styleName = 'Primavera';
  const p = migrateProject(j);
  assert.equal(p.trees.mix.arbusto, defaultProject().trees.mix.arbusto);
  assert.deepEqual(p.wind, defaultProject().wind);
  assert.deepEqual(p.style.grass, STYLES['Primavera'].grass, 'estilo se completa pelo preset de mesmo nome');
});

test('baked é descartado e formatos estranhos são recusados', () => {
  assert.equal(migrateProject({ ...v1, baked: { trees: [] } }).baked, undefined);
  assert.throws(() => migrateProject({ format: 'outra-coisa' }), /Não é um projeto/);
  assert.throws(() => migrateProject({ ...v1, version: PROJECT_VERSION + 1 }), /versão/);
});
