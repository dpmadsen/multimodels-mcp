# Rodada 4 (parcial) — Os estreantes: Kimi K3 agora, Gemini na próxima janela

Data: 2026-07-22. Duas raias novas nas mesmas 2 estações da rodada 3 — o Kimi K3 (texto-puro, via OpenRouter) e os dois Gemini (3.1 Pro high e 3.6 Flash high, pela assinatura Google). Só o Kimi rodou; as duas raias Gemini ficaram **adiadas** por esgotamento de cota (ver a nota metodológica no fim). Por isso: **rodada parcial**.

## As provas

São **exatamente as mesmas** da [rodada 3](../rodada3-esforco-e-cutoff/README.md) — mesmos enunciados, mesmo cenário com dependência de verdade instalada, mesmos corretores ocultos. Nada foi reescrito, para que as notas novas se comparem célula a célula com as antigas.

- **Estação A — armadilha da data de corte** ([estacao-a.md](../rodada3-esforco-e-cutoff/estacao-a.md)): validador usando o **zod v4 instalado de verdade** no cenário (reconstruído aqui com zod 4.4.3). Quem escreve a API antiga (v3) de memória entrega código que nem carrega. 14 verificações ocultas.
- **Estação B — raciocínio puro** ([estacao-b.md](../rodada3-esforco-e-cutoff/estacao-b.md)): rateio de centavos com tetos e regras cruéis, sem dependências. 18 verificações ocultas.
- Cada entrega corrigida pelos corretores que nenhum modelo viu ([grade-a.mjs](../rodada3-esforco-e-cutoff/grade-a.mjs) / [grade-b.mjs](../rodada3-esforco-e-cutoff/grade-b.mjs)). Placar célula a célula em [placar.tsv](placar.tsv); status detalhado em [STATUS.md](STATUS.md); respostas cruas em [saidas/](saidas/).

## Placar (r1 · r2 · r3)

| Raia | A: zod v4 (14) | B: rateio (18) |
|---|---|---|
| Kimi K3 (texto) | 14 · **não entregou**¹ · **não entregou**² | 18 · **não entregou**² · 18 |
| Gemini 3.1 Pro · high | (adiado — cota, reexecução ~29/07)³ | (adiado — cota, reexecução ~29/07)³ |
| Gemini 3.6 Flash · high | (adiado — cota, reexecução ~29/07)³ | (adiado — cota, reexecução ~29/07)³ |

¹ A r2: o modelo devolveu **só o raciocínio interno**, sem resposta final (falha de MODELO — sem repescagem, por protocolo).
² A r3 e B r2: **timeout de 5 min** do provedor, 2 vezes cada (falha de INFRA — 1 repescagem cada, que também estourou o prazo).
³ Gemini adiado: cota da assinatura esgotada no dia. Ver a nota metodológica abaixo.

Onde o Kimi entregou, **gabaritou**: 14/14 e 18/18 (este último duas vezes).

## As lições (só do que os dados mostram)

1. **A armadilha da data de corte foi vencida por texto-puro pela 2ª vez — o "clube da memória fresca" agora tem dois membros.** Na rodada 3, o Grok 4.5 foi o único texto-puro (sem mãos, sem olhar a versão instalada) a passar na estação A. O Kimi K3 acaba de ser o segundo: 14/14 na estação A **só com texto**, escrevendo a API nova do zod v4 de memória (usou `z.email`, `z.ipv4`, `z.cidrv4` — a cara da v4). Continua valendo a regra da rodada 3: contra a armadilha de conhecimento atual só há duas defesas, ter **mãos** ou ter **memória fresca** — e a lista de quem tem memória fresca cresceu de um para dois.

2. **O prazo desigual mascarava o perfil do modelo: no teto justo, 5 de 6 entregas são perfeitas; sobra UMA falha sistemática.** No placar oficial (@5min) o Kimi parecia um modelo de entrega instável, com 3 de 6 execuções mortas. A verificação de 23/07 (seção abaixo) desmontou isso: o teto era **desigual** — o Kimi rodou com 5 min (padrão do OpenRouter) enquanto a raia GLM-texto teve 15 min na rodada 3. Duas das três "falhas" (A r3 e B r2) eram só o cronômetro curto demais: com 15 min entregaram **14/14 e 18/18**, gastando 6,3 min e 11,9 min — sempre passariam de 5 min. Com o prazo equalizado, o placar vira **5 de 6 perfeito**. O que **não** é infra: a estação A r2 falhou nas três condições (5 min ontem, 5 min e 15 min hoje) — e nas rodadas longas o modo foi sempre o mesmo, **"fecha o raciocínio e não emite a resposta final"**. Isso é uma falha sistemática do modelo (reapareceu 3× na mesma célula), não um azar de entrega. **Correção de infra aplicada:** o `timeoutMs` do provedor openrouter foi subido para **900000 (15 min), permanente** no `config/models.json`, equalizando com a z.ai — decisão do Daniel. Com isso, o que sobra do Kimi não é tempo, é o tique de "só raciocínio".

