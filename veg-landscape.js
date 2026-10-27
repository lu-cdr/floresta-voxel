/* veg-landscape.js — no celular o jogo só roda deitado, para o layout ser o mesmo do computador.
   Em pé, cobre a tela com um aviso para girar; onde o navegador deixa (Android), o botão
   entra em tela cheia e trava na horizontal. Tablets e computador não são afetados. */
const CSS = `
.rotate {
  display: none; position: fixed; inset: 0; z-index: 50; place-content: center; justify-items: center; gap: 14px;
  padding: 24px; text-align: center; background: var(--bg); color: var(--ink);
  font: 500 14px/1.45 "Instrument Sans", system-ui, sans-serif;
}
@media (orientation: portrait) and (pointer: coarse) and (max-width: 600px) { .rotate { display: grid; } }
.rotate strong { font: 400 18px/1.2 "Silkscreen", monospace; letter-spacing: .04em; }
.rotate p { margin: 0; max-width: 28ch; color: var(--muted); }
.rotate svg { width: 72px; height: 72px; color: var(--accent); animation: rotate-hint 2.4s ease-in-out infinite; }
.rotate button {
  font: 600 13px "Instrument Sans", system-ui, sans-serif; color: var(--ink); background: var(--panel);
  border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; cursor: pointer;
}
.rotate button[hidden] { display: none; }
@keyframes rotate-hint { 0%, 25% { transform: rotate(0); } 55%, 85% { transform: rotate(-90deg); } 100% { transform: rotate(0); } }
@media (prefers-reduced-motion: reduce) { .rotate svg { animation: none; transform: rotate(-90deg); } }
`;

export function landscapeOnly() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const el = document.createElement('div');
  el.className = 'rotate';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>
    </svg>
    <strong>Gire o celular</strong>
    <p>A Floresta Voxel é jogada com o celular deitado.</p>
    <button type="button">Tela cheia na horizontal</button>`;
  const btn = el.querySelector('button');
  // trava de orientação só existe em tela cheia (Android); no iPhone fica só o aviso
  btn.hidden = !document.documentElement.requestFullscreen || !screen.orientation?.lock;
  btn.addEventListener('click', async () => {
    try {
      await document.documentElement.requestFullscreen();
      await screen.orientation.lock('landscape');
    } catch { btn.hidden = true; }
  });
  document.body.append(el);
}
