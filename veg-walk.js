/* veg-walk.js — andar dentro do diorama: colisão com troncos e rochas, degrau máximo, ponto livre
   para nascer e um controle de 1ª pessoa no jeito clássico de jogo de bloco (mouse travado olha,
   WASD anda, Espaço pula). O editor (modo Passear) e o exemplo-jogo usam as mesmas regras.
   Sem import do three: a câmera chega pronta e o resto é número, para os testes rodarem no Node. */

export const BODY_R = .3;   // raio do corpo
export const STEP_UP = .6;  // degrau mais alto que dá para subir sem pular (o terreno anda em degraus de .5)
export const EYE = 1.55;    // altura dos olhos em pé

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
// (3ª pessoa do exemplo-jogo; a 1ª pessoa abaixo tem gravidade e pulo)
export function stepTo(world, pos, nx, nz, dt) {
  [nx, nz] = collide(world, nx, nz);
  if (world.heightAt(nx, nz) - pos.y <= STEP_UP) { pos.x = nx; pos.z = nz; }
  else if (world.heightAt(nx, pos.z) - pos.y <= STEP_UP) pos.x = nx; // desliza ao longo do degrau
  else if (world.heightAt(pos.x, nz) - pos.y <= STEP_UP) pos.z = nz;
  pos.y += (world.heightAt(pos.x, pos.z) - pos.y) * (1 - Math.exp(-dt * 18));
  return pos;
}

/* 1ª pessoa clássica: mouse travado gira a cabeça (clique para travar), WASD anda, Espaço pula,
   Shift agacha (devagar e sem cair de borda), W duas vezes corre — Ctrl+W fecharia a aba do navegador.
   Toque: metade esquerda é o joystick (empurrar longe corre), direita olha, jump() pelo botão.
   start(x, z, yaw) liga, stop() desliga; update(dt) a cada quadro. frozen (modo foto): não anda nem
   pula, e o mouse olha arrastando, porque a trava foi solta para usar a barra. */
export const SPEED = { walk: 4.3, sprint: 5.6, sneak: 1.4 };
export const GRAVITY = 28, JUMP_V = 8; // pulo ≈ 1,15 m: passa um degrau duplo do terreno
const FOV = 70, SNEAK_EYE = EYE - .2;

