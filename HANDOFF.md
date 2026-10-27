# Handoff — Floresta Voxel

Estado em 2026-10-27. Pasta `C:\Browser Games\vegetacao`, branch `master`, remoto `lu-cdr/floresta-voxel`
(GitHub Pages). **Commits locais ainda não enviados** (de `1acb4a0` P2 até o desta nota). Sem PRs abertos.
Só `.impeccable/config.json` modificado e fora dos commits (não é do projeto).

## O que é
Editor cozy de dioramas em voxel no navegador (three.js 0.160, HTML/JS puro, módulos ES, sem build).
Pinta árvores, grama, flora, solo, água, relevo e rochas; estações; modo foto; passeio em 1ª pessoa.
Direção (GDD §11): demo web grátis + versão paga na Steam com wrapper (Tauri/Electron). Porte Godot fora do caminho crítico.

## Feito neste ciclo (marco "Paisagem", todos com `npm test` + navegador)
- P1 relevo (`veg-relief.js`, tecla 6) · P2 rochas (`veg-core.js` ROCKS/scatterRocks, tecla 7)
- P3 arbustos, frutos e junco (FLORA em `veg-core.js`, PREFS em `veg-eco.js`)
- P4 margens d'água: praia/lama/seixos/espuma (`shoreBands` em `veg-water.js`)
- P5 Passear 1ª pessoa estilo bloco: mouse travado, Espaço pula, W W corre, Shift agacha (`veg-walk.js`, tecla V);
  onde o navegador recusa pointer lock (painel do app Claude) cai para arrastar e olhar
- Celular só deitado (`veg-landscape.js`); layout compacto em altura ≤ 520 px
- Interface em ícones: folhas do ChatGPT em `design/chatgpt/` → `python -I design/extrair_icones.py`
  → `design/icones/*.svg` + `veg-icons-data.js`; `veg-icons.js` (`iconSVG`, `hydrateIcons`);
  em `floresta.html`: balão `#uitip` via `data-tip`, `iconChoices(select, itens)` (select escondido segue sendo o valor)

## Não feito / pendências conhecidas
- P6 vitrine (demo no GitHub Pages + página itch.io) — não começado
- Não testado com mouse/teclado reais nem toque real: pointer lock, pulo, botão Pular e joystick
- Não dá para subir em rochas (colisão é cilindro) nem nadar
- Água: superfície não foi baixada 1/4 de bloco (degrau na margem); praia não seca a umidade
- Ícone do matacão perdeu o verde do musgo na conversão; hint de baixo e menu Avançado ainda em texto
- Rochas e sub-bosque fora do export GLB de cena

## Próximos passos
1. **needs user:** decidir se publica — `git push origin master` (GitHub Pages atualiza com tudo acima).
2. P6: atualizar `index.html` como página de demo + preparar textos/GIFs da página itch.io (needs user: conta itch).
3. Ajustes do que o Lucas reportar ao testar o Passear e a interface (sensibilidade, velocidades, tamanho dos ícones).
4. Depois do marco: página Steam e spike do wrapper (GDD §11 "Marco Paisagem" e plano em
   `C:\Users\Pichau\.claude\plans\ent-o-amigo-que-dire-o-generic-meteor.md`).

## Para retomar
- Prévia: servidor `vegetacao` em `.claude/launch.json` (`python -m http.server 8767`) → `http://localhost:8767/floresta.html`
  (runtime: `/exemplo-jogo.html`; galeria de ícones: `/tests/icons-chatgpt.html`).
- Testes: `npm test` (88). Verificação visual com o Playwright MCP usa perfil separado — não mexe no mapa do Lucas.
- O mapa salvo do Lucas fica no localStorage da porta 8767 (`floresta-voxel:projeto`): não pintar nele.
- Push, publicação e qualquer conta externa (itch, Steam) só com aprovação do Lucas. E-mail de commit: noreply.
- Método: um commit por incremento, `npm test` + navegador, nota curta neste arquivo.

## Não refazer
- Ícones vêm das folhas do Lucas; não desenhar novos à mão (ele pediu explicitamente). Faltou algum → prompt
  em `design/prompts-ui-chatgpt.md` e mais uma folha em `design/chatgpt/` (o script tem a ordem esperada).
- Correr não usa Ctrl (Ctrl+W fecha a aba). Painel do app não aceita pointer lock (`WrongDocumentError`).
- Arbustos têm `rare` .3 (sem isso cobriam o chão); junco tem peso 3 e só nasce na margem.
- Rochas são geradas `ROCK_SINK` voxels acima (a grade não guarda y < 0) e descidas no render.
- `rockMask` vai de −1 a 1 (negativo apaga as automáticas); 128 no save é lido como 0.
- Contratos completos: `README.md` (técnico), `GDD.md` (design); histórico por incremento em `git log`.
