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

2. **Entrega instável: metade das execuções morreu, e o remédio é de infra, não de inteligência.** Das 6 execuções do Kimi, **3 não entregaram**: uma devolveu só o raciocínio sem resposta, e duas estouraram o prazo de 5 min do provedor (cada uma com 1 repescagem que também estourou). É a mesma classe de lição da rodada 3 — *falha de conhecimento é consistente; falha de entrega é aleatória* — e o remédio é idêntico ao que curou o GLM-com-mãos: **prazo maior**. O raciocínio do Kimi é pesado (6,5 a 11,4 mil tokens de raciocínio por resposta) e estoura o teto padrão de 5 min do OpenRouter; subir o `timeoutMs` do provedor no `config/models.json` reduziria os "não entregou" (não foi mexido aqui — protocolo manda rodar o runner validado como está).

3. **O raciocínio pesado sai caro.** As 3 entregas do Kimi custaram **US$ 0,4135 no total**, ou ~**US$ 0,14 por tarefa entregue** — preço observado de ~US$ 3 por milhão de tokens de entrada e ~US$ 15 por milhão de saída, com a saída (o raciocínio) dominando a conta. É o dobro-e-meio a três vezes o custo do Grok 4.5 na rodada 3 (~US$ 0,04/tarefa), o outro texto-puro que passa na armadilha. Então: quando você precisa de texto-puro com biblioteca moderna, o Kimi é uma alternativa que **funciona** — mas o Grok continua mais barato e mais estável.

## Nota metodológica — por que é uma rodada parcial

As duas raias Gemini (3.1 Pro high e 3.6 Flash high) **não pontuaram nenhuma execução** porque a cota da assinatura Google esgotou no dia ("Individual quota reached ... Resets in 167h", medido a partir de 2026-07-22 por volta das 17h30). Contando 167h, a janela reabre por volta de **2026-07-29**, quando as 12 células dos Gemini (2 raias × 2 estações × 3 rodadas) serão reexecutadas com o mesmo runner e os mesmos corretores.

Fica registrado o **comportamento observado na única tentativa real antes da cota estourar** (não conta como nota, é só evidência qualitativa):

- **A leitura de arquivos dos Gemini está funcionando** — o Flash leu corretamente a versão do zod (4.4.3) instalada no cenário durante um teste. Isso é resultado da feature 0.4.0 (o Gemini ganhou olhos).
- Na estação A, o **3.1 Pro tentou EDITAR o arquivo direto** em vez de colar o código na resposta em texto — a ação foi negada pelo modo somente-leitura do agy (soft-deny), e a raia ficou sem resposta final. É um comportamento a observar na reexecução: o modelo com olhos quer usar as mãos, mas a raia é de leitura só.

Enquanto os Gemini não rodam de verdade, as células deles ficam marcadas como **adiado**, nunca como zero — ausência de dado não é dado.
