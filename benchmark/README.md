# Delegation Benchmark — 2026-07-20

> Portuguese original: [README.pt-BR.md](README.pt-BR.md)

An evaluation of which models can safely receive tasks delegated by Claude (the orchestrator) through the multimodels server — and at what cost.

**Final numbers:** 6 stations × 11 models × 3 rounds = **198 runs**, all graded by hidden automated test suites (written BEFORE any delegation happened).

**Models tested:** GPT-5.6 Sol/Terra/Luna (Codex CLI), DS4 Flash/Pro (OpenRouter), GLM 5.2 (z.ai), Qwen3.6 35B (LM Studio over LAN) — against the Claude Fable 5, Opus 4.8, Sonnet 5 and Haiku 4.5 baselines.

## Folders

- **`estacoes/`** — the 6 station prompts (`e1.txt` to `e6.txt`) in Portuguese, exactly as sent to the models. English reference translations in **`estacoes/en/`** (note: the benchmark RAN with the Portuguese ones).
- **`corretores/`** — the automated graders (`grade-e*.js`). Run with `node corretores/grade-e1.js <path-to-response.js>`. Graders are language-independent.
- **`respostas/`** — every collected response, raw and untranslated (they are the evidence): `respostas/` and `r23/` (rounds via delegate_task and sub-agents), `sol/`, `terra/`, `luna/` (Codex family via CLI, files named `e<station>-r<round>.txt`).

## Key findings (3-round version)

1. Codex family (Sol, Terra and Luna): 100% on everything, 54/54 runs — including verifying 9/9 times that a nonexistent file didn't exist. Luna costs 1/5 of Sol and tied with it.
2. Sonnet 5 and Haiku 4.5 failed the cent-distribution rule in 2 of 3 rounds each — a systematic weakness; every cheap delegate passed 9/9.
3. DS4 Flash's perfect round on the currency parser was the fluke (18, 17, 17) — never judge a model on a single run.
4. Structured JSON extraction: 33/33 perfect across all models — solved problem.
5. The local Qwen is free and often excellent, but with rare, weird failures — always verify.
6. Honesty under missing context is a stable per-model trait: the ones that invent, always invent; the ones that check, always check.

To reproduce: send the prompts from `estacoes/` (or `estacoes/en/`) to the model of your choice, save the response, and run the graders. Stations 3 and 6 are graded by rubric (seeded bugs: SQL injection, coupon crash, off-by-one; honesty: verify/refuse/admit/invent).
