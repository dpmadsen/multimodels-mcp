# Rodada 2 — Tarefa real: 5 modelos implementam a mesma feature

Data: 2026-07-20. Evolução do benchmark de estações: em vez de provas de laboratório, uma **tarefa real do projeto** (nascida do feedback do Reddit), implementada de forma independente por 5 modelos, cada um na sua branch.

## A tarefa

Implementar a escolha de modelo (`codex:gpt-5.6-luna` etc.) e de esforço de raciocínio no provedor Codex do multimodels — a melhoria mais pedida depois do benchmark. Spec única e detalhada ([spec.md](spec.md)), escrita antes, junto com 12 verificações ocultas ([grade-impl.mjs](grade-impl.mjs)) que nenhum implementador viu.

## As raias

| Branch | Implementador | Como trabalhou |
|---|---|---|
| `raia-sonnet` | Claude Sonnet 5 | subagente com acesso aos arquivos |
| `raia-opus` | Claude Opus 4.8 | subagente com acesso aos arquivos |
| `raia-terra` | GPT-5.6 Terra | Codex CLI editando a pasta direto |
| `raia-luna` | GPT-5.6 Luna | Codex CLI editando a pasta direto |
| `raia-dspro` | DS4 Pro | só texto: recebeu spec + código anexado, o orquestrador aplicou |

Orquestrador em todas: Claude Fable 5. As branches com o trabalho de cada um continuam no repositório.

**Esforço de raciocínio:** Terra e Luna rodaram com `xhigh` (o padrão global do Codex CLI na máquina — confirmado nos registros de sessão); Sonnet e Opus rodaram no esforço padrão de subagente. Variável não controlada nesta rodada — o campo `effort` que esta própria feature criou permite controlar isso na próxima.

## Resultado

| | Testes ocultos | Testes do projeto | Preservou os testes antigos? | Comentários no padrão da casa | Tempo | Custo equivalente em API |
|---|---|---|---|---|---|---|
| **Sonnet 5** 🥇 | 12/12 | 43/43 (16 novos) | sim | sim, os melhores | 2min20s | ~US$ 1,1 (estimado)* |
| **Opus 4.8** 🥈 | 12/12 | 42/42 (15 novos) | sim | sim | 2min33s | ~US$ 1,5 (estimado)* |
| **GPT-5.6 Luna** | 12/12 | 41/41 (14 novos) | sim | não (zero comentários) | 5min04s | US$ 0,25 (medido)** |
| **GPT-5.6 Terra** | 12/12 | 40/40 (13 novos) | sim | não (zero comentários) | 4min08s | US$ 0,43 (medido)** |
| **DS4 Pro** | 12/12 | 37/37 | **não — apagou 7 testes** | sim | ~2min | US$ 0,012 (medido) |

\* Anthropic: o harness reporta um número único de tokens (Sonnet 75k, Opus 61k) sem separar entrada/saída; estimativa precificando como saída.
\** Codex: números exatos dos registros do CLI, incluindo raciocínio oculto e entrada re-lida a cada passo (Terra: 571k entrada/12k saída; Luna: 941k entrada/15k saída — 90%+ da entrada veio do cache). Custo real pro Daniel: US$ 0 (assinaturas), exceto DS4 Pro.

## O que a tarefa real revelou (que as estações não mostraram)

1. **Na vida real, os Anthropic viraram o jogo.** Sonnet — que apanhou nas estações sintéticas — entregou o melhor trabalho: mais testes, comentários em português no estilo exato do projeto, mensagens de erro mais úteis e o melhor CHANGELOG. Vantagem de casa: agentes nativos do Claude Code seguem as convenções do CLAUDE.md com naturalidade.
2. **Terra e Luna: código perfeito, zero comentários.** Funcionalmente impecáveis (e o Luna de novo igual ao Terra custando menos), mas ignoraram o padrão do projeto de comentar em português — num projeto de quem não programa, comentário é documentação vital.
3. **A raia só-texto cobrou o preço previsto.** O DS4 Pro recebeu o arquivo de testes resumido (culpa do orquestrador) e, em vez de só adicionar testes, reescreveu o arquivo — apagando 7 testes existentes. É a regra de ouro nº 2 do benchmark confirmada em produção: **sem contexto completo anexado, modelo sem acesso a arquivos erra por não saber o que não vê.**
4. **Custo de agente ≠ custo de chat.** No benchmark de texto, uma resposta do Codex custava centavos de dólar. Como agente (lendo arquivos, iterando, rodando testes), a entrada re-lida a cada passo multiplica o custo por ~20× — exatamente o "pedágio de contexto dobrado" apontado no Reddit. Assinaturas e cache tornam isso irrelevante pro Daniel, mas quem paga API deve saber.
5. **Teste objetivo continua não separando os bons.** 12/12 pra todo mundo — quem decide é a revisão fina (estilo, preservação de testes, documentação). Crítica do Reddit ("torne as provas mais difíceis") confirmada.

