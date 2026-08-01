# multimodels-mcp

**Delegate tasks from Claude Code to other companies' models — without leaving the app.**

This is a small MCP (Model Context Protocol) server that acts as a "waiter" between your main coding agent and every other model you have access to. Claude Code stays the orchestrator; the waiter takes an order to whichever kitchen you point at:

- **Codex CLI** → GPT-5.6 Sol / Terra / Luna via your ChatGPT subscription (no API cost)
- **DeepSeek** (DS4 Flash / Pro) via direct API
- **z.ai** (GLM 5.2) via the coding-plan subscription
- **OpenRouter** → anything in their catalog
- **LM Studio** → local models on your machine or another box on your LAN, for free
- **"With hands" lanes** → GLM (z.ai), DeepSeek and Kimi (Moonshot) piloting a disposable headless Claude Code pointed at their Anthropic-compatible endpoint — plus **Claude itself on your subscription** (`claude-maos`, no API key) — the model *reads* your files, greps the code and actually runs `npm test` / `npm run build`, but cannot edit anything

The same pattern works for any MCP-capable agent — nothing here is Claude-specific except where it's registered.

## Tools exposed

| Tool | What it does |
|---|---|
| `list_models` | Returns the menu: every enabled model with its exact id and provider status (missing key, offline local server, etc.) |
| `delegate_task` | Sends a self-contained task to the chosen model. **Backgrounds it by default** and returns a task id immediately; `"wait": true` blocks and returns the answer instead |
| `check_task` | With `id`, returns that task's result (or "still running" **plus live progress signals**, or the error **plus any salvaged partial**). Without `id`, lists the tasks, newest first |

Delegation niceties, all born from the benchmarks below: pick the Codex model per call (`codex:gpt-5.6-luna`), set reasoning effort per call (`effort` works for Codex, `claude-maos`, z.ai, DeepSeek and OpenRouter) **or as a per-model default picked in the panel**, **per-provider concurrency queues** (z.ai and LM Studio silently choke on parallel calls — the server now queues them), configurable per-provider timeouts, and **automatic retry** on network drops / 429 / 5xx (the answer footer says `repescada 1×` when the second attempt saved the day).

## Background by default

A delegation to a "with hands" lane or to a local box can take 20–30 minutes. Blocking the caller's session for that long is the whole reason this exists, so `delegate_task` **runs in the background unless you ask otherwise**:

- It answers in milliseconds with a human-readable ticket (`tarefa-1`, `tarefa-2`, …), the model, and how to collect the result. The tool description tells the calling agent explicitly to go do other work and check back later rather than polling in a loop.
- `check_task` collects it. The stored result includes the same origin/token footer a synchronous call would have printed.
- `"wait": true` restores the old synchronous behaviour — right call for a twenty-second task.
- **Everything that can be refused is refused before the task is created** (unknown/disabled model, the manufacturer rule, `effort` on a with-hands lane), so a refusal is immediate rather than a task that fails later.
- Background tasks go through the *same* provider code paths, so **per-provider concurrency queues (`maxConcurrent`) still apply**: five background delegations to LM Studio queue up exactly like five synchronous ones.

### Progress signals and salvaged partials (with-hands lanes only)

A backgrounded delegation used to be a black box: `check_task` could only say "still running". Since 0.12.0 the **`claude-cli` ("with hands") lanes** report what is happening while it happens, and hand back the work in progress if the run dies. **Codex, Gemini and the `openai-compat` API lanes are untouched** — they have no equivalent signal, so `check_task` tells you honestly that this lane sends no progress.

**How it's read.** The engine no longer runs `claude -p --output-format json` and parses one document at the end. It runs:

```
--output-format stream-json --include-partial-messages --verbose
```

