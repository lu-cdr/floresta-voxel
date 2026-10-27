# GDD — Floresta Voxel

**Versão:** 0.1 — 26 de outubro de 2026  
**Estado:** documento de direção / pré-produção  
**Plataforma inicial:** navegador desktop  
**Gênero:** sandbox criativo de ecossistema / diorama voxel

## 1. Visão

**Floresta Voxel** é uma caixa de areia calma em que a pessoa cria, observa e transforma uma pequena floresta viva. A proposta não é apenas preencher um terreno com árvores: é compor um ecossistema que responde a terreno, água, clima, tempo e às intervenções do jogador.

O diferencial é unir duas fantasias numa interface legível: a liberdade tátil de **pintar um diorama** e a surpresa controlável de uma **vegetação procedural que se organiza como natureza**. Cada ação deve produzir resultado imediato, bonito e compreensível; com o tempo, o mundo deve contar a história do que aconteceu nele.

### Pilares

1. **Pinte intenção, não instâncias.** O jogador indica biomas, recursos e regras locais; o sistema decide a distribuição natural de cada planta.
2. **Natureza legível.** Água, solo, luz, inclinação e competição explicam visualmente por que algo cresce ou não.
3. **Serenidade com descoberta.** Sem pressão de falhar; objetivos opcionais e pequenos mistérios dão direção a quem quiser jogar.
4. **Diorama que merece ser mostrado.** Voxel artesanal, estação, clima, fauna e modo foto transformam cada mapa em uma cena compartilhável.

## 2. Público e experiência-alvo

**Público principal:** pessoas que gostam de jogos cozy, construção, jardinagem, simulação leve, voxel art e ferramentas criativas.  
**Sessão típica:** 10–30 minutos para criar uma cena ou avançar algumas estações; sessões longas para projetar mapas e desafios.  
**Tom:** contemplativo, acolhedor e curioso. Eventos como fogo ou seca são desafios de manejo e recuperação, nunca punições irreversíveis por padrão.

### Fantasia do jogador

> “Estou restaurando e observando uma floresta em miniatura. Eu crio as condições; a vida encontra seu próprio desenho.”

## 3. Escopo atual

O protótipo já entrega a base de autoria procedural:

- terreno voxel com relevo por ruído;
- pincéis de árvores, grama e borracha, com raio, força, dureza e espécie opcional;
- cinco espécies, formatos e variações determinísticas;
- campos Perlin para densidade, espaçamento, espécie, tamanho, formato, cor e grama;
- vento, iluminação, estilos sazonais, salvar/carregar projeto e exportação JSON/GLB;
- runtime separado com movimentação em terceira pessoa, colisão em troncos e grama reativa.

Essa base deve continuar sendo a camada de **direção artística e edição**. As próximas funções devem adicionar camadas ecológicas, e não substituir o sistema de máscara e ruído que já funciona.

## 4. Loop principal

```text
Ler o terreno → Preparar condições → Plantar/pintar intenção →
Observar as mudanças → Ajustar ou proteger o ecossistema →
Registrar/compartilhar o diorama → Novo terreno ou desafio
```

1. O jogador lê declives, umidade, solo e luz através de overlays simples.
2. Molda o local: eleva/abaixa, cria água, pinta solo, abre clareiras ou planta espécies.
3. Avança o tempo ou muda a estação; o mundo germina, cresce, se espalha e reage.
4. Usa observações para intervir: criar corredor de fauna, conter fogo, recuperar uma área degradada ou apenas compor uma bela paisagem.
5. Salva uma “foto de estação”, exporta o diorama ou inicia outro mapa.

## 5. Sistemas de jogo

### 5.1 Terreno, solo e água

O relevo deixa de ser apenas visual e passa a criar condições de vida. Cada célula do terreno mantém valores normalizados e visíveis em overlay:

| Camada | Origem | Efeito inicial |
|---|---|---|
| Altura e declive | terreno atual | limita espécies e velocidade de caminhada |
| Umidade | água, chuva, altitude e escoamento | favorece grama, samambaias e árvores ribeirinhas |
| Fertilidade | tipo de solo e matéria orgânica | altera germinação e porte |
| Luz | copa acima, hora e estação | define sub-bosque e regeneração |
| Solo | terra, areia, rocha, húmus | dá paleta e regras específicas |

**Ferramentas propostas:** subir/descer terreno, nivelar, pintar tipo de solo, fonte/curso d’água e borracha contextual. A água começa simples: tiles conectados, nível fixo e direção de fluxo visual. Simulação hidráulica completa fica fora do MVP.

