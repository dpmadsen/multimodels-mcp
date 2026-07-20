# multimodels-mcp

**Delegate tasks from Claude Code to other companies' models — without leaving the app.**

This is a small MCP (Model Context Protocol) server that acts as a "waiter" between your main coding agent and every other model you have access to. Claude Code stays the orchestrator; the waiter takes an order to whichever kitchen you point at:

- **Codex CLI** → GPT-5.6 Sol / Terra / Luna via your ChatGPT subscription (no API cost)
- **DeepSeek** (DS4 Flash / Pro) via direct API
- **z.ai** (GLM 5.2) via the coding-plan subscription
- **OpenRouter** → anything in their catalog
- **LM Studio** → local models on your machine or another box on your LAN, for free

The same pattern works for any MCP-capable agent — nothing here is Claude-specific except where it's registered.

## Tools exposed

| Tool | What it does |
|---|---|
| `list_models` | Returns the menu: every enabled model with its exact id and provider status (missing key, offline local server, etc.) |
| `delegate_task` | Sends a self-contained task to the chosen model and returns its answer, tagged with origin and token usage |

## Quick start

```bash
git clone https://github.com/dpmadsen/multimodels-mcp.git
cd multimodels-mcp
npm install
npm run build

# copy the key template and fill in what you use
cp .env.example .env

# register in Claude Code (user scope = available in every project)
claude mcp add --scope user multimodels -- node "$(pwd)/dist/index.js"
```

Then ask Claude: *"use the list_models tool and show me the menu"*.

## Configuring providers

- **`config/models.json`** — which providers exist, their base URLs, and which models are enabled. Adding an OpenAI-compatible provider is one JSON block; enabling a model is one line in its `models` array.
- **`.env`** — API keys only. Never in models.json, never in code. The server reads models.json fresh on every call (edit and it applies immediately); `.env` is read at startup (restart the server after adding a key).
- **Local control panel** — `npm run panel` opens a localhost page (http://127.0.0.1:4747) to manage keys and toggle models. Keys are shown last-4-only; the panel binds to localhost.
- **Codex lane** — needs the [Codex CLI](https://github.com/openai/codex) installed and logged in. It uses whatever model your `~/.codex/config.toml` sets (the CLI accepts `-m gpt-5.6-luna` etc.).
- **z.ai gotcha** — coding-plan subscription keys only work on the coding endpoint (`https://api.z.ai/api/coding/paas/v4`). On the generic endpoint they fail with a misleading "insufficient balance". The default config already points at the right one.

## The benchmark: who can you actually trust with delegated work?

The [`benchmark/`](benchmark/) folder contains a full evaluation run through this server: **6 stations × 11 models × 3 rounds = 198 runs**, graded by hidden test suites written *before* any model saw the tasks. Stations: build-from-spec, find-and-fix-a-bug, code review with seeded bugs, strict JSON extraction, a long compound deliverable, and honesty under missing context.

![Scorecard](benchmark/post-reddit/benchmark-1-scorecard.png)

Highlights (details and caveats in [`benchmark/post-reddit/reddit-post.md`](benchmark/post-reddit/reddit-post.md)):

- The GPT-5.6 Codex family (including Luna at $1/M input) went **54/54 perfect runs**, and verified 9/9 times that a phantom file didn't exist instead of hallucinating a fix.
- Sonnet 5 and Haiku 4.5 failed the same cent-distribution contract in 2 of 3 rounds each — while every cheap delegate passed 9/9.
- Strict JSON extraction: 33/33 across all models. Solved problem.
- Single-run benchmarks lied in both directions; three rounds changed half the conclusions.

Everything needed to reproduce is in the folder: station prompts (`benchmark/estacoes/`, in Portuguese), automated graders (`benchmark/corretores/`), and every raw response (`benchmark/respostas/`).

![Costs](benchmark/post-reddit/benchmark-2-costs.png)

## Repo notes

- This project is built entirely through vibecoding, in Portuguese. The originals stay in Portuguese as part of how it's made, and every document has an English version: [CLAUDE.en.md](CLAUDE.en.md) (working instructions), [CHANGELOG.en.md](CHANGELOG.en.md) (project diary), [benchmark/README.md](benchmark/README.md) (benchmark guide) and [benchmark/estacoes/en/](benchmark/estacoes/en/) (station prompts).
- The benchmark ran with the Portuguese prompts; the raw model responses in `benchmark/respostas/` are untranslated on purpose — they're the evidence. The graders are language-independent.
- Tests: `npm test`.

## License

[MIT](LICENSE)
