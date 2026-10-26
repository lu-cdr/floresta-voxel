import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_KEYS, STYLES, SEASONS, rng, genTreeVoxels, colorTree, meshVoxels, variantSeed, seasonAt, blendStyle, seasonStyle, lightAt, hexToRgb } from '../veg-core.js';

// checksums FNV-1a (position, color, veg, index) gravados do código ANTES da separação geometria/cor
const GOLDEN = {
  'Outono ICQR|carvalho|0.3': [306356245, 2753847601, 1844844877, 1866920001],
  'Outono ICQR|carvalho|0.8': [2804329861, 1384905322, 3132269821, 1281170373],
  'Outono ICQR|betula|0.3': [3840806437, 2173507137, 4292292381, 1958821641],
  'Outono ICQR|betula|0.8': [1834110005, 605027313, 4233707213, 1184962449],
  'Outono ICQR|cerejeira|0.3': [3564496101, 131347842, 3714292461, 3198367677],
  'Outono ICQR|cerejeira|0.8': [2940376565, 1579974134, 2392447493, 758205709],
  'Outono ICQR|pinheiro|0.3': [295020917, 3321237338, 1577279637, 698757361],
  'Outono ICQR|pinheiro|0.8': [3286066837, 3740672277, 4276467165, 2124537949],
  'Outono ICQR|arbusto|0.3': [2428509765, 2070314111, 2688552525, 2243503277],
  'Outono ICQR|arbusto|0.8': [374564997, 3819999674, 324296925, 4084039813],
  'Inverno|carvalho|0.3': [306356245, 3743428986, 3685852949, 1866920001],
  'Inverno|carvalho|0.8': [2804329861, 270812221, 2867020309, 1281170373],
  'Inverno|betula|0.3': [3840806437, 4112417737, 2749893821, 1958821641],
  'Inverno|betula|0.8': [1834110005, 2090508770, 2587065365, 1184962449],
  'Inverno|cerejeira|0.3': [3564496101, 679854947, 4177370821, 3198367677],
  'Inverno|cerejeira|0.8': [2940376565, 833747492, 3194948101, 758205709],
  'Inverno|pinheiro|0.3': [295020917, 480443343, 1268976637, 698757361],
  'Inverno|pinheiro|0.8': [3286066837, 4020452969, 3860209125, 2124537949],
  'Inverno|arbusto|0.3': [2428509765, 3515894609, 3231595117, 2243503277],
  'Inverno|arbusto|0.8': [374564997, 2928766133, 1101012453, 4084039813],
};

const fnv = a => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let h = 2166136261; for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
const sums = m => [fnv(m.position), fnv(m.color), fnv(m.veg), fnv(m.index)];
const gen = (sp, t, st) => genTreeVoxels(sp, t, variantSeed(sp, 1, 0, 1234), STYLES[st], SPECIES);
const cases = [];
for (const st of ['Outono ICQR', 'Inverno']) for (const sp of SPECIES_KEYS) for (const t of [.3, .8]) cases.push([st, sp, t]);

test('golden: geração idêntica ao código anterior', () => {
  for (const [st, sp, t] of cases) assert.deepEqual(sums(meshVoxels(gen(sp, t, st), .25)), GOLDEN[`${st}|${sp}|${t}`], `${st} ${sp} ${t}`);
});

test('colorTree: Outono → Inverno == gerar direto; voltar reproduz o Outono', () => {
  for (const [, sp, t] of cases.filter(c => c[0] === 'Outono ICQR')) {
    const tree = gen(sp, t, 'Outono ICQR');
    colorTree(tree, STYLES['Inverno']);
    assert.deepEqual(sums(meshVoxels(tree, .25)), GOLDEN[`Inverno|${sp}|${t}`], `inverno ${sp} ${t}`);
    colorTree(tree, STYLES['Outono ICQR']);
    assert.deepEqual(sums(meshVoxels(tree, .25)), GOLDEN[`Outono ICQR|${sp}|${t}`], `outono ${sp} ${t}`);
  }
});

test('colorTree: passa por todas as estações e volta igual (flores do arbusto)', () => {
  const tree = gen('arbusto', .8, 'Outono ICQR');
  for (const s of SEASONS) colorTree(tree, STYLES[s.style]);
  colorTree(tree, STYLES['Outono ICQR']);
  assert.deepEqual(sums(meshVoxels(tree, .25)), GOLDEN['Outono ICQR|arbusto|0.8']);
});

