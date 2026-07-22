# Rodada 4 — status: PARCIAL (kimi-k3 rodada; gemini adiado)

Data: 2026-07-22. Mesmas provas da rodada 3 (estacao-a.md / estacao-b.md,
grade-a.mjs / grade-b.mjs). Corretores e cenário validados.

## Situação por raia

| Raia | Estação | Situação |
|---|---|---|
| kimi-k3 | A e B | **RODADA CONCLUÍDA** em 2026-07-22 (após o Daniel liberar o modelo em openrouter.ai/settings/privacy). 3 de 6 execuções entregues; ver placar.tsv. |
| gemini31pro-high | A e B | **ADIADO**: cota da assinatura Gemini/agy esgotada ("Individual quota reached ... Resets in 167h"). Reexecutar quando resetar, **~2026-07-29**. |
| gemini36flash-high | A e B | **ADIADO**: mesma cota (compartilhada com o pro) esgotada. Reexecutar **~2026-07-29**. |

## Tabela-resumo (r1 · r2 · r3)

| Raia | A: zod v4 (14) | B: rateio (18) |
|---|---|---|
| kimi-k3 | 14 · **não entregou**¹ · **não entregou**² | 18 · **não entregou**² · 18 |
| gemini31pro-high | (pendente ~07-29) | (pendente ~07-29) |
| gemini36flash-high | (pendente ~07-29) | (pendente ~07-29) |

¹ A r2: o modelo devolveu só o raciocínio interno, sem resposta final (falha de MODELO — sem repescagem, por protocolo).
² A r3 e B r2: timeout de 5min do provedor, 2 vezes cada (falha de INFRA — 1 repescagem cada, também estourou).

## Custo / tokens kimi-k3 (só execuções entregues; OpenRouter reporta o custo direto)

| Exec | nota | dur (s) | tokens saída | reasoning | custo (US$) |
|---|---|---|---|---|---|
| A r1 | 14/14 | 157 | 7466 | 6840 | 0,114528 |
| B r1 | 18/18 | 271 | 12267 | 11402 | 0,187113 |
| B r3 | 18/18 | 165 | 7435 | 6538 | 0,111868 |
| **Total** | | | **27168** | | **≈ 0,4135** |

Preço observado do kimi-k3 no OpenRouter: **~US$ 3 / milhão de tokens de entrada** e
**~US$ 15 / milhão de tokens de saída** (derivado dos cost_details; a saída domina o custo por causa do raciocínio).
As 3 execuções que falharam (A r2, A r3, B r2) também podem ter gerado custo no provedor,
mas não há usage retornado (timeout/abort ou parse sem content), então ficam fora da soma.

## O que ficou validado (encanamento OK)

- Build atualizado; cenário A reconstruído em `cenario-a/` com **zod 4.4.3** instalado de verdade
  (ESM, script test = `node --test testes/`, testes públicos em `testes/publicos.mjs`).
- Referência A (zod v4) → grade-a.mjs **14/14**; referência B → grade-b.mjs **18/18**.
- Runner `runner/run-one.mjs`: monta prova + apêndice de entrega, extrai bloco ```javascript,
  corrige e registra nota/duração/tokens/usage.

## Incidentes observados

- kimi-k3 entrega instável: 3 de 6 execuções morreram (1 "só raciocínio", 2 timeouts de 5min ×2).
  Onde entregou, gabaritou (14/14 e 18/18 duas vezes) — inclusive a estação A **só com texto**,
  sem olhos: o kimi-k3 conhece a API do zod v4 (não caiu na armadilha da data de corte).
- gemini31pro-high (antes da cota estourar) tentou a ferramenta **Edit** na estação A e o modo
  somente-leitura do agy negou (soft-deny, step 92) → sem resposta final. O flash só leu, na fumaça.

## Para reexecutar os gemini (quando a cota resetar ~2026-07-29)

    node runner/run-one.mjs gemini31pro-high a r1   # raia × {a,b} × {r1,r2,r3}
    node runner/run-one.mjs gemini36flash-high a r1

Nota: o timeout padrão do provedor OpenRouter é 5min. O kimi-k3 com raciocínio pesado estoura isso
com frequência; se quiser reduzir os "não entregou", subir `timeoutMs` do openrouter no
config/models.json ajudaria (não foi alterado aqui — protocolo manda usar o runner validado como está).
