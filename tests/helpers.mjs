// Monta o mesmo contexto de scatter que o VegWorld, sem three.js.
import { sampleField } from '../veg-core.js';

export function makeWorld(P, { treeMask, speciesMask } = {}) {
  const size = P.size, res = 2, n = size * res, h = size / 2;
  treeMask ??= new Float32Array(n * n).fill(1);
  speciesMask ??= new Int8Array(n * n).fill(-1);
  const heights = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const v = sampleField(P.terrain.field, i - h + .5, j - h + .5);
    heights[j * size + i] = Math.round(v * P.terrain.amp / P.terrain.step) * P.terrain.step;
  }
  const maskIndex = (x, z) => {
    const i = Math.floor((x + h) * res), j = Math.floor((z + h) * res);
    return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
  };
  const heightAt = (x, z) => {
    const i = Math.min(size - 1, Math.max(0, Math.floor(x + h))), j = Math.min(size - 1, Math.max(0, Math.floor(z + h)));
    return heights[j * size + i];
  };
  return {
    n, treeMask, speciesMask,
    cfg: {
      size, seed: P.seed, fields: P.fields, p: P.trees, heightAt,
      maskAt: (x, z) => { const k = maskIndex(x, z); return k < 0 ? 0 : treeMask[k]; },
      speciesMaskAt: (x, z) => { const k = maskIndex(x, z); return k < 0 ? -1 : speciesMask[k]; },
      slopeAt: (x, z) => { const y = heightAt(x, z); return Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => Math.abs(heightAt(x + a, z + b) - y))); },
    },
  };
}
