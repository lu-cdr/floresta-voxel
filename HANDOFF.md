# Handoff — Floresta Voxel (vegetação procedural)

Estado em 2026-10-26. Continuação da sessão que começou no acervo `C:\Sites claude\Efeitos reels`.

## O que é

Kit de vegetação procedural em voxel para gamedev, derivado da árvore do gerador de QR
voxel ICQR (`C:\Sites claude\Efeitos reels\icqr.html`, skill `qr-voxel`): tronco, galhos
que caminham subindo e copa em blobs recortados por ruído. Aqui sem a máscara do QR, com
ruído Perlin controlando espaçamento, espécie, tamanho, formato e cor, pincel para pintar
florestas inteiras e menu de debug. Detalhes técnicos completos em `README.md`.

## Arquivos

| Arquivo | Papel |
|---|---|
| `veg-core.js` | Núcleo sem three.js: `rng`, `hash3`, Perlin 2D/3D, `sampleField` (fbm configurável), `SPECIES` (5), `STYLES` (4), `genTreeVoxels`, `meshVoxels` (faces visíveis + AO), `scatterTrees`, `scatterGrass`. |
| `veg-render.js` | `VegWorld` (three 0.160): terreno em blocos, máscaras pintadas, árvores em `InstancedMesh` por variante (`espécie:formato:variante`, geradas numa fila ~24 ms/quadro), grama em chunks 16×16, shader de vento/tint HSV/empurrão (`uPush`), `toJSON`, export assado (`bakedTreeMesh`). |
| `floresta.html` | Editor: ferramentas Câmera/Árvores/Grama/Borracha (C, 1, 2, E; `[` `]` raio; Shift apaga), lil-gui 0.19.2 com todos os parâmetros, visualização de campo no terreno, estilos, export (projeto .json, árvore .glb, biblioteca .glb, cena .glb). Autosave em `localStorage['floresta-voxel:projeto']`. `window.__world` para depurar. |
| `exemplo-jogo.html` | Runtime mínimo: terceira pessoa (WASD/Shift/toque), colisão com troncos, grama abre em volta do jogador, carrega o projeto do editor (mesmo localStorage) ou um .json. |
| `.claude/launch.json` | Servidor `vegetacao`: `python -m http.server 8767` nesta pasta. |
| `tests/` | `npm test` (= `node --test "tests/*.test.mjs"`): determinismo do núcleo, localidade do scatter, migração v1→v2. `fixtures/projeto-v1.json` é um projeto salvo no formato antigo. |

## Roadmap em execução

Plano aprovado em 2026-10-26: Incremento 0 (fundação) → Marco 1 do GDD em 7 incrementos (desfazer, estações, solo/umidade, estágios, sub-bosque, modo foto, painel "Criar") → porte Godot → Marcos 2 e 3. Um commit por incremento; parar para aprovação a cada um. Método em `OPUS_ORCHESTRATION.md`.

### Incremento 0 — Fundação (2026-10-26)

1. **Entrega:** repositório git; projeto versionado (`format: 'veg-forest'`, `version: 2`) com `migrateProject()`; editor e runtime abrem projetos antigos pela migração (antes era merge raso, que perderia campos aninhados novos).
2. **Arquivos:** `defaultProject`, `migrateProject`, `PROJECT_VERSION` agora em `veg-core.js` (re-exportados por `veg-render.js`). v2 adiciona `ecology: { mode, tick, season, dayTime, seasonLen, plants }` e `photo: { frame, showMeta }`, ainda sem uso. Estilo incompleto é completado pelo preset de mesmo nome (`styleName`). `baked` é descartado ao abrir. Versão maior que a suportada → erro legível.
3. **TIGHT:** Tempo — migração roda só ao carregar (~ms). Integridade — testes de idempotência, de entrada intocada e de v1 sem perda. Game feel — erro de arquivo agora diz o motivo no editor e no runtime. Harmonia — sem mudança visual. Testes — 8 em `npm test`.
4. **Verificação:** `npm test` 8/8. Navegador (8767): editor sem erros (só o favicon 404, que já existia), 615 árvores / 165 fps; fixture v1 colocada no autosave → recarrega com seed 777, 378 árvores, canto de pinheiros pintado mantido; `exemplo-jogo.html` carrega o mesmo projeto.
5. **Riscos/continuação:** o jogador do runtime nasce em (0,0) mesmo se houver árvore ali (já era assim). Próximo: Incremento 1, desfazer/refazer.