### 5.2 Vegetação em camadas

Hoje há árvores e grama. O próximo salto visual e sistêmico é o sub-bosque:

- **Cobertura:** grama baixa, musgo e flores silvestres.
- **Arbustos:** manchas de volume baixo; fornecem abrigo e frutos.
- **Samambaias e plantas de sombra:** aparecem em locais úmidos e sob copa.
- **Árvores jovens:** instâncias pequenas que podem amadurecer entre estações.
- **Árvores mortas e tocos:** preservam a memória de eventos e viram micro-habitat.

Cada tipo usa o mesmo princípio de campo + máscara, agora com uma função de adequação (`umidade × fertilidade × luz × solo × declive`). A intenção pintada segue sendo prioridade sobre aleatoriedade.

### 5.3 Ciclo de tempo e estações

O tempo dá significado às decisões sem exigir simulação em tempo real.

- Relógio visual de manhã, tarde, noite e amanhecer, com luz e cor de céu.
- Quatro estações com duração configurável; botão de avanço de dia/semana/estação.
- Primavera: germinação e flores; verão: crescimento; outono: folhas e sementes; inverno: dormência/neve conforme o estilo.
- Crescimento em **estágios discretos** (semente, broto, jovem, adulta, velha), atualizados em passos de simulação — não a cada frame.

O modo Criativo permite congelar tempo, ignorar condições e editar livremente. O modo Ecossistema usa os parâmetros de adequação e progresso temporal.

### 5.4 Sucessão ecológica leve

Este é o sistema que transforma um gerador em sandbox vivo. A cada avanço de estação, células ativas avaliam regras baratas:

1. plantas maduras produzem sementes dentro de um raio por espécie;
2. uma semente só germina se o solo for adequado e houver espaço;
3. plantas competem por luz e raio pessoal, reduzindo crescimento em excesso;
4. árvores velhas podem virar tocos; o húmus local cresce;
5. espécies pioneiras ocupam clareiras primeiro; espécies de sombra surgem depois.

Não é necessário simular indivíduos invisíveis. Use uma grade de baixa resolução para “pressão de sementes”, umidade, luz e fertilidade; os objetos visíveis são gerados ou atualizados a partir dela. Isso preserva performance e determinismo.

### 5.5 Clima e eventos

Clima deve mudar tanto o ambiente quanto as decisões, mas nunca interromper a edição.

- **Chuva:** enche umidade, intensifica som e cria poças/riachos visuais.
- **Vento:** já existe para vegetação; expandir para direção visual, partículas e queda ocasional de folhas.
- **Névoa, geada e neve:** principalmente atmosféricos; afetam crescimento em modo Ecossistema.
- **Seca:** reduz umidade e aumenta risco de incêndio em mapas-desafio.
- **Fogo controlado:** ferramenta/evento opcional, com propagação por células e possibilidade de aceiro/chuva. Deve ter preview e desfazer.

Incêndios, pragas e tempestades entram após a versão de ciclo de vida. No modo Criativo, são efeitos acionados pelo jogador; no modo Desafio, podem ser condições de cenário.

### 5.6 Fauna como indicador, não como gestão pesada

Fauna deve premiar diversidade visualmente, sem virar um simulador de alimentação.

- borboletas e abelhas: flores e primavera;
- pássaros: árvores maduras, arbustos e água;
- cervos/capivaras ou criaturas estilizadas: clareiras, margem de água e rotas;
- vaga-lumes: noite, umidade e baixa perturbação.

Cada espécie de fauna consulta um pequeno conjunto de condições de habitat. Ao atingir o limiar, ela aparece e permanece em uma área. Uma aba de caderno registra avistamentos e explica a relação, por exemplo: “Pica-pau encontrado: árvores maduras + madeira morta”.

### 5.7 Ferramentas de autoria

Evoluir o painel de pincel para uma paleta organizada, mantendo os atalhos atuais:

- Pincéis por camada: terreno, água, solo, flora, limpeza e marcadores.
- Modos de aplicação: pintar, suavizar, preencher conectado, amostrar e carimbar.
- Carimbos naturais: clareira, bosque ribeirinho, bosque de pinheiros, trilha, campo florido e ruína.
- Seleção de área: copiar/colar, rotacionar e salvar como preset.
- Histórico de ações com desfazer/refazer; requisito antes de qualquer evento destrutivo.
- Overlays: umidade, luz, fertilidade, adequação da espécie, idade da floresta e rotas de fauna.

O menu debug atual fica disponível em “Avançado”; o painel principal deve falar a linguagem de criação, não a linguagem de parâmetros brutos.

