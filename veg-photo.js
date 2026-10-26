// Modo foto: captura a cena em PNG de alta resolução, com moldura e legenda opcionais.
// Sem dependências (o three é passado pelo chamador).

const COR = { papel: '#fbf8f2', polaroide: '#fffdf8', tinta: '#29251f', suave: '#6c6455', linha: '#dcd2c1' };
const FONTE_TXT = '"Instrument Sans", system-ui, sans-serif';
const FONTE_TIT = '"Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif';

// Tamanho lógico (px CSS) do canvas, sem depender de three.
function tamanho(renderer) {
  const t = { w: 0, h: 0, set(w, h) { this.w = w; this.h = h; } };
  renderer.getSize(t);
  return { w: t.w, h: t.h };
}

// Maior escala inteira (1..4) que cabe nos limites da GPU para o canvas atual.
export function maxPhotoScale(renderer) {
  const gl = renderer.getContext();
  const lim = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const { w, h } = tamanho(renderer);
  return Math.max(1, Math.min(4, Math.floor(lim / Math.max(w, h, 1))));
}

// 'floresta-voxel-2026-10-26-1005.png' (data/hora local)
export function photoFileName(meta, date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `floresta-voxel-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.png`;
}

// Desenha título + linhas; reduz a fonte se passar de maxW. Devolve a altura usada.
function desenharTexto(ctx, meta, x, y, u, maxW, { escala = 1, align = 'left', cor = COR.tinta, corSec = COR.suave } = {}) {
  const linhas = (meta.lines || []).filter(Boolean);
  let fT = 0.03 * u * escala, fL = 0.02 * u * escala;
  const medir = () => {
    let m = 0;
    ctx.font = `700 ${fT}px ${FONTE_TIT}`;
    if (meta.title) m = ctx.measureText(meta.title).width;
    ctx.font = `500 ${fL}px ${FONTE_TXT}`;
    for (const l of linhas) m = Math.max(m, ctx.measureText(l).width);
    return m;
  };
  const larg = medir();
  if (larg > maxW) { const k = maxW / larg; fT *= k; fL *= k; }
  ctx.textAlign = align; ctx.textBaseline = 'top';
  let cy = y;
  if (meta.title) {
    ctx.font = `700 ${fT}px ${FONTE_TIT}`; ctx.fillStyle = cor;
    ctx.fillText(meta.title, x, cy); cy += fT * 1.35;
  }
  ctx.font = `500 ${fL}px ${FONTE_TXT}`; ctx.fillStyle = corSec;
  for (const l of linhas) { ctx.fillText(l, x, cy); cy += fL * 1.45; }
  return cy - y;
}

function caminhoArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Renderiza em escala maior, compõe moldura/legenda num canvas 2D e devolve um PNG.
export async function capturePhoto({ renderer, scene, camera, scale = 2, frame = 'nenhuma', meta = null }) {
  const canvas = renderer.domElement;
  const { w, h } = tamanho(renderer);
  const pr = renderer.getPixelRatio();
  const aspecto = camera.aspect;
  const s = Math.max(1, Math.min(Math.round(scale), maxPhotoScale(renderer)));
  const W = w * s, H = h * s, u = Math.min(W, H);
  const temMeta = !!(meta && (meta.title || (meta.lines && meta.lines.length)));

  // Fontes prontas antes de qualquer desenho de texto.
  try {
    await Promise.all([`700 20px ${FONTE_TIT}`, `500 20px ${FONTE_TXT}`].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch (e) { /* segue com fonte de reserva */ }

  let foto; // canvas 2D só com a cena
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    if (camera.isPerspectiveCamera) { camera.aspect = W / H; camera.updateProjectionMatrix(); }
    renderer.render(scene, camera);
    // Copia logo após o render, na mesma tarefa (sem preserveDrawingBuffer).
    foto = document.createElement('canvas');
    foto.width = W; foto.height = H;
    foto.getContext('2d').drawImage(canvas, 0, 0);
  } finally {
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    if (camera.isPerspectiveCamera) { camera.aspect = aspecto; camera.updateProjectionMatrix(); }
  }

  // Margens por moldura.
  let mT = 0, mL = 0, mB = 0;
  if (frame === 'passe-partout') { mT = mL = 0.06 * u; mB = mT + (temMeta ? 0.15 * u : 0); }
  else if (frame === 'polaroide') { mT = mL = 0.045 * u; mB = temMeta ? 0.2 * u : 0.1 * u; }
  const OW = Math.round(W + 2 * mL), OH = Math.round(H + mT + mB);

  const out = document.createElement('canvas');
  out.width = OW; out.height = OH;
  const ctx = out.getContext('2d');

  if (frame === 'passe-partout' || frame === 'polaroide') {
    ctx.fillStyle = frame === 'polaroide' ? COR.polaroide : COR.papel;
    ctx.fillRect(0, 0, OW, OH);
    if (frame === 'passe-partout') {
      // Foto com cantos levemente arredondados e sombra suave.
      const r = 0.006 * u;
      ctx.save();
      ctx.shadowColor = 'rgba(41,37,31,.28)'; ctx.shadowBlur = 0.03 * u; ctx.shadowOffsetY = 0.008 * u;
      ctx.fillStyle = '#000'; caminhoArredondado(ctx, mL, mT, W, H, r); ctx.fill();
      ctx.restore();
      ctx.save(); caminhoArredondado(ctx, mL, mT, W, H, r); ctx.clip();
      ctx.drawImage(foto, mL, mT); ctx.restore();
      ctx.strokeStyle = COR.linha; ctx.lineWidth = Math.max(1, 0.001 * u);
      caminhoArredondado(ctx, mL, mT, W, H, r); ctx.stroke();
    } else {
      ctx.drawImage(foto, mL, mT);
      // Leve contorno interno, como a borda de uma foto instantânea.
      ctx.strokeStyle = 'rgba(41,37,31,.18)'; ctx.lineWidth = Math.max(1, 0.0015 * u);
      ctx.strokeRect(mL, mT, W, H);
    }
    if (temMeta) {
      const topo = mT + H + (frame === 'polaroide' ? 0.03 * u : 0.035 * u);
      if (frame === 'polaroide') desenharTexto(ctx, meta, OW / 2, topo, u, OW - 2 * mL, { align: 'center' });
      else desenharTexto(ctx, meta, mL, topo, u, W);
    }
  } else {
    ctx.drawImage(foto, 0, 0);
    if (temMeta) {
      // Cartão pequeno no canto inferior esquerdo.
      const esc = 0.8, pad = 0.014 * u, off = 0.02 * u;
      const maxW = Math.min(W * 0.6, 0.5 * u);
      const tmp = document.createElement('canvas').getContext('2d');
      const alt = desenharTexto(tmp, meta, 0, 0, u, maxW - 2 * pad, { escala: esc });
      // Largura real do texto para ajustar o cartão.
      let lw = 0;
      tmp.font = `700 ${0.03 * u * esc}px ${FONTE_TIT}`; if (meta.title) lw = tmp.measureText(meta.title).width;
      tmp.font = `500 ${0.02 * u * esc}px ${FONTE_TXT}`;
      for (const l of meta.lines || []) lw = Math.max(lw, tmp.measureText(l).width);
      const cw = Math.min(maxW, lw + 2 * pad), ch = alt + 2 * pad;
      ctx.save();
      ctx.shadowColor = 'rgba(41,37,31,.3)'; ctx.shadowBlur = 0.012 * u; ctx.shadowOffsetY = 0.003 * u;
      ctx.fillStyle = 'rgba(251,248,242,.92)';
      caminhoArredondado(ctx, off, H - off - ch, cw, ch, 0.008 * u); ctx.fill();
      ctx.restore();
      desenharTexto(ctx, meta, off + pad, H - off - ch + pad, u, cw - 2 * pad, { escala: esc });
    }
  }

  const blob = await new Promise((ok, falha) =>
    out.toBlob((b) => (b ? ok(b) : falha(new Error('toBlob falhou'))), 'image/png'));
  return { blob, width: OW, height: OH, scale: s };
}
