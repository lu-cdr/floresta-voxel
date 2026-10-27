/* veg-water.js — água em blocos (rios, lagos, cachoeiras), sem three.js e sem DOM.
   Cada bloco do terreno tem um nível de água ou nenhum (WATER_NONE). O leito é escavado
   abaixo do nível; onde a água encontra um bloco mais baixo, a lateral vira cachoeira.
   Rio: o nível nunca sobe ao longo do traço (pinte do alto para baixo; morro vira cânion).
   Lago: nível do primeiro clique, só enche os blocos que estão abaixo dele. */
export const WATER_NONE = -1e4;
export const hasWater = v => v > WATER_NONE / 2;
export const SURF_DROP = .15; // superfície um pouco abaixo da margem
export const SHORE_FOAM = .35;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const EPS = 1e-4;

// leito: 1 degrau na margem, 2 no meio (os 4 vizinhos com água)
export function carveHeights(base, water, size, step) {
  const h = base.slice(), d = Math.max(.25, step);
  for (let j = 0, k = 0; j < size; j++) for (let i = 0; i < size; i++, k++) {
    const w = water[k];
    if (!hasWater(w)) continue;
    let inner = true;
    for (const [a, b] of N4) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= size || jj >= size || !hasWater(water[jj * size + ii])) { inner = false; break; }
    }
    h[k] = Math.min(base[k], w - d * (inner ? 2 : 1));
  }
  return h;
}

// correnteza: cada trecho de mesmo nível corre para a saída mais próxima (água mais baixa ou borda do mapa);
// trecho sem saída fica parado (lago). → Float32 (dx, dz) por bloco, normalizado ou zero
export function waterFlow(water, size) {
  const n = size * size, dist = new Int32Array(n).fill(-1), edge = new Uint8Array(n);
  const nb = (i, j, a, b) => { const ii = i + a, jj = j + b; return ii < 0 || jj < 0 || ii >= size || jj >= size ? -1 : jj * size + ii; };
  // a borda só é saída para o trecho que não tem outra (senão a cabeceira na borda correria para fora)
  const spread = q => {
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = k % size, j = (k - i) / size;
      for (const [a, b] of N4) {
        const kk = nb(i, j, a, b);
        if (kk >= 0 && dist[kk] < 0 && hasWater(water[kk]) && Math.abs(water[kk] - water[k]) < EPS) { dist[kk] = dist[k] + 1; q.push(kk); }
      }
    }
  };
  for (const viaEdge of [false, true]) {
    const q = [];
    for (let j = 0, k = 0; j < size; j++) for (let i = 0; i < size; i++, k++) {
      const w = water[k];
      if (!hasWater(w) || dist[k] >= 0) continue;
      for (const [a, b] of N4) {
        const kk = nb(i, j, a, b);
        if (viaEdge ? kk < 0 : kk >= 0 && hasWater(water[kk]) && water[kk] < w - EPS) { dist[k] = 0; edge[k] = viaEdge ? 1 : 0; q.push(k); break; }
      }
    }
    spread(q);
  }
  const dir = new Float32Array(n * 2);
  for (let j = 0, k = 0; j < size; j++) for (let i = 0; i < size; i++, k++) {
    if (dist[k] < 0) continue;
    let dx = 0, dz = 0;
    for (const [a, b] of N4) {
      const kk = nb(i, j, a, b);
      const down = kk < 0 ? edge[k] === 1 : (hasWater(water[kk]) && (water[kk] < water[k] - EPS || (Math.abs(water[kk] - water[k]) < EPS && dist[kk] >= 0 && dist[kk] < dist[k])));
      if (down) { dx += a; dz += b; }
    }
    const l = Math.hypot(dx, dz);
    if (l > 0) { dir[k * 2] = dx / l; dir[k * 2 + 1] = dz / l; }
  }
  return dir;
}

/* malha da água: superfícies, paredes e cachoeiras.
   Atributos por vértice: position, normal, water (fluxoX, fluxoZ, tipo 0=superfície/1=cachoeira, espuma), depth (0..1) */