export class FirstPerson {
  constructor({ world, camera, dom }) {
    Object.assign(this, { world, camera, dom, active: false, frozen: false, yaw: 0, pitch: 0, bob: 0 });
    this.pos = { x: 0, y: 0, z: 0 }; this.vel = { x: 0, y: 0 }; this.vy = 0; this.onGround = true;
    this.eye = EYE; this.sprint = false; this.jumpReq = false; this.lastW = -1;
    this.keys = new Set(); this.move = null; this.look = null;
    const on = (el, ev, fn, o) => el.addEventListener(ev, e => this.active && fn(e), o);
    on(window, 'keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault?.(); // nada de rolar nem clicar botão focado
      if (e.code === 'KeyW' && !e.repeat) { const t = performance.now(); if (t - this.lastW < 280) this.sprint = true; this.lastW = t; }
      this.keys.add(e.code);
    });
    on(window, 'keyup', e => this.keys.delete(e.code));
    on(window, 'blur', () => { this.keys.clear(); this.sprint = false; });
    on(document, 'mousemove', e => { if (this.locked) this.turn(e.movementX, e.movementY, .0022); });
    // onde o navegador não deixa travar (painel embutido, iframe sem permissão), cai para arrastar e olhar
    document.addEventListener('pointerlockerror', () => this.active && this.failLock());
    on(dom, 'pointerdown', e => {
      if (e.pointerType === 'mouse') {
        if (this.frozen || this.noLock) this.look = { id: e.pointerId, x: e.clientX, y: e.clientY }; // foto ou sem trava: arrastar olha
        else this.lock();                                                                          // jogando: clique trava o mouse
      } else if (e.clientX < innerWidth / 2 && !this.move) this.move = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
      else this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      // com o mouse travado o navegador recusa a captura (InvalidStateError); só arrastos precisam dela
      if (this.move || this.look) try { dom.setPointerCapture?.(e.pointerId); } catch {}
    });
    on(dom, 'pointermove', e => {
      if (this.move?.id === e.pointerId) { this.move.x = (e.clientX - this.move.x0) / 50; this.move.y = (e.clientY - this.move.y0) / 50; }
      else if (this.look?.id === e.pointerId && !this.locked) {
        this.turn(e.clientX - this.look.x, e.clientY - this.look.y, e.pointerType === 'mouse' ? .004 : .006);
        this.look.x = e.clientX; this.look.y = e.clientY;
      }
    });
    const up = e => { if (this.move?.id === e.pointerId) this.move = null; if (this.look?.id === e.pointerId) this.look = null; };
    on(dom, 'pointerup', up); on(dom, 'pointercancel', up);
  }
  get locked() { return document.pointerLockElement === this.dom; }
  turn(dx, dy, k) {
    this.yaw -= dx * k;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * k)); // olha quase reto para cima e para baixo
  }
  lock() {
    if (this.noLock || this.locked || !matchMedia('(pointer: fine)').matches) return;
    if (!this.dom.requestPointerLock) return this.failLock();
    try { this.dom.requestPointerLock()?.catch?.(() => this.failLock()); } catch { this.failLock(); }
  }
  // a trava falhou uma vez: neste navegador olhar é arrastando (lembrado enquanto a página estiver aberta)
  failLock() { if (this.noLock) return; this.noLock = true; this.onLockChange?.(); }
  jump() { this.jumpReq = true; }
  start(x, z, yaw = 0) {
    const p = freeSpot(this.world, x, z);
    Object.assign(this.pos, { x: p.x, y: this.world.heightAt(p.x, p.z), z: p.z });
    Object.assign(this, { yaw, pitch: 0, vy: 0, onGround: true, eye: EYE, sprint: false, jumpReq: false, move: null, look: null });
    this.vel.x = this.vel.y = 0; this.keys.clear();
    this.baseFov = this.camera.fov;
    this.active = true;
    this.update(0);
  }
  stop() {
    this.active = false; this.keys.clear(); this.move = this.look = null;
    if (this.baseFov != null) { this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix?.(); }
    if (this.locked) document.exitPointerLock();
  }
  update(dt) {
    if (!this.active) return;
    const K = this.keys, W = this.world, pos = this.pos;
    let f = (K.has('KeyW') || K.has('ArrowUp')) - (K.has('KeyS') || K.has('ArrowDown'));
    let s = (K.has('KeyD') || K.has('ArrowRight')) - (K.has('KeyA') || K.has('ArrowLeft'));
    let touchRun = false;
    if (this.move) {
      s = Math.max(-1, Math.min(1, this.move.x)); f = Math.max(-1, Math.min(1, -this.move.y));
      touchRun = Math.hypot(this.move.x, this.move.y) > 1.8;
    }
    const sneak = K.has('ShiftLeft') || K.has('ShiftRight');
    if (this.frozen) f = s = 0;
    if (f <= 0 || sneak) this.sprint = false; // como no clássico: parar ou agachar corta a corrida
    const running = (this.sprint || touchRun) && f > 0 && !sneak;
    const speed = sneak ? SPEED.sneak : running ? SPEED.sprint : SPEED.walk;
    const len = Math.hypot(f, s) || 1, sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // frente = −Z da câmera girada por yaw; resposta rápida no chão, pouco controle no ar
    const tx = (-sin * f + cos * s) / len * speed, tz = (-cos * f - sin * s) / len * speed;
    const a = 1 - Math.exp(-dt * (this.onGround ? 16 : 3));
    this.vel.x += (tx - this.vel.x) * a; this.vel.y += (tz - this.vel.y) * a;
    if ((K.has('Space') || this.jumpReq) && this.onGround && !this.frozen) { this.vy = JUMP_V; this.onGround = false; }
    this.jumpReq = false;
    if (dt > 0) {
      // horizontal: colide e só entra onde o chão está até um degrau acima dos pés (no ar, abaixo deles)
      const [nx, nz] = collide(W, pos.x + this.vel.x * dt, pos.z + this.vel.y * dt);
      const top = pos.y + (this.onGround ? STEP_UP : .05);
      const fits = (x, z) => W.heightAt(x, z) <= top && !(sneak && this.onGround && W.heightAt(x, z) < pos.y - .4); // agachado não cai
      if (fits(nx, nz)) { pos.x = nx; pos.z = nz; }
      else if (fits(nx, pos.z)) pos.x = nx; // desliza ao longo do muro
      else if (fits(pos.x, nz)) pos.z = nz;
      // vertical: gravidade no ar, sobe degrau baixo com suavidade, cai ao sair de uma borda
      const g = W.heightAt(pos.x, pos.z);
      if (!this.onGround) {
        this.vy -= GRAVITY * dt; pos.y += this.vy * dt;
        if (pos.y <= g) { pos.y = g; this.vy = 0; this.onGround = true; }
      } else if (g > pos.y) pos.y += (g - pos.y) * (1 - Math.exp(-dt * 22));
      else if (g < pos.y - .02) { this.onGround = false; this.vy = 0; }
    }
    // câmera: olhos baixam ao agachar, balanço de passo, FOV abre um pouco correndo
    const sp = this.onGround ? Math.hypot(this.vel.x, this.vel.y) : 0;
    this.bob += dt * sp * 2.2;
    this.eye += ((sneak ? SNEAK_EYE : EYE) - this.eye) * (1 - Math.exp(-dt * 14));
    const amp = Math.min(1, sp / SPEED.walk), side = Math.sin(this.bob) * .03 * amp;
    const c = this.camera;
    c.position.set(pos.x + Math.cos(this.yaw) * side, pos.y + this.eye - Math.abs(Math.cos(this.bob)) * .05 * amp, pos.z - Math.sin(this.yaw) * side);
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (c.fov != null) {
      const want = FOV * (running ? 1.1 : 1);
      c.fov = dt === 0 ? want : c.fov + (want - c.fov) * (1 - Math.exp(-dt * 10));
      c.updateProjectionMatrix?.();
    }
  }
}