3. **O raciocínio pesado sai caro.** O Kimi é o modelo que mais pensa do estudo (7 a 25 mil tokens de saída por resposta, o raciocínio dominando), com preço observado de ~US$ 3 por milhão de tokens de entrada e ~US$ 15 por milhão de saída. Somando as 3 entregas da rodada (US$ 0,4135) e as 2 da verificação (US$ 0,564), dá ~**US$ 0,20 por tarefa entregue** considerando tudo — cerca de **5× o custo do Grok 4.5** (~US$ 0,04/tarefa), o outro texto-puro que passa na armadilha. Então: quando você precisa de texto-puro com biblioteca moderna, o Kimi **funciona** (com o prazo de 15 min), mas o Grok continua bem mais barato — e sem o tique de fechar o raciocínio sem responder.

## Verificação com prazo equalizado (23/07)

O Daniel estranhou o Kimi ter falhado metade das células e pediu para re-rodar **só as três que falharam**, para separar o que foi azar de infra do que é padrão do modelo. Na conferência descobrimos a **desigualdade de prazo**: o Kimi correu com o teto padrão do OpenRouter (5 min), enquanto a raia GLM-texto teve 15 min na rodada 3. Para equalizar, o `timeoutMs` do provedor openrouter foi subido para **900000 (15 min)** no `config/models.json` (`npm run build`, timeout efetivo conferido) — mudança **permanente**, decisão do Daniel.

O placar oficial de ontem (@5min) permanece **intacto** — é o dado da rodada. Esta seção é verificação por cima, para transparência.

| Célula | Ontem @5min (oficial) | Hoje @15min (prazo equalizado) | Duração | Custo US$ |
|---|---|---|---|---|
| A r2 (zod v4) | não entregou (só raciocínio) | **não entregou (só raciocínio)** | — | — |
| A r3 (zod v4) | não entregou (timeout 5min ×2) | **14/14** | 380s (6,3 min) | 0,1915 |
| B r2 (rateio) | não entregou (timeout 5min ×2) | **18/18** | 716s (11,9 min) | 0,3726 |

Leitura seca (só o que os dados mostram):

- **A r3 e B r2 eram o cronômetro curto:** com 15 min entregaram perfeito, gastando 6,3 min e 11,9 min — ou seja, sempre passariam do teto de 5 min. Com o prazo justo, o Kimi vai a **5 de 6 perfeito** na rodada.
- **A r2 é outra coisa:** falhou nas três condições (5 min ontem, 5 min e 15 min hoje). Nas duas execuções longas o comportamento foi o mesmo — o modelo **fecha o raciocínio interno e não emite a resposta final**. Não é timeout; é uma falha sistemática do modelo, que reapareceu 3× na mesma célula. Prazo maior não resolve.
- Respostas cruas @15min entregues: [`saidas/kimi-k3-a-r3-verificacao.md`](saidas/kimi-k3-a-r3-verificacao.md) e [`saidas/kimi-k3-b-r2-verificacao.md`](saidas/kimi-k3-b-r2-verificacao.md) (A r2 não gerou texto, só raciocínio).

Custo desta verificação (só chamadas com usage retornado): **≈ US$ 0,564**. Somado à rodada, o custo por tarefa entregue do Kimi considerando tudo fica em **≈ US$ 0,20**.

## Nota metodológica — por que é uma rodada parcial

As duas raias Gemini (3.1 Pro high e 3.6 Flash high) **não pontuaram nenhuma execução** porque a cota da assinatura Google esgotou no dia ("Individual quota reached ... Resets in 167h", medido a partir de 2026-07-22 por volta das 17h30). Contando 167h, a janela reabre por volta de **2026-07-29**, quando as 12 células dos Gemini (2 raias × 2 estações × 3 rodadas) serão reexecutadas com o mesmo runner e os mesmos corretores.

Fica registrado o **comportamento observado na única tentativa real antes da cota estourar** (não conta como nota, é só evidência qualitativa):

- **A leitura de arquivos dos Gemini está funcionando** — o Flash leu corretamente a versão do zod (4.4.3) instalada no cenário durante um teste. Isso é resultado da feature 0.4.0 (o Gemini ganhou olhos).
- Na estação A, o **3.1 Pro tentou EDITAR o arquivo direto** em vez de colar o código na resposta em texto — a ação foi negada pelo modo somente-leitura do agy (soft-deny), e a raia ficou sem resposta final. É um comportamento a observar na reexecução: o modelo com olhos quer usar as mãos, mas a raia é de leitura só.

Enquanto os Gemini não rodam de verdade, as células deles ficam marcadas como **adiado**, nunca como zero — ausência de dado não é dado.