### 5.8 Exploração em terceira pessoa

O runtime atual pode tornar-se um modo de visita ao diorama:

- alternância Editor / Explorar sem perder o estado;
- caminhada, corrida curta e câmera de foto; sem combate;
- pontos de interesse, placas naturais e observação de fauna;
- interação contextual mínima: coletar semente para replantio, colocar tronco/ponte decorativa, registrar descoberta.

Este modo é secundário ao sandbox: ele valida escala, dá presença e ajuda na captura, mas não deve bloquear a criação.

### 5.9 Modo foto, coleção e partilha

Prioridade alta porque o jogo já produz cenas expressivas:

- esconder UI, controlar hora, clima, profundidade de campo leve e moldura;
- capturar PNG da tela em alta resolução;
- álbuns de “estações” de um mesmo mapa;
- seed do mundo, preset de estilo e lista de espécies visíveis na captura;
- importação/exportação de projeto continua em JSON; GLB segue como saída para outros pipelines.

## 6. Modos de jogo

| Modo | Objetivo | Regras |
|---|---|---|
| Criativo | Compor qualquer floresta sem atrito | recursos ilimitados, tempo opcional, todos os pincéis |
| Ecossistema | Ver um bioma amadurecer | crescimento, adequação ambiental e fauna ativos |
| Cenários | Resolver uma intenção de paisagem | mapa inicial, metas leves e restrições temáticas |
| Explorar | Caminhar dentro do próprio diorama | câmera em terceira pessoa, observação e foto |

**Exemplos de cenários:** restaurar uma margem erodida; criar uma floresta de outono que atraia três espécies de pássaros; estabelecer um corredor verde entre dois bosques; recuperar uma clareira após seca.

## 7. Progressão e objetivos

Não haverá moeda, grind ou árvore de tecnologia obrigatória. A progressão é de **descoberta e repertório**:

- caderno de campo desbloqueia explicações, presets e desafios;
- marcos opcionais celebram diversidade, idade da floresta e visitas de fauna;
- estilos, espécies e carimbos podem ser liberados por cenários ou ficar livres no modo Criativo;
- avaliação qualitativa ao fim de um cenário: biodiversidade, saúde hídrica, cobertura de copa e composição — sem nota punitiva.

## 8. Direção visual e sonora

### Visual

- voxel detalhado em escala de diorama, com silhuetas de espécies fáceis de distinguir;
- paleta quente e material fosco; cores sazonais controladas pelo sistema de estilo já existente;
- vegetação densa em bordas e áreas úmidas, clareiras que deixam o relevo respirar;
- UI em painéis compactos, com a mesma linguagem creme/terracota do protótipo;
- overlays sem poluir: cores translúcidas, legenda curta e opção de comparar antes/depois.

### Áudio

- camadas reativas de vento, folhas, água, chuva e insetos;
- pássaros e fauna entram por habitat, hora e estação;
- pincéis têm retorno suave: terra, água, semente e poda;
- música ambiental discreta ou ausente por padrão, para preservar a sensação contemplativa.

## 9. UX e acessibilidade

- tudo que altera mapa deve ter feedback visual e botão de desfazer;
- preview do pincel mostra área, camada e resultado provável;
- atalhos sempre visíveis e remapeáveis posteriormente;
- controles de intensidade de vento, tremor de câmera, contraste e escala de interface;
- paletas de overlay com alternativa para daltonismo e informação redundante por ícone/textura;
- simulação em pausa enquanto menus críticos estiverem abertos;
- salvar automático local e projeto portátil em arquivo.

## 10. Direção técnica

### Princípios

- **Determinismo primeiro:** mesma seed + projeto + versão de regras deve produzir o mesmo mundo.
- **Simulação por passos:** clima e ecologia atualizam em ticks ao avançar o tempo, nunca como trabalho contínuo por frame.
- **Dados separados de render:** `VegWorld` mantém o mundo visível; uma estrutura de `EcoGrid` guarda condições e estado ecológico.
- **Instancing continua central:** árvores, arbustos, plantas e fauna simples agrupados por variante/material.
- **Camadas persistentes:** adicionar máscaras de solo/água e estado de idade sem quebrar o JSON de projeto existente.

### Extensão recomendada do projeto

```text
project
├─ terrain / fields / treeMask / grassMask        # já existentes
├─ layers: waterMask, soilMask, shrubMask         # novos pincéis persistentes
├─ ecology: tick, season, weather, ecoGrid        # estado simulável e versionado
├─ entities: plants, deadwood, fauna              # somente objetos que precisam de identidade
└─ journal: discoveries, scenario progress, photos
```

