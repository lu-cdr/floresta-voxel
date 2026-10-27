"""Converte as folhas de ícones do ChatGPT (design/chatgpt/folha-*.webp) em ícones pixel vetoriais.

Para cada folha: separa os ícones pelos vãos de fundo, descobre o tamanho do "pixel" de cada ícone
(o passo em que as bordas de cor caem), lê a cor no centro de cada pixel e grava:
  - design/icones/<nome>.svg  (um <path> por cor, só retângulos, crispEdges)
  - veg-icons-data.js          (as grades para o editor montar os SVGs, com a tinta escura seguindo o tema)
Uso: python -I design/extrair_icones.py   (na pasta vegetacao)
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from sklearn.cluster import KMeans

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

# ordem dos ícones em cada folha, linha por linha (igual aos prompts 1A–1F)
FOLHAS = {
    'folha-ferramentas.webp': ['camera', 'arvores', 'grama', 'solo', 'flora', 'agua', 'relevo', 'rochas', 'borracha', 'passear'],
    'folha-acoes.webp': ['desfazer', 'refazer', 'salvar', 'abrir', 'limpar', 'foto', 'sair', 'ajuda', 'atalhos', 'avancado'],
    'folha-ver-no-terreno.webp': ['olho', 'umidade', 'luz', 'fertilidade', 'declive', 'bom', 'escala', 'lupa'],
    'folha-pincel.webp': ['raio', 'forca', 'dureza', 'dado', 'adensar', 'apagarShift',
                          'carvalho', 'betula', 'cerejeira', 'pinheiro', 'arbusto', 'frutos',
                          'terra', 'areia', 'rocha', 'humus', 'rio', 'lago',
                          'cachoeira', 'subir', 'descer', 'nivelar', 'suavizar', 'original'],
    'folha-foto-passeio-contadores.webp': ['molduraSem', 'molduraPasse', 'molduraPolaroide', 'tamanho', 'legenda', 'baixar',
                                           'teclas', 'pular', 'correr', 'agachar', 'mira', 'mouse',
                                           'statArvores', 'statRochas', 'statPlantas', 'statGrama', 'fps', 'estacoes'],
    # folha 1G (ainda não gerada): entra sozinha quando o arquivo existir
    'folha-tempo-extras.webp': ['primavera', 'verao', 'outono', 'inverno', 'sol',
                                'lua', 'dia', 'semana', 'proxima', 'cores',
                                'criativo', 'ecossistema', 'pincel', 'fechar', 'check',
                                'seixo', 'pedra', 'matacao', 'afloramento', 'junco'],
}
# folhas apertadas em que raios do vizinho invadem a célula
CORTA_BORDA = {'folha-tempo-extras.webp'}
# linhas × colunas de cada folha (os ícones ficam em células iguais)
GRADE = {'folha-ferramentas.webp': (2, 5), 'folha-acoes.webp': (2, 5), 'folha-ver-no-terreno.webp': (2, 4),
         'folha-pincel.webp': (4, 6), 'folha-foto-passeio-contadores.webp': (3, 6), 'folha-tempo-extras.webp': (4, 5)}
INK_MAX_LUM = 70      # abaixo disso a cor vira a tinta do tema
TERRACOTA = np.array([181, 98, 58])


def fundo(im):
    c = np.concatenate([im[:8, :8].reshape(-1, 3), im[:8, -8:].reshape(-1, 3), im[-8:, :8].reshape(-1, 3), im[-8:, -8:].reshape(-1, 3)])
    return np.median(c, 0)


def recortes_grade(im, bg, nl, nc, corta_borda=False):
    """caixa justa do desenho dentro de cada célula da grade (ignora sujeira pequena)."""
    mask = np.abs(im.astype(int) - bg).sum(2) > 60
    mask = ndimage.binary_opening(mask, iterations=1)
    H, W = mask.shape
    caixas = []
    for j in range(nl):
        for i in range(nc):
            y0, y1, x0, x1 = j * H // nl, (j + 1) * H // nl, i * W // nc, (i + 1) * W // nc
            sub = mask[y0:y1, x0:x1].copy()
            lab, k = ndimage.label(sub)
            if k:
                tam = ndimage.sum(sub, lab, range(1, k + 1))
                # fora: sujeira pequena e pedaços que encostam na borda da célula (vizinho invadindo)
                borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
                maior = int(np.argmax(tam)) + 1  # o desenho principal fica mesmo se encostar
                ok = [i + 1 for i in range(k) if i + 1 == maior or (tam[i] >= 30 and not (corta_borda and (i + 1) in borda))]
                sub = np.isin(lab, ok)
            ys, xs = np.nonzero(sub)
            caixas.append((y0 + ys.min(), y0 + ys.max() + 1, x0 + xs.min(), x0 + xs.max() + 1))
    return caixas


def recortes(im, bg, n, dil=18):
    """caixas dos ícones: máscara de não-fundo, um pouco dilatada para juntar as partes de cada ícone."""
    mask = np.abs(im.astype(int) - bg).sum(2) > 60
    mask = ndimage.binary_opening(mask, iterations=1)
    lab, k = ndimage.label(ndimage.binary_dilation(mask, iterations=dil))
    caixas = []
    for sl in ndimage.find_objects(lab):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        sub = mask[y0:y1, x0:x1]
        if sub.sum() < 400: continue
        ys, xs = np.nonzero(sub)
        caixas.append((y0 + ys.min(), y0 + ys.max() + 1, x0 + xs.min(), x0 + xs.max() + 1))
    if len(caixas) != n:
        raise SystemExit(f'esperava {n} ícones, achei {len(caixas)}: ajuste a dilatação')
    # ordena em linhas (agrupa por centro vertical) e depois da esquerda para a direita
    caixas.sort(key=lambda c: (c[0] + c[1]) / 2)
    linhas, atual = [], [caixas[0]]
    for c in caixas[1:]:
        if (c[0] + c[1]) / 2 - (atual[-1][0] + atual[-1][1]) / 2 > (c[1] - c[0]) * .5: linhas.append(atual); atual = [c]
        else: atual.append(c)
    linhas.append(atual)
    return [c for l in linhas for c in sorted(l, key=lambda c: c[2])]


def passo(cls):
    """tamanho do pixel: o maior passo em que as trocas de cor caem perto de múltiplos dele."""
    trocas = []
    for eixo in (0, 1):
        d = np.diff(cls, axis=eixo) != 0
        pos = np.nonzero(d)[eixo] + 1
        trocas.append(pos)
    melhor = None
    for u in np.arange(5, 40, .25):
        erros = []
        for pos in trocas:
            if len(pos) < 10: continue
            fase = np.angle(np.exp(2j * np.pi * pos / u).mean()) / (2 * np.pi) * u  # deslocamento da grade
            r = np.mod(pos - fase, u); r = np.minimum(r, u - r)
            erros.append(r.mean() / u)
        if not erros: continue
        e = np.mean(erros)
        if e < .085: melhor = u  # o maior que ainda encaixa bem
    return melhor or 10.0


def converte(img, caixa, bg):
    y0, y1, x0, x1 = caixa
    pad = 6
    crop = img[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad].astype(int)
    px = crop.reshape(-1, 3)
    fg = np.abs(px - bg).sum(1) > 60
    k = min(6, max(2, len(np.unique(px[fg] // 24, axis=0)) // 40 + 2))
    km = KMeans(n_clusters=k, n_init=4, random_state=0).fit(px[fg])
    cores = np.vstack([bg, km.cluster_centers_])
    dist = ((crop[:, :, None, :] - cores[None, None]) ** 2).sum(3)
    cls = dist.argmin(2)
    u = passo(cls)
    # fase da grade: alinha pelo canto da caixa sem margem
    h, w = cls.shape
    ny, nx = int(round((h - 2 * pad) / u)), int(round((w - 2 * pad) / u))
    oy, ox = pad + ((h - 2 * pad) - ny * u) / 2, pad + ((w - 2 * pad) - nx * u) / 2
    grade = np.zeros((ny, nx), int)
    for j in range(ny):
        for i in range(nx):
            a, b = int(oy + (j + .3) * u), int(oy + (j + .7) * u) + 1
            c, d = int(ox + (i + .3) * u), int(ox + (i + .7) * u) + 1
            v = np.bincount(cls[a:b, c:d].ravel(), minlength=len(cores))
            grade[j, i] = v.argmax()
    return grade, cores, u


def hexa(c): return '#%02x%02x%02x' % tuple(int(round(x)) for x in c)


def main():
    saida = os.path.join(AQUI, 'icones'); os.makedirs(saida, exist_ok=True)
    dados, relato = {}, []
    for arq, nomes in FOLHAS.items():
        if not os.path.exists(os.path.join(AQUI, 'chatgpt', arq)):
            relato.append(f'(sem {arq} ainda)'); continue
        img = np.array(Image.open(os.path.join(AQUI, 'chatgpt', arq)).convert('RGB'))
        bg = fundo(img)
        for nome, caixa in zip(nomes, recortes_grade(img, bg, *GRADE[arq], corta_borda=arq in CORTA_BORDA)):
            grade, cores, u = converte(img, caixa, bg)
            letras = 'abcdefghij'
            pal, linhas = {}, []
            for idx in range(1, len(cores)):
                c = cores[idx]
                lum = .299 * c[0] + .587 * c[1] + .114 * c[2]
                pal[letras[idx]] = 'ink' if lum < INK_MAX_LUM else ('#b5623a' if np.abs(c - TERRACOTA).sum() < 70 else hexa(c))
            for row in grade:
                linhas.append(''.join('.' if v == 0 else letras[v] for v in row))
            # corta linhas/colunas vazias da borda
            while linhas and set(linhas[0]) == {'.'}: linhas.pop(0)
            while linhas and set(linhas[-1]) == {'.'}: linhas.pop()
            esq = min(len(l) - len(l.lstrip('.')) for l in linhas); dir_ = min(len(l) - len(l.rstrip('.')) for l in linhas)
            linhas = [l[esq:len(l) - dir_] for l in linhas]
            dados[nome] = {'pal': pal, 'rows': linhas}
            relato.append(f'{nome:18s} {len(linhas[0]):3d}x{len(linhas):<3d} pixel~{u:5.2f}px  cores={len(pal)}')
            with open(os.path.join(saida, nome + '.svg'), 'w', encoding='utf-8') as f:
                f.write(svg(dados[nome], '#2a2420'))
    with open(os.path.join(RAIZ, 'veg-icons-data.js'), 'w', encoding='utf-8') as f:
        f.write('/* gerado por design/extrair_icones.py a partir das folhas do ChatGPT — não editar à mão.\n'
                '   pal: letra → cor ("ink" = contorno que segue o tema); rows: grade, "." = transparente */\n')
        f.write('export const ICON_DATA = ' + json.dumps(dados, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('\n'.join(relato))


def svg(d, ink):
    rows = d['rows']; h, w = len(rows), len(rows[0])
    paths = {}
    for y, r in enumerate(rows):
        x = 0
        while x < w:
            ch, e = r[x], x + 1
            while e < w and r[e] == ch: e += 1
            if ch != '.': paths.setdefault(ch, []).append(f'M{x} {y}h{e - x}v1h{x - e}z')
            x = e
    body = ''.join(f'<path fill="{ink if d["pal"][ch] == "ink" else d["pal"][ch]}" d="{"".join(p)}"/>' for ch, p in paths.items())
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">{body}</svg>\n'


if __name__ == '__main__':
    main()