### Incremento 1 — Desfazer/refazer (2026-10-26)

1. **Entrega:** cada traço de pincel (árvores, grama, borracha, Shift) e as ações "Preencher tudo"/"Limpar tudo" podem ser desfeitos e refeitos com os botões ↶/↷ do painel, Ctrl+Z, Ctrl+Shift+Z ou Ctrl+Y. A linha de status diz "Desfeito: borracha" etc.; o botão mostra no título o que vai desfazer.
2. **Arquivos:** `veg-history.js` novo (trilha Sonnet): `History` (60 passos / 32 MB) e remendos `snapshotLayers`/`makePatch`/`applyPatch`, que guardam só o retângulo e só as camadas que mudaram. `VegWorld.maskLayers()`, `maskRect(bounds)`, `bounds`. Em `floresta.html`: `maskCommand`, `maskAction`, traço com snapshot no `pointerdown` e comando no fim (inclusive quando um segundo dedo vira gesto de câmera). **Convenção nova:** toda ferramenta que muda máscaras passa por `maskCommand`/`maskAction`. Trocar tamanho do mapa ou abrir projeto zera o histórico e avisa. Histórico não é salvo (só na sessão).
3. **TIGHT:** Tempo — aplicar o remendo do mapa inteiro leva 0,2 ms; o pior quadro depois é 12 ms (a reconstrução já existente da grama/árvores); desfazer só refaz a área tocada. Integridade — máscaras e contagens voltam exatamente (soma ponderada das máscaras idêntica; 615→590→615 árvores). Game feel — botões desabilitados quando não há o que fazer, mensagem de causa, atalho no rodapé. Harmonia — mesmos chips do painel; em 375 px ficam numa linha de dois. Testes — 9 testes novos em `tests/history.test.mjs` (17 no total).
4. **Verificação:** `npm test` 17/17. Navegador (Playwright, 8767): traço de borracha → Ctrl+Z → Ctrl+Shift+Z → Ctrl+Y (vazio) → "Limpar tudo" → botão Desfazer; estado idêntico em cada volta; console só com o favicon 404.
5. **Riscos/continuação:** mudanças de parâmetros do menu Avançado (semente, campos, relevo) ainda não entram no histórico — não alteram máscaras, mas mudam o mundo. Camadas novas (solo, no Incremento 3) só precisam entrar em `maskLayers()`. Próximo: Incremento 2, relógio e estações.

### Incremento 2 — Relógio e estações (2026-10-26)

