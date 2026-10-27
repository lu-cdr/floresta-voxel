import test from 'node:test';
import assert from 'node:assert/strict';
import { collide, freeSpot, stepTo, FirstPerson, BODY_R, STEP_UP, EYE } from '../veg-walk.js';

// mundo mínimo: 32×32, chão plano com um muro alto em x ≥ 5, água em z ≥ 10
const fakeWorld = (o = {}) => ({
  P: { size: 32 }, trees: [], rocks: [],
  heightAt: (x) => (x >= 5 ? 3 : 0),
  waterAt: (x, z) => z >= 10,
  rockAt: () => false,
  ...o,
});

test('colisão empurra para fora de troncos e de pedras grandes, não de seixos', () => {
  const w = fakeWorld({ trees: [{ x: 0, z: 0, scale: 1 }], rocks: [{ kind: 'matacao', x: -6, z: 0, r: 1.5 }, { kind: 'seixo', x: -6, z: 6, r: .8 }] });
  const [x, z] = collide(w, .1, 0);
  assert.ok(Math.hypot(x, z) >= .35 + BODY_R - 1e-9);
  const [rx, rz] = collide(w, -6.2, 0);
  assert.ok(Math.hypot(rx + 6, rz) >= 1.5 * .8 + BODY_R - .05 - 1e-9);
  assert.deepEqual(collide(w, -6, 6), [-6, 6], 'seixo se pisa por cima');
});

test('ponto livre foge de tronco, rocha e água', () => {
  const w = fakeWorld({ trees: [{ x: 0, z: 0, scale: 1.2 }], rockAt: (x, z) => Math.hypot(x - 1, z) < 1 });
  const p = freeSpot(w, 0, 0);
  assert.ok(Math.hypot(p.x, p.z) >= .35 * 1.2 + BODY_R, 'longe do tronco');
  assert.ok(!w.rockAt(p.x, p.z) && !w.waterAt(p.x, p.z));
  const q = freeSpot(w, 0, 12);
  assert.ok(q.z < 10, 'saiu da água');
});

test('degrau alto barra, degrau baixo sobe', () => {
  const w = fakeWorld(), pos = { x: 4.5, y: 0, z: 0 };
  stepTo(w, pos, 5.2, 0, .016);
  assert.equal(pos.x, 4.5, 'muro de 3 m não dá para subir');
  const low = fakeWorld({ heightAt: x => (x >= 5 ? STEP_UP - .1 : 0) }), p2 = { x: 4.5, y: 0, z: 0 };
  stepTo(low, p2, 5.2, 0, .016);
  assert.equal(p2.x, 5.2);
  assert.ok(p2.y > 0, 'começa a subir');
});

test('1ª pessoa: W anda para onde olha, câmera na altura dos olhos', () => {
  globalThis.window ??= { addEventListener() {} };
  globalThis.document ??= { addEventListener() {}, pointerLockElement: null };
  const cam = { position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: { set() {} } };
  const fp = new FirstPerson({ world: fakeWorld(), camera: cam, dom: { addEventListener() {} } });
  fp.start(0, 0, 0); // yaw 0 olha para −z
  assert.ok(Math.abs(cam.position.y - EYE) < .05);
  fp.keys.add('KeyW');
  for (let i = 0; i < 60; i++) fp.update(1 / 60);
  assert.ok(fp.pos.z < -1 && Math.abs(fp.pos.x) < .01, `andou para −z: ${fp.pos.x}, ${fp.pos.z}`);
  fp.frozen = true; const z = fp.pos.z;
  for (let i = 0; i < 60; i++) fp.update(1 / 60);
  assert.ok(Math.abs(fp.pos.z - z) < .5, 'congelado (modo foto) só desliza enquanto freia');
});
