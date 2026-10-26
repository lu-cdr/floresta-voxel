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
