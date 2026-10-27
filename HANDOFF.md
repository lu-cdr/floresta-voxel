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
| `veg-history.js` | Desfazer/refazer: `History` + remendos de máscara por retângulo. |
| `veg-eco.js` | Grade ecológica (umidade, luz, fertilidade, declive, solo), `PREFS` de espécies e flora, adequação e fator limitante. |
| `veg-water.js` | Água por bloco (sem three): `WATER_NONE`, `carveHeights` (leito), `waterFlow` (correnteza), `buildWaterGeometry` (superfície, paredes, cachoeiras, espuma), `waterProximity` (umidade), `packWater`/`unpackWater`. |
| `veg-relief.js` | Relevo esculpido (sem three): `sculptRelief` (subir/descer/nivelar/suavizar/original), `reliefHeights`, `packRelief`/`unpackRelief`, `RELIEF_MAX`. |
| `veg-landscape.js` | `landscapeOnly()`: celular em pé (toque, ≤ 600 px) vê "Gire o celular"; no Android o botão entra em tela cheia e trava na horizontal. Usado pelo editor e pelo runtime. |
| `veg-walk.js` | Andar no diorama (sem three): `collide` (troncos e pedras grandes), `freeSpot` (espiral até lugar seco e livre), `stepTo` (degrau ≤ 0,6, desliza no muro), `FirstPerson` (WASD + pointer lock, ou toque: esquerda anda, direita olha). Editor e runtime usam. |
| `veg-photo.js` | Modo foto: `capturePhoto` em 2×/4× com moldura e legenda. |
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

### Incremento 3 — Solo, umidade e overlays (2026-10-26)

1. **Entrega:** ferramenta **Solo** (tecla 3) com Areia/Rocha/Húmus (Shift volta a terra); areia deixa a grama rala e rocha quase nua, com cor própria no terreno. Seção **Ver no terreno**: umidade, luz no chão, fertilidade, declive e "Bom para <espécie>", com legenda (rampa escura→clara, legível sem cor) e leitura no cursor ("Bétula: 34% — pouca luz · Umidade 52% · luz 20% …").
2. **Arquivos/contratos:** `veg-eco.js` novo (trilha Sonnet): `SOILS` (+ `grass`, por mim), `PREFS`, `computeEco`, `suitability`, `suitabilityGrid`, `explainCell`. `VegWorld`: `soilMask` (Uint8, na resolução das máscaras, entra em `maskLayers()` → histórico), `paintSoil`, `soilAt`, `getEco()` (cache invalidado por árvores, relevo, solo e estação), `ecoIndex`, overlays `eco:*`. Save: `masks.soil` (b64); projetos sem ele = tudo terra.
3. **TIGHT:** Tempo — grade ecológica 7,8 ms no navegador (96², 615 árvores), só recalculada sob demanda; recolorir terreno 12 ms. Integridade — determinística (testes), solo sobrevive a reload, desfazer de solo exato. Game feel — legenda com palavras (seco/úmido), causa limitante em texto. Harmonia — mesmos controles; opções de cada ferramenta só aparecem com ela. Testes — 37 em `npm test`.
4. **Verificação:** Playwright 8767: pintar areia/rocha/húmus, overlays de umidade e adequação, leitura no cursor, Ctrl+Z/Ctrl+Shift+Z, reload; console sem erros.
5. **Riscos/continuação:** com um overlay ecológico ligado, pintar árvores recalcula grade + terreno por quadro (~20 ms). A grade ainda não muda o crescimento (vem no Incremento 4, modo Ecossistema).

### Incremento 4 — Estágios, árvores jovens e tocos (2026-10-26)

