import test from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, iconSVG } from '../veg-icons.js';

test('ícones convertidos: grade retangular e toda letra tem cor na paleta', () => {
  assert.ok(Object.keys(ICONS).length >= 70);
  for (const [name, d] of Object.entries(ICONS)) {
    const w = d.rows[0].length;
    assert.ok(w > 4 && d.rows.length > 4, name);
    d.rows.forEach((r, y) => {
      assert.equal(r.length, w, `${name} linha ${y}`);
      for (const ch of r) assert.ok(ch === '.' || ch in d.pal, `${name}: letra ${ch} sem cor`);
    });
    assert.ok(Object.values(d.pal).includes('ink'), `${name} tem contorno`);
  }
});

test('iconSVG usa a grade do ícone no viewBox, o contorno segue o tema e acusa nome errado', () => {
  const s = iconSVG('arvores'), d = ICONS.arvores;
  assert.ok(s.startsWith(`<svg class="px" viewBox="0 0 ${d.rows[0].length} ${d.rows.length}"`));
  assert.match(s, /var\(--icon-ink/);
  assert.throws(() => iconSVG('nao-existe'));
});