1. **Entrega:** barra de tempo embaixo no centro: estação + dia (+ ano a partir do 2º), cor-amostra da estação, slider de hora (luz do sol, entardecer quente, noite com lua), "+1 dia", "+1 semana", "Próxima estação" e "Cores da estação". Com a caixa marcada, a floresta passa por Primavera → Verão → Outono → Inverno (presets), misturando com a próxima nos últimos ~30% da estação; avisa "Chegou o Inverno.". Avançar o tempo entra no histórico (Ctrl+Z volta a estação). Hora e dia persistem no autosave; o runtime usa a mesma hora.
2. **Arquivos/contratos:** `veg-core.js` (trilha Sonnet): `SEASONS`, `seasonAt`, `blendStyle`, `seasonStyle`, `lightAt`, `colorTree` (genTreeVoxels = geometria + colorTree, saída idêntica — checksums golden em `tests/seasons.test.mjs`), `rng().state()`. **`ecology` mudou:** `{ mode, tick (dias; 24 = 1º dia do outono), dayTime, seasonLen, seasonal, plants }` — sem `season` (derivada de tick). Migração: v1 → `seasonal: false` e estação do `styleName`; v2 inicial com `season` → convertido. `VegWorld.setStyle`: mesmo voxel → fila `recolorQueue` (12 ms/quadro) que recolore as variantes no lugar; voxel diferente → regenera. Escolher estilo/paleta à mão desmarca "Cores da estação". `buildGui` agora preserva pastas abertas e rolagem. Luz: `view.sunAz` virou "orientação", elevação vem da hora.
3. **TIGHT:** Tempo — troca de estação sem refazer geometria (mesmos objetos de geometria antes/depois); colorTree+mesh ≈ 2× mais barato que gerar; pior quadro da troca 37–42 ms (um quadro: terreno 13 ms + GUI + fila), depois ~0,3 s a 18 ms; corrigidos: terreno recolorido 2× e hex da neve convertido por bloco. Integridade — golden idênticos, recolorir ida e volta reproduz exatamente; reload mantém estação/hora; v1 abre com as cores dele. Game feel — mensagem de chegada da estação, desfazer funciona com foco no slider. Harmonia — mesmos chips/tokens; em 375 px a barra quebra em duas linhas; menu debug termina acima da barra. Testes — 26 em `npm test`.
4. **Verificação:** `npm test` 26/26. Navegador (Playwright, 8767): Outono → Inverno → Primavera, Ctrl+Z com foco no slider, noite 19:41, reload, 375 px, `exemplo-jogo.html` com o projeto salvo; console só com o favicon 404.
5. **Riscos/continuação:** o seletor "modo" (criativo/ecossistema) ainda não tem controle — entra no Incremento 4, quando muda algo. A troca de estação refaz o menu debug (custo de um quadro). Na troca sol→lua o azimute salta (intensidade 0 nesse instante). Menu debug aberto em celular cobre o painel (comportamento antigo; resolve no Incremento 7). Próximo: Incremento 3, solo + umidade + overlays.

Abrir: preview `vegetacao` → `http://localhost:8767/floresta.html`.

## Verificado

- Editor carrega sem erros no console; ~615 árvores + ~110 mil lâminas a ~165 fps (painel do app).
- Borracha abre clareira (carimbos interpolados no traço); visualização de campo funciona com árvores/grama escondidas.
- Export GLB testado por script (carvalho: 1.887 voxels → 3.420 tris, 262 KB, ~21 ms). **Os botões de download não foram clicados** — falta confirmar que os arquivos baixam e abrem (ex.: no Blender ou no Godot).
- `exemplo-jogo.html` roda: anda, colide, empurra a grama.

## Decisões já tomadas (não refazer)

- Projeto mora em `C:\Browser Games\vegetacao`; jogos de browser vão em `C:\Browser Games`, não no acervo.
- Visual da interface segue a família do ICQR (creme/terracota, Bricolage Grotesque, Instrument Sans, Silkscreen; tema claro/escuro).
- Árvores por variantes instanciadas, não uma malha por árvore.
- Scatter determinístico por hash de célula (pintar num canto não embaralha o resto).
- Cor por árvore = deslocamento HSV só nas folhas, no shader; no export é assada na cor de vértice.

## Próximos passos

1. **Godot 4** (pedido do usuário, adiado até agora). Godot 4.7.2 já instalado em `C:\Godot\Godot.exe` (há `Godot_v4.7.2-stable_win64_console.exe` para rodar headless) — não baixar outro. Plano:
   - portar `veg-core.js` para GDScript mantendo `rng`/`hash3`/Perlin idênticos (mesma semente → mesma floresta; cuidado com aritmética de 32 bits: mascarar com `& 0xFFFFFFFF`);
   - `ArrayMesh` com cor de vértice + `CUSTOM0` para `aVeg`; `MultiMeshInstance3D` por variante, cor por instância via `INSTANCE_CUSTOM`;
   - shader de vento/tint equivalente ao GLSL de `veg-render.js`;
   - plugin de editor com pincel que faz raycast na superfície e pinta a máscara;
   - importador do projeto .json (`format: "veg-forest"`, campo `baked.trees`: `s`, `v`, `p`, `r`, `k`, `tint`).
2. Ideias soltas ainda não feitas: pétalas/folhas caindo (existem no ICQR), LOD/impostores para florestas grandes, água.

## Detalhe que custou tempo

- O que foi pintado na porta 8766 (quando o projeto estava no acervo) ficou no localStorage daquela origem; a 8767 começa do zero.
- No shader, não usar o nome `im` para variáveis (o three já declara); por isso é `vegIm`.