1. **Entrega:** seletor **Criativo / Ecossistema** na barra de tempo. No Ecossistema, cada árvore tem idade: broto → jovem → adulta → velha (copa apagada) → morta em pé → toco → rebrota no mesmo lugar. Árvores pintadas nascem como broto; as que já existiam começam adultas/velhas com idades variadas. Avançar o tempo diz o que mudou ("Chegou o Verão. 15 morreram, 1 virou toco."). Passar o mouse numa árvore mostra espécie, estágio, idade, qualidade do lugar e vida esperada. Lugar ruim (seco, solo pobre, encosta) = árvore menor e vida mais curta.
2. **Arquivos/contratos:** `veg-core.js` (trilha Sonnet): `id` estável `i,j` no scatter, `STAGES`, `STAGE_LABELS`, `LIFE` (dias; carvalho 480 ≈ 10 anos), `lifeOf`, `stageKey`, `deadVariant`. `ecology.epoch` (dia em que o Ecossistema começou) e `ecology.plants` (`id → dia em que brotou`, podado quando a árvore some). `veg-eco.js`: `siteQuality` (adequação sem luz — competição por luz é do Marco 2). `VegWorld`: `updateLife`, `stageSnapshot`, chave de variante com sufixo `:morta`/`:toco`, `t.drawScale`/`t.vkey`; `baked.trees` exporta `stage` e o tamanho desenhado. Runtime colide pelo tamanho desenhado.
3. **TIGHT:** Tempo — estágio é derivado (sem simulação por quadro); avançar tempo só refaz as instâncias; 152 variantes com mortas/tocos sem fila visível. Integridade — mesmo projeto recarregado dá a mesma contagem por estágio (bug achado e corrigido: estágios eram calculados com a grade da estação anterior). Game feel — mensagens de causa, dica no cursor, modo no histórico. Harmonia — mortalidade calibrada para ~2–4% por estação (era 35% em 5 estações). Testes — 46 em `npm test`.
4. **Verificação:** Playwright: Criativo → Ecossistema, borracha + repintar (16 brotos), 5 estações com mensagens, Ctrl+Z, reload idêntico, dica sobre cerejeira; console sem erros.
5. **Riscos/continuação:** mudar semente/tamanho/espaçamento muda os ids e as idades registradas ficam órfãs (são podadas). Grama não reage ao tamanho do broto até o próximo rebuild.

### Incremento 5 — Sub-bosque por adequação (2026-10-26)

1. **Entrega:** samambaias, flores e musgo em voxel (meio voxel do mundo) nascem sozinhos sob a floresta onde o lugar serve — samambaia/musgo na sombra úmida, flores no sol — e mudam com a estação (inverno sem flores, primavera florida). Ferramenta **Flora** (tecla 4) pinta mais intenção em clareiras; borracha "tudo que cresce" ou "só flora". Contagem de plantas no cabeçalho; pasta "Sub-bosque" no menu avançado.
2. **Arquivos/contratos:** `veg-core.js` (trilha Sonnet): `FLORA`, `FLORA_KEYS`, `genFloraVoxels`, `scatterFlora`, `STYLES[*].flora`; `defaultProject().flora = { density, variants, underTrees, mix }`. `veg-eco.js`: `PREFS` de samambaia/flor/musgo. `VegWorld`: `floraMask` (pintável, histórico, `masks.flora`), `rebuildFlora(bounds)` chamado junto com a grama, uma `InstancedMesh` por variante (9 chamadas de desenho), `invalidateFlora` na troca de estilo, `trunkBlocker()` compartilhado. Intenção = max(máscara de flora, máscara de árvores × underTrees).
3. **TIGHT:** Tempo — refazer toda a flora 19 ms (só em troca de estação ou parâmetro; pincel refaz só os chunks tocados); 165 fps com 6.448 plantas. Integridade — determinística por posição (teste de localidade), estilos antigos sem `flora` caem no preset. Game feel — nota explicando onde cada planta gosta de nascer + overlay "Bom para…". Harmonia — mesmo voxel/paleta sazonal, sem sombra própria (pequenas). Testes — 54 em `npm test`.
4. **Verificação:** Playwright: outono 3.162 plantas → inverno 1.222 (sem flores) → primavera 6.448; pincel de flora + Ctrl+Z exato; console sem erros.
5. **Riscos/continuação:** sub-bosque não entra no export GLB/`baked` ainda; projetos v1 passam a mostrar sub-bosque sob as árvores (melhoria visual, não quebra).

### Incremento 6 — Modo foto (2026-10-26)

