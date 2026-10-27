import test from 'node:test';
import assert from 'node:assert/strict';
import { collide, freeSpot, stepTo, FirstPerson, BODY_R, STEP_UP, EYE, SPEED, GRAVITY, JUMP_V } from '../veg-walk.js';

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

const fp = (world = fakeWorld()) => {
  globalThis.window ??= { addEventListener() {} };
  globalThis.document ??= { addEventListener() {}, pointerLockElement: null };
  const cam = { fov: 42, position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: { set() {} }, updateProjectionMatrix() {} };
  const p = new FirstPerson({ world, camera: cam, dom: { addEventListener() {} } });
  return { p, cam };
};
const run = (p, sec, fn) => { for (let i = 0; i < sec * 60; i++) { fn?.(i); p.update(1 / 60); } };

test('pulo: sobe ~1 m, volta ao chão e não pula de novo no ar', () => {
  const { p } = fp();
  p.start(0, 0, 0);
  p.keys.add('Space');
  let top = 0; run(p, .2, () => { top = Math.max(top, p.pos.y); });
  p.keys.delete('Space');
  run(p, .6, () => { top = Math.max(top, p.pos.y); });
  assert.ok(top > (JUMP_V * JUMP_V) / (2 * GRAVITY) - .1 && top < 1.3, `altura ${top}`);
  assert.ok(p.onGround && Math.abs(p.pos.y) < 1e-9, 'pousou');
  p.vy = 2; p.onGround = false; p.jump(); p.update(1 / 60);
  assert.ok(p.vy < 2, 'no ar o pulo não renova');
});

test('degrau de 1 m só com pulo; agachado não cai da borda', () => {
  const ledge = fakeWorld({ heightAt: x => (x <= -3 ? 1 : 0), waterAt: () => false });
  const a = fp(ledge).p; a.start(0, 0, Math.PI / 2); // yaw π/2 olha para −x
  a.keys.add('KeyW'); run(a, 1.5);
  assert.ok(a.pos.x > -3 && a.pos.y < .01, 'andando para no muro de 1 m');
  a.keys.add('Space'); run(a, 1);
  assert.ok(a.pos.x < -3 && a.pos.y > .9, `pulando sobe: ${a.pos.x}, ${a.pos.y}`);
  const b = fp(ledge).p; b.start(-6, 0, -Math.PI / 2); // em cima, olhando para +x (a borda em x = −3)
  b.keys.add('ShiftLeft'); b.keys.add('KeyW'); run(b, 4);
  assert.ok(b.pos.x <= -3 && b.pos.y > .99, `agachado parou na borda: ${b.pos.x}`);
});

test('velocidades: agachar < andar < correr (W duas vezes), FOV abre correndo e volta ao sair', () => {
  const dist = setup => { const { p, cam } = fp(); p.start(0, 8, 0); setup(p); run(p, 1); return { d: 8 - p.pos.z, p, cam }; };
  const sneak = dist(p => { p.keys.add('KeyW'); p.keys.add('ShiftLeft'); }).d;
  const walk = dist(p => p.keys.add('KeyW')).d;
  const r = dist(p => { p.keys.add('KeyW'); p.sprint = true; });
  assert.ok(sneak < walk && walk < r.d, `${sneak} < ${walk} < ${r.d}`);
  assert.ok(Math.abs(walk - SPEED.walk) < .4);
  assert.ok(r.cam.fov > 70);
  r.p.stop();
  assert.equal(r.cam.fov, 42, 'FOV do editor de volta');
});