export function buildWaterGeometry({ size, water, heights }) {
  const flow = waterFlow(water, size), half = size / 2;
  const pos = [], nor = [], wat = [], dep = [];
  const push = (p, n, w, d) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); wat.push(w[0], w[1], w[2], w[3]); dep.push(d); };
  let falls = 0, blocks = 0;
  for (let j = 0, k = 0; j < size; j++) for (let i = 0; i < size; i++, k++) {
    const w = water[k];
    if (!hasWater(w)) continue;
    blocks++;
    const y = w - SURF_DROP, x0 = i - half, x1 = x0 + 1, z0 = j - half, z1 = z0 + 1;
    const fx = flow[k * 2], fz = flow[k * 2 + 1], depth = Math.min(1, (w - heights[k]) / 1.5);
    // espuma na borda que recebe uma cachoeira de um vizinho mais alto
    const fallIn = N4.map(([a, b]) => {
      const ii = i + a, jj = j + b;
      return ii >= 0 && jj >= 0 && ii < size && jj < size && water[jj * size + ii] > w + EPS ? 1 : 0;
    });
    // espuma fraca na beira: canto encostado num vizinho seco (0,35), forte onde cai cachoeira (1)
    const shore = N4.map(([a, b]) => {
      const ii = i + a, jj = j + b;
      return ii >= 0 && jj >= 0 && ii < size && jj < size && !hasWater(water[jj * size + ii]) ? SHORE_FOAM : 0;
    });
    const foamAt = (x, z) => Math.max(x === x1 ? fallIn[0] : 0, x === x0 ? fallIn[1] : 0, z === z1 ? fallIn[2] : 0, z === z0 ? fallIn[3] : 0,
      x === x1 ? shore[0] : 0, x === x0 ? shore[1] : 0, z === z1 ? shore[2] : 0, z === z0 ? shore[3] : 0);
    const top = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]];
    for (const t of [0, 1, 2, 0, 2, 3]) push([top[t][0], y, top[t][1]], [0, 1, 0], [fx, fz, 0, foamAt(top[t][0], top[t][1])], depth);
    // laterais (mesma ordem de vértices das laterais do terreno)
    const sides = [[i + 1, j, [x1, z1], [x1, z0], [1, 0, 0]], [i - 1, j, [x0, z0], [x0, z1], [-1, 0, 0]],
                   [i, j + 1, [x0, z1], [x1, z1], [0, 0, 1]], [i, j - 1, [x1, z0], [x0, z0], [0, 0, -1]]];
    for (const [ni, nj, a, b, n] of sides) {
      const out = ni < 0 || nj < 0 || ni >= size || nj >= size, nk = nj * size + ni;
      let bottom, fall;
      if (out) { bottom = heights[k]; fall = false; } // borda do diorama: corte de aquário até o leito
      else if (hasWater(water[nk])) { if (water[nk] >= w - EPS) continue; bottom = water[nk] - SURF_DROP; fall = true; }
      else { if (heights[nk] >= y) continue; bottom = Math.max(heights[nk], heights[k]); fall = y - bottom > .3; }
      if (bottom >= y - EPS) continue;
      if (fall) falls++;
      const kind = fall ? 1 : 0, A = [a[0], y, a[1]], B = [b[0], y, b[1]], Ab = [a[0], bottom, a[1]], Bb = [b[0], bottom, b[1]];
      const wt = [n[0], n[2], kind, 0], wb = [n[0], n[2], kind, fall ? 1 : 0];
      for (const [p, ww] of [[A, wt], [Ab, wb], [Bb, wb], [A, wt], [Bb, wb], [B, wt]]) push(p, n, ww, fall ? 0 : depth);
    }
  }
  return {
    position: Float32Array.from(pos), normal: Float32Array.from(nor), water: Float32Array.from(wat), depth: Float32Array.from(dep),
    blocks, falls,
  };
}

// umidade extra perto da água: 1 no bloco com água, caindo até zero a `reach` blocos (BFS em 4 vizinhos)
export function waterProximity(water, size, reach = 5) {
  const n = size * size, d = new Int32Array(n).fill(-1), q = [], out = new Float32Array(n);
  for (let k = 0; k < n; k++) if (hasWater(water[k])) { d[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % size, j = (k - i) / size;
    if (d[k] >= reach) continue;
    for (const [a, b] of N4) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= size || jj >= size) continue;
      const kk = jj * size + ii;
      if (d[kk] < 0) { d[kk] = d[k] + 1; q.push(kk); }
    }
  }
  for (let k = 0; k < n; k++) if (d[k] >= 0) out[k] = 1 - d[k] / (reach + 1);
  return out;
}

// faixas da margem por bloco seco: 1 = colado na água (areia/cascalho), 2 = segundo bloco (lama úmida), 0 = resto
export function shoreBands(water, size) {
  const p = waterProximity(water, size, 2), out = new Uint8Array(size * size);
  for (let k = 0; k < out.length; k++) if (!hasWater(water[k]) && p[k] > 0) out[k] = p[k] > .5 ? 1 : 2;
  return out;
}

// salvar: nível em centésimos (Int16), sem água = -32768
export function packWater(water) {
  const u = new Int16Array(water.length);
  for (let k = 0; k < water.length; k++) u[k] = hasWater(water[k]) ? Math.max(-32767, Math.min(32767, Math.round(water[k] * 100))) : -32768;
  return new Uint8Array(u.buffer);
}
export function unpackWater(bytes) {
  const u = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1), w = new Float32Array(u.length);
  for (let k = 0; k < u.length; k++) w[k] = u[k] === -32768 ? WATER_NONE : u[k] / 100;
  return w;
}
