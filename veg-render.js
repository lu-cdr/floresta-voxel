/* veg-render.js — mundo de vegetação em three.js, reaproveitável em jogos de browser.
   Terreno em blocos, floresta instanciada (uma InstancedMesh por variante de árvore),
   grama em chunks, vento e variação de cor no shader. O editor e o exemplo de jogo
   usam a mesma classe VegWorld; o "projeto" (JSON) é o que o editor exporta. */
import * as THREE from 'three';
import {
  SPECIES_KEYS, STYLES, defaultProject, migrateProject, sampleField, genTreeVoxels, colorTree, meshVoxels,
  scatterTrees, scatterGrass, bucketT, variantSeed, hexToRgb, srgbToLinear, shiftHsl, hash3, clamp01, lerp,
} from './veg-core.js';
import { seasonAt, lifeOf, stageKey, deadVariant } from './veg-core.js';
import { SOILS, computeEco, suitabilityGrid, siteQuality } from './veg-eco.js';

// o projeto padrão e a migração moram no núcleo (sem three), para Node/Godot lerem igual
export { defaultProject, migrateProject };

/* ---------- shader de vegetação: vento, empurrão e variação de cor ---------- */
export function makeUniforms() {
  return {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector4(1, 0, .45, 1.2) }, // dirX, dirZ, força, frequência
    uGust: { value: .6 },
    uPush: { value: new THREE.Vector4(0, 0, 1.4, 0) },   // x, z, raio, força (cursor / jogador)
    uGBase: { value: new THREE.Color() },
    uGTip: { value: new THREE.Color() },
  };
}

const GLSL_HEAD = /* glsl */`
attribute vec2 aVeg;
uniform float uTime; uniform vec4 uWind; uniform float uGust; uniform vec4 uPush;
uniform vec3 uGBase; uniform vec3 uGTip;
#ifdef VEG_TINT
attribute vec3 iTint;
vec3 vegRgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)), d/(q.x+1e-10), q.x); }
vec3 vegHsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }
#endif
`;
const GLSL_WIND = /* glsl */`
#include <begin_vertex>
#ifdef USE_INSTANCING
  mat4 vegM = modelMatrix * instanceMatrix;
#else
  mat4 vegM = modelMatrix;
#endif
  vec3 rootW = (vegM * vec4(0., 0., 0., 1.)).xyz;
  mat3 vegIm = mat3(vegM);
  float vegS2 = dot(vegIm[0], vegIm[0]);
  float ph = dot(rootW.xz, uWind.xy) * .18 - uTime * uWind.w;
  float gust = .55 + .45 * sin(rootW.x * .045 + rootW.z * .03 - uTime * .6 * uWind.w);
  float sw = aVeg.y * uWind.z * (sin(ph) * .5 + .5 + .35 * sin(ph * 2.7 + rootW.z)) * mix(1., gust, uGust);
  vec3 dispW = vec3(uWind.x, 0., uWind.y) * sw;
#ifdef VEG_GRASS
  vec2 dp = rootW.xz - uPush.xy; float dl = length(dp);
  float pf = (1. - smoothstep(0., uPush.z, dl)) * uPush.w * aVeg.y;
  dispW.xz += (dl > 1e-3 ? dp / dl : vec2(0.)) * pf;
  dispW.y -= pf * .25;
#else
  dispW *= sqrt(vegS2);
  dispW += vec3(sin(uTime * 5.3 + position.x * 17. + position.y * 11.), 0., cos(uTime * 4.7 + position.z * 15. + position.y * 9.)) * .02 * aVeg.x * uWind.z;
#endif
  // deslocamento em mundo → espaço local (rotação + escala da instância)
  transformed += transpose(vegIm) * dispW / vegS2;
`;
const GLSL_COLOR = /* glsl */`
#include <color_vertex>
#ifdef VEG_TINT
  if (aVeg.x > .5) { vec3 h = vegRgb2hsv(vColor.rgb); h.x = fract(h.x + iTint.x); h.y = clamp(h.y * (1. + iTint.y), 0., 1.); h.z *= 1. + iTint.z; vColor.rgb = vegHsv2rgb(h); }
#endif
#ifdef VEG_GRASS
  vColor.rgb = mix(uGBase, uGTip, aVeg.y) * vColor.rgb;
#endif
`;

