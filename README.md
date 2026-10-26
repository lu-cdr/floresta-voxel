# Vegetação procedural voxel (gamedev)

Kit em `C:\Browser Games\vegetacao`, derivado do gerador ICQR (skill `qr-voxel`, acervo em `C:\Sites claude\Efeitos reels`): mesma árvore voxel
(tronco → galhos que caminham subindo → copa em blobs recortados por ruído), agora sem a
máscara do QR e com ruído Perlin decidindo tudo o que varia de uma árvore para outra.

| Arquivo | Para quê |
|---|---|
| `veg-core.js` | Núcleo sem three.js: Perlin 2D/3D, campos fbm, 5 espécies, mesher voxel com AO, scatter de árvores e grama, estilos. Dá pra portar para GDScript. |
| `veg-render.js` | `VegWorld` em three.js: terreno em blocos, árvores instanciadas por variante, grama em chunks, shader de vento/tint/empurrão, salvar/carregar. |
| `floresta.html` | Editor: pincel de floresta, menu de debug (lil-gui) com todos os parâmetros, exportação. |
| `exemplo-jogo.html` | Runtime mínimo para jogo de browser: carrega o projeto, terceira pessoa, colisão com troncos, a grama abre passagem. |

Abrir: `python -m http.server 8767` nesta pasta → `http://localhost:8767/floresta.html`.

## Ruído Perlin: um campo por propriedade

Cada propriedade é um campo fbm independente (semente, frequência, oitavas, lacunaridade,
ganho, contraste, viés, deslocamento, inverter), editável no menu "Ruído Perlin (campos)":

- **Densidade**: máscara pintada × campo decide se um candidato nasce. `corte de densidade` e `peso do ruído` controlam quanto o ruído manda.
- **Espaçamento**: raio mínimo entre árvores varia entre `espaçamento mín` e `máx` → mata fechada num lugar, árvores soltas noutro. Dois vizinhos usam a média dos raios.
- **Espécie**: o valor do campo percorre os pesos acumulados da mistura → manchas da mesma espécie, com `acaso na espécie` borrando as fronteiras. O pincel pode forçar uma espécie.
- **Tamanho**: escala da instância entre `tamanho mín/máx` + acaso.
- **Formato**: escolhe o "balde" de formato da espécie (t ∈ [0,1] interpola cada parâmetro `[mín, máx]`: altura, copa, galhos, achatamento, buracos, inclinação…).
- **Cor**: deslocamento HSV aplicado só nas folhas, no shader (matiz/saturação/brilho ±).
- **Grama**: campos próprios de densidade e altura.

Truque de estabilidade: cada candidato tira seus números de `hash3(célula, semente)`, não de
uma sequência. Pintar num canto não embaralha a floresta do outro lado, e o mesmo projeto
sempre gera a mesma floresta.

## Variantes em vez de uma malha por árvore

Gerar uma malha única por árvore não escala. Cada árvore usa a chave
`espécie:formato:variante` (ex.: 5 espécies × 4 formatos × 3 variantes = 60 malhas). Cada
chave vira uma `InstancedMesh`; tamanho, rotação e cor vêm por instância. As variantes são
geradas numa fila, até ~24 ms por quadro, então a floresta "brota" sem travar. Um carvalho
médio: ~1.900 voxels → ~3.400 triângulos, ~20 ms para gerar.

## Mesher voxel

Só faces cujo vizinho está vazio. Oclusão de ambiente por vértice (lado1, lado2, canto →
4 níveis), com a diagonal do quad virada conforme o AO para não dar listras. Atributo
`aVeg = (é folha, peso do vento)`: folhas balançam com a altura, galhos pouco, tronco nada.

## Shader (patch no MeshLambertMaterial via onBeforeCompile)

- Vento: fase pela posição da raiz da instância + rajada de baixa frequência. O deslocamento é calculado em mundo e convertido para o espaço local (`transpose(M) * d / s²`), então a direção do vento é a mesma para árvores giradas.
- Tint HSV por instância (`iTint`) só onde `aVeg.x = 1`.
- Grama: degradê base→ponta por altura + `uPush` (cursor no editor, jogador no jogo) empurra as lâminas para fora.
- `customDepthMaterial` com o mesmo patch: as sombras balançam junto.

## Estilo = design document

Um estilo é um JSON: `voxel`, `snow`, cores de céu/névoa/luz, `terrain` (low/mid/high/cliff/grass/litter), `grass` (base/tip) e `species.<nome>` (`leaves[]`, `wood`, `wood2` para listras de bétula, `flowers[]`). Predefinidos: Outono ICQR, Primavera, Verão denso, Inverno (neve no topo exposto das copas). Abrir/salvar pelo menu "Estilo".

## Exportação

- **Projeto .json** (`format: "veg-forest"`): todos os parâmetros, estilo, máscaras pintadas (base64) e `baked.trees` com posição, rotação, escala, variante e tint de cada árvore. É o formato para levar ao Godot.
- **Árvore .glb**: uma espécie/formato/variante, cor de vértice, sem atributos do shader.
- **Biblioteca .glb**: todas as variantes em uso, um nó por chave (`carvalho_2_1`).
- **Cena .glb**: terreno + árvores fundidas por espécie com a cor assada (limite de 6 mi de vértices; acima disso, use biblioteca + projeto).

## Godot (próximo passo)

Godot 4.7.2 em `C:\Godot\Godot.exe`. Caminho previsto: portar `veg-core.js` para GDScript
(mesmo hash e Perlin para a mesma semente dar a mesma floresta), `MultiMeshInstance3D` por
variante, shader de vento equivalente e importador do projeto .json.
