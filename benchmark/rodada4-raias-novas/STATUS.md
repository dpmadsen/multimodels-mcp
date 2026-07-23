# Rodada 4 — status: PARCIAL (kimi-k3 concluída; gemini adiado)

Data: 2026-07-23. Mesmas provas da rodada 3 (estacao-a.md / estacao-b.md,
grade-a.mjs / grade-b.mjs). Corretores e cenário validados.

## Situação por raia

| Raia | Estação | Situação |
|---|---|---|
| kimi-k3 | A e B | **CONCLUÍDA**. 5 de 6 células gabaritadas; 1 falha sistemática do modelo (A r2). |
| gemini31pro-high | A e B | **ADIADO**: cota da assinatura Gemini/agy esgotada. Reexecutar **~2026-07-29**. |
| gemini36flash-high | A e B | **ADIADO**: mesma cota (compartilhada com o pro) esgotada. Reexecutar **~2026-07-29**. |

## Placar consolidado kimi-k3 (r1 · r2 · r3)

| Raia | A: zod v4 (14) | B: rateio (18) |
|---|---|---|
| kimi-k3 | 14 · **✗** · 14 | 18 · 18 · 18 |

`✗` = A r2: falha **sistemática** do modelo — raciocina até o fim e não emite a resposta final.
Três tentativas idênticas, todas sem entregar (não é timeout nem azar de infra; é comportamento do modelo).

## Dados por célula entregue (OpenRouter reporta o custo direto)

| Exec | nota | dur (s) | tokens saída | reasoning | custo (US$) |
|---|---|---|---|---|---|
| A r1 | 14/14 | 157 | 7466 | 6840 | 0,114528 |
| A r2 | ✗ (só raciocínio) | — | — | — | — |
| A r3 | 14/14 | 380 | 12735 | — | 0,1915 |
| B r1 | 18/18 | 271 | 12267 | 11402 | 0,187113 |
| B r2 | 18/18 | 716 | 24633 | — | 0,3726 |
| B r3 | 18/18 | 165 | 7435 | 6538 | 0,111868 |
| **Total (5 entregas)** | | | | | **≈ 0,978** |

Custo por tarefa entregue: **≈ US$ 0,20**. Preço observado do kimi-k3 no OpenRouter:
**~US$ 3 / milhão de tokens de entrada** e **~US$ 15 / milhão de tokens de saída** (a saída, dominada
pelo raciocínio, é o que pesa). O kimi-k3 é o modelo mais lento do estudo (6–12 min nas provas pesadas).

## O que ficou validado (encanamento OK)

- Build atualizado; cenário A reconstruído em `cenario-a/` com **zod 4.4.3** instalado de verdade
  (ESM, script test = `node --test testes/`, testes públicos em `testes/publicos.mjs`).
- Referência A (zod v4) → grade-a.mjs **14/14**; referência B → grade-b.mjs **18/18**.
- Runner `runner/run-one.mjs`: monta prova + apêndice de entrega, extrai bloco ```javascript,
  corrige e registra nota/duração/tokens/usage.
- Respostas cruas entregues em `saidas/`; correções em `correcoes/`.

## Observação: kimi-k3 na estação A só com texto

O kimi-k3 gabaritou a estação A (armadilha da data de corte) **só com texto**, sem olhar os arquivos:
conhece a API do zod v4 de memória (`z.email`, `z.ipv4`, `z.cidrv4`). É o 2º texto-puro do estudo a
passar nessa prova, ao lado do Grok 4.5.

## Observação: gemini antes da cota estourar

- A leitura de arquivos dos Gemini está funcionando (o Flash leu a versão do zod 4.4.3 instalada
  corretamente num teste).
- Na estação A, o 3.1 Pro tentou EDITAR o arquivo direto (negado pelo modo somente-leitura do agy)
  em vez de colar o código na resposta — comportamento a observar na reexecução.

## Para reexecutar os gemini (quando a cota resetar ~2026-07-29)

    node runner/run-one.mjs gemini31pro-high a r1   # raia × {a,b} × {r1,r2,r3}
    node runner/run-one.mjs gemini36flash-high a r1