1. **Entrega:** botão **Foto** na barra de tempo (tecla P; Esc sai). Some toda a interface; fica uma barra com hora, próxima estação, moldura (sem / passe-partout / polaroide), tamanho 2× ou 4×, legenda e **Salvar PNG**. Arrastar gira a câmera. A legenda traz estação, dia, hora, semente, estilo e as espécies que aparecem no enquadramento. Clarão de câmera e aviso com o tamanho salvo.
2. **Arquivos/contratos:** `veg-photo.js` novo (trilha Sonnet): `capturePhoto({ renderer, scene, camera, scale, frame, meta })` → `{ blob, width, height, scale }`, `photoFileName`, `maxPhotoScale`; `tests/photo.html` (página de teste das molduras). `project.photo = { frame, showMeta }` persistido. 4× é desabilitado quando a GPU não comporta.
3. **TIGHT:** Tempo — captura 2× com polaroide ≈ 0,4 s (sem `preserveDrawingBuffer`; canvas volta ao tamanho original e é redesenhado). Integridade — moldura/legenda salvas no projeto. Game feel — "Revelando…", clarão, mensagem com dimensões, erro legível sugerindo 2×. Harmonia — mesmas cores/fontes nas molduras. Testes — `npm test` 54 + página de teste das molduras.
4. **Verificação:** Playwright: P → polaroide + legenda + 17:17 → download `floresta-voxel-2026-10-26-0846.png` 2783×3088, Esc volta; console sem erros.
5. **Riscos/continuação:** sem profundidade de campo nem clima (clima é do Marco 2); "álbum de estações" do GDD ainda não existe.

### Incremento 7 — Painel "Criar" simplificado (2026-10-26)

1. **Entrega:** o menu de parâmetros virou **Avançado** e começa fechado. A coluna da esquerda junta cabeçalho e painel: ferramentas, desfazer/refazer, seções dobráveis **Pincel**, **Ver no terreno** e **Projeto** (Salvar, Abrir…, Limpar o mapa — desfazível). **Primeiros passos** no cabeçalho (pintar → avançar estação → ver camada → salvar foto), que se riscam sozinhos e somem ao fim (lembrado só neste navegador). No celular, Pincel/Ver começam dobrados e nada se sobrepõe. Foco visível em botões/selects/sumários; rótulos ≥ 12 px.
2. **Arquivos:** só `floresta.html`.
3. **TIGHT:** Tempo — nada novo no laço. Integridade — guia em `localStorage['floresta-voxel:guia']` (conveniência por navegador, falha silenciosa). Game feel — o critério do Marco 1 vira o roteiro na tela. Harmonia — mesmos tokens; coluna sem barra de rolagem em 1280×900; 375 px sem rolagem horizontal. Testes — `npm test` 54.
4. **Verificação:** Playwright: Avançado fechado; pintar/estação/umidade/foto marcam o guia e ele some; Limpar o mapa + Ctrl+Z (0 → 602 árvores); 1280×900 e 375×812 sem sobreposição; runtime carrega projeto em modo Ecossistema; console sem erros.
5. **Riscos/continuação:** atalhos ainda não são remapeáveis; não há controle de escala de interface/contraste (GDD §9).

## Marco 1 — "Diorama vivo": fechado em 2026-10-26

Em menos de cinco minutos: pintar/apagar → "Próxima estação" (cores e, no Ecossistema, brotos/mortes/tocos com mensagem) → "Ver no terreno" explica (umidade, luz, "Bom para…") → P → Salvar PNG. Commits: um por incremento (`git log`).

**Próximo:** porte para Godot 4 (formato v2 estável; ver "Próximos passos" acima) e depois Marco 2 — água estática + chuva, germinação por pressão de sementes e competição por luz (`siteQuality` hoje ignora luz de propósito), fauna-indicador + caderno de campo, carimbos, cenário de mata ciliar.

### Pincéis: adensar mata + pincel de água (2026-10-26)

