/* veg-icons.js — ícones pixel da interface, vindos das folhas geradas no ChatGPT (design/chatgpt/folha-*.webp)
   e convertidos por design/extrair_icones.py em veg-icons-data.js. Aqui só se monta o <svg>:
   iconSVG(nome) devolve o desenho (um <path> por cor, só retângulos, crispEdges) e
   hydrateIcons(raiz) troca todo <i data-icon="nome"> por ele. A cor "ink" (contorno) segue o tema
   pela variável CSS --icon-ink; as demais são as cores da folha. Sem three e sem dependências. */
import { ICON_DATA } from './veg-icons-data.js';

export const ICONS = ICON_DATA;
const INK = 'var(--icon-ink, #2a2420)';
const cache = new Map();

export function iconSVG(name, { label = '' } = {}) {
  if (cache.has(name)) return cache.get(name);
  const d = ICON_DATA[name];
  if (!d) throw new Error('ícone desconhecido: ' + name);
  const h = d.rows.length, w = d.rows[0].length, paths = {};
  d.rows.forEach((row, y) => {
    for (let x = 0; x < w;) {
      const ch = row[x];
      let e = x + 1;
      while (e < w && row[e] === ch) e++;
      if (ch !== '.') (paths[ch] ||= []).push(`M${x} ${y}h${e - x}v1h${x - e}z`);
      x = e;
    }
  });
  const body = Object.entries(paths).map(([ch, p]) => `<path fill="${d.pal[ch] === 'ink' ? INK : d.pal[ch]}" d="${p.join('')}"/>`).join('');
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const svg = `<svg class="px" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" ${a11y}>${body}</svg>`;
  cache.set(name, svg);
  return svg;
}
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('i[data-icon]')) el.outerHTML = iconSVG(el.dataset.icon);
}
