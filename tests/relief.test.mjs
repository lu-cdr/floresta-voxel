import test from 'node:test';
import assert from 'node:assert/strict';
import { sculptRelief, reliefHeights, packRelief, unpackRelief, RELIEF_MAX } from '../veg-relief.js';
import { WATER_NONE, hasWater, carveHeights } from '../veg-water.js';

const S = 16, STEP = .5;
const flat = () => new Float32Array(S * S);
const at = (r, x, z) => r[(z + S / 2) * S + (x + S / 2)]; // bloco cujo canto é (x, z)
const opts = o => ({ size: S, step: STEP, noise: flat(), x: .5, z: .5, radius: 4, strength: .6, hard: .35, ...o });

test('subir faz uma cúpula: centro mais alto, borda intocada', () => {
  const r = flat(), rect = sculptRelief(r, opts({ mode: 'subir' }));
  assert.ok(rect);
  assert.equal(at(r, 0, 0), 4, 'força .6 → 4 degraus no centro');
  assert.ok(at(r, 3, 0) < at(r, 1, 0));
  assert.equal(at(r, 6, 0), 0);
  for (const v of r) assert.ok(Number.isInteger(v) && v >= 0);
});

test('repassar no mesmo traço não empilha; novo traço sobe mais', () => {
  const r = flat(), start = r.slice();
  sculptRelief(r, opts({ mode: 'subir', start }));
  const once = r.slice();
  assert.equal(sculptRelief(r, opts({ mode: 'subir', start })), null, 'mesmo carimbo de novo não muda nada');
  assert.deepEqual(r, once);
  sculptRelief(r, opts({ mode: 'subir', start: r.slice() }));
  assert.equal(at(r, 0, 0), 8);
});

test('descer é o espelho de subir e respeita o limite', () => {
  const r = flat();
  for (let k = 0; k < 20; k++) sculptRelief(r, opts({ mode: 'descer', strength: 1, start: r.slice() }));
  assert.equal(at(r, 0, 0), -RELIEF_MAX);
  assert.ok(Math.min(...r) >= -RELIEF_MAX);
});

test('nivelar leva o terreno até a altura alvo vinda do ruído', () => {
  const noise = flat(); noise.fill(2); // ruído a 2 m = 4 degraus
  const r = flat();
  for (let k = 0; k < 10; k++) sculptRelief(r, opts({ mode: 'nivelar', noise, target: .5, strength: 1 }));
  const h = reliefHeights(noise, r, STEP);
  assert.equal(h[(S / 2) * S + S / 2], .5);
  assert.equal(at(r, 0, 0), -3);
});

test('suavizar arredonda um pico solto e original zera', () => {
  const r = flat(); r[(S / 2) * S + S / 2] = 10;
  sculptRelief(r, opts({ mode: 'suavizar', radius: 2, strength: 1 }));
  assert.ok(at(r, 0, 0) < 10, 'pico baixou');
  assert.ok(at(r, 1, 0) > 0, 'vizinho subiu');
  for (let k = 0; k < 12; k++) sculptRelief(r, opts({ mode: 'original', radius: 3, strength: 1 }));
  assert.equal(at(r, 0, 0), 0);
});

test('determinístico e pack/unpack sem perda', () => {
  const a = flat(), b = flat();
  for (const r of [a, b]) { sculptRelief(r, opts({ mode: 'subir', start: r.slice() })); sculptRelief(r, opts({ mode: 'descer', x: 3, z: -2, radius: 3, start: r.slice() })); }
  assert.deepEqual(a, b);
  assert.deepEqual(unpackRelief(new Uint8Array(packRelief(a).buffer)), a);
});

test('água continua sobre o relevo: leito abaixo do nível mesmo com o chão erguido', () => {
  const r = flat(), w = new Float32Array(S * S).fill(WATER_NONE);
  w[(S / 2) * S + S / 2] = 0; // poça no nível 0
  sculptRelief(r, opts({ mode: 'subir' }));
  const h = carveHeights(reliefHeights(flat(), r, STEP), w, S, STEP);
  const k = (S / 2) * S + S / 2;
  assert.ok(hasWater(w[k]) && h[k] < 0, 'leito fica abaixo da água');
  assert.equal(h[k + 1], at(r, 1, 0) * STEP, 'vizinho seco segue o relevo');
});
