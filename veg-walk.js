/* veg-walk.js — andar dentro do diorama: colisão com troncos e rochas, degrau máximo, ponto livre
   para nascer e um controle de 1ª pessoa (WASD + mouse com pointer lock, ou toque: metade esquerda
   anda, metade direita olha). O editor (modo Passear) e o exemplo-jogo usam as mesmas regras.
   Sem import do three: a câmera chega pronta e o resto é número, para os testes rodarem no Node. */

export const BODY_R = .3;   // raio do corpo
export const STEP_UP = .6;  // degrau mais alto que dá para subir sem pular
export const EYE = 1.5;     // altura dos olhos

// empurra (x, z) para fora de troncos e de pedras grandes; seixos se pisa por cima → [x, z]
export function collide(world, x, z, r = BODY_R) {
  for (const t of world.trees) {
    const rr = .35 * (t.drawScale ?? t.scale) + r, dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz);
    if (d < rr) { if (d < 1e-4) { x = t.x + rr; continue; } x = t.x + dx / d * rr; z = t.z + dz / d * rr; } // bem no centro: sai por +x
  }
  for (const k of world.rocks || []) {
    if (k.kind === 'seixo') continue;
    const rr = k.r * .8 + r - .05, dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz);
    if (d < rr) { if (d < 1e-4) { x = k.x + rr; continue; } x = k.x + dx / d * rr; z = k.z + dz / d * rr; }
  }
  const lim = world.P.size / 2 - 1;
  return [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, z))];
}

// lugar seco, fora de rocha e longe de troncos, procurando em espiral a partir de (x, z)
export function freeSpot(world, x = 0, z = 0) {
  const lim = world.P.size / 2 - 1.5;
  const ok = (px, pz) => Math.abs(px) < lim && Math.abs(pz) < lim && !world.waterAt(px, pz) && !world.rockAt?.(px, pz)
    && collide(world, px, pz, BODY_R + .3).every((v, i) => Math.abs(v - (i ? pz : px)) < 1e-6);
  for (let ring = 0; ring < 60; ring++) {
    const n = Math.max(1, ring * 6);
    for (let s = 0; s < n; s++) {
      const a = s / n * Math.PI * 2, px = x + Math.cos(a) * ring * .7, pz = z + Math.sin(a) * ring * .7;
      if (ok(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

// tenta ir para (nx, nz) a partir de pos ({ x, y, z }): colide, só sobe degraus baixos, cola no chão com suavidade
export function stepTo(world, pos, nx, nz, dt) {
  [nx, nz] = collide(world, nx, nz);
  if (world.heightAt(nx, nz) - pos.y <= STEP_UP) { pos.x = nx; pos.z = nz; }
  else if (world.heightAt(nx, pos.z) - pos.y <= STEP_UP) pos.x = nx; // desliza ao longo do degrau
  else if (world.heightAt(pos.x, nz) - pos.y <= STEP_UP) pos.z = nz;
  pos.y += (world.heightAt(pos.x, pos.z) - pos.y) * (1 - Math.exp(-dt * 18));
  return pos;
}

/* 1ª pessoa. start(x, z, yaw) liga, stop() desliga; update(dt) a cada quadro.
   frozen: não anda (modo foto), mas ainda dá para olhar arrastando. */
export class FirstPerson {
  constructor({ world, camera, dom }) {
    Object.assign(this, { world, camera, dom, active: false, frozen: false, yaw: 0, pitch: -.08, bob: 0 });
    this.pos = { x: 0, y: 0, z: 0 }; this.vel = { x: 0, y: 0 };
    this.keys = new Set(); this.move = null; this.look = null;
    const on = (el, ev, fn, o) => el.addEventListener(ev, e => this.active && fn(e), o);
    on(window, 'keydown', e => { if (!e.ctrlKey && !e.metaKey && !e.altKey) this.keys.add(e.code); });
    on(window, 'keyup', e => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
    on(document, 'mousemove', e => { if (document.pointerLockElement === dom) this.turn(e.movementX, e.movementY, .0022); });
    on(dom, 'pointerdown', e => {
      // toque: metade esquerda é o "joystick", direita olha; mouse sem trava olha arrastando (e trava no clique)
      if (e.pointerType !== 'mouse' && e.clientX < innerWidth / 2 && !this.move) this.move = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
      else { this.look = { id: e.pointerId, x: e.clientX, y: e.clientY }; if (e.pointerType === 'mouse' && !this.frozen) this.lock(); }
      dom.setPointerCapture?.(e.pointerId);
    });
    on(dom, 'pointermove', e => {
      if (this.move?.id === e.pointerId) { this.move.x = (e.clientX - this.move.x0) / 50; this.move.y = (e.clientY - this.move.y0) / 50; }
      else if (this.look?.id === e.pointerId && document.pointerLockElement !== dom) {
        this.turn(e.clientX - this.look.x, e.clientY - this.look.y, e.pointerType === 'mouse' ? .004 : .006);
        this.look.x = e.clientX; this.look.y = e.clientY;
      }
    });
    const up = e => { if (this.move?.id === e.pointerId) this.move = null; if (this.look?.id === e.pointerId) this.look = null; };
    on(dom, 'pointerup', up); on(dom, 'pointercancel', up);
  }
  turn(dx, dy, k) {
    this.yaw -= dx * k;
    this.pitch = Math.max(-1.3, Math.min(1.2, this.pitch - dy * k));
  }
  lock() { if (matchMedia('(pointer: fine)').matches && document.pointerLockElement !== this.dom) this.dom.requestPointerLock?.()?.catch?.(() => {}); }
  start(x, z, yaw = 0) {
    const p = freeSpot(this.world, x, z);
    Object.assign(this.pos, { x: p.x, y: this.world.heightAt(p.x, p.z), z: p.z });
    this.yaw = yaw; this.pitch = -.08; this.vel.x = this.vel.y = 0; this.keys.clear(); this.move = this.look = null;
    this.active = true;
    this.update(0);
  }
  stop() {
    this.active = false; this.keys.clear(); this.move = this.look = null;
    if (document.pointerLockElement === this.dom) document.exitPointerLock();
  }
  update(dt) {
    if (!this.active) return;
    const K = this.keys;
    let f = (K.has('KeyW') || K.has('ArrowUp')) - (K.has('KeyS') || K.has('ArrowDown'));
    let s = (K.has('KeyD') || K.has('ArrowRight')) - (K.has('KeyA') || K.has('ArrowLeft'));
    if (this.move) { s = Math.max(-1, Math.min(1, this.move.x)); f = Math.max(-1, Math.min(1, -this.move.y)); }
    if (this.frozen) f = s = 0;
    const len = Math.hypot(f, s) || 1, speed = K.has('ShiftLeft') || K.has('ShiftRight') ? 6.5 : 3.2;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // frente = -Z da câmera girada por yaw
    const tx = (-sin * f + cos * s) / len * speed, tz = (-cos * f - sin * s) / len * speed;
    const a = 1 - Math.exp(-dt * 10);
    this.vel.x += (tx - this.vel.x) * a; this.vel.y += (tz - this.vel.y) * a;
    if (dt > 0) stepTo(this.world, this.pos, this.pos.x + this.vel.x * dt, this.pos.z + this.vel.y * dt, dt);
    const sp = Math.hypot(this.vel.x, this.vel.y);
    this.bob += dt * sp * 2.4;
    const c = this.camera;
    c.position.set(this.pos.x, this.pos.y + EYE + Math.sin(this.bob) * .035 * Math.min(1, sp / 3), this.pos.z);
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