function patch(material, U, defines, withColor) {
  material.defines = { ...(material.defines || {}), ...defines };
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = GLSL_HEAD + sh.vertexShader.replace('#include <begin_vertex>', GLSL_WIND);
    if (withColor) sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', GLSL_COLOR);
  };
  material.customProgramCacheKey = () => 'veg' + Object.keys(defines).join();
  return material;
}
export function vegMaterials(U, { grass = false } = {}) {
  const defines = grass ? { VEG_GRASS: '' } : { VEG_TINT: '' };
  const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), U, defines, true);
  const depth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), U, defines, false);
  return { mat, depth };
}

/* ---------- geometrias ---------- */
export function treeGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.color, 3));
  g.setAttribute('aVeg', new THREE.BufferAttribute(m.veg, 2));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  g.computeBoundingSphere();
  return g;
}
function bladeGeometry(style, width) {
  let g;
  if (style === 'voxel') {
    g = new THREE.BoxGeometry(width, 1, width, 1, 3, 1).translate(0, .5, 0);
  } else {
    // lâmina afinando, em X cruzado
    const w = width * 1.6, pos = [], idx = [];
    for (const r of [0, Math.PI / 2]) {
      const b = pos.length / 3, c = Math.cos(r), s = Math.sin(r);
      for (const [x, y] of [[-w, 0], [w, 0], [-w * .55, .5], [w * .55, .5], [0, 1]]) pos.push(x * c, y, x * s);
      idx.push(b, b + 1, b + 3, b, b + 3, b + 2, b + 2, b + 3, b + 4);
      idx.push(b, b + 3, b + 1, b, b + 2, b + 3, b + 2, b + 4, b + 3);
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  const p = g.attributes.position, n = p.count;
  const veg = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
  for (let i = 0; i < n; i++) { veg[i * 2] = 0; veg[i * 2 + 1] = clamp01(p.getY(i)); }
  g.setAttribute('aVeg', new THREE.BufferAttribute(veg, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/* ---------- campo visualizado no terreno (debug) ---------- */
function ramp(t) {
  // azul-escuro → verde → amarelo, legível nos dois temas
  const stops = [[.15, .12, .35], [.13, .45, .55], [.35, .7, .35], [.98, .86, .3]];
  const x = clamp01(t) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return stops[i].map((v, k) => lerp(v, stops[i + 1][k], f));
}

/* ---------- o mundo ---------- */
export class VegWorld {
  constructor(scene, project = defaultProject()) {
    this.scene = scene;
    this.U = makeUniforms();
    this.P = project;
    this.group = new THREE.Group();
    this.treeGroup = new THREE.Group();
    this.grassGroup = new THREE.Group();
    this.group.add(this.treeGroup, this.grassGroup);
    scene.add(this.group);
    this.treeMats = vegMaterials(this.U);
    this.grassMats = vegMaterials(this.U, { grass: true });
    this.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.variants = new Map();     // key → { geo, mesh, cap, ready }
    this.genQueue = [];
    this.recolorQueue = new Set();
    this.trees = [];
    this.grassChunks = new Map();  // "cx,cz" → InstancedMesh
    this.overlay = 'nenhum';
    this.stats = { arvores: 0, grama: 0, variantes: 0, fila: 0, recolor: 0, genMs: 0 };
    this.setSize(project.size, project.masks);
  }

  /* --- máscaras pintadas (2 amostras por unidade) --- */
  setSize(size, masks) {
    this.P.size = size;
    this.res = 2;
    const n = size * this.res;
    this.maskN = n;
    this.treeMask = new Float32Array(n * n);
    this.grassMask = new Float32Array(n * n);
    this.speciesMask = new Int8Array(n * n).fill(-1);
    this.soilMask = new Uint8Array(n * n); // índice em SOILS (0 = terra)
    this.eco = null;
    if (masks) this.loadMasks(masks);
    this.rebuildTerrain();
  }
  maskIndex(x, z) {
    const n = this.maskN, h = this.P.size / 2;
    const i = Math.floor((x + h) * this.res), j = Math.floor((z + h) * this.res);
    return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
  }
  sampleMask(arr, x, z) { const k = this.maskIndex(x, z); return k < 0 ? 0 : arr[k]; }

  // value: espécie forçada (árvores) ou tipo de solo (solo)
  paint(layer, x, z, radius, strength, hardness, erase, speciesIdx = -1) {
    if (layer === 'solo') return this.paintSoil(x, z, radius, strength, hardness, erase ? 0 : speciesIdx);
    const arr = layer === 'grama' ? this.grassMask : this.treeMask;
    const n = this.maskN, h = this.P.size / 2, r = this.res;
    const i0 = Math.max(0, Math.floor((x - radius + h) * r)), i1 = Math.min(n - 1, Math.ceil((x + radius + h) * r));
    const j0 = Math.max(0, Math.floor((z - radius + h) * r)), j1 = Math.min(n - 1, Math.ceil((z + radius + h) * r));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = i / r - h + .5 / r, pz = j / r - h + .5 / r;
      const d = Math.hypot(px - x, pz - z) / radius;
      if (d > 1) continue;
      const f = 1 - Math.pow(d, Math.max(.05, hardness * 6)) ; // dureza: borda macia ou seca
      const k = j * n + i, a = clamp01(f) * strength;
      if (erase) arr[k] = Math.max(0, arr[k] - a);
      else {
        arr[k] = Math.min(1, arr[k] + a);
        if (layer !== 'grama' && a > .05) this.speciesMask[k] = speciesIdx;
      }
    }
    return { x0: x - radius, x1: x + radius, z0: z - radius, z1: z + radius };
  }
  // camadas pintadas que o histórico guarda (todas maskN × maskN)
  maskLayers() { return { trees: this.treeMask, grass: this.grassMask, species: this.speciesMask, soil: this.soilMask }; }
  // bounds em mundo → retângulo inclusivo de células da máscara (mesma conta do paint)
  maskRect(b) {
    const n = this.maskN, h = this.P.size / 2, r = this.res;
    const rect = {
      i0: Math.max(0, Math.floor((b.x0 + h) * r)), i1: Math.min(n - 1, Math.ceil((b.x1 + h) * r)),
      j0: Math.max(0, Math.floor((b.z0 + h) * r)), j1: Math.min(n - 1, Math.ceil((b.z1 + h) * r)),
    };
    return rect.i0 > rect.i1 || rect.j0 > rect.j1 ? null : rect;
  }
  get bounds() { const h = this.P.size / 2; return { x0: -h, x1: h, z0: -h, z1: h }; }
  // solo é categórico: a célula troca de tipo onde a pincelada passa do limiar
  paintSoil(x, z, radius, strength, hardness, type) {
    const n = this.maskN, h = this.P.size / 2, r = this.res;
    const i0 = Math.max(0, Math.floor((x - radius + h) * r)), i1 = Math.min(n - 1, Math.ceil((x + radius + h) * r));
    const j0 = Math.max(0, Math.floor((z - radius + h) * r)), j1 = Math.min(n - 1, Math.ceil((z + radius + h) * r));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(i / r - h + .5 / r - x, j / r - h + .5 / r - z) / radius;
      if (d > 1) continue;
      if ((1 - Math.pow(d, Math.max(.05, hardness * 6))) * strength > .15) this.soilMask[j * n + i] = type;
    }
    this.eco = null;
    return { x0: x - radius, x1: x + radius, z0: z - radius, z1: z + radius };
  }
  soilAt(x, z) { const k = this.maskIndex(x, z); return k < 0 ? 0 : this.soilMask[k]; }
  // grade ecológica sob demanda; qualquer mudança em árvores, solo, relevo ou estação a invalida
  getEco() {
    if (this.eco) return this.eco;
    const { size, terrain } = this.P, h = size / 2;
    this.eco = computeEco({
      size, heights: this.heights, amp: terrain.amp,
      soilAt: (i, j) => this.soilAt(i - h + .5, j - h + .5),
      trees: this.trees, season: seasonAt(this.P.ecology).index,
    });
    return this.eco;
  }
  ecoIndex(x, z) {
    const s = this.P.size, h = s / 2, i = Math.floor(x + h), j = Math.floor(z + h);
    return i < 0 || j < 0 || i >= s || j >= s ? -1 : j * s + i;
  }
  fillAll(layer, v = 1) {
    (layer === 'grama' ? this.grassMask : this.treeMask).fill(v);
    if (layer !== 'grama') this.speciesMask.fill(-1);
  }

  /* --- terreno em blocos --- */
  rebuildTerrain() {
    const { size, terrain } = this.P;
    this.heights = new Float32Array(size * size);
    const h = size / 2;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const v = sampleField(terrain.field, i - h + .5, j - h + .5);
      this.heights[j * size + i] = Math.round(v * terrain.amp / terrain.step) * terrain.step;
    }
    this.eco = null;
    if (this.terrainMesh) { this.group.remove(this.terrainMesh); this.terrainMesh.geometry.dispose(); }
    const pos = [], nor = [], tileOf = [];
    const H = (i, j) => (i < 0 || j < 0 || i >= size || j >= size) ? -2 : this.heights[j * size + i];
    const quad = (a, b, c, d, n, tile, side) => {
      for (const p of [a, b, c, a, c, d]) { pos.push(...p); nor.push(...n); tileOf.push(side ? -1 - tile : tile); }
    };
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const y = H(i, j), x0 = i - h, x1 = x0 + 1, z0 = j - h, z1 = z0 + 1, t = j * size + i;
      quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], [0, 1, 0], t, false);
      const sides = [[i + 1, j, [x1, y, z1], [x1, y, z0], [1, 0, 0]], [i - 1, j, [x0, y, z0], [x0, y, z1], [-1, 0, 0]],
                     [i, j + 1, [x0, y, z1], [x1, y, z1], [0, 0, 1]], [i, j - 1, [x1, y, z0], [x0, y, z0], [0, 0, -1]]];
      for (const [ni, nj, a, b, n] of sides) {
        const yn = H(ni, nj);
        if (yn >= y) continue;
        quad(a, [a[0], yn, a[2]], [b[0], yn, b[2]], b, n, t, true);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    this.tileOf = Int32Array.from(tileOf);
    this.terrainMesh = new THREE.Mesh(g, this.terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.group.add(this.terrainMesh);
    this.recolorTerrain();
  }
  heightAt(x, z) {
    const s = this.P.size, h = s / 2;
    const i = Math.min(s - 1, Math.max(0, Math.floor(x + h))), j = Math.min(s - 1, Math.max(0, Math.floor(z + h)));
    return this.heights[j * s + i];
  }
  slopeAt(x, z) {
    const y = this.heightAt(x, z);
    return Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => Math.abs(this.heightAt(x + a, z + b) - y)));
  }
  recolorTerrain() {
    const { size, style, terrain } = this.P;
    const T = style.terrain;
    const C = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, hexToRgb(v)]));
    const h = size / 2, tileCol = new Array(size * size), sideCol = new Array(size * size);
    const snowC = style.snow > 0 && T.snow ? hexToRgb(T.snow) : null;
    const field = this.overlay !== 'nenhum' && !this.overlay.startsWith('eco:') ? (this.overlay === 'terreno' ? terrain.field : this.P.fields[this.overlay]) : null;
    const ecoV = this.overlay.startsWith('eco:') ? this.ecoOverlay(this.overlay.slice(4)) : null;
    const soilC = SOILS.map(s => s.color && hexToRgb(s.color));
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const t = j * size + i, x = i - h + .5, z = j - h + .5;
      const y = this.heights[t] / Math.max(.01, terrain.amp);
      let c = y < .3 ? C.low.map((v, k) => lerp(v, C.mid[k], y / .3)) : C.mid.map((v, k) => lerp(v, C.high[k], clamp01((y - .3) / .6)));
      const gm = this.sampleMask(this.grassMask, x, z), tm = this.sampleMask(this.treeMask, x, z);
      c = c.map((v, k) => lerp(v, C.grass[k], gm * .8));
      c = c.map((v, k) => lerp(v, C.litter[k], tm * .35));
      const so = this.soilAt(x, z);
      if (so) c = c.map((v, k) => lerp(v, soilC[so][k], SOILS[so].mix));
      if (snowC) c = c.map((v, k) => lerp(v, snowC[k], style.snow * .7));
      c = shiftHsl(c, 0, 0, (hash3(i, j, 5) - .5) * .035);
      if (field) c = ramp(sampleField(field, x, z)).map((v, k) => lerp(c[k], v, .82));
      if (ecoV) c = ramp(ecoV[t]).map((v, k) => lerp(c[k], v, .82));
      tileCol[t] = srgbToLinear(c);
      sideCol[t] = srgbToLinear(shiftHsl(C.cliff, 0, 0, (hash3(i, j, 9) - .5) * .05));
    }
    const col = this.terrainMesh.geometry.attributes.color;
    for (let v = 0; v < this.tileOf.length; v++) {
      const k = this.tileOf[v];
      const c = k >= 0 ? tileCol[k] : sideCol[-1 - k];
      col.setXYZ(v, c[0], c[1], c[2]);
    }
    col.needsUpdate = true;
  }
  // 'umidade' | 'luz' | 'fertilidade' | 'declive' | 'adequacao:<espécie>' → valor por bloco
  ecoOverlay(name) {
    const e = this.getEco();
    if (name.startsWith('adequacao:')) return suitabilityGrid(name.slice(10), e);
    return { umidade: e.moisture, luz: e.light, fertilidade: e.fertility, declive: e.slope }[name];
  }
  // raio contra o heightmap: avança em passos e refina
  raycast(ray) {
    const s = this.P.size / 2;
    let t = 0, prev = null;
    const p = new THREE.Vector3();
    for (let k = 0; k < 2400; k++) {
      p.copy(ray.direction).multiplyScalar(t).add(ray.origin);
      if (Math.abs(p.x) < s && Math.abs(p.z) < s && p.y <= this.heightAt(p.x, p.z)) {
        if (!prev) return p.clone();
        let a = t - .15, b = t;
        for (let r = 0; r < 8; r++) { const m = (a + b) / 2; p.copy(ray.direction).multiplyScalar(m).add(ray.origin); if (p.y <= this.heightAt(p.x, p.z)) b = m; else a = m; }
        p.copy(ray.direction).multiplyScalar(b).add(ray.origin);
        return p.clone();
      }
      prev = true;
      t += .15;
      if (p.y < -5 && ray.direction.y < 0) break;
    }
    return null;
  }

  /* --- árvores --- */
  invalidateVariants() {
    for (const v of this.variants.values()) { this.treeGroup.remove(v.mesh); v.geo?.dispose(); }
    this.variants.clear();
    this.genQueue.length = 0;
    this.recolorQueue.clear();
    this.applyTrees();
  }
  ensureVariant(key) {
    let v = this.variants.get(key);
    if (v) return v;
    v = { geo: null, mesh: null, cap: 0, ready: false, height: 1 };
    this.variants.set(key, v);
    this.genQueue.push(key);
    return v;
  }
  buildVariant(key) {
    const [species, b, vi, dead] = key.split(':');
    const t0 = performance.now();
    const tree = genTreeVoxels(species, bucketT(+b, this.P.trees.shapeBuckets), variantSeed(species, b, vi, this.P.seed), this.P.style, this.P.species);
    const m = meshVoxels(dead ? deadVariant(tree, dead, this.P.style) : tree, this.P.style.voxel);
    this.stats.genMs = Math.round(performance.now() - t0);
    // árvore viva guardada para recolorir na troca de estação sem refazer a geometria; morta/toco são refeitas (poucas)
    m.tree = dead ? null : tree;
    return m;
  }
  // sproutTick: dia em que as árvores que surgirem agora brotaram (modo Ecossistema, após pintar)
  rescatterTrees({ sproutTick = null } = {}) {
    const P = this.P, prev = new Set(this.trees.map(t => t.id));
    this.trees = scatterTrees({
      size: P.size, seed: P.seed,
      maskAt: (x, z) => this.sampleMask(this.treeMask, x, z),
      speciesMaskAt: (x, z) => { const k = this.maskIndex(x, z); return k < 0 ? -1 : this.speciesMask[k]; },
      heightAt: (x, z) => this.heightAt(x, z),
      slopeAt: (x, z) => this.slopeAt(x, z),
      fields: P.fields, p: P.trees,
    });
    const plants = P.ecology.plants, ids = new Set();
    for (const t of this.trees) {
      ids.add(t.id);
      if (sproutTick != null && prev.size && !prev.has(t.id) && !(t.id in plants)) plants[t.id] = sproutTick;
    }
    for (const id in plants) if (!ids.has(id)) delete plants[id]; // apagadas não guardam idade
    this.eco = null;
    this.applyTrees();
  }
  // estágio de vida (modo Ecossistema): tamanho desenhado e variante (viva, morta, toco) por árvore
  updateLife() {
    const E = this.P.ecology, on = E.mode === 'ecossistema', eco = on ? this.getEco() : null;
    for (const t of this.trees) {
      if (!on) { t.life = null; t.suit = 1; t.drawScale = t.scale; t.vkey = t.key; continue; }
      const k = this.ecoIndex(t.x, t.z);
      t.suit = k < 0 ? 1 : siteQuality(t.species, eco, k);
      t.life = lifeOf(t, E.epoch == null ? { ...E, epoch: E.tick } : E, this.P.seed, t.suit);
      t.drawScale = t.scale * t.life.scale;
      t.vkey = t.key + stageKey(t.life.stage);
    }
  }
  stageSnapshot() { return new Map(this.trees.map(t => [t.id, t.life?.stage || 'adulta'])); }
  applyTrees() {
    this.updateLife();
    const groups = new Map();
    for (const t of this.trees) { if (!groups.has(t.vkey)) groups.set(t.vkey, []); groups.get(t.vkey).push(t); }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), p = new THREE.Vector3();
    let shown = 0;
    for (const [key, v] of this.variants) if (!groups.has(key) && v.mesh) v.mesh.count = 0;
    for (const [key, list] of groups) {
      const v = this.ensureVariant(key);
      if (!v.ready) continue;
      if (list.length > v.cap) {
        if (v.mesh) this.treeGroup.remove(v.mesh);
        v.cap = Math.max(8, 1 << Math.ceil(Math.log2(list.length)));
        v.mesh = new THREE.InstancedMesh(v.geo, this.treeMats.mat, v.cap);
        v.mesh.customDepthMaterial = this.treeMats.depth;
        v.mesh.castShadow = v.mesh.receiveShadow = true;
        v.mesh.frustumCulled = false;
        v.tint = new THREE.InstancedBufferAttribute(new Float32Array(v.cap * 3), 3);
        v.geo.setAttribute('iTint', v.tint);
        this.treeGroup.add(v.mesh);
      }
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, t.rot); s.setScalar(t.drawScale); p.set(t.x, t.y, t.z);
        v.mesh.setMatrixAt(i, m.compose(p, q, s));
        const old = t.life?.stage === 'velha'; // copa velha mais apagada
        v.tint.setXYZ(i, t.tint[0], t.tint[1] - (old ? .18 : 0), t.tint[2] - (old ? .08 : 0));
      });
      v.mesh.count = list.length;
      v.mesh.instanceMatrix.needsUpdate = true;
      v.tint.needsUpdate = true;
      shown += list.length;
    }
    this.stats.arvores = this.trees.length;
    this.stats.variantes = [...this.variants.values()].filter(v => v.ready).length;
  }

  /* --- grama em chunks de 16×16 --- */
  rebuildGrass(bounds) {
    const CH = 16, s = this.P.size, h = s / 2, n = Math.ceil(s / CH);
    const P = this.P;
    if (!this.bladeGeo || this.bladeKey !== P.grass.style + P.grass.width) {
      this.bladeGeo?.dispose();
      this.bladeGeo = bladeGeometry(P.grass.style, P.grass.width);
      this.bladeKey = P.grass.style + P.grass.width;
      bounds = null;
    }
    this.U.uGBase.value.set(P.style.grass.base);
    this.U.uGTip.value.set(P.style.grass.tip);
    // grama não nasce dentro dos troncos
    const trunks = new Map();
    for (const t of this.trees) {
      const k = Math.floor(t.x) + ',' + Math.floor(t.z);
      if (!trunks.has(k)) trunks.set(k, []);
      trunks.get(k).push(t);
    }
    const blocked = (x, z) => {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const l = trunks.get((Math.floor(x) + dx) + ',' + (Math.floor(z) + dz));
        if (l) for (const t of l) if ((t.x - x) ** 2 + (t.z - z) ** 2 < (.35 * (t.drawScale ?? t.scale)) ** 2) return true;
      }
      return false;
    };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    let total = 0;
    for (let cz = 0; cz < n; cz++) for (let cx = 0; cx < n; cx++) {
      const x0 = -h + cx * CH, z0 = -h + cz * CH, key = cx + ',' + cz;
      const inB = !bounds || !(bounds.x1 < x0 || bounds.x0 > x0 + CH || bounds.z1 < z0 || bounds.z0 > z0 + CH);
      if (!inB) { total += this.grassChunks.get(key)?.count || 0; continue; }
      const old = this.grassChunks.get(key);
      if (old) { this.grassGroup.remove(old); old.dispose(); this.grassChunks.delete(key); }
      const blades = scatterGrass({
        x0, z0, x1: Math.min(h, x0 + CH), z1: Math.min(h, z0 + CH), seed: P.seed + 77,
        maskAt: (x, z) => this.sampleMask(this.grassMask, x, z) * SOILS[this.soilAt(x, z)].grass,
        heightAt: (x, z) => this.heightAt(x, z), fields: P.fields, p: P.grass,
        blockedAt: P.grass.underTrees ? blocked : (x, z) => blocked(x, z) || this.sampleMask(this.treeMask, x, z) > .5,
      });
      if (!blades.length) continue;
      const im = new THREE.InstancedMesh(this.bladeGeo, this.grassMats.mat, blades.length);
      im.customDepthMaterial = this.grassMats.depth;
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      blades.forEach((b, i) => {
        q.setFromEuler(e.set(b.lean * .5, b.rot, b.lean));
        p.set(b.x, b.y, b.z); sc.set(1, b.h, 1);
        im.setMatrixAt(i, m.compose(p, q, sc));
        im.setColorAt(i, c.setScalar(.82 + b.c * .3));
      });
      this.grassGroup.add(im);
      this.grassChunks.set(key, im);
      total += blades.length;
    }
    this.stats.grama = total;
  }
  clearGrass() {
    for (const im of this.grassChunks.values()) { this.grassGroup.remove(im); im.dispose(); }
    this.grassChunks.clear();
  }

  /* --- por quadro: vento e geração de variantes sem travar --- */
  update(time) {
    const w = this.P.wind, a = w.dir * Math.PI / 180;
    this.U.uTime.value = time;
    this.U.uWind.value.set(Math.cos(a), Math.sin(a), w.strength, w.freq);
    this.U.uGust.value = w.gust;
    if (this.genQueue.length) {
      const t0 = performance.now();
      let built = false;
      while (this.genQueue.length && performance.now() - t0 < 24) {
        const key = this.genQueue.shift(), v = this.variants.get(key);
        if (!v) continue;
        const mesh = this.buildVariant(key);
        v.geo = treeGeometry(mesh); v.height = mesh.height; v.ready = true; v.voxels = mesh.voxels; v.tree = mesh.tree;
        built = true;
      }
      if (built) this.applyTrees();
    }
    // recolorir (estação/paleta): mesma fatia de tempo, depois da geração
    if (this.recolorQueue.size) {
      const t0 = performance.now();
      for (const key of this.recolorQueue) {
        if (performance.now() - t0 > 12) break;
        this.recolorQueue.delete(key);
        this.recolorVariant(key);
      }
    }
    this.stats.fila = this.genQueue.length;
    this.stats.recolor = this.recolorQueue.size;
  }

  /* --- troca de estilo (o "design document") ---
     Mesmo tamanho de voxel: só recolore as variantes prontas, na fila, sem refazer geometria.
     Voxel diferente: regenera tudo. */
  setStyle(style, name) {
    const sameVoxel = style.voxel === this.P.style.voxel;
    this.P.style = structuredClone(style);
    if (name) this.P.styleName = name;
    this.recolorTerrain();
    if (sameVoxel) for (const [key, v] of this.variants) { if (v.ready) this.recolorQueue.add(key); }
    else this.invalidateVariants();
    this.U.uGBase.value.set(this.P.style.grass.base);
    this.U.uGTip.value.set(this.P.style.grass.tip);
  }
  recolorVariant(key) {
    const v = this.variants.get(key);
    if (!v?.ready) return;
    let m;
    if (v.tree) { colorTree(v.tree, this.P.style); m = meshVoxels(v.tree, this.P.style.voxel); }
    else m = this.buildVariant(key);
    const col = v.geo.attributes.color, veg = v.geo.attributes.aVeg;
    // a malha não muda (mesma ocupação), só cor e o sinal de folha; se mudar, é bug: refaz do zero
    if (m.color.length !== col.array.length) { v.geo.dispose(); v.geo = treeGeometry(m); this.rebindVariant(v); return; }
    col.array.set(m.color); col.needsUpdate = true;
    veg.array.set(m.veg); veg.needsUpdate = true;
  }
  rebindVariant(v) {
    if (v.mesh) { this.treeGroup.remove(v.mesh); v.mesh = null; v.cap = 0; }
    this.applyTrees();
  }

  /* --- salvar / carregar --- */
  packMasks() {
    const q = a => { const u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = Math.round(a[i] * 255); return u; };
    const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    return { n: this.maskN, trees: b64(q(this.treeMask)), grass: b64(q(this.grassMask)), species: b64(new Uint8Array(this.speciesMask.buffer.slice(0))), soil: b64(this.soilMask) };
  }
  loadMasks(m) {
    if (!m || m.n !== this.maskN) return;
    const un = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const t = un(m.trees), g = un(m.grass), sp = un(m.species);
    for (let i = 0; i < t.length; i++) { this.treeMask[i] = t[i] / 255; this.grassMask[i] = g[i] / 255; }
    this.speciesMask.set(new Int8Array(sp.buffer));
    if (m.soil) this.soilMask.set(un(m.soil)); // projetos antigos: tudo terra
  }
  toJSON() {
    const r3 = v => Math.round(v * 1000) / 1000;
    return {
      ...this.P,
      masks: this.packMasks(),
      // árvores já distribuídas: o que um motor (Godot, outro jogo) precisa para posicionar
      baked: {
        voxel: this.P.style.voxel,
        trees: this.trees.map(t => ({ s: t.species, v: t.vkey ?? t.key, p: [r3(t.x), r3(t.y), r3(t.z)], r: r3(t.rot), k: r3(t.drawScale ?? t.scale), tint: t.tint.map(r3), ...(t.life ? { stage: t.life.stage } : {}) })),
      },
    };
  }
}

/* ---------- export: malhas "assadas" (cor de folha aplicada, sem atributos do shader) ---------- */
function bakeTint(color, veg, tint) {
  const out = new Float32Array(color.length);
  const c = new THREE.Color(), hsl = {};
  for (let i = 0; i < color.length / 3; i++) {
    c.setRGB(color[i * 3], color[i * 3 + 1], color[i * 3 + 2]);
    if (veg[i * 2] > .5 && tint) {
      // HSV aproximado via HSL: suficiente para variações pequenas
      c.getHSL(hsl);
      c.setHSL((hsl.h + tint[0] + 1) % 1, clamp01(hsl.s * (1 + tint[1])), clamp01(hsl.l * (1 + tint[2])));
    }
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  return out;
}
export function bakedTreeMesh(geo, tint, name) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position.clone());
  g.setAttribute('normal', geo.attributes.normal.clone());
  g.setAttribute('color', new THREE.BufferAttribute(bakeTint(geo.attributes.color.array, geo.attributes.aVeg.array, tint), 3));
  g.setIndex(geo.index.clone());
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.name = name;
  return mesh;
}
export { SPECIES_KEYS, STYLES };
