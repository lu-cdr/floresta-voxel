import test from 'node:test';
import assert from 'node:assert/strict';
import { History, snapshotLayers, makePatch, applyPatch } from '../veg-history.js';

const cmd = (label, bytes = 0, log = []) => ({ label, bytes, apply: () => log.push('a:' + label), revert: () => log.push('r:' + label) });

test('push/undo/redo e labels', () => {
  const log = [], h = new History();
  assert.equal(h.undo(), null); assert.equal(h.redo(), null);
  assert.equal(h.undoLabel, ''); assert.equal(h.redoLabel, '');
  h.push(cmd('A', 0, log)); h.push(cmd('B', 0, log));
  assert.deepEqual(log, []); // push não aplica
  assert.equal(h.undoLabel, 'B'); assert.ok(h.canUndo && !h.canRedo);
  assert.equal(h.undo().label, 'B'); assert.equal(h.redoLabel, 'B'); assert.equal(h.undoLabel, 'A');
  assert.equal(h.redo().label, 'B');
  assert.deepEqual(log, ['r:B', 'a:B']);
  h.undo(); h.undo();
  assert.ok(!h.canUndo && h.canRedo);
});

test('push após undo apaga o refazer', () => {
  const h = new History();
  h.push(cmd('A')); h.push(cmd('B')); h.undo();
  h.push(cmd('C'));
  assert.ok(!h.canRedo); assert.equal(h.undoLabel, 'C');
});

test('limite por passos', () => {
  const h = new History({ limit: 3 });
  for (const l of 'ABCDE') h.push(cmd(l));
  assert.equal(h.undoStack.length, 3);
  h.undo(); h.undo(); h.undo();
  assert.equal(h.redoLabel, 'C'); assert.ok(!h.canUndo);
});

test('limite por bytes mantém ao menos o último', () => {
  const h = new History({ maxBytes: 100 });
  h.push(cmd('A', 60)); h.push(cmd('B', 60));
  assert.equal(h.undoStack.length, 1); assert.equal(h.bytes, 60);
  h.push(cmd('Gigante', 500));
  assert.equal(h.undoStack.length, 1); assert.equal(h.undoLabel, 'Gigante'); assert.equal(h.bytes, 500);
  h.undo(); assert.equal(h.bytes, 500); // soma undo + refazer
});

test('onChange e clear', () => {
  let n = 0; const h = new History({ onChange: () => n++ });
  h.push(cmd('A')); h.undo(); h.redo(); h.clear();
  assert.equal(n, 4); assert.ok(!h.canUndo && !h.canRedo);
});

const mk = n => ({ f: new Float32Array(n * n), m: new Int8Array(n * n), u: new Uint8Array(n * n) });

test('makePatch devolve null quando nada muda', () => {
  const L = mk(8), snap = snapshotLayers(L);
  assert.equal(makePatch(L, snap, { i0: 0, i1: 7, j0: 0, j1: 7 }, 8), null);
  L.f[0] = 1; // mudança fora do rect
  assert.equal(makePatch(L, snap, { i0: 2, i1: 5, j0: 2, j1: 5 }, 8), null);
});

test('só camadas alteradas entram no remendo', () => {
  const n = 8, L = mk(n), snap = snapshotLayers(L);
  L.f[3 * n + 4] = 0.5;
  const p = makePatch(L, snap, { i0: 2, i1: 5, j0: 2, j1: 5 }, n);
  assert.deepEqual(Object.keys(p.before), ['f']); assert.deepEqual(Object.keys(p.after), ['f']);
  assert.ok(p.before.f instanceof Float32Array); assert.equal(p.before.f.length, 16);
  assert.equal(p.bytes, 16 * 4 * 2);
});

test('applyPatch before/after: identidade com Float32 + Int8, rect na borda', () => {
  const n = 16, L = mk(n);
  for (let k = 0; k < n * n; k++) { L.f[k] = k * 0.25; L.m[k] = (k % 7) - 3; }
  const snap = snapshotLayers(L);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if (i >= 0 && j >= 5) { L.f[j * n + i] += 1; L.m[j * n + i] = 9; } }
  const final = snapshotLayers(L);
  const p = makePatch(L, snap, { i0: 0, i1: n - 1, j0: 5, j1: n - 1 }, n);
  assert.deepEqual(Object.keys(p.before).sort(), ['f', 'm']);
  applyPatch(L, p, 'before', n);
  assert.deepEqual(L.f, snap.f); assert.deepEqual(L.m, snap.m);
  applyPatch(L, p, 'after', n);
  assert.deepEqual(L.f, final.f); assert.deepEqual(L.m, final.m);
});

test('desempenho n=320 rect cheio', () => {
  const n = 320, L = mk(n), snap = snapshotLayers(L);
  for (let k = 0; k < n * n; k++) { L.f[k] = k; L.m[k] = 1; }
  const rect = { i0: 0, i1: n - 1, j0: 0, j1: n - 1 };
  const t = performance.now();
  const p = makePatch(L, snap, rect, n); applyPatch(L, p, 'before', n); applyPatch(L, p, 'after', n);
  assert.ok(performance.now() - t < 500);
  assert.equal(L.f[n * n - 1], n * n - 1);
});