Para manter compatibilidade, projetos antigos recebem valores padrão para campos novos. O `baked.trees` atual permanece útil para exportação, mas a fonte de verdade do modo Ecossistema deve ser a seed, máscaras e estado ecológico.

### Performance: metas iniciais

- manter interação de pincel fluida em mapas padrão;
- manter render acima de 60 FPS no mapa de referência desktop;
- limitar recomputação a chunks afetados por pincel, água ou tick;
- usar LOD/impostores antes de ampliar muito o tamanho padrão do mapa;
- começar fauna como sprites/instâncias simples, não esqueletos animados.

## 11. Roadmap priorizado

### Marco 1 — “Diorama vivo”

**Objetivo:** entregar a primeira experiência completa de criar → avançar tempo → observar mudança → fotografar.

1. desfazer/refazer e sistema de comandos para todos os pincéis;
2. relógio, estações e avanço de tempo;
3. crescimento em estágios para árvores e adição de árvores jovens/tocos;
4. solo e umidade em grid simples, com overlays;
5. arbustos, flores e samambaias por adequação ambiental;
6. modo foto e captura PNG;
7. painel principal simplificado; debug preservado em “Avançado”.

**Critério de sucesso:** em menos de cinco minutos, uma pessoa consegue criar uma cena, avançar uma estação, entender uma mudança ecológica e salvar uma imagem.

### Marco 2 — “Bioma”

**Objetivo:** tornar a floresta capaz de se recuperar e atrair vida.

1. água estática conectada, chuva e escoamento visual simples;
2. germinação, pressão de sementes e competição por luz;
3. fauna-indicador e caderno de campo;
4. carimbos naturais e presets de bioma;
5. primeiro cenário guiado: recuperação de mata ciliar.

### Marco 3 — “Histórias de paisagem”

**Objetivo:** acrescentar desafio e exploração sem perder o clima cozy.

1. troca Editor / Explorar;
2. trilhas, pontes e elementos decorativos;
3. seca, tempestade e fogo controlado com preview/desfazer;
4. cenários adicionais e compartilhamento de seeds/projetos;
5. LOD/impostores para mapas maiores.

### Marco "Paisagem" (decidido em 27/10/2026, antes do Marco 2)

**Objetivo:** cada screenshot e GIF mais bonito — é o que puxa wishlist.

1. pincel de relevo (subir, descer, nivelar, suavizar);
2. rochas e pedregulhos em voxel, pintáveis e automáticos em solo rochoso/encosta;
3. arbustos e juncos;
4. margens d'água (areia/cascalho/lama automáticos, ondulação, espuma);
5. modo Passear em 1ª pessoa dentro do editor;
6. vitrine: demo web + página itch.io.

**Plataforma e venda:** continua no navegador (HTML/three.js). Demo web grátis e limitada; versão completa paga (faixa US$ 8–15) na Steam, empacotada com Tauri/Electron. O porte Godot deixa de ser pré-requisito. Sem anúncios nem microtransações (ver §7).

## 12. Recortes explícitos (por enquanto)

Para proteger o foco, estas ideias não entram antes do Marco 3:

- cadeia alimentar detalhada, fome ou reprodução individual de fauna;
- hidráulica física completa, erosão contínua ou fluidos voxel;
- multiplayer e edição colaborativa em tempo real;
- crafting, combate, inventário pesado ou economia;
- mundo infinito; priorizar mapas finitos, densos e autorais;
- simulação individual de cada folha, semente ou inseto.

## 13. Riscos e decisões abertas

| Tema | Risco | Decisão proposta |
|---|---|---|
| Complexidade de simulação | regra ecológica opaca frustra | usar poucas variáveis, overlay e mensagens de causa/efeito |
| Performance | vegetação + sub-bosque aumenta draw calls | instancing, chunks e atualização localizada desde o início |
| Interface | debug afasta público não técnico | separar “Criar” de “Avançado” sem remover controle profundo |
| Escopo | água, fauna e clima podem virar jogos próprios | versões visuais e discretas antes de simulação física |
| Persistência | estado crescente quebra saves antigos | JSON versionado e migrações com valores padrão |

## 14. Próxima decisão de produção

O primeiro vertical slice recomendado é: **solo + umidade + ciclo de estações + crescimento por estágios + flores/arbustos + modo foto**. Ele reaproveita diretamente os campos, máscaras, estilos e renderizador existentes, prova o pilar de “ecossistema legível” e gera material visual forte antes de investir em água complexa, fauna ou exploração.