which emits one JSON event per line as things happen. `--verbose` is not optional: with `--print`, the CLI refuses `stream-json` without it (`When using --print, --output-format=stream-json requires --verbose`). Event types actually observed on this machine (2026-08-01): `system` (`init`, `status`, `hook_started`, `hook_response`, `thinking_tokens`, `post_turn_summary`), `stream_event` (wrapping the raw API events `message_start`, `content_block_start`, `content_block_delta` with `text_delta` / `thinking_delta` / `input_json_delta` / `signature_delta`, `content_block_stop`, `message_delta`, `message_stop`), `assistant` (one per closed content block), `user` (tool results), `rate_limit_event`, and `result` last.

**The final text is unchanged.** The `result` event carries an *identical key set* to the single document the old `--output-format json` produced, so the extraction rules and their error messages are the same code as before, just fed from the stream. A test proves it: it runs the old parser and the new reader over the same recorded run and asserts the two strings are equal.

**What the signals are.** Steps (trips to the model, grouped by `request_id` — the CLI emits several `assistant` events per trip, so counting events would inflate it), tools used with counts, and output tokens (summed from `message_delta`, which matches the total the `result` event reports). Progress is persisted at most **once every 3 seconds**, plus a guaranteed final write — a single run emits hundreds of events and writing each one would hammer the disk.

**Partials.** When the process is killed by the deadline or by the 10 MB output cap, the text accumulated so far is attached to the error (a dedicated `ErroComParcial`) instead of being thrown away. It is stored on the task as a `parcial` field **inside the `erro` state**, not as a new state: the task did fail, and inventing a third state would force the list, the housekeeping pass and the orphan warning to learn about it. Anything displaying it must wrap it in an unmissable warning — `check_task` prints the warning before *and* after the draft, with explicit start/end markers, and the list shows `erro (com rascunho incompleto)`. `"wait": true` gets the same treatment inline, since in synchronous mode there's no ticket to store it on.

**Deliberately not implemented: live partial text during a normal run.** A reasoning model passes through mid-way conclusions it later revises away; exposing those invites acting on something the model itself has already discarded. The draft surfaces only when the task dies — the one case where it is all that's left. The reader also never mixes `thinking_delta` into the accumulated text, for the same reason.

**Unknown events and junk lines are ignored in silence.** A future CLI update adding a field or a type, or stray non-JSON noise on stdout, must never take a delegation down.

### Where results live

`.multimodels/tarefas/<id>.json` in the project root (gitignored) — one JSON file per task holding its state, model id, a ~200-character summary of the request, start/end timestamps, that lane's deadline, the result or the error, plus (with-hands lanes) a `progresso` block (`passos`, `ferramentas`, `tokensSaida`, `atualizadoEm`) and a `parcial` field when a dead run left a draft behind. On disk, so a result outlives the session that ordered it.