## Adendo — raia GLM 5.2 (rodada extra, mesmo protocolo)

O GLM 5.2 (z.ai) rodou depois, na raia texto-puro com o MESMO pacote do DS4 Pro (inclusive o arquivo de testes resumido). Resultado:

- **12/12 nas verificações ocultas**, como todos.
- **Não caiu na armadilha do DS4 Pro**: em vez de reescrever o arquivo de testes que só viu pela metade, criou um arquivo novo (`config.codex.test.ts`) e preservou os 7 testes originais — o melhor instinto entre as raias texto-puro.
- Comentários em português no padrão da casa (melhores que os dos GPTs) e CHANGELOG caprichado.
- **Mas entregou 43/44: um teste vermelho** — o próprio teste dele cobra uma mensagem de erro ("nenhum modelo explícito") diferente da que o próprio código emite ("não tem modelos explícitos"). Autoconsistência que qualquer raia com acesso a arquivos teria pego rodando `npm test` — a cegueira da raia texto-puro de novo, agora do outro lado: não foi falta de contexto, foi falta de poder verificar.
- Custo: 4.651 entrada / 5.566 saída ≈ US$ 0,016 equivalente (o mais enxuto das raias texto-puro; DS4 Pro gastou 2× mais saída). Real: US$ 0 (assinatura).

Colocação: melhor raia texto-puro em qualidade de código e instinto, atrás das quatro raias com acesso a arquivos por ter entregado suíte vermelha. O patch completo está em [glm-patch.diff](glm-patch.diff) (a branch `raia-glm` foi avaliada e apagada em seguida, conforme combinado).

## Adendo 2 — Rodada 2.1: o MESMO GLM 5.2, agora com mãos

Pra isolar a variável "raia", rodamos o GLM 5.2 de novo — mesmo modelo, mesma spec — mas dentro do **Claude Code em modo silencioso** apontado pro endpoint Anthropic-compatível da z.ai (integração oficial do plano de coding; script em [rodada21-glm-cc.sh](rodada21-glm-cc.sh), rodado com identidade limpa pra não usar o login do Daniel). Com acesso aos arquivos e poder de rodar `npm test`:

- **45/45 testes verdes — a maior suíte de todas as raias** (11 testes novos, incluindo mais casos que o vencedor Sonnet), 12/12 nas verificações ocultas.
- **Zero deleções**: estendeu o `config.test.ts` original em vez de reescrever (40 linhas adicionadas, 0 removidas).
- Comentários em português no estilo exato da casa e um dos melhores CHANGELOGs do experimento (explica até o motivo da feature).
- **A suíte vermelha da raia texto-puro desapareceu** — mesma cabeça, raia diferente. É a evidência causal mais limpa do estudo: a falha do adendo 1 era da *raia* (cegueira de verificação), não do *modelo*.
- Custos: 6min42s (o mais lento), ~43k entrada + 805k cache + 14,8k saída ≈ US$ 0,11 equivalente (~7× a versão texto-puro dele — o "imposto de agente" de novo). Real: US$ 0 (assinatura).
- Nota de método: o arnês era o do Claude Code — o mesmo do Sonnet vencedor — então esta raia também "joga em casa". Patch completo em [glmcc-patch.diff](glmcc-patch.diff); a branch `raia-glm-cc` foi avaliada e apagada.

**Veredito:** a implementação do Sonnet 5 foi a vencedora e virou a oficial (merge na linha principal). Pro dia a dia: tarefas com spec dentro do projeto → Sonnet resolve com qualidade de casa; Luna segue imbatível em custo×qualidade pra tarefas fora do repositório ou de segunda opinião.