1. **Entrega:** (a) pintar árvores **de novo por cima** de uma mata agora adensa: a máscara de árvores vai de 0 a 2 (`TREE_MAX`); acima de 1 o scatter ignora o ruído de densidade e aperta o espaçamento até 50%. A segunda demão sobe mais devagar (×0,4). (b) ferramenta **Água** (tecla 5, raio próprio 2) com três formas: **Rio** (nível nunca sobe no traço — pinte do alto para baixo; morro vira cânion), **Lago** (nível do primeiro clique; só enche blocos abaixo dele), **Cachoeira** (nível do clique perto dele, depois 3 degraus abaixo, escavando a garganta). Cachoeiras também aparecem sozinhas onde o rio desce um degrau. Shift apaga; borracha tem "só água". Contagem de blocos e quedas na linha de status.
2. **Arquivos/contratos:** `veg-water.js` novo. `VegWorld`: `waterMask` (Float32, mask res, mesmo valor nas 2×2 células de cada bloco → entra no histórico), `baseHeights` (relevo do ruído) × `heights` (escavado), `applyWater()`, `paintWater(x, z, r, { mode, level, erase })`, `baseHeightAt`, `waterAt`, `blockWater`, `fillWater`, `recolorWater`, `stats.agua/cachoeiras`, uniforme `uIce` (estilo com neve congela). Árvores, grama e flora não nascem na água; margem fica mais escura; `computeEco({ water })` deixa o chão úmido até 5 blocos da água. Save: `masks.water` (Int16 centésimos por bloco, -32768 = seco) e `masks.treeMax: 2` (sem ele, a máscara de árvores antiga é lida como 0..1).
3. **TIGHT:** Tempo — `applyWater` ≈ 28 ms, rescatter ≈ 22 ms por quadro enquanto pinta água; grama/flora só na área tocada (o mapa todo custava 200 ms). Integridade — desfazer/refazer, Shift, autosave e reload conferidos. Game feel — rótulo do histórico "rio/lago/cachoeira/apagar água", nota explicando cada forma. Harmonia — água em "pixels" de 1/4 de bloco, Borracha virou botão largo. Testes — `npm test` 61 (7 novos em `tests/water.test.mjs`).
4. **Verificação:** Playwright 1280×860: 4 repasses de árvores 615 → 652, Ctrl+Z volta; rio, lago e cachoeira desenhados; inverno congela; `exemplo-jogo.html` mostra a água; 375 px sem rolagem horizontal; console só com o favicon 404 de sempre.
5. **Riscos/continuação:** água não entra no export GLB/`baked` nem no porte Godot ainda; no runtime o jogador anda pelo leito (sem nadar). Mudar relevo/degrau depois de pintar mantém o nível salvo da água (pode ficar acima/abaixo do novo terreno). "Limpar o mapa" não apaga água. Painel da esquerda ganha barra de rolagem em 1280×860 com a nota da água aberta.

## Direção decidida em 2026-10-27

Plataforma: continua HTML/three.js. Demo grátis na web puxa wishlist; versão paga na Steam com
wrapper (Tauri/Electron). **Porte Godot saiu do caminho crítico.** Exploração = modo "Passear"
curto em 1ª pessoa dentro do editor. Próximo marco: **"Paisagem"** — P1 relevo, P2 rochas,
P3 arbustos/juncos, P4 margens d'água, P5 Passear, P6 vitrine (itch.io + página). Monetização
(página Steam cedo, premium US$ 8–15, "Voxel Nature Kit" no itch) só depois do marco. Detalhe em
`GDD.md` §11.

### P1 — Pincel de relevo (2026-10-27)

1. **Entrega:** ferramenta **Relevo** (tecla 6) com Subir / Descer / Nivelar / Suavizar / Voltar ao original. Subir/descer: cada traço ergue uma cúpula de até 1 + força×5 degraus sobre o terreno do começo do traço (repassar no mesmo traço não empilha; solte e pinte de novo para subir mais). Nivelar usa a altura do primeiro clique. Shift: subir↔descer; nos outros modos volta ao original. Borracha ganhou "só relevo". Árvores, grama, flora e água acompanham o chão.
2. **Arquivos/contratos:** `veg-relief.js` novo. `VegWorld`: `noiseHeights` (só ruído) → `baseHeights` = ruído + `reliefMask`×`terrain.step`; `reliefMask` (Float32, degraus, mesmo valor nas 2×2 células de cada bloco → entra em `maskLayers()` e no histórico), `beginRelief`, `paintRelief`, `blockRelief`, `applyRelief` (refaz alturas e chama `applyWater`). `rebuildTerrain` agora só recalcula o ruído. Save: `masks.relief` (Int8 por bloco, b64); projetos sem ele = relevo só do ruído. Editor: `dirty.relief`, `RELIEF_NOTES`/`RELIEF_LABELS`, raio próprio 5; Borracha deixou de ocupar a linha inteira (grade 4×2).
3. **TIGHT:** Tempo — `applyRelief` ≈ 24 ms + rescatter ≈ 21 ms por quadro enquanto esculpe (mesma ordem da água); grama/flora só na área tocada. Integridade — desfazer/refazer exatos (soma do relevo 2266 → 0 → 2266), reload mantém, runtime abre o projeto. Game feel — nota por modo, rótulo no histórico ("subir terreno"…). Harmonia — degraus inteiros: o morro fica em terraços voxel, coerente com o resto. Testes — `npm test` 68 (7 novos em `tests/relief.test.mjs`).
4. **Verificação:** navegador 1280×860: dois traços de subir (máx. 8 degraus), Ctrl+Z ×2 / Ctrl+Shift+Z ×2, borracha abre o morro e mostra os terraços, reload; 375 px sem rolagem horizontal; `exemplo-jogo.html` sem erros; console limpo.
5. **Riscos/continuação:** água pintada guarda nível absoluto — erguer o chão em volta de um lago deixa a água num poço; baixar o chão sob ela deixa a água "flutuando" como queda. Trocar semente/campo do relevo mantém o esculpido somado ao ruído novo. Suavizar por muitas passadas perde volume (arredondamento). Próximo: P2, rochas.

