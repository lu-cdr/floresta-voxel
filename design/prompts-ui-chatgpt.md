# Prompts para redesenhar a interface no ChatGPT

Objetivo: **manter o visual atual** (creme/terracota, cantos arredondados, pixel na marca) e trocar
palavras por **ícones**, deixando texto só onde é número, nome próprio ou explicação que aparece ao
passar o mouse.

Os prints estão em `design/ui-prints/` (tirados em 27/10/2026, mapa padrão, 1280×860, tema claro,
mais um escuro e dois de celular).

## Como usar

1. Abra uma conversa nova no ChatGPT e cole o **Prompt 0** (contexto e guia de estilo) com os prints
   `01-editor-completo-claro.png` e `22-editor-completo-escuro.png`.
2. Na mesma conversa, gere as **folhas de ícones** (Prompts 1A a 1F), uma por mensagem. Escolha a
   melhor de cada e peça ajustes ("mais grosso", "menos detalhe", "igual ao de árvore").
3. Depois, os **mockups de painel** (Prompts 2 a 9), anexando o print indicado em cada um.
4. Traga para cá as imagens aprovadas: eu redesenho os ícones em SVG/pixel e aplico no editor (as
   imagens geradas servem de referência; o texto delas costuma sair com erros e não deve ser copiado).

Dica: peça sempre "mesma folha, só mude X" para não perder o estilo entre gerações.

---

## Prompt 0 — contexto e guia de estilo (colar primeiro)

```text
Vou redesenhar a interface do meu jogo de navegador "Floresta Voxel", um editor cozy de dioramas em
voxel: você pinta árvores, grama, flores, água, rochas e relevo num terreno de blocos, avança as
estações e pode passear em 1ª pessoa. Anexei dois prints da interface atual (tema claro e escuro).

Gosto do visual atual e quero mantê-lo. O problema é excesso de palavras. Quero:
- mais ícones e menos texto: botões viram ícones com o nome aparecendo só no tooltip;
- números continuam visíveis (raio 7.0, força 60%, 10:05, dia 1 de 12);
- notas explicativas viram um ícone "?" que abre a explicação;
- a cena 3D continua sendo a protagonista; painéis compactos e flutuantes.

Guia de estilo que deve ser respeitado em tudo que você gerar:
- Paleta clara: fundo #ebe5d9, painel #fbf8f2, chip/botão #efe8dc, linha #dcd2c1,
  texto #29251f, texto secundário #6c6455, destaque terracota #b5623a (texto sobre ele #fff8f0).
- Paleta escura: fundo #1b1916, painel #25221e, chip #302c26, linha #3a352d, texto #f0e9dd,
  secundário #9b917f, destaque #dc8a58.
- Fontes: "Silkscreen" (pixel) só na marca e em números de relógio/atalhos; "Bricolage Grotesque"
  em títulos curtos; "Instrument Sans" no resto.
- Painéis com cantos de 12–14 px, borda fina de 1 px, sombra suave e quente; botões de 9 px de raio;
  estado ativo = fundo terracota.
- Ícones: estilo pixel art limpo em grade de 16×16 (exibidos a 24–32 px), traço de 2 px, no máximo
  2 cores (tinta #29251f + detalhe terracota #b5623a), fundo transparente, sem gradiente, sem 3D,
  legíveis em 24 px, combinando com o mundo em voxel. A versão escura troca a tinta por #f0e9dd.
- Idioma de qualquer texto: português do Brasil.
Responda só "entendido" agora; nas próximas mensagens vou pedir folhas de ícones e mockups.
```

---

## Prompts 1A–1F — folhas de ícones

