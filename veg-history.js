/* veg-history.js — histórico de desfazer/refazer (sem three.js, sem DOM)
   Pilhas de comandos { label, apply(), revert(), bytes? } e remendos de máscaras:
   em vez de copiar o grid inteiro por passo, guarda só o retângulo que mudou. */

export class History {
  constructor({ limit = 60, maxBytes = 32 * 1024 * 1024, onChange } = {}) {
    this.limit = limit; this.maxBytes = maxBytes; this.onChange = onChange;
    this.undoStack = []; this.redoStack = [];
  }
  _emit() { if (this.onChange) this.onChange(this); }
  push(cmd) {
    this.undoStack.push(cmd); this.redoStack.length = 0;
    // descarta os mais antigos, mas sempre mantém ao menos o último
    while (this.undoStack.length > 1 && (this.undoStack.length > this.limit || this.bytes > this.maxBytes)) this.undoStack.shift();
    this._emit();
  }
  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.revert(); this.redoStack.push(cmd); this._emit();
    return cmd;
  }
  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.apply(); this.undoStack.push(cmd); this._emit();
    return cmd;
  }
  clear() { this.undoStack.length = 0; this.redoStack.length = 0; this._emit(); }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get undoLabel() { return this.canUndo ? this.undoStack[this.undoStack.length - 1].label : ''; }
  get redoLabel() { return this.canRedo ? this.redoStack[this.redoStack.length - 1].label : ''; }
  get bytes() {
    let b = 0;
    for (const c of this.undoStack) b += c.bytes || 0;
    for (const c of this.redoStack) b += c.bytes || 0;
    return b;
  }
}

/* ---------- remendos de máscaras (arrays n×n, índice j*n+i) ---------- */
export function snapshotLayers(layers) {
  const s = {};
  for (const k in layers) s[k] = layers[k].slice();
  return s;
}

export function makePatch(layers, before, rect, n) {
  const { i0, i1, j0, j1 } = rect, w = i1 - i0 + 1, h = j1 - j0 + 1;
  const pb = {}, pa = {}; let bytes = 0, any = false;
  for (const k in layers) {
    const cur = layers[k], old = before[k];
    let changed = false;
    for (let j = j0; j <= j1 && !changed; j++) {
      for (let idx = j * n + i0, e = j * n + i1; idx <= e; idx++) if (cur[idx] !== old[idx]) { changed = true; break; }
    }
    if (!changed) continue;
    const sb = new cur.constructor(w * h), sa = new cur.constructor(w * h);
    for (let j = 0; j < h; j++) {
      const o = (j0 + j) * n + i0;
      sb.set(old.subarray(o, o + w), j * w);
      sa.set(cur.subarray(o, o + w), j * w);
    }
    pb[k] = sb; pa[k] = sa; bytes += sb.byteLength + sa.byteLength; any = true;
  }
  return any ? { rect: { i0, i1, j0, j1 }, before: pb, after: pa, bytes } : null;
}

export function applyPatch(layers, patch, which, n) {
  const { i0, i1, j0, j1 } = patch.rect, w = i1 - i0 + 1, h = j1 - j0 + 1, subs = patch[which];
  for (const k in subs) {
    const dst = layers[k], src = subs[k];
    for (let j = 0; j < h; j++) dst.set(src.subarray(j * w, (j + 1) * w), (j0 + j) * n + i0);
  }
}