### Celular só na horizontal (2026-10-27)

1. **Entrega:** no celular em pé, editor e runtime mostram "Gire o celular" (com botão de tela cheia + trava horizontal onde o navegador deixa — Android; no iPhone só o aviso). Deitado, o editor usa o mesmo layout do computador, compacto: cabeçalho só com nome e números, coluna de ferramentas que rola, Pincel/Ver começam dobrados, relógio à direita da coluna em 2–3 linhas, menu Avançado termina acima dele, barra do modo foto na largura toda.
2. **Arquivos:** `veg-landscape.js` novo; `floresta.html` (media query `max-height: 520px and min-width: 600px`; a de `max-width: 760px` agora exige `min-height: 521px`, então só vale para janelas estreitas e altas); `exemplo-jogo.html` chama `landscapeOnly()`. Tablets e computador não mudam.
3. **Verificação:** 812×375 e 667×375 sem sobreposição (painel, relógio, Avançado, modo foto); 375×812 com toque mostra o aviso nas duas páginas; 1280×860 igual a antes; console limpo.
4. **Riscos:** iPhone não tem trava de orientação nem tela cheia de página — depende do usuário girar. Em 667 px o relógio ocupa ~115 px de altura.

### P2 — Rochas e pedregulhos (2026-10-27)

1. **Entrega:** ferramenta **Rochas** (tecla 7) com tipo Automático/Seixos/Pedras/Matacões/Afloramento. Rochas também nascem sozinhas em solo Rocha e em encosta íngreme (morro esculpido ganha pedras nas bordas); matacões e afloramentos preferem esses lugares. Shift ou Borracha "só rochas" tira rochas, inclusive as automáticas. Musgo em cima onde o chão é úmido, neve no inverno, tint por instância no musgo. Árvores, grama e flora abrem espaço para as rochas. Pasta "Rochas" no Avançado (chance, sozinhas, variantes, mistura). Contagem no cabeçalho.
2. **Arquivos/contratos:** `veg-core.js`: `ROCKS`, `ROCK_KEYS`, `ROCK_SINK` (rocha gerada 2 voxels acima porque a grade não guarda y < 0; o render desce), `rockRadius`, `genRockVoxels(kind, shapeT, seed, style, { moss })`, `scatterRocks`; `STYLES[*].rock = { stone, moss }`; `defaultProject().rocks = { density, variants, auto, mix }`. `VegWorld`: `rockMask` (Float32 −1..1: negativo suprime as automáticas), `rockKindMask` (Int8), ambos em `maskLayers()`; `rockCover` (Uint8 por bloco); `roughAt`, `rescatterRocks` (chamado no começo de `rescatterTrees`), `rockAt`, `rockVariant` (chave `r:tipo:variante[:m]`, vento zerado), `applyRocks`, `invalidateRocks` (em `setStyle`). Save: `masks.rocks` ((v+1)/2 em bytes; 128 lido como 0), `masks.rockKind`. `baked.rocks` no export. Runtime colide com pedra/matacão/afloramento (seixo se pisa por cima). Editor: pintar solo ou rochas marca `dirty.trees` (as automáticas dependem do solo); Borracha voltou a ocupar a linha inteira.
3. **TIGHT:** Tempo — `rescatterRocks` ≈ 4 ms; geração de variante 1–8 ms (sob demanda, no máx. 4 tipos × variantes × musgo). Integridade — determinístico (testes), pintar num canto não muda rochas do outro lado, desfazer/refazer e reload com as mesmas contagens (matacão 27 / pedra 15 / seixo 34). Game feel — nota explicando onde nascem sozinhas; Shift tira até as automáticas. Harmonia — voxel do mundo, paleta por estação, assentadas no mínimo da pegada. Testes — `npm test` 74 (6 novos em `tests/rocks.test.mjs`).
4. **Verificação:** navegador 1280×860: rochas automáticas nas encostas do morro do P1, pincel automático (seixos/pedras), pincel de matacões, Ctrl+Z/Ctrl+Shift+Z, reload, borracha "só rochas" (27 → 8 matacões), inverno com neve nas pedras, runtime carrega.
5. **Riscos/continuação:** o jogador do runtime ainda pode nascer dentro de uma rocha (resolver no P5). Grama já existente fora da área tocada só some de baixo de uma rocha nova quando a grama é refeita (o traço refaz a área dele). Rochas não entram no export GLB de cena ainda. Próximo: P3, arbustos e juncos.

