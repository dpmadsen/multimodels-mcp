# Benchmark de Delegação — 20/07/2026

Avaliação de quais modelos podem receber tarefas delegadas pelo Claude (orquestrador) via o servidor multimodels, com segurança e a que custo.

**Números finais:** 6 estações × 11 modelos × 3 rodadas = **198 execuções**, todas corrigidas por testes automatizados ocultos (escritos ANTES de qualquer delegação).

**Modelos testados:** GPT-5.6 Sol/Terra/Luna (Codex CLI), DS4 Flash/Pro (OpenRouter), GLM 5.2 (z.ai), Qwen3.6 35B (LM Studio no Celta) — contra as réguas Claude Fable 5, Opus 4.8, Sonnet 5 e Haiku 4.5.

## Pastas

- **`post-reddit/`** — o material pronto pra compartilhar: 3 infográficos em PNG, os HTMLs que os geraram, e o texto do post em inglês (`reddit-post.md`).
- **`estacoes/`** — os 6 enunciados da prova (`e1.txt` a `e6.txt`), em português, exatamente como enviados aos modelos.
- **`corretores/`** — os scripts de correção automática (`grade-e*.js`). Rodar com `node corretores/grade-e1.js <caminho-do-arquivo-de-resposta.js>`.
- **`respostas/`** — todas as respostas coletadas: `respostas/` e `r23/` (rodadas via delegate_task e subagentes), `sol/`, `terra/` e `luna/` (família Codex via CLI, arquivos `e<estação>-r<rodada>.txt`).
- **`relatorios/`** — os relatórios HTML das fases anteriores (prova fácil, prova difícil, limites dos locais) e o placar de trabalho (`placar-parcial.md`).

## Principais conclusões (versão de 3 rodadas)

1. Família Codex (Sol, Terra e Luna): 100% em tudo, 54/54 — incluindo verificar 9/9 vezes que um arquivo inexistente não existia. O Luna custa 1/5 do Sol e empatou com ele.
2. Sonnet 5 e Haiku 4.5 falharam a regra de distribuição de centavos em 2 de 3 rodadas cada — fraqueza sistemática; todos os substitutos baratos acertaram 9/9.
3. A rodada perfeita do DS4 Flash no conversor de dinheiro era o acaso (18, 17, 17) — nunca julgar modelo por 1 execução.
4. Extração de JSON estruturado: 33/33 perfeito em todos os modelos — problema resolvido.
5. Qwen local: grátis e frequentemente excelente, mas com falhas raras e esquisitas — sempre verificar.
6. Honestidade sob contexto faltando é traço estável de cada modelo: quem inventa, inventa sempre; quem verifica, verifica sempre.

Para reproduzir: enviar os enunciados de `estacoes/` ao modelo desejado, salvar a resposta e rodar os corretores. As estações 3 e 6 têm correção por critério (bugs plantados: injeção de SQL, crash do cupom, off-by-one; honestidade: verificar/recusar/admitir/inventar).
