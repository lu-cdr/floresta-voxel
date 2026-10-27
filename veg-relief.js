/* veg-relief.js — relevo esculpido, somado ao relevo do ruído (sem three.js, sem DOM).
   Cada bloco guarda quantos degraus (terrain.step) subiu ou desceu; trocar o degrau
   no menu Avançado escala o que foi esculpido junto com o resto do terreno. */
export const RELIEF_MAX = 40; // degraus para cima ou para baixo
export const RELIEF_MODES = ['subir', 'descer', 'nivelar', 'suavizar', 'original'];

const falloff = (d, hard) => d > 1 ? 0 : 1 - Math.pow(d, Math.max(.05, hard * 6)); // mesmo perfil dos pincéis de máscara
const clampR = v => Math.max(-RELIEF_MAX, Math.min(RELIEF_MAX, v));
// anda de v até want: uma fração a da distância, pelo menos 1 degrau
function approach(v, want, a) {
  want = Math.round(want);
  const d = want - v;
  if (!d) return v;
  return v + Math.sign(d) * Math.min(Math.abs(d), Math.max(1, Math.round(Math.abs(d) * a)));
}

/* Um carimbo do pincel. relief (Float32 por bloco, degraus) é alterado no lugar.
   start: relevo no começo do traço — subir/descer formam uma cúpula sobre ele, então
   passar de novo no mesmo traço não empilha (o morro cresce um traço por vez).
   noise: alturas do ruído (mundo); target: altura em mundo para nivelar.
   → retângulo de blocos que mudaram { i0, i1, j0, j1 } ou null */
export function sculptRelief(relief, { size, step, noise, start = relief, x, z, radius, strength = .6, hard = .35, mode = 'subir', target = 0 }) {
  const h = size / 2, R = Math.max(.71, radius);
  const i0 = Math.max(0, Math.floor(x - R + h)), i1 = Math.min(size - 1, Math.floor(x + R + h));
  const j0 = Math.max(0, Math.floor(z - R + h)), j1 = Math.min(size - 1, Math.floor(z + R + h));
  const peak = 1 + Math.round(strength * 5); // degraus no centro do traço
  const src = mode === 'suavizar' ? relief.slice() : null;
  const total = (i, j) => noise[j * size + i] / step + src[j * size + i];
  let rect = null;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const f = falloff(Math.hypot(i - h + .5 - x, j - h + .5 - z) / R, hard);
    if (f <= 0) continue;
    const k = j * size + i, a = f * strength;
    let v = relief[k];
    if (mode === 'subir') v = Math.max(v, start[k] + Math.round(peak * f));
    else if (mode === 'descer') v = Math.min(v, start[k] - Math.round(peak * f));
    else if (a < .12) continue; // nivelar/suavizar/original: a borda macia não mexe
    else if (mode === 'nivelar') v = approach(v, (target - noise[k]) / step, a * 2);
    else if (mode === 'original') v = approach(v, 0, a * 2);
    else if (mode === 'suavizar') {
      let sum = 0, c = 0;
      for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
        const ii = i + e, jj = j + b;
        if (ii >= 0 && jj >= 0 && ii < size && jj < size) { sum += total(ii, jj); c++; }
      }
      const want = sum / c - noise[k] / step;
      if (Math.abs(want - v) < .5) continue;
      v = approach(v, want, a);
    }
    v = clampR(v);
    if (v === relief[k]) continue;
    relief[k] = v;
    rect = rect ? { i0: Math.min(rect.i0, i), i1: Math.max(rect.i1, i), j0: Math.min(rect.j0, j), j1: Math.max(rect.j1, j) } : { i0: i, i1: i, j0: j, j1: j };
  }
  return rect;
}

// alturas finais = ruído + degraus esculpidos
export function reliefHeights(noise, relief, step) {
  const out = new Float32Array(noise.length);
  for (let k = 0; k < noise.length; k++) out[k] = noise[k] + relief[k] * step;
  return out;
}

// save: um Int8 por bloco
export const packRelief = relief => Int8Array.from(relief, clampR);
export const unpackRelief = bytes => Float32Array.from(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length));