Cada um gera uma folha em grade. Peça fundo creme liso (#fbf8f2) para enxergar bem; depois eu tiro o
fundo.

### 1A — Ferramentas (barra principal)

```text
Gere uma folha de ícones pixel art 16×16 (ampliados ×4, cada um numa célula de 96×96 com 16 px de
margem), grade de 5 colunas × 2 linhas, fundo #fbf8f2, seguindo o guia de estilo. Sem texto na imagem.
Ordem, da esquerda para a direita:
1 câmera (mão de arrastar / órbita)  2 árvores (pinheiro + copa redonda)  3 grama (tufo de 3 lâminas)
4 solo (balde de areia com pá / camadas de terra)  5 flora (samambaia com flor)
6 água (gota com onda)  7 relevo (morro em degraus com seta para cima)  8 rochas (pedra voxel com seixo)
9 borracha (borracha de lápis inclinada)  10 passear (silhueta de pessoa andando / pegada)
Mesma espessura de traço em todos; terracota só em 1 detalhe por ícone.
```
Prints: `03-painel-ferramentas.png`.

### 1B — Ações gerais

```text
Mesma folha e estilo da anterior (5 × 2). Sem texto. Ícones:
1 desfazer (seta curva para a esquerda)  2 refazer (seta curva para a direita)  3 salvar projeto (disquete)
4 abrir projeto (pasta aberta)  5 limpar o mapa (vassoura)  6 foto (câmera fotográfica)
7 voltar ao editor (porta com seta / x)  8 ajuda (balão com "?")  9 atalhos de teclado (tecla)
10 menu avançado (engrenagem com reguinha)
```
Prints: `03-painel-ferramentas.png`, `15-projeto.png`.

### 1C — Tempo e estações

```text
Mesma folha e estilo (6 × 2). Sem texto. Ícones:
1 primavera (broto com flor)  2 verão (sol cheio)  3 outono (folha caindo)  4 inverno (floco de neve)
5 +1 dia (sol com "+")  6 +1 semana (calendário com 7 pontos)  7 próxima estação (seta "pular" com folha)
8 hora do dia (meio sol, meia lua)  9 cores da estação (paleta com folha)
10 modo criativo (pincel com estrela)  11 modo ecossistema (ciclo de setas com folha)  12 noite (lua)
```
Prints: `16-barra-de-tempo.png`.

### 1D — Opções do pincel

```text
Mesma folha e estilo (6 × 4). Sem texto. Ícones:
Linha 1 (pincel): 1 raio (círculo com seta para fora)  2 força (gota cheia/meio cheia)  3 dureza (círculo de borda dura vs borda difusa)
   4 espécie automática (dado)  5 adensar (duas árvores juntas com "+")  6 apagar com Shift (borracha pequena + tecla)
Linha 2 (espécies): 1 carvalho (copa larga)  2 bétula (tronco branco listrado)  3 cerejeira (copa rosa com flor)
   4 pinheiro (triângulo em camadas)  5 arbusto baixo  6 arbusto com frutos
Linha 3 (solo e água): 1 terra  2 areia  3 rocha (solo)  4 húmus (folhas sobre terra escura)  5 rio (curva de água)
   6 lago (poça oval)
Linha 4 (relevo e rochas): 1 cachoeira  2 subir terreno  3 descer terreno  4 nivelar (régua horizontal)
   5 suavizar (degraus virando curva)  6 voltar ao original (seta circular sobre morro)
Extra (se couber, 5ª linha): seixos, pedra, matacão, afloramento em camadas.
```
Prints: `04` a `12` (`pincel-*.png`).

### 1E — Ver no terreno (camadas de informação)

```text
Mesma folha e estilo (4 × 2). Sem texto. Ícones:
1 só a paisagem (olho)  2 umidade (gota com termômetro)  3 luz no chão (sol atravessando copa)
4 fertilidade (broto em terra escura)  5 declive (rampa com ângulo)  6 bom para… (alvo/check sobre árvore)
7 legenda / escala (barra em degradê)  8 explicar o ponto (lupa)
```
Prints: `13-ver-no-terreno-umidade.png`, `14-editor-com-camada-umidade.png`.

### 1F — Foto, passeio e números do cabeçalho

```text
Mesma folha e estilo (6 × 3). Sem texto. Ícones:
Linha 1 (foto): 1 sem moldura  2 passe-partout  3 polaroide  4 tamanho 2×/4× (lupa com cantos)
   5 legenda (linhas de texto sob foto)  6 salvar PNG (seta para baixo numa foto)
Linha 2 (passeio): 1 andar (teclas WASD em cruz)  2 pular (seta para cima sobre bloco)  3 correr (pessoa com linhas de velocidade)
   4 agachar (pessoa abaixada)  5 mira (cruz)  6 mouse/olhar (mouse com setas)
Linha 3 (contadores): 1 árvores  2 rochas  3 plantas  4 lâminas de grama  5 fps (velocímetro)  6 estação atual (círculo das 4 estações)
```
Prints: `19-barra-modo-foto.png`, `21-barra-passear.png`, `02-cabecalho-e-primeiros-passos.png`.

### 1G — o que faltou (tempo, estações, rochas e extras)

As folhas 1A–1F viraram SVG (`design/icones/`). Estes 20 ainda não existem — a 1C não veio como
folha, e os tipos de rocha e o junco ficaram de fora. Gere na mesma conversa e salve como
`design/chatgpt/folha-tempo-extras.webp`; o conversor (`python -I design/extrair_icones.py`) já espera
essa ordem.

```text
Mesma folha e estilo das anteriores (traço escuro grosso + detalhe terracota, fundo #fbf8f2),
grade de 5 colunas × 4 linhas, ícones bem separados e do mesmo tamanho. Sem texto. Ordem:
Linha 1: primavera (broto com flor), verão (sol cheio), outono (folha caindo), inverno (floco de neve), sol pequeno
Linha 2: lua crescente, +1 dia (sol com "+"), +1 semana (calendário), próxima estação (setas em ciclo com folha), cores da estação (paleta de pintor)
Linha 3: modo criativo (varinha com brilhos), modo ecossistema (broto dentro de setas em ciclo), pincel, fechar (×), concluído (✓)
Linha 4: seixos (3 pedrinhas), pedra (uma pedra média), matacão (pedra grande com musgo no topo), afloramento (pedra em camadas achatadas), junco (hastes com espiga na beira d'água)
```

---

## Prompts 2–9 — mockups de painel

Pedir sempre: **mesmo tamanho do print**, tema claro, e depois "agora a versão escura".

### 2 — Barra de ferramentas (coluna esquerda)

```text
Redesenhe este painel (anexo) usando os ícones da folha 1A e 1B. Regras:
- as 9 ferramentas viram uma grade de botões quadrados só com ícone (36–40 px), o atalho
  (1–7, C, E) em pixel pequeno no canto inferior direito de cada botão; a ativa em terracota;
- desfazer/refazer viram dois ícones pequenos lado a lado;
- os títulos de seção (PINCEL, VER NO TERRENO, PROJETO) viram ícone + palavra curta;
- mostre também o tooltip de um botão ao passar o mouse: "Árvores · 1".
Mantenha largura de ~236 px, paleta e cantos do guia. Mesma escala do anexo.
```
Prints: `03-painel-ferramentas.png`.

### 3 — Pincel contextual

```text
Redesenhe a seção "Pincel" (anexos) mostrando 3 estados lado a lado: Árvores, Água e Relevo.
- Raio, Força e Dureza: ícone à esquerda do slider, número à direita, sem o rótulo escrito;
- selects de Espécie/Forma/Modo viram fileiras de botões-ícone (folha 1D) com o nome no tooltip;
- a nota explicativa vira um ícone "?" no título da seção (mostre um deles aberto como balão).
Mesma paleta e largura de ~236 px.
```
Prints: `04-pincel-arvores.png`, `08-pincel-agua.png`, `09-pincel-relevo.png`, `10-pincel-rochas.png`.

### 4 — Barra de tempo (embaixo, no centro)

```text
Redesenhe esta barra (anexo) com menos texto:
- estação = ícone da estação (folha 1C) + "dia 1/12" pequeno;
- relógio continua em pixel (10:05) com o slider; ícones de sol e lua nas pontas do slider;
- "+1 dia", "+1 semana", "Próxima estação" viram três botões-ícone agrupados;
- "Cores da estação" vira um botão alternável com ícone de paleta;
- Foto e Passear viram botões-ícone com o atalho (P, V) no canto;
- Criativo/Ecossistema vira um interruptor de 2 ícones.
Altura ~52 px, cantos 14 px, centralizada. Mostre também o tooltip de "Próxima estação".
```
Prints: `16-barra-de-tempo.png`.

### 5 — Ver no terreno + legenda

```text
Redesenhe a seção "Ver no terreno" (anexos): o select vira uma fileira de botões-ícone (folha 1E);
a legenda continua como barra de degradê com "seco" e "úmido" nas pontas; a leitura do ponto sob o
cursor vira uma linha de pequenos ícones com valores (gota 52%, sol 20%, broto 61%) em vez da frase.
```
Prints: `13-ver-no-terreno-umidade.png`, `14-editor-com-camada-umidade.png`.

### 6 — Cabeçalho, contadores e primeiros passos

```text
Redesenhe o cabeçalho (anexo): marca "FLORESTA VOXEL" em pixel; os contadores viram ícones com
números (árvore 577 · rocha 57 · planta 1.987 · grama 98k · 165 fps), em uma linha; a frase de
descrição some; a lista "Primeiros passos" vira 4 ícones numerados que ganham um check terracota
quando concluídos, com o texto só no tooltip.
```
Prints: `02-cabecalho-e-primeiros-passos.png`.

### 7 — Modo foto

```text
Redesenhe a barra do modo foto (anexos) em uma linha só: hora (pixel + slider), próxima estação
(ícone), moldura (3 miniaturas clicáveis: sem, passe-partout, polaroide), tamanho 2×/4× (segmentado),
legenda (ícone alternável), botão principal "Salvar" com ícone em terracota e um ícone de sair.
```
Prints: `18-modo-foto-completo.png`, `19-barra-modo-foto.png`.

### 8 — HUD do Passear

```text
Redesenhe o HUD de passeio em 1ª pessoa (anexos), estilo jogo de bloco clássico mas no nosso visual:
mira pequena no centro; no canto inferior esquerdo uma "cola" de controles só com ícones de teclas
(WASD, Espaço = pular, W W = correr, Shift = agachar, P = foto, Esc = voltar) que some depois de
alguns segundos; botão de voltar ao editor como ícone discreto no canto superior direito. Mostre
também a variante de celular deitado: joystick à esquerda, área de olhar à direita, botão redondo de
pular embaixo à direita.
```
Prints: `20-passear-completo.png`, `21-barra-passear.png`.

### 9 — Celular deitado (tela inteira)

```text
Com tudo que definimos, mostre a tela do editor num celular deitado (812×375): coluna esquerda só de
ícones (sem rótulos), barra de tempo compacta numa linha, menu avançado recolhido num ícone de
engrenagem. A cena 3D deve ocupar pelo menos 70% da tela.
```
Prints: `23-celular-deitado.png`, `24-celular-em-pe-aviso.png`.

### Opcional — menu Avançado

O Avançado (`17-menu-avancado.png`) é de ajuste fino e pode continuar com texto; vale só pedir ícones
nos títulos das pastas (Ver, Mundo, Árvores, Cor das folhas, Mistura, Grama, Sub-bosque, Rochas,
Vento, Estilo, Exportar).

---

## Inventário: o que hoje é palavra e pode virar ícone

| Onde | Texto atual | Proposta |
|---|---|---|
| Cabeçalho | "Pinte uma floresta, avance as estações…" | some (fica no tooltip da marca) |
| Cabeçalho | "577 árvores · 57 rochas · 1.987 plantas · 98.029 lâminas · 165 fps" | ícone + número |
| Cabeçalho | Primeiros passos (4 frases) + "Esconder" | 4 ícones numerados com check; × para fechar |
| Ferramentas | Câmera, Árvores, Grama, Solo, Flora, Água, Relevo, Rochas, Borracha | só ícone + atalho; nome no tooltip |
| Histórico | ↶ Desfazer, ↷ Refazer | só setas |
| Pincel | Raio, Força, Dureza | ícone à esquerda; número fica |
| Pincel | Espécie / Tipo de solo / Forma / Modo / Tipo (selects) | fileiras de botões-ícone |
| Pincel | notas explicativas por ferramenta | ícone "?" que abre balão |
| Borracha | "Borracha apaga: tudo que cresce / só árvores / …" | botões-ícone de camada |
| Ver no terreno | select com 13 opções | fileira de ícones + "Bom para" com ícone da espécie |
| Ver no terreno | leitura em frase ("Umidade 52% · luz 20% …") | ícones com valor |
| Projeto | Salvar, Abrir…, Limpar o mapa | disquete, pasta, vassoura |
| Tempo | "Inverno / dia 1 de 12" | ícone da estação + "1/12" |
| Tempo | +1 dia, +1 semana, Próxima estação | 3 ícones agrupados |
| Tempo | Cores da estação (checkbox) | botão alternável com paleta |
| Tempo | Foto P, Passear V | ícones com atalho |
| Tempo | Criativo / Ecossistema | interruptor de 2 ícones |
| Foto | Modo foto, Próxima estação, Moldura, Tamanho, Legenda, Salvar PNG, Sair | ícones; "Salvar" mantém palavra |
| Passear | frase longa de controles + "Voltar ao editor" | cola de teclas em ícones; × no canto |
| Dica | "Arraste para pintar · botão direito gira · …" | ícones de mouse/tecla, some após uso |

Não capturado: a dica que aparece ao passar o mouse numa árvore (espécie, estágio, idade) — não
apareceu no navegador automático; vale tirar à mão se quiser redesenhá-la.
