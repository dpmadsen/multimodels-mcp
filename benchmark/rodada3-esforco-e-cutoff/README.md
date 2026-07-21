# Rodada 3 — Esforço, data de corte e consistência (13 raias × 2 estações × 3 rodadas)

Data: 2026-07-21. Construída com os feedbacks da thread do Reddit: esforço de raciocínio controlado, portão de verificação executada, prova de "conhecimento atual" com dependência de verdade instalada, e tudo rodado 3×.

## As provas

- **Estação A — armadilha da data de corte** ([estacao-a.md](estacao-a.md)): validador usando o **zod v4 instalado de verdade** no cenário. Quem escreve a API antiga (v3) de memória entrega código que nem carrega. 14 verificações ocultas.
- **Estação B — raciocínio puro** ([estacao-b.md](estacao-b.md)): rateio de centavos com tetos e regras cruéis, sem dependências. 18 verificações ocultas.
- Cada entrega corrigida por corretores que nenhum modelo viu ([grade-a.mjs](grade-a.mjs) / [grade-b.mjs](grade-b.mjs)); raias com mãos obrigadas a rodar `npm test` e colar a saída. Placar completo célula a célula em [placar.tsv](placar.tsv).

## Placar (r1 · r2 · r3)

| Raia | A: zod v4 (14) | B: rateio (18) |
|---|---|---|
| Claude Sonnet 5 | 14 · 14 · 14 | 18 · 18 · 18 |
| Claude Opus 4.8 | 14 · 14 · 14 | 18 · 18 · 18 |
| GPT-5.6 Terra (high) | 14 · 14 · 14 | 18 · 18 · 18 |
| GPT-5.6 Luna (high) | 14 · 14 · 14 | 18 · 18 · 18 |
| Grok 4.5 (texto) | 14 · 14 · 14 | 18 · 18 · 18 |
| GPT-5.6 Terra (xhigh) | 14 · 14 · 14 | 18 · **não entregou**¹ · 18 |
| GPT-5.6 Luna (xhigh) | 14 · 14 · 14 | 18 · 18² · 18 |
| GLM 5.2 com mãos (Claude Code) | 14 · 14 · 14 | **não entregou**³ · 18 · 18 |
| GLM 5.2 texto (esforço max) | 14 · **1** · 14 | 18 · 18 · 18 |
| GLM 5.2 texto (esforço high) | **0 · 0 · 0** | 18 · 18 · 18 |
| DS4 Pro (texto) | **0 · 0 · 0** | 18 · 18 · 18 |
| Qwen3.6 27B (local) | **0 · 0 · 0** | 18 · 18 · 18 |
| Qwen3.6 35B (local) | **0 · 0 · 0**⁴ | 14 · 18 · **loop infinito** |

¹ planejou tudo e terminou perguntando "posso implementar?" num modo sem ninguém pra responder. ² entregou correto, mas em 60 minutos (o high fez o mesmo em 4). ³ travava sob tráfego concorrente na z.ai (o plano tem limite de requisições simultâneas e a sessão agêntica espera vaga em silêncio); rodando sozinha, a mesma tarefa fez 18/18 em 7min45 — solução: enfileirar as chamadas à z.ai. ⁴ na r3, gastou 60 mil tokens inteiros pensando e entregou zero caracteres.

## As 5 lições

1. **Data de corte é O divisor de águas dos modelos baratos.** DS4 Pro, GLM-high e os dois Qwen zeraram a estação A **nove vezes seguidas sem variação** — todos escrevendo a API antiga do zod de memória, com confiança, em código que morre na primeira linha. Os mesmos modelos gabaritaram a estação B. O perigo não é o modelo barato raciocinar mal: é ele conhecer um mundo que não existe mais.
2. **Contra isso há exatamente duas defesas.** Ter **mãos** (Codex, agentes Claude, GLM no Claude Code — todos espiam a versão instalada e acertam) ou ter **memória fresca** (Grok 4.5, único texto-puro a gabaritar tudo, 6/6). Sem nenhuma das duas, não use o modelo em código com bibliotecas atuais.
3. **Raciocínio com spec fechada virou commodity.** A prova cruel de matemática de centavos: 18/18 pra praticamente todo mundo, do modelo de 1 centavo ao topo de linha. Pague por conhecimento e confiabilidade, não por "inteligência de prova".
4. **Esforço tem ponto ótimo — e passar dele piora.** Codex: high gabaritou tudo rápido; xhigh só acrescentou uma hesitação fatal e uma maratona de 60 minutos. GLM: max lembra da API nova (2 de 3) onde high esquece sempre (0 de 3) — pensar mais ajudou a memória, mas duplicou o tempo. Grok no padrão: perfeito. Receita: high pro Codex, max pro GLM texto, padrão pro Grok.
5. **Falha de conhecimento é consistente; falha de entrega é aleatória.** Quem zerou a A, zerou 3× do mesmo jeito — uma rodada teria bastado. Já os acidentes de entrega (GLM-com-mãos travando, xhigh hesitando, Qwen sufocando no próprio pensamento) aparecem e somem entre rodadas — só o 3× revela. Confiabilidade de entrega não acompanha a inteligência: acompanha a dose de esforço e a saúde do provedor.

## Rota prática (o que usar amanhã)

- **Dentro do projeto:** Sonnet (perfeito 6/6, veloz, já pago).
- **Fora do projeto / segunda opinião:** Luna em **high** (perfeito 6/6, ~2min por tarefa, US$ 0 na assinatura).
- **Texto-puro com biblioteca moderna:** Grok 4.5 — o único sem mãos que conhece o mundo atual (~US$ 0,04/tarefa).
- **Algoritmo puro bem especificado:** DS4 Pro por 1 centavo — nunca com bibliotecas recentes.
- **GLM 5.2:** ótimo e grátis na assinatura; no texto use esforço **max**; no arnês agêntico, enfileire o tráfego da z.ai (uma chamada por vez) — os travamentos eram congestionamento do plano, não do modelo.
- **Local (Celta):** o **27B entrega sempre** (6/6 entregas, 3/3 na estação B); o 35B é mais rápido porém errático (pensamento sem fim, loop infinito). Nenhum dos dois com bibliotecas atuais.

Custos reais da rodada inteira: DS4 Pro US$ 0,05 · Grok US$ 0,26 · todo o resto US$ 0 (assinaturas e máquina local).
