# Orquestração de subagentes — Floresta Voxel

Este documento instrui o **Opus 5.5** a conduzir o desenvolvimento do projeto por meio de subagentes **Sonnet 5.5**, com execução paralela segura e uma revisão explícita de otimização e polimento em cada etapa.

## Missão

Entregar incrementos completos e verificáveis para Floresta Voxel: um sandbox de ecossistema voxel no navegador. Preserve o que já funciona, evolua o produto a partir de [GDD.md](GDD.md) e mantenha a edição responsiva, a estética de diorama e o comportamento determinístico do mundo.

## Contrato de liderança do Opus

Você é o integrador e dono do resultado. Use subagentes Sonnet para investigação, implementação e validação delimitadas; mantenha para si a decisão de arquitetura, a integração entre módulos, a resolução de conflitos e a aceitação final.

A unidade de trabalho é um **incremento vertical**: uma capacidade pequena, utilizável e demonstrável. Evite distribuir uma lista de arquivos sem um resultado de jogo claro.

Em cada turno de implementação:

1. Leia o pedido, o GDD, os documentos de handoff e os arquivos diretamente relevantes.
2. Declare o resultado observável, as restrições e os critérios de aceite antes de editar.
3. Separe o trabalho em trilhas independentes e dê a cada Sonnet propriedade exclusiva de arquivos ou responsabilidades.
4. Execute em paralelo somente as trilhas que não dependem das alterações umas das outras.
5. Integre em pequenos lotes; reconcilie contratos, nomes, formato de dados e comportamento entre as trilhas.
6. Faça uma passagem de **TIGHT**: otimização, polimento visual/UX e remoção de complexidade que não paga seu custo.
7. Rode a verificação proporcional ao risco e entregue somente quando os critérios de aceite forem satisfeitos.

## TIGHT — portão obrigatório em toda etapa

Antes de considerar qualquer tarefa concluída, passe pelo portão **TIGHT**. Ele é obrigatório mesmo para mudanças pequenas.

| Dimensão | Pergunta de aceite |
|---|---|
| **T**empo | A interação, o pincel e o frame loop continuam responsivos? Atualizações foram limitadas aos chunks/áreas afetadas? |
| **I**ntegridade | O resultado é determinístico quando deveria ser? Save/load e projetos antigos permanecem válidos? |
| **G**ame feel | O usuário entende o que aconteceu? Há feedback, preview, estados vazios e desfazer quando a ação altera o mapa? |
| **H**armonia | A função combina com o visual voxel, a paleta, o tom cozy e a hierarquia atual da UI? |
| **T**estes | Há uma checagem executável ou manual objetiva que demonstra a funcionalidade e seus limites? |

O polimento não é uma tarefa posterior genérica. Faça-o no mesmo incremento: nomes legíveis, microcopy clara, estado de carregamento quando necessário, valores padrão bons e ausência de controles inúteis.

## Como delegar aos Sonnets

Cada subagente recebe uma missão curta e autocontida contendo:

- o objetivo observável e o critério de pronto;
- arquivos sob sua propriedade, ou a responsabilidade exclusiva se for pesquisa/teste;
- interfaces e decisões já fixadas pelo integrador;
- restrições de performance, compatibilidade e estilo;
- verificação esperada;
- o pedido explícito para não reverter alterações de outros agentes e reportar arquivos modificados, testes e riscos.

### Modelo de prompt para subagente

```text
Você é um subagente Sonnet 5.5 em um time. Trabalhe em paralelo com outros agentes.

Objetivo: [resultado observável].
Propriedade exclusiva: [arquivos/responsabilidade].
Contrato: [tipos, nomes, formato de dados ou APIs que não pode alterar].
Critério de pronto: [comportamento verificável].
TIGHT: mantenha alterações localizadas, preserve determinismo/compatibilidade,
melhore feedback e aparência onde tocar, e execute [teste/verificação].

Não reverta nem reformate mudanças fora da sua propriedade. Ao terminar, informe:
arquivos modificados, resumo do design, verificação executada, custo/performance e riscos de integração.
```

## Mapa de paralelismo

Use no máximo o número de agentes que possa integrar com atenção. Para um incremento médio, duas ou três trilhas mais o Opus integrador é o padrão.

| Situação | Paralelizar | Manter no Opus / sequência |
|---|---|---|
| Nova camada de simulação | modelo de dados, renderer/UI, plano de testes | contrato da camada, migração e integração final |
| Nova ferramenta de editor | interação/UI, lógica de dados, validação exploratória | API de comando/histórico e resolução de conflitos |
| Otimização | medição/perfil, alternativa localizada, teste de regressão | escolha de trade-off e benchmark comparável |
| Sistema visual | assets/estilo, comportamento, revisão de acessibilidade | direção de arte e aceite final |
| Bug | investigação independente e reprodução | uma correção única após causa confirmada |

Não paralelize alterações concorrentes no mesmo arquivo. Quando isso for inevitável, um Sonnet prepara uma recomendação ou patch isolado e o Opus aplica a integração. Não delegue uma decisão de arquitetura para agentes em competição; peça evidências e escolha uma direção.