test('rng: state() continua a sequência', () => {
  const a = rng(42); for (let i = 0; i < 7; i++) a();
  const b = rng(a.state());
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('seasonAt: início, último dia, virada de ano', () => {
  const e = tick => seasonAt({ tick, seasonLen: 12 });
  assert.deepEqual(e(0), { index: 0, key: 'primavera', label: 'Primavera', day: 1, seasonLen: 12, phase: 0, year: 0 });
  const last = e(11); assert.equal(last.index, 0); assert.equal(last.day, 12); assert.equal(last.phase, 11 / 12);
  assert.equal(e(12).key, 'verao'); assert.equal(e(24).key, 'outono'); assert.equal(e(47).key, 'inverno');
  assert.equal(e(47).year, 0); assert.equal(e(47).day, 12);
  const y1 = e(48); assert.equal(y1.index, 0); assert.equal(y1.year, 1); assert.equal(y1.day, 1);
});

test('blendStyle: extremos, arrays de tamanhos diferentes, sem mutar', () => {
  const A = STYLES['Outono ICQR'], B = STYLES['Inverno'];
  const a0 = structuredClone(A), b0 = structuredClone(B);
  // t=0: igual a `a` (as chaves só de `b` são copiadas)
  const zero = blendStyle(A, B, 0);
  assert.equal(zero.snowColor, B.snowColor); delete zero.snowColor; delete zero.terrain.snow;
  assert.deepEqual(zero, A);
  // t=1: mesmas cores de `b` nas chaves de `b`
  const one = blendStyle(A, B, 1);
  assert.equal(one.sky, B.sky); assert.deepEqual(one.terrain, B.terrain); assert.equal(one.snow, B.snow);
  // arrays de tamanhos diferentes (5 x 3): tamanho 5, elemento k mistura A[k] com B[k % 3]
  assert.deepEqual(one.species.carvalho.leaves, [0, 1, 2, 3, 4].map(k => B.species.carvalho.leaves[k % 3]));
  assert.deepEqual(A, a0); assert.deepEqual(B, b0);
  assert.deepEqual(blendStyle(['#000000'], ['#ffffff', '#ff0000'], .5), ['#808080', '#800000']);
  assert.equal(blendStyle(1, 3, 2), 3); assert.equal(blendStyle(1, 3, -1), 1);
});

test('seasonStyle: meio da estação = preset; último dia mistura com a próxima', () => {
  const mid = seasonStyle({ tick: 12 + 3, seasonLen: 12 });
  assert.deepEqual(mid, STYLES['Verão denso']);
  const last = seasonStyle({ tick: 12 + 11, seasonLen: 12 }, { voxel: .3 });
  assert.equal(last.voxel, .3);
  assert.notEqual(last.sky, STYLES['Verão denso'].sky);
  assert.notEqual(last.sky, STYLES['Outono ICQR'].sky);
  assert.equal(STYLES['Verão denso'].voxel, .25);
});

test('lightAt: periódica, contínua, noite mais escura que meio-dia', () => {
  const st = STYLES['Primavera'], lum = h => { const [r, g, b] = hexToRgb(h); return .2126 * r + .7152 * g + .0722 * b; };
  const f0 = lightAt(0, st), f1 = lightAt(1, st);
  for (const k of ['sunEl', 'sunI', 'hemiI', 'night']) assert.ok(Math.abs(f0[k] - f1[k]) < 1e-9, k);
  assert.equal(f0.sky, f1.sky);
  let prev = lightAt(0, st);
  for (let i = 1; i <= 2000; i++) {
    const c = lightAt(i / 2000, st);
    assert.ok(Math.abs(c.sunEl - prev.sunEl) < 1.5 && Math.abs(c.sunI - prev.sunI) < .02 && Math.abs(c.hemiI - prev.hemiI) < .02, 'salto em ' + i / 2000);
    prev = c;
  }
  const noon = lightAt(.5, st), mid = lightAt(0, st), dawn = lightAt(.27, st);
  assert.ok(Math.abs(noon.sunEl - 58) < 1e-6 && noon.night < .01);
  assert.ok(mid.night > .99 && mid.sunI < noon.sunI && mid.hemiI < noon.hemiI && lum(mid.sky) < lum(noon.sky) && lum(mid.fog) < lum(noon.fog));
  assert.ok(Math.abs(lightAt(.25 + .0001, st).sunEl) < .1 && lightAt(.4, st).sunAz < lightAt(.6, st).sunAz);
  assert.notEqual(dawn.sunColor, noon.sunColor);
});