- **Ids are claimed exclusively.** The next number comes from the files already present, and the file is created with the `wx` flag; on `EEXIST` the creator tries the next number. Two sessions running at once can never land on the same id.
- **50 tasks are kept.** A housekeeping pass runs on every creation and deletes the oldest beyond that, so the folder can't grow forever. A task still running inside its deadline is never deleted — something is still going to write to it.
- **Orphan tasks are reported honestly, not guessed away.** If the session that started a task is closed, nobody will ever update that file: it stays `rodando` forever. There's no reliable way to detect this, so once a running task passes its own deadline plus a 2-minute grace period, it is *presented* as "provavelmente interrompida — a sessão que iniciou essa tarefa foi fechada". The file itself is never rewritten; if the answer does land, the warning disappears by itself.

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
- **Reasoning effort, per model** — an OpenAI-compatible provider that declares `effortStyle` (`"openai"` → top-level `reasoning_effort`; `"openrouter"` → `reasoning: { effort }`) can also declare `effortOptions` (the vendor's own level names, which the panel offers as-is) and `defaultEffortByModel` (a `{ model: level }` map you edit from the panel). Precedence when building the request: `effort` passed to `delegate_task` → `defaultEffortByModel[model]` → the provider's `defaultEffort` → nothing sent, so the vendor's own default applies. Shipped levels: z.ai `high`/`max` (vendor default `max`), OpenRouter `low`/`medium`/`high`, DeepSeek `low`/`high`/`max` (vendor default `high`). A `claude-cli` ("with hands") lane joins the same mechanism by declaring `effortOptions` — same cascade, same panel selector, same `{ model: level }` map — except the level is passed as `--effort <level>` on the CLI instead of in a request body. **Who gets effort control is declarative, not hardcoded**: an OpenAI-compatible provider needs `effortStyle`, a with-hands lane needs `effortOptions`. Everything else (LM Studio, Codex, Gemini, the vendor with-hands lanes) has no effort control — the panel shows no selector, and asking for one returns a friendly error.
- **DeepSeek `low` caveat** — on `deepseek-v4-pro` the vendor currently treats `low` as `high`, so picking `low` there changes the bill, not the thinking. DeepSeek expects this to change in August 2026; `deepseek-v4-flash` honours all three levels.
- **Effort on the *vendor* "with hands" lanes is not controllable — tested, don't retry.** The reason is the engine on the other end, not the protocol: DeepSeek documents that it discards the field, and states it auto-raises effort to max for agentic clients anyway, so the lane already runs at the level you'd pick. Measured against the live endpoint (2026-07-31): sending `reasoning_effort` in the body changed nothing (`low` → 1140/916 output tokens, `max` → 393/863), and `budget_tokens` was overrun and undershot at will (500 → 773, 12000 → 549). The real lever on these lanes is the model id (`pro` vs `flash`). *(Correction, 0.11.0: an earlier version of this note claimed "the Anthropic wire protocol has no effort concept, only a thinking budget". That was wrong — effort is part of the Anthropic API (`output_config.effort`) and the CLI exposes `--effort`. The measured conclusion held; the explanation didn't, and the wrong explanation is exactly what would stop anyone from trying it on the Anthropic lane.)*
- **z.ai gotcha** — coding-plan subscription keys only work on the coding endpoint (`https://api.z.ai/api/coding/paas/v4`). On the generic endpoint they fail with a misleading "insufficient balance". The default config already points at the right one.
- **"With hands" lanes** — need the [Claude Code CLI](https://claude.com/claude-code) on your PATH; each lane is a `claude-cli` provider with write tools blocked. **The convention: a `claude-cli` lane with `baseUrl` + `envKey` is a third-party engine (that address, that key, run under a throwaway `CLAUDE_CONFIG_DIR`); a lane with *neither* is a subscription lane, run under your real Claude Code login with no key at all.** One engine, two configurations. Shipped vendor lanes: `glm-maos:glm-5.2` (z.ai, `ZAI_API_KEY`), `deepseek-maos:deepseek-v4-pro` / `deepseek-maos:deepseek-v4-flash` (`https://api.deepseek.com/anthropic`, `DEEPSEEK_API_KEY`, pay-per-use) and `kimi-maos:kimi-k3` (`https://api.moonshot.ai/anthropic`, `MOONSHOT_API_KEY`). The panel shows a key field on these cards (last-4-only, as always).
- **`claude-maos` — Anthropic's own models, on your subscription.** Ids: `claude-maos:claude-fable-5`, `claude-maos:claude-opus-5`, `claude-maos:claude-opus-4-8`, `claude-maos:claude-sonnet-5`. Identical hands to every other lane (Read/Glob/Grep + `npm test` / `npm run build`, no Edit/Write). No key, so no key field in the panel. Three things worth knowing before you reach for it:
  - **This lane *does* take reasoning effort — measured, and it works.** Levels: `low`, `medium`, `high`, `xhigh`, `max` (the five the `claude` CLI accepts), passed through as `--effort <level>`, picked per call via `delegate_task`'s `effort` or as a per-model default in the panel. Measured on this machine (2026-08-01, `claude-sonnet-5`, same short reasoning puzzle, `--output-format json`): `low` → **168 output tokens, 6.0 s, $0.2629**; `max` → **1321 output tokens, 16.3 s, $0.2803**. So ~7.9× the output tokens and ~2.7× the wall clock for ~6.6% more cost — the cost barely moves because on this lane the ~43k tokens of inherited global configuration dominate the bill, not the thinking. Both answers were correct; `max` was slightly better structured. No `defaultEffort` is shipped: with nothing picked, `--effort` isn't sent at all and the CLI's own default applies.
  - **A throwaway config dir does NOT authenticate a subscription — measured, don't "fix" this.** With `CLAUDE_CONFIG_DIR` pointed at an empty temp folder and no key, the CLI returns `{"is_error":true,...,"result":"Not logged in · Please run /login"}` (2026-08-01, this machine). That is why this lane deliberately runs against the real `~/.claude`. The consequence: it **inherits your global user configuration**, roughly **31k tokens of baggage per delegation** before the task is even read. Rewiring it to a disposable identity breaks the lane outright.
  - **Safety lock.** Because it runs on the real config, the child process is spawned with `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` *deleted* from the inherited environment. Any one of them surviving would silently divert the delegation to metered API billing (or to another vendor's engine) instead of the subscription. And "free of API charge" still means it eats the same subscription allowance your main session is spending.
- **The manufacturer rule — a lane is hidden from the host that made it.** This server exists to *cross the border*: call GPT/Gemini/GLM from inside Claude Code, or call Claude from inside Codex. Delegating to a lane from the **same vendor as the calling program** is an expensive detour — it spawns a second agent process that reloads the whole global configuration (measured: ~31k tokens per delegation on the subscription lane) and eats the same subscription allowance the session is already spending. The native subagent does it cheaper. So the rule is code, not discipline:
  - The host identifies itself in the MCP handshake (`getClientVersion()`, read at call time — it does not exist yet at startup). Its name is matched by **substring, case-insensitively**, because the exact name drifts between versions: `claude` → `anthropic`, `codex` → `openai`, `gemini` → `google`.
  - A provider declaring `"fabricante": "<vendor>"` in `config/models.json` is dropped from `list_models` and refused by `delegate_task` (the id can be typed by hand, so both doors are locked) when it matches the host's vendor. Shipped marks: `codex` → `openai`, `gemini` → `google`, `claude-maos` → `anthropic`. A provider **without** the field is never hidden — including the with-hands lanes of other engines (`glm-maos`, `deepseek-maos`, `kimi-maos`), which merely use Claude Code as a chassis while another vendor's model answers.
  - **Never silent**: when something is omitted, the menu ends with a line naming what was dropped and why. **Fails open**: an unknown or unidentified host hides nothing.
  - **Escape hatch** — `MULTIMODELS_ANFITRIAO` overrides the detection: `nenhum` (or `none`) disables the rule entirely, any other value is forced as the host's vendor. It's a cost optimisation, not a security boundary, so a wrong guess must never block work.
  - The first tool call of each session logs one line to **stderr** (stdout belongs to the protocol) with the client name, version and deduced vendor — that's how you verify detection against a real host.
- **Moonshot key** — the Kimi-with-hands lane needs an official Moonshot key from [platform.kimi.ai](https://platform.kimi.ai), stored as `MOONSHOT_API_KEY` in `.env`. It is *not* the OpenRouter key used by the text-only `openrouter:moonshotai/kimi-k3` lane.
- **DeepSeek model names — tested, no gotcha.** DeepSeek's docs suggest an unrecognized model name is silently downgraded to `deepseek-v4-flash`. Verified against the live API (2026-07-31): a bogus name returns `400 The supported API model names are deepseek-v4-pro or deepseek-v4-flash`, and each valid name is served by that exact model (checked via the run's usage report, not the model's self-report). Both names stay enabled.
- **Cost figures printed by the Claude Code CLI are wrong for these lanes** — they're computed with Anthropic's price table, not the vendor's. Read the real bill on the vendor's dashboard.

## The benchmark: who can you actually trust with delegated work?

The [`benchmark/`](benchmark/) folder contains a full evaluation run through this server: **6 stations × 11 models × 3 rounds = 198 runs**, graded by hidden test suites written *before* any model saw the tasks. Stations: build-from-spec, find-and-fix-a-bug, code review with seeded bugs, strict JSON extraction, a long compound deliverable, and honesty under missing context.

![Scorecard](benchmark/imagens/benchmark-1-scorecard.png)

Highlights:

- The GPT-5.6 Codex family (including Luna at $1/M input) went **54/54 perfect runs**, and verified 9/9 times that a phantom file didn't exist instead of hallucinating a fix.
- Sonnet 5 and Haiku 4.5 failed the same cent-distribution contract in 2 of 3 rounds each — while every cheap delegate passed 9/9.
- Strict JSON extraction: 33/33 across all models. Solved problem.
- Single-run benchmarks lied in both directions; three rounds changed half the conclusions.

Everything needed to reproduce is in the folder: station prompts (`benchmark/estacoes/`, in Portuguese), automated graders (`benchmark/corretores/`), and every raw response (`benchmark/respostas/`).

![Costs](benchmark/imagens/benchmark-2-costs.png)

### Round 2 — a real task instead of synthetic stations

Seven implementers (Claude, GPT-5.6 and GLM lanes, agentic and text-only) built the **same real feature** of this very server, each on an isolated git branch, judged by 12 hidden acceptance checks: [`benchmark/rodada2-implementacao/`](benchmark/rodada2-implementacao/). Sonnet 5 won on fine-grained review; the text-only lanes revealed their two blind spots (context and verification).

### Round 3 — the knowledge-cutoff round

Designed by the Reddit comment section: 13 lanes × 2 stations × 3 rounds, with reasoning effort controlled and a station built against the **actually installed zod v4**: [`benchmark/rodada3-esforco-e-cutoff/`](benchmark/rodada3-esforco-e-cutoff/). The cheap models didn't fail at reasoning — they failed at knowing what year it is (0/14 nine-for-nine on the trap, 18/18 on pure reasoning). Only two defenses exist: file access, or fresh training data.

### Round 4 (partial) — the newcomers

Two requested lanes on the same two stations: [`benchmark/rodada4-raias-novas/`](benchmark/rodada4-raias-novas/). **Kimi K3** (text-only, via OpenRouter) ran and became the **second text-only lane ever to beat the cutoff trap** — 14/14 on the zod v4 station from memory alone, joining Grok 4.5 in the "fresh memory" club. It went **5 of 6 perfect**; the one blemish is a **systematic failure mode** (it reasons to completion but never emits the final answer, 3× identically on the same cell). It's the **slowest and heaviest reasoner in the study** — 6-12 min per task, ~$0.20 per delivered task ($3/$15 per M). The two **Gemini** lanes (3.1 Pro high and 3.6 Flash high) are **pending** — the Google subscription quota ran out; that window resets ~Jul 29.

![Rounds 3–4 scorecard](benchmark/imagens/benchmark-7-rounds34-scorecard.png)

There's also an interactive decision report (in Portuguese) consolidating all rounds: [`benchmark/relatorio-decisao.html`](benchmark/relatorio-decisao.html).

## Repo notes

- This project is built entirely through vibecoding, in Portuguese. The originals stay in Portuguese as part of how it's made, and every document has an English version: [CLAUDE.en.md](CLAUDE.en.md) (working instructions), [CHANGELOG.en.md](CHANGELOG.en.md) (project diary), [benchmark/README.md](benchmark/README.md) (benchmark guide) and [benchmark/estacoes/en/](benchmark/estacoes/en/) (station prompts).
- The benchmark ran with the Portuguese prompts; the raw model responses in `benchmark/respostas/` are untranslated on purpose — they're the evidence. The graders are language-independent.
- Tests: `npm test`.

## License

[MIT](LICENSE)
