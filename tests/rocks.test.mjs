import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, migrateProject, genRockVoxels, scatterRocks, rockRadius, ROCK_KEYS, ROCK_SINK, STYLES } from '../veg-core.js';

const P = defaultProject(), S = 48, V = P.style.voxel;
const cfg = o => ({ size: S, seed: 99, voxel: V, p: P.rocks, maskAt: () => .8, groundAt: () => 0, ...o });
const voxels = r => [...r.grid.map.values()];

test('cada tipo gera rocha com parte acima do chão, pegada coerente com rockRadius', () => {
  for (const k of ROCK_KEYS) {
    const r = genRockVoxels(k, .5, 7, P.style), vs = voxels(r);
    assert.ok(vs.some(v => v.y >= ROCK_SINK + 1), k + ' aparece acima do chão');
    assert.ok(vs.some(v => v.y < ROCK_SINK), k + ' fica um pouco enterrada');
    assert.equal(r.radius * V, rockRadius(k, .5, V));
    assert.ok(vs.every(v => v.type === 1), k + ' sem musgo nem neve no outono seco');
  }
});

test('musgo e neve só em cima, e geração determinística', () => {
  const a = genRockVoxels('matacao', .5, 3, STYLES.Inverno, { moss: true }), b = genRockVoxels('matacao', .5, 3, STYLES.Inverno, { moss: true });
  assert.deepEqual(voxels(a).map(v => [v.x, v.y, v.z, v.type, ...v.col]), voxels(b).map(v => [v.x, v.y, v.z, v.type, ...v.col]));
  const top = voxels(a).filter(v => v.type !== 1);
  assert.ok(top.length > 0);
  for (const v of top) assert.ok(!a.grid.has(v.x, v.y + 1, v.z), 'acabamento só exposto para cima');
});

test('rochas não se sobrepõem e respeitam bloqueio e tipo forçado', () => {
  const rocks = scatterRocks(cfg({ blockedAt: x => x < 0 }));
  assert.ok(rocks.length > 20);
  for (const r of rocks) assert.ok(r.x >= 0, 'nada no lado bloqueado');
  for (let i = 0; i < rocks.length; i++) for (let j = i + 1; j < rocks.length; j++) {
    const a = rocks[i], b = rocks[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= (a.r + b.r) * .85 - 1e-9, `${a.id} × ${b.id}`);
  }
  const forced = scatterRocks(cfg({ kindAt: () => ROCK_KEYS.indexOf('matacao') }));
  assert.ok(forced.length && forced.every(r => r.kind === 'matacao'));
});

test('lugar rochoso puxa matacões e afloramentos; sem intenção não há rochas', () => {
  const big = l => l.filter(r => r.kind === 'matacao' || r.kind === 'afloramento').length / l.length;
  assert.ok(big(scatterRocks(cfg({ roughAt: () => 1 }))) > big(scatterRocks(cfg({ roughAt: () => 0 }))));
  assert.equal(scatterRocks(cfg({ maskAt: () => 0 })).length, 0);
});

test('pintar num canto não mexe nas rochas do outro lado', () => {
  const base = scatterRocks(cfg({ maskAt: x => x > 4 ? .8 : 0 }));
  const more = scatterRocks(cfg({ maskAt: (x, z) => x > 4 || (x < -12 && z < -12) ? .8 : 0 }));
  const far = l => l.filter(r => r.x > 10).map(r => r.id + r.key).sort();
  assert.deepEqual(far(more), far(base));
});

test('projeto antigo ganha a configuração de rochas e estilo antigo cai na paleta padrão', () => {
  const old = defaultProject(); delete old.rocks; delete old.style.rock;
  const p = migrateProject(old);
  assert.deepEqual(p.rocks, defaultProject().rocks);
  assert.ok(voxels(genRockVoxels('pedra', .5, 1, old.style)).length > 0);
});
