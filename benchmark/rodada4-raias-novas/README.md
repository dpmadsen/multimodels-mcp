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
| Kimi K3 (texto) | 14 · **✗**¹ · 14 | 18 · 18 · 18 |
| Gemini 3.1 Pro · high | (adiado — cota, reexecução ~29/07)² | (adiado — cota, reexecução ~29/07)² |
| Gemini 3.6 Flash · high | (adiado — cota, reexecução ~29/07)² | (adiado — cota, reexecução ~29/07)² |

¹ A r2 (✗): falha **sistemática** do modelo — raciocina até o fim e não emite a resposta final. Três tentativas idênticas, todas sem entregar.
² Gemini adiado: cota da assinatura esgotada no dia. Ver a nota metodológica abaixo.

Placar consolidado do Kimi: **5 de 6 gabaritado**, com uma única falha sistemática (A r2). Onde entregou, levou 2,6 e 6,3 min na estação A; 4,5, 11,9 e 2,75 min na estação B — o mais lento do estudo, chegando a 6–12 min nas provas pesadas.

## As lições (só do que os dados mostram)

1. **A armadilha da data de corte foi vencida por texto-puro pela 2ª vez — o "clube da memória fresca" agora tem dois membros.** Na rodada 3, o Grok 4.5 foi o único texto-puro (sem mãos, sem olhar a versão instalada) a passar na estação A. O Kimi K3 acaba de ser o segundo: 14/14 na estação A **só com texto**, escrevendo a API nova do zod v4 de memória (usou `z.email`, `z.ipv4`, `z.cidrv4` — a cara da v4). Continua valendo a regra da rodada 3: contra a armadilha de conhecimento atual só há duas defesas, ter **mãos** ou ter **memória fresca** — e a lista de quem tem memória fresca cresceu de um para dois.

2. **Gabarita, mas devagar e com um tique próprio.** Onde entregou, o Kimi acertou tudo — 5 de 6 gabaritado (A 14·✗·14 / B 18·18·18). O preço disso é o ritmo: é **o modelo mais lento do estudo**, pensando de 6 a 12 minutos nas provas pesadas. E sobra **uma falha sistemática** dele: na estação A r2, o modelo raciocina até o fim e **não emite a resposta final** — aconteceu 3 vezes seguidas, idêntico. Não é azar de entrega (isso seria aleatório entre rodadas); é um comportamento próprio do modelo, que reaparece na mesma célula. Bom saber antes de confiar uma tarefa a ele.

3. **O raciocínio pesado sai caro.** O Kimi é o modelo que mais pensa do estudo (o raciocínio domina a saída de tokens), com preço observado de ~US$ 3 por milhão de tokens de entrada e ~US$ 15 por milhão de saída. Na prática dá ~**US$ 0,20 por tarefa entregue** — cerca de **5× o custo do Grok 4.5** (~US$ 0,04/tarefa), o outro texto-puro que passa na armadilha. Então: quando você precisa de texto-puro com biblioteca moderna, o Kimi **funciona**, mas o Grok continua bem mais barato, mais rápido e sem o tique de fechar o raciocínio sem responder.

## Nota metodológica — por que é uma rodada parcial

As duas raias Gemini (3.1 Pro high e 3.6 Flash high) **não pontuaram nenhuma execução** porque a cota da assinatura Google esgotou no dia ("Individual quota reached ... Resets in 167h", medido a partir de 2026-07-22 por volta das 17h30). Contando 167h, a janela reabre por volta de **2026-07-29**, quando as 12 células dos Gemini (2 raias × 2 estações × 3 rodadas) serão reexecutadas com o mesmo runner e os mesmos corretores.

Fica registrado o **comportamento observado na única tentativa real antes da cota estourar** (não conta como nota, é só evidência qualitativa):

- **A leitura de arquivos dos Gemini está funcionando** — o Flash leu corretamente a versão do zod (4.4.3) instalada no cenário durante um teste. Isso é resultado da feature 0.4.0 (o Gemini ganhou olhos).
- Na estação A, o **3.1 Pro tentou EDITAR o arquivo direto** em vez de colar o código na resposta em texto — a ação foi negada pelo modo somente-leitura do agy (soft-deny), e a raia ficou sem resposta final. É um comportamento a observar na reexecução: o modelo com olhos quer usar as mãos, mas a raia é de leitura só.

Enquanto os Gemini não rodam de verdade, as células deles ficam marcadas como **adiado**, nunca como zero — ausência de dado não é dado.