### P3 — Arbustos e juncos (2026-10-27)

1. **Entrega:** três plantas novas no sub-bosque: **Arbusto** (domo de folhas com galhinho), **Arbusto com frutos** (frutos vermelhos/roxos no verão e outono, flores brancas na primavera, poucos frutos no inverno) e **Junco** (touceira de hastes que balançam, com espiga escura). Junco nasce sozinho a 1–2 blocos da água, sem precisar pintar; arbustos servem em quase todo lugar mas são mais raros, e os com frutos pedem sol. Arbustos fazem sombra. "Ver no terreno" ganhou "Bom para arbusto/arbusto com frutos/junco" (junco explica "longe da água"). Avançado → Sub-bosque: "beira d'água" e nomes legíveis na mistura.
2. **Arquivos/contratos:** `veg-core.js`: `FLORA` ganhou `moita`, `frutos`, `junco` (chaves distintas da espécie de árvore `arbusto`) e o campo `rare` (chance extra de nascer, .3 nos arbustos); `FLORA_SEASON` com frutos/junco; `genFloraVoxels` com os três formatos e fallback de paleta para estilos salvos sem elas; `scatterFlora` vale para N tipos; `STYLES[*].flora.{moita,frutos,junco}`; `defaultProject().flora.margin = .8` e `mix` com `moita .6, frutos .35, junco 3`. `veg-eco.js`: `PREFS` dos três, `margin: true` no junco, `computeEco` devolve `near` (proximidade da água). `VegWorld.rebuildFlora`: intenção = max(pintada, árvores × underTrees, beira d'água × margin).
3. **TIGHT:** Tempo — mesma flora em chunks; 9 → até 18 chamadas de desenho. Integridade — determinístico (testes); mudar a lista de tipos muda o sorteio da flora já existente (layout de flora de projetos antigos muda, árvores/rochas não). Game feel — junco aparece sozinho ao desenhar um rio; explicação "longe da água". Harmonia — calibrado no navegador: sem `rare` os arbustos eram 2.756 de 5.259 plantas e cobriam o chão; com .3, 855 de ~2.600; rio de 115 blocos ganha ~45 juncos. Testes — `npm test` 77.
4. **Verificação:** navegador 1280×860: contagem por tipo, rio desenhado → juncos na margem, close na margem; console limpo.
5. **Riscos/continuação:** projetos salvos antes guardam `mix.junco` = 1 se foram abertos nesta versão antes do ajuste (só eu, nos testes). O autosave do navegador (8767) ficou com o morro, as rochas e um rio dos testes P1–P3. Próximo: P4, margens d'água.

### P4 — Margens d'água (2026-10-27)

1. **Entrega:** a beira de rios e lagos virou praia: o bloco colado na água fica areia ou cascalho em manchas, com o barranco molhado (escuro) no lugar da cor de penhasco; o segundo bloco fica lama úmida. Grama rala na praia (×0,3). Seixos nascem sozinhos na margem e podem encostar na água. Espuma fraca e cintilante em toda borda de água que encosta em terra (a forte continua sob as cachoeiras). Solo pintado pelo jogador na margem é respeitado (não vira praia). Junto com o P3, a margem já tem junco, seixo e praia sem pintar nada.
2. **Arquivos/contratos:** `veg-water.js`: `shoreBands(water, size)` → Uint8 por bloco (1 colado, 2 segundo, 0 resto), `SHORE_FOAM = .35` (canto de superfície encostado em terra seca). `VegWorld`: `this.shore` (refeito em `applyWater`), `shoreAt(x, z)`; `nearWater` removido; `SHORE_COLORS` (estilo pode trocar com `style.shore = { sand, gravel, mud }`); `rescatterRocks`: margem pede seixos (intenção .9, tipo seixo se nada foi pintado), bloqueio só a 0,4 do raio e assentar no ponto seco mais baixo da pegada.
3. **TIGHT:** Tempo — `shoreBands` é uma BFS de alcance 2, junto com a água (já refeita ao pintar). Integridade — determinístico (testes); sem mudança no save (tudo derivado da água). Game feel — rio desenhado ganha praia, junco e seixos na hora. Harmonia — manchas por ruído (primeira versão com hash forte virava xadrez). Testes — `npm test` 79 (2 novos em `tests/water.test.mjs`).
4. **Verificação:** navegador 1280×860 com o rio do P3: 50 blocos de praia + 54 de lama, 6 seixos de margem, close na margem; runtime abre.
5. **Riscos/continuação:** não baixei o nível da água para 1/4 de bloco (o plano previa) — `SURF_DROP` .15 continua; a parede de terra entre margem e água ainda tem cara de degrau. Margem não altera a grade ecológica (areia da praia não seca o chão). Próximo: P5, modo Passear.

### P5 — Modo Passear em 1ª pessoa (2026-10-27)

1. **Entrega:** botão **Passear** na barra de tempo (tecla V). A interface some e você entra na floresta na altura dos olhos (1,5 m), num lugar livre perto do centro da vista, olhando para onde a câmera olhava. WASD/setas andam, Shift corre, clicar trava o mouse para olhar (ou arrastar sem travar); no celular, arrastar na metade esquerda anda e na direita olha. Colide com troncos, pedras, matacões e afloramentos; seixos se pisa por cima; sobe degraus de até 0,6 m e desliza ao longo de muros; a grama abre em volta. P abre a foto com a câmera do passeio (o mouse destrava; arrastar ainda olha); Esc fecha a foto, outro Esc (ou V, ou "Voltar ao editor") volta exatamente ao enquadramento de antes. No passeio as teclas de ferramenta não disparam.
2. **Arquivos/contratos:** `veg-walk.js` novo (sem three; testável no Node). `floresta.html`: `walkOn`, `setWalk`, `walker` (FirstPerson na `persp`), `.walkbar`, `body.walk` esconde coluna/relógio/menu; no passeio `controls.update()` não roda (ele reposicionaria a câmera mesmo desligado) e `uPush` segue quem passeia; câmera isométrica volta depois. `exemplo-jogo.html`: colisão e degrau vêm de `stepTo`, nasce via `freeSpot` (resolveu "nasce dentro de árvore/rocha").
3. **TIGHT:** Tempo — colisão percorre árvores e rochas por quadro (~600 + ~100), desprezível. Integridade — sair restaura posição, rotação, alvo e tipo de câmera; nada do mapa muda. Game feel — leve balanço de passo, aceleração suave, dica na barra (texto de toque no celular), aviso quando o Esc só soltou o mouse. Harmonia — barra com os mesmos tokens da barra de foto. Testes — `npm test` 83 (4 novos em `tests/walk.test.mjs`).
4. **Verificação:** navegador 1280×860 no mapa salvo atual: V entra na margem do rio entre juncos; W anda; E não troca ferramenta; P abre foto e esconde a barra; Esc fecha foto, Esc sai; runtime nasce livre e sem erros. Obs.: com o painel do navegador em segundo plano o laço roda a ~1 fps, então o andar parece lento no teste (dt limitado a 0,05).
5. **Riscos/continuação:** pointer lock não foi testado com mouse real (o teste foi por eventos); Esc com mouse travado é engolido pelo navegador (por isso o aviso). Não há pulo nem nado: o leito d'água é chão. Próximo: P6, vitrine (demo web + itch.io).