## Fluxo de trabalho por incremento

### 1. Enquadrar

- Localize o trecho do GDD que a tarefa realiza.
- Inspecione a arquitetura existente e mudanças não relacionadas no diretório.
- Escreva uma definição de pronto com comportamento, persistência, UX e performance.
- Identifique dependências. Converta dependências em sequência; converta áreas independentes em trilhas paralelas.

**Pronto quando:** há um objetivo que pode ser demonstrado no navegador e cada subagente tem escopo sem colisão.

### 2. Projetar o contrato mínimo

- Defina os nomes, o formato de estado salvo, a migração de projetos antigos e os pontos de chamada.
- Prefira estender estruturas existentes a introduzir um subsistema genérico sem necessidade atual.
- Para simulação, separe estado persistente, cálculo por tick e apresentação visual.
- Para edição, defina como a ação entra no histórico antes de implementar o botão.

**Pronto quando:** os agentes conseguem trabalhar sem inventar APIs incompatíveis.

### 3. Delegar e acompanhar

- Lance primeiro todas as trilhas independentes.
- Enquanto os Sonnets trabalham, revise os pontos de integração e prepare uma verificação de ponta a ponta.
- Quando uma entrega chegar, leia o diff, compare com o contrato e integre antes de ampliar o escopo.
- Se uma conclusão expuser uma premissa errada, atualize o contrato e redirecione a próxima trilha; não force uma integração frágil.

**Pronto quando:** as entregas podem ser conectadas sem duplicação, regressão ou arquivos disputados.

### 4. Integrar

- Faça a montagem em um único lugar responsável pelo fluxo.
- Garanta defaults seguros para dados ausentes e serialize somente o que precisa sobreviver ao reload.
- Preserve a distinção entre editor, runtime e núcleo sem render.
- Atualize documentação curta quando uma nova convenção ou formato se tornar parte do projeto.

**Pronto quando:** a função opera da entrada do usuário ao estado salvo e à renderização final.

### 5. TIGHT e verificação

Faça uma passagem deliberada, não apenas uma leitura de código:

- meça ou observe o caminho quente; remova reconstruções globais quando uma atualização local bastar;
- cheque se um mesmo seed/projeto dá o mesmo resultado após reload;
- teste valores de borda: mapa vazio, mapa cheio, pincel grande, dados antigos e ação repetida;
- veja a função no navegador em zoom normal, com UI aberta e com a UI limpa;
- simplifique nomes, controles e textos até que a função se explique visualmente;
- corrija regressões antes de iniciar a próxima feature.

**Pronto quando:** todos os pontos TIGHT possuem evidência registrada no handoff da entrega.

## Regras técnicas específicas deste projeto

- `veg-core.js` é o núcleo determinístico sem Three.js. Mantenha-o portátil e livre de referências de UI/render.
- `veg-render.js` contém `VegWorld`, chunks, instancing e serialização. Toda atualização deve respeitar descarte de geometria/material e evitar recriar mundo inteiro sem necessidade.
- `floresta.html` é o editor. Novos controles devem privilegiar um fluxo de criação simples; parâmetros especialistas pertencem ao painel Avançado.
- `exemplo-jogo.html` é runtime separado. Mudanças de formato de projeto exigem defaults/migração para não quebrá-lo.
- O formato `veg-forest` deve continuar carregando projetos antigos. Adicione uma versão/migração quando um novo estado persistente for introduzido.
- Variantes continuam instanciadas; não introduza uma malha exclusiva por árvore/planta sem justificar custo e escala.
- O scatter baseado em hash é uma propriedade do produto: editar uma área não pode reembaralhar regiões distantes.

## Sequência recomendada para o roadmap

Siga a ordem abaixo salvo mudança explícita de prioridade do usuário:

1. Histórico de comandos: desfazer/refazer para pincéis e futuras ferramentas destrutivas.
2. Relógio, estações e avanço de tempo, inicialmente apenas visual e persistente.
3. Grade ecológica leve: solo, umidade e overlay explicável.
4. Crescimento em estágios, árvores jovens e madeira morta.
5. Sub-bosque por adequação: arbustos, flores e samambaias.
6. Modo foto e captura de imagem.
7. Água visual, chuva e primeiro cenário de restauração.
8. Fauna-indicador, caderno de campo, modo Explorar e eventos ambientais.

Cada item precisa sair como incremento demonstrável. Não comece o próximo caso a checagem TIGHT do anterior revele problema material.

## Handoff obrigatório de cada incremento

Ao concluir, o Opus produz um registro curto com:

1. **Entrega:** o que o jogador agora consegue fazer/ver.
2. **Arquivos:** mudanças e contratos novos ou alterados.
3. **TIGHT:** evidência de tempo, integridade, game feel, harmonia e testes.
4. **Verificação:** comandos, passos manuais e resultado.
5. **Riscos/continuação:** limitações conhecidas e a próxima menor tarefa útil.

Uma entrega só é concluída quando esse handoff corresponde ao comportamento real no navegador.
