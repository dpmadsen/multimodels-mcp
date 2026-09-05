# Multimodels MCP Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four unauthorized-access risks in `docs/security-report.md` while preserving intentional code transfer, approved endpoints, shared all-project history, and future agent editing.

**Architecture:** Keep the current provider architecture. Add only local choke-point controls: explicit working-directory selection, minimal child environments, bounded provider responses with manual redirects, exact-origin panel mutations, and a small typed stderr logger. Do not add a database, proxy, policy engine, URL allowlist, task namespace, or model-catalog redesign.

**Tech Stack:** TypeScript 7, Node.js 21+ built-in APIs, MCP TypeScript SDK 1.29.0, Zod 3, Node test runner, existing Vite panel.

**Spec:** `docs/security-hardening/hardening.md`

## Global Constraints

- Approved agents and providers may receive project code. Editing and command execution are target behavior, but current writable modes remain disabled until native confinement inside the user/host-approved scope is proven.
- Any endpoint explicitly configured by the user remains allowed, including HTTP, LAN, public, or intentionally dangerous endpoints.
- A redirect is a different recipient and is rejected unless a later approved design says otherwise.
- Shared task history across all projects remains intentional single-user behavior.
- Keep `models` as `string[]`; add only an optional limits map instead of redesigning the catalog.
- Add no runtime dependency.
- Use the smallest working change; no compatibility framework, metrics backend, database, credential service, proxy, authentication system, or adjacent refactor.
- Every code milestone starts with a failing focused test when feasible, then the minimal implementation, focused validation, and independent read-only QA.
- Every new or changed test must have a nearby rationale comment and a matching append-only entry in `docs/test-change-log.md` as required by `AGENTS.md`.
- Write every new security-flow diagnostic only to stderr as one-line JSON. Never log prompts, file contents, model responses, partials, API-key values, Authorization headers, redirect locations, or URL query strings. Existing fixed startup and storage-failure stderr messages remain outside this change.
- An implementer may touch only the files listed for its task. An unexpected required file, CLI behavior, or interface is a stop condition: report it to the coordinator and update this plan only with user approval.
- QA compares the original user requirements and this plan against the actual diff. The plan is not its own source of truth.
- Do not install dependencies, deploy, push, delete features, rewrite history, or change unrelated files.

## Acceptance Checklist

- [ ] A CLI child never receives unrelated provider keys or arbitrary host secrets.
- [ ] An API-key-backed Claude lane exposes no shell/npm tool while the real provider key is in its process environment.
- [ ] A CLI delegation has one explicit canonical `workdir`; no provider silently falls back to the MCP server's `process.cwd()`.
- [ ] Writable delegated modes remain disabled until that installed CLI demonstrates confinement inside the approved scope.
- [ ] `delegate_task` truthfully declares `readOnlyHint: false` and retains `openWorldHint: true`.
- [ ] The loopback panel accepts its normal JSON mutations and rejects missing/wrong Origin, Host, or Content-Type before parsing or writing.
- [ ] The panel continues allowing every user-configured HTTP or HTTPS endpoint.
- [ ] OpenAI-compatible completion and LM Studio catalog requests never follow redirects.
- [ ] Provider/model definitions can specify context metadata, maximum output tokens, and maximum response bytes without changing `models: string[]`.
- [ ] Every provider completion and CLI-result path enforces the resolved byte cap locally; exactly-at-limit succeeds and limit-plus-one fails without retaining the oversized content.
- [ ] New security-flow logs expose provider/model/task phase, retry, rejection category, elapsed time, and byte counts on size rejection without sensitive content.
- [ ] Focused tests pass after each milestone; `npm test` and final independent QA pass at the end.
- [ ] README, both changelogs, the security report, test change log, handoff, and authorized memory notes match verified behavior.

## Orchestration And Model Routing

The coordinator owns requirements, integration, the test-change log, and final status. It must not implement a milestone while its assigned worker is editing the same files.

| Milestone | Implementer | Independent QA | Why this route |
| --- | --- | --- | --- |
| Baseline and permission gate | `gpt-5.6-luna`, medium | `gpt-5.6-terra`, high | Mostly deterministic path and CLI-contract work; QA checks boundary claims. |
| Child credential isolation | `gpt-5.6-terra`, high | fresh `gpt-5.6-terra`, high | Secret propagation is security-sensitive and cross-provider. |
| Provider redirects, limits, and logs | `gpt-5.6-terra`, high | fresh `gpt-5.6-terra`, high | Streaming byte accounting and retry semantics need careful reasoning. |
| Panel mutation guard | `gpt-5.6-luna`, medium | fresh `gpt-5.6-terra`, high | Small pure HTTP-header guard with a focused attack boundary. |
| Documentation and release evidence | `gpt-5.6-luna`, low | `gpt-5.6-terra`, medium | Mechanical evidence synchronization; no product behavior. |
| Final regression/security gate | none | `gpt-5.6-sol`, xhigh | Reserve the strongest model for the complete cross-milestone judgment. |

Each QA worker is read-only. It reports acceptance or exact defects to the coordinator. The original implementer receives any correction request; do not dispatch a replacement implementer unless the original cannot continue.

---

### Task 1: Establish Baseline And Make Delegated Scope Explicit

**Files:**

- Create: `src/pasta-de-trabalho.ts`
- Create: `src/pasta-de-trabalho.test.ts`
- Create: `src/tools/delegate.test.ts`
- Modify: `src/tools/delegate.ts:33-41,118-214`
- Modify: `src/providers/codex.ts:35-57`
- Modify: `src/providers/gemini.ts:70-92`
- Modify: `src/providers/claude-cli.ts:139-210`
- Modify: `src/providers/codex.test.ts`
- Modify: `src/providers/gemini.test.ts`
- Modify: `src/providers/claude-cli.test.ts`
- Create or append: `docs/test-change-log.md`

**Interfaces:**

- Produces: `resolverPastaDeTrabalho(workdir: string | undefined): Promise<string>` returning a canonical existing directory.
- Produces: CLI provider functions whose `workdir` parameter is required after the dispatcher resolves it.
- Preserves: direct `openai-compat` task-only delegation and every configured endpoint.

- [ ] **Step 1: Record checkout, requirement, test, history, and memory evidence before changing tests**

Run these commands separately and retain their actual outputs for `docs/test-change-log.md`:

```zsh
git status --short --branch
```

```zsh
git rev-parse HEAD
```

```zsh
git log --oneline -- src/tools/delegate.ts src/providers/codex.ts src/providers/gemini.ts src/providers/claude-cli.ts
```

```zsh
git log --oneline -- src/providers/codex.test.ts src/providers/gemini.test.ts src/providers/claude-cli.test.ts
```

```zsh
git log -S'workdir ?? process.cwd()' --oneline -- src/providers
```

```zsh
git log -S'readOnlyHint' --oneline -- src/tools/delegate.ts
```

```zsh
rg -n -i -C 2 "multimodels|workdir|delegate_task|test-change-log|test history" /Users/ppirooznia/.codex/memories/MEMORY.md
```

If project-specific memory/history evidence is absent, record that absence honestly. Do not weaken, remove, rename, or skip an existing test.

- [ ] **Step 2: Write failing tests for canonical explicit working directories**

In `src/pasta-de-trabalho.test.ts`, add a rationale comment immediately above the logical test group stating that it protects the explicit delegated project boundary, is required because implicit server cwd is not user-selected authority, and may be modified only after checking the original requirement, current diff, introducing/later commits, replacement coverage, `MEMORY.md`, this plan, and `docs/test-change-log.md`.

Test these exact cases using temporary directories:

```ts
test("resolve uma pasta existente para o caminho canônico", async () => {
  const pasta = await mkdtemp(join(tmpdir(), "multimodels-workdir-"));
  assert.equal(await resolverPastaDeTrabalho(pasta), await realpath(pasta));
});

test("recusa workdir ausente ou inexistente", async () => {
  await assert.rejects(resolverPastaDeTrabalho(undefined), /workdir.*obrigatório/i);
  await assert.rejects(resolverPastaDeTrabalho(join(tmpdir(), "nao-existe")), /não existe/i);
});
```

Create a temporary regular file and separately assert `resolverPastaDeTrabalho(filePath)` rejects it with `/não é uma pasta/i`. Extend existing provider argument/process tests so they fail while `process.cwd()` remains a fallback. In `src/tools/delegate.test.ts`, capture registration through a minimal fake `McpServer` without invoking the handler and assert `delegate_task` registers exactly:

```ts
annotations: { readOnlyHint: false, openWorldHint: true }
```

- [ ] **Step 3: Run the focused tests and confirm the expected failure**

```zsh
npm run build
```

```zsh
node --test dist/pasta-de-trabalho.test.js dist/tools/delegate.test.js dist/providers/codex.test.js dist/providers/gemini.test.js dist/providers/claude-cli.test.js
```

Expected failure: missing resolver, optional provider `workdir`, current cwd fallback, and `readOnlyHint: true`.

- [ ] **Step 4: Implement only canonical explicit workdir resolution**

Create `src/pasta-de-trabalho.ts` with this behavior:

```ts
import { realpath, stat } from "node:fs/promises";

export async function resolverPastaDeTrabalho(workdir: string | undefined): Promise<string> {
  if (!workdir?.trim()) {
    throw new Error("O campo workdir é obrigatório para modelos que acessam arquivos.");
  }
  let canonica: string;
  try {
    canonica = await realpath(workdir);
  } catch {
    throw new Error(`A pasta indicada em workdir não existe: ${workdir}`);
  }
  if (!(await stat(canonica)).isDirectory()) {
    throw new Error(`O caminho indicado em workdir não é uma pasta: ${workdir}`);
  }
  return canonica;
}
```

In `delegate_task`, resolve this only for `codex-cli`, `gemini-cli`, and `claude-cli` before constructing the delegation. Pass the canonical directory to each CLI provider. Keep `openai-compat` unchanged because it does not read files.

Change the three CLI functions to require `workdir: string` and set:

```ts
cwd: workdir
```

Remove every `?? process.cwd()` provider fallback. Change only `delegate_task` metadata to `readOnlyHint: false`; keep `openWorldHint: true` and leave `list_models`/`check_task` metadata unchanged.

Do not add MCP-root enforcement. The official MCP specification defines roots as informational, so presenting them as a complete sandbox would be false. The explicit `workdir` becomes the user/host-selected starting scope; provider-native confinement remains the runtime gate below.

- [ ] **Step 5: Run focused validation**

```zsh
npm run build
```

```zsh
node --test dist/pasta-de-trabalho.test.js dist/tools/delegate.test.js dist/providers/codex.test.js dist/providers/gemini.test.js dist/providers/claude-cli.test.js
```

Expected: all selected tests pass, direct API tests remain untouched, and no external model runs.

- [ ] **Step 6: Perform the provider-native permission gate**

Use only installed CLI help and an explicitly approved bounded runtime probe. Record the installed version, exact mode flags, selected test directory, attempted inside/outside operation, and actual result. Do not expose source or secrets in the probe.

The Codex candidate contract is already source-verified from local help: `-C`, `--sandbox workspace-write`, `--add-dir`, `--ephemeral`, `--ignore-user-config`, and `shell_environment_policy`. Re-query at implementation time.

For `agy` and `claude`, if the binary or exact writable confinement mode is unavailable, record `unverified` and keep that provider's current non-writing mode. Do not guess flags and do not add an OS wrapper.

Acceptance rule:

```text
No provider may be described or enabled as writable unless its live probe shows that an outside-scope write is denied while an inside-scope write succeeds.
```

- [ ] **Step 7: Append the required test-change record**

Run:

```zsh
date '+%Y-%m-%dT%H:%M:%S%z'
```

Append the returned timestamp, exact test names, behavior/reason, rationale-comment locations, history/memory/plan evidence, commands/results, and runtime-probe limitations to `docs/test-change-log.md`.

- [ ] **Step 8: Independent Milestone 1 QA**

Dispatch the read-only QA agent specified above. It must compare the original request, corrected report, and this task against the diff; run the focused commands; confirm no implicit cwd remains; confirm direct APIs are unchanged; and reject any claim that MCP roots alone enforce permissions.

- [ ] **Step 9: Commit the accepted milestone**

```zsh
git add src/pasta-de-trabalho.ts src/pasta-de-trabalho.test.ts src/tools/delegate.ts src/tools/delegate.test.ts src/providers/codex.ts src/providers/gemini.ts src/providers/claude-cli.ts src/providers/codex.test.ts src/providers/gemini.test.ts src/providers/claude-cli.test.ts docs/test-change-log.md
```

```zsh
git commit -m "fix: make delegated project scope explicit"
```

---

### Task 2: Remove Ambient Credentials From CLI Children

**Files:**

- Create: `src/providers/ambiente-filho.ts`
- Create: `src/providers/ambiente-filho.test.ts`
- Modify: `src/providers/codex.ts`
- Modify: `src/providers/gemini.ts`
- Modify: `src/providers/claude-cli.ts`
- Modify: `src/providers/claude-cli.test.ts`
- Modify: `src/providers/claude-cli-processo.test.ts`
- Append: `docs/test-change-log.md`

**Interfaces:**

- Produces: `montarAmbienteBase`, `montarAmbienteCodex`, `montarAmbienteGemini`, and `montarAmbienteClaude`.
- Preserves: subscription authentication through the user's home/config paths and the selected third-party Claude key.
- Enforces: unrelated environment variables never reach a CLI child.

- [ ] **Step 1: Inspect complete test/history evidence for the environment contract**

```zsh
git status --short --branch
```

```zsh
git diff -- src/providers/codex.ts src/providers/gemini.ts src/providers/claude-cli.ts src/providers/codex.test.ts src/providers/gemini.test.ts src/providers/claude-cli.test.ts src/providers/claude-cli-processo.test.ts
```

```zsh
git log --oneline -- src/providers/claude-cli.ts src/providers/claude-cli.test.ts src/providers/claude-cli-processo.test.ts
```

```zsh
git show --find-renames ed3fc2e -- src/providers/claude-cli.ts src/providers/claude-cli.test.ts
```

```zsh
rg -n -i -C 2 "API key|environment|credential|claude-cli" /Users/ppirooznia/.codex/memories/MEMORY.md
```

Record unavailable evidence; do not remove the existing Anthropic subscription-routing protections.

- [ ] **Step 2: Write failing environment-isolation tests**

In `src/providers/ambiente-filho.test.ts`, seed a supplied environment object with `PATH`, `HOME`, `TMPDIR`, locale fields, `CODEX_HOME`, and sentinel secrets named `AWS_SECRET_ACCESS_KEY`, `OPENROUTER_API_KEY`, `ZAI_API_KEY`, `DEEPSEEK_API_KEY`, and `UNRELATED_SECRET`.

Add a rationale comment stating that these tests protect provider-to-provider credential isolation and must not be weakened without the full history/memory/plan review required by `AGENTS.md`.

Assert:

```ts
assert.equal(env.PATH, origem.PATH);
assert.equal(env.HOME, origem.HOME);
assert.ok(!("UNRELATED_SECRET" in env));
assert.ok(!("OPENROUTER_API_KEY" in env));
```

For keyed Claude, assert only the selected routing/credential variables are added. Extend `claude-cli.test.ts` so the keyed lane's allowed tool arguments contain `Read`, `Glob`, and `Grep`, but not either npm Bash permission.

- [ ] **Step 3: Run the focused tests and confirm they fail against full environment inheritance**

```zsh
npm run build
```

```zsh
node --test dist/providers/ambiente-filho.test.js dist/providers/claude-cli.test.js dist/providers/claude-cli-processo.test.js
```

- [ ] **Step 4: Implement a strict shared environment builder**

Create `src/providers/ambiente-filho.ts` with a fixed base-name list:

```ts
const NOMES_BASE = [
  "PATH", "HOME", "USER", "LOGNAME", "SHELL",
  "TMPDIR", "TMP", "TEMP",
  "LANG", "LC_ALL", "LC_CTYPE", "TERM", "COLORTERM", "NO_COLOR",
  "SSL_CERT_FILE", "SSL_CERT_DIR"
] as const;
```

Copy only defined values from the supplied source environment. `montarAmbienteCodex` may additionally copy `CODEX_HOME`; `montarAmbienteGemini` adds no unverified variables; Claude subscription uses the base plus `API_TIMEOUT_MS`. Keyed Claude also adds exactly `CLAUDE_CONFIG_DIR`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_API_KEY`.

Do not inherit proxy variables or any name based on a pattern. The allowlist itself is the control.

Pass the explicit environment into all three `spawn` calls. Replace the current `{ ...process.env }` implementation in Claude.

Change `buildClaudeCliArgs` to accept `provider: ClaudeCliProvider`, pass it from `executarClaudeCli`, and split allowed tools without changing read behavior:

```ts
const FERRAMENTAS_DE_ARQUIVO = ["Read", "Glob", "Grep"] as const;
const FERRAMENTAS_DE_VERIFICACAO = ["Bash(npm test:*)", "Bash(npm run build:*)"] as const;
```

Use `ehRaiaDeAssinatura(provider)` inside `buildClaudeCliArgs`: subscription Claude receives both arrays; API-key-backed Claude receives only `FERRAMENTAS_DE_ARQUIVO` until a separately approved credential-proxy design exists. Update argument tests for both provider shapes. Do not build that proxy in this phase.

- [ ] **Step 5: Run focused validation and a fake-process smoke test**

```zsh
npm run build
```

```zsh
node --test dist/providers/ambiente-filho.test.js dist/providers/codex.test.js dist/providers/gemini.test.js dist/providers/claude-cli.test.js dist/providers/claude-cli-processo.test.js
```

Expected: all sentinels are absent, the selected keyed-Claude credential remains available to the CLI, the subscription-routing tests still pass, and keyed Claude has no Bash/npm tools.

- [ ] **Step 6: Append the required test-change record**

Append the exact evidence/results to `docs/test-change-log.md` using the output of `date '+%Y-%m-%dT%H:%M:%S%z'`.

- [ ] **Step 7: Independent Milestone 2 QA**

The QA agent must inspect the full environment diff, run the focused tests, verify no sentinel or raw secret is logged, confirm selected provider functionality is preserved, and confirm no proxy or credential service was introduced.

- [ ] **Step 8: Commit the accepted milestone**

```zsh
git add src/providers/ambiente-filho.ts src/providers/ambiente-filho.test.ts src/providers/codex.ts src/providers/gemini.ts src/providers/claude-cli.ts src/providers/claude-cli.test.ts src/providers/claude-cli-processo.test.ts docs/test-change-log.md
```

```zsh
git commit -m "fix: isolate credentials passed to child agents"
```

- [ ] **Step 9: Create the authorized midpoint memory note**

The user explicitly requested memory updates during implementation. Run:

```zsh
date '+%Y%m%dT%H%M%S%z'
```

Create one small note under `/Users/ppirooznia/.codex/memories/extensions/ad_hoc/notes/` using that timestamp as the filename prefix and `multimodels-security-midpoint.md` as the suffix. Record only that Tasks 1-2 passed focused QA, the approved-transfer trust model, both verified milestone commit IDs, and the remaining unfinished milestones. Do not edit `MEMORY.md` directly and do not claim completion.

---

### Task 3: Reject Redirects, Enforce Model Response Limits, And Add Safe Flow Logs

**Files:**

- Create: `src/observabilidade.ts`
- Create: `src/observabilidade.test.ts`
- Create: `src/providers/limite-saida.ts`
- Create: `src/providers/limite-saida.test.ts`
- Modify: `src/config.ts`
- Modify: `src/config.test.ts`
- Modify: `src/tools/delegate.ts`
- Modify: `src/tools/delegate.test.ts`
- Modify: `src/providers/openai-compat.ts`
- Modify: `src/providers/openai-compat.test.ts`
- Modify: `src/providers/codex.ts`
- Modify: `src/providers/codex.test.ts`
- Modify: `src/providers/gemini.ts`
- Modify: `src/providers/gemini.test.ts`
- Modify: `src/providers/claude-cli.ts`
- Modify: `src/providers/claude-cli.test.ts`
- Modify: `src/providers/claude-cli-processo.test.ts`
- Modify: `src/panel/catalog.ts`
- Modify: `src/panel/catalog.test.ts`
- Modify: `src/tarefas/execucao.ts`
- Modify: `src/tarefas/execucao.test.ts`
- Append: `docs/test-change-log.md`

**Interfaces:**

- Produces: `ModelLimits`, `resolveMaxOutputTokens`, and `resolveMaxResponseBytes`.
- Produces: `lerCorpoLimitado(response, maxBytes)` for success and error HTTP bodies.
- Produces: a pure `somarBytesDeSaida(total, chunk, limit)` helper used by Claude and Gemini stream caps.
- Produces: `registrarEvento(evento)` for closed-schema JSONL stderr diagnostics.
- Preserves: existing network/429/5xx retry policy and arbitrary configured endpoints.

- [ ] **Step 1: Inspect relevant history and record the test rationale basis**

```zsh
git status --short --branch
```

```zsh
git diff -- src/config.ts src/config.test.ts src/tools/delegate.ts src/tools/delegate.test.ts src/providers/openai-compat.ts src/providers/openai-compat.test.ts src/providers/codex.ts src/providers/codex.test.ts src/providers/gemini.ts src/providers/gemini.test.ts src/providers/claude-cli.ts src/providers/claude-cli.test.ts src/panel/catalog.ts src/panel/catalog.test.ts src/tarefas/execucao.ts src/tarefas/execucao.test.ts
```

```zsh
git log --oneline -- src/config.ts src/providers/openai-compat.ts src/panel/catalog.ts src/tarefas/execucao.ts
```

```zsh
git log --oneline -- src/config.test.ts src/providers/openai-compat.test.ts src/panel/catalog.test.ts src/tarefas/execucao.test.ts
```

```zsh
git log -S'DEFAULT_MAX_TOKENS' --oneline -- src README.md
```

```zsh
git log -S'ESPERA_REPESCAGEM_MS' --oneline -- src README.md
```

```zsh
rg -n -i -C 2 "maxTokens|response bytes|redirect|retry|logging|test history" /Users/ppirooznia/.codex/memories/MEMORY.md
```

- [ ] **Step 2: Write failing model-limit resolver tests**

Add a rationale comment above the logical group in `src/config.test.ts`. Test this precedence:

```text
modelLimits[model].maxOutputTokens -> provider.maxOutputTokens -> 32,000
modelLimits[model].maxResponseBytes -> provider.maxResponseBytes -> defaults.maxResponseBytes -> 10 MiB
```

Test zero, negative, fractional, and unsafe integers as fail-closed configuration errors. Test that `contextTokens` is metadata only and returns `undefined` when absent. Do not add tokenizer logic.

- [ ] **Step 3: Write failing bounded-response, redirect, and logging tests**

In `src/providers/openai-compat.test.ts`, reuse the existing `globalThis.fetch` mock/restore pattern and add rationale comments. Cover:

```ts
assert.equal(init?.redirect, "manual");
```

- exactly-at-limit response succeeds;
- limit-plus-one response rejects;
- chunked response crossing the limit rejects and cancels;
- multibyte UTF-8 split across chunks decodes correctly while counting bytes;
- `302` and `307` reject without retry and without exposing `Location`;
- oversized success and error bodies are not retried;
- existing network, 429, and 5xx cases still retry exactly once.

In `src/providers/limite-saida.test.ts`, test exactly-at-limit, limit-plus-one, and multibyte UTF-8 accounting. Use this pure helper in Gemini so no test invokes a real `agy` binary. In `src/providers/claude-cli-processo.test.ts`, extend the existing fake-child coverage to prove a resolved smaller cap terminates the live Claude stream path. Assert that Codex checks `stat()` before reading its result file.

In `src/observabilidade.test.ts`, use a captured `console.error` and assert that each emitted line parses as JSON. Construct a test error containing a prompt fragment, response fragment, `Bearer secret`, and a query URL; assert none appears. The logger accepts no arbitrary `Error` or object spread.

- [ ] **Step 4: Run the focused tests and confirm the expected failures**

```zsh
npm run build
```

```zsh
node --test dist/config.test.js dist/tools/delegate.test.js dist/providers/openai-compat.test.js dist/providers/limite-saida.test.js dist/providers/codex.test.js dist/providers/gemini.test.js dist/providers/claude-cli.test.js dist/providers/claude-cli-processo.test.js dist/panel/catalog.test.js dist/tarefas/execucao.test.js dist/observabilidade.test.js
```

- [ ] **Step 5: Add the minimal optional model-limit shape**

In `src/config.ts`, keep `models: string[]` and add:

```ts
export interface ModelLimits {
  contextTokens?: number;
  maxOutputTokens?: number;
  maxResponseBytes?: number;
}

export interface ControleDeLimites {
  maxOutputTokens?: number;
  maxResponseBytes?: number;
  modelLimits?: Record<string, ModelLimits>;
}
```

Have provider types that return model output include `ControleDeLimites`. Add `maxResponseBytes?: number` to `ConfigDefaults`. Rename the unused `OpenAICompatProvider.maxTokens` field to `maxOutputTokens`; current `config/models.json` contains no `maxTokens`, so no compatibility shim is required.

Implement positive-safe-integer validation inside these resolvers:

```ts
resolveMaxOutputTokens(provider, model?: string)
resolveMaxResponseBytes(config, provider, model?: string)
```

Use model-specific values only when `model` is present, then fall back to provider/default/built-in values. Add one bare `codex` test with `model === undefined`. Use `10 * 1024 * 1024` as the built-in response fallback. Do not populate unverified `contextTokens` values in `config/models.json`; the user or later model-catalog work can add verified data.

- [ ] **Step 6: Implement bounded body reading and redirect rejection**

In `src/providers/openai-compat.ts`, serialize the request as today, set:

```ts
redirect: "manual"
```

Reject `300-399` before reading the response body. The error may contain provider ID/model/status but must not contain `Location`.

Implement `lerCorpoLimitado` in the same file to avoid a new abstraction:

```ts
export async function lerCorpoLimitado(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declarado = Number(contentLength);
    if (Number.isFinite(declarado) && declarado > maxBytes) {
      throw new Error(`Resposta excedeu o limite local de ${maxBytes} bytes.`);
    }
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Resposta excedeu o limite local de ${maxBytes} bytes.`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
```

Use it for both success and error bodies, then `JSON.parse` the successful text. Keep byte-limit and redirect errors non-retryable. Preserve retry only for network failures, 429, and 5xx.

Set `redirect: "manual"` in `fetchLmStudioModels`; do not add a hostname/IP allowlist. Catalog JSON byte caps are not part of this milestone because catalogs do not contain delegated prompts or model responses; retain their current timeouts and record this explicit non-goal.

Resolve the same model response limit for CLI paths. Create `src/providers/limite-saida.ts` with a pure helper that adds `Buffer.byteLength(chunk, "utf8")` to the running total and reports whether the limit was exceeded. Claude and Gemini keep their existing kill/error flow but use this helper plus the resolved limit instead of a hard-coded character cap. Codex uses `stat(outFile).size` before `readFile` and rejects an oversized file without reading it.

- [ ] **Step 7: Add minimal structured flow logs**

Create `src/observabilidade.ts` with a closed union containing only:

```ts
type Evento =
  | { event: "task.created" | "task.finished"; taskId: string; modelId: string; outcome?: "success" | "error" }
  | { event: "provider.start" | "provider.finish"; providerId: string; modelId: string; elapsedMs?: number; outcome?: "success" | "error" | "timeout" }
  | { event: "provider.retry"; providerId: string; modelId: string; attempt: 2; reason: "network" | "http_429" | "http_5xx" }
  | { event: "provider.reject"; providerId: string; modelId: string; reason: "redirect" | "response_bytes"; status?: number; observedBytes?: number; limitBytes?: number }
  | { event: "panel.reject"; reason: "origin" | "host" | "content_type" };
```

`registrarEvento` prepends `ts` and writes exactly one `console.error(JSON.stringify(...))`. Provider calls log start, retry/reject, and finish. Background execution logs task creation and finish using the existing task ID. Never pass task text, workdir, provider response text, raw URL, redirect location, or an arbitrary error object.

Extend `chatCompletion` options with `providerId?: string`; production `delegate_task` passes `ref.providerId`, while existing direct/test callers resolve the safe literal `"direct"` when the option is absent. Wrap Codex/Gemini/Claude start and finish logging in `montarDelegacao`, where `ref.providerId` already exists. For log fields use `modelId: ref.model ?? ref.providerId`, and add a bare-`codex` log test. The `provider.reject` size event carries `observedBytes` and `limitBytes`; successful finish events need no byte count.

This new structured logger does not replace unrelated existing fixed startup or storage-failure stderr messages in `index.ts`, `anfitriao-sessao.ts`, `tarefas/execucao.ts`, or `tarefas/limitador.ts`. Current `execucao` and `limitador` emitters report failures while writing task/progress state, not provider response errors. Do not route arbitrary existing `Error` messages into the new event logger.

- [ ] **Step 8: Run focused validation**

```zsh
npm run build
```

```zsh
node --test dist/config.test.js dist/tools/delegate.test.js dist/providers/openai-compat.test.js dist/providers/limite-saida.test.js dist/providers/codex.test.js dist/providers/gemini.test.js dist/providers/claude-cli.test.js dist/providers/claude-cli-processo.test.js dist/panel/catalog.test.js dist/tarefas/execucao.test.js dist/observabilidade.test.js
```

Expected: all new boundary cases pass and the pre-existing retry tests retain their exact attempt counts.

- [ ] **Step 9: Append the required test-change records**

Use `date '+%Y-%m-%dT%H:%M:%S%z'` and add one entry per logical group: model-limit resolution, bounded HTTP body, redirect rejection, CLI output caps, safe logger, catalog redirect, and task lifecycle logging. Each entry names the rationale comment and full history/memory evidence actually checked.

- [ ] **Step 10: Independent Milestone 3 QA**

The QA agent must verify byte counting rather than JavaScript character counting, no response is buffered before the cap, redirects are never followed or retried, existing retry behavior is unchanged, arbitrary endpoints remain allowed, no sensitive field can enter logs, and no new dependency/UI limit editor was added.

- [ ] **Step 11: Commit the accepted milestone**

```zsh
git add src/config.ts src/config.test.ts src/tools/delegate.ts src/tools/delegate.test.ts src/providers/openai-compat.ts src/providers/openai-compat.test.ts src/providers/limite-saida.ts src/providers/limite-saida.test.ts src/providers/codex.ts src/providers/codex.test.ts src/providers/gemini.ts src/providers/gemini.test.ts src/providers/claude-cli.ts src/providers/claude-cli.test.ts src/providers/claude-cli-processo.test.ts src/panel/catalog.ts src/panel/catalog.test.ts src/tarefas/execucao.ts src/tarefas/execucao.test.ts src/observabilidade.ts src/observabilidade.test.ts docs/test-change-log.md
```

```zsh
git commit -m "fix: enforce provider response boundaries"
```

---

### Task 4: Reject Cross-Site Panel Mutations

**Files:**

- Create: `src/panel/mutation-guard.ts`
- Create: `src/panel/mutation-guard.test.ts`
- Modify: `src/panel/server.ts:17-20,38-76,123-158`
- Append: `docs/test-change-log.md`

**Interfaces:**

- Produces: `validarMutacaoDoPainel(headers, expectedOrigin): { ok: true } | { ok: false; reason: "origin" | "host" | "content_type" }`.
- Preserves: existing UI requests and arbitrary eligible LM Studio endpoint editing.

- [ ] **Step 1: Inspect the panel's requirement and test history**

```zsh
git status --short --branch
```

```zsh
git diff -- src/panel/server.ts src/panel/config-write.ts src/panel/config-write.test.ts src/panel/provider-view.test.ts ui/src/lib/api.ts
```

```zsh
git log --oneline -- src/panel/server.ts src/panel/config-write.ts ui/src/lib/api.ts
```

```zsh
git log --oneline -- src/panel/config-write.test.ts src/panel/provider-view.test.ts
```

```zsh
git log -S'127.0.0.1' --oneline -- src/panel README.md
```

```zsh
rg -n -i -C 2 "localhost panel|cross-site|CSRF|Origin|test history" /Users/ppirooznia/.codex/memories/MEMORY.md
```

- [ ] **Step 2: Write failing pure guard tests**

Add a rationale comment stating that the test protects the local user's panel mutation authority, blocks browser cross-site requests before persistence, and requires complete history/memory/plan review before weakening/removal.

Test:

- exact `Origin: http://127.0.0.1:4747`, `Host: 127.0.0.1:4747`, and `application/json; charset=utf-8` succeeds;
- wrong or missing Origin fails with `origin`;
- wrong or missing Host fails with `host`;
- `text/plain`, form types, or missing Content-Type fail with `content_type`.

- [ ] **Step 3: Run the focused test and confirm failure**

```zsh
npm run build
```

```zsh
node --test dist/panel/mutation-guard.test.js
```

- [ ] **Step 4: Implement the pure guard and call it before body parsing**

Build `PANEL_ORIGIN` once from the existing `HOST` and `PORT`. In each POST branch, call the guard before `readBody`. On rejection:

```ts
registrarEvento({ event: "panel.reject", reason: resultado.reason });
sendJson(res, 403, { error: "Pedido recusado pelo painel local." });
return;
```

Do not add CORS headers or a token system. Exact Origin/Host/JSON validation blocks browser cross-site mutation; same-user native process authentication is explicitly outside this phase.

- [ ] **Step 5: Run focused panel validation**

```zsh
npm run build
```

```zsh
node --test dist/panel/mutation-guard.test.js dist/panel/config-write.test.js dist/panel/env-file.test.js dist/panel/provider-view.test.js
```

Expected: guard tests pass and existing configuration/key behavior remains unchanged.

- [ ] **Step 6: Append the test-change record**

Use `date '+%Y-%m-%dT%H:%M:%S%z'`; record the exact guard cases, source/history evidence, rationale-comment location, validation result, and the limitation that same-user local processes can forge browser headers.

- [ ] **Step 7: Independent Milestone 4 QA**

The QA agent confirms the guard runs before body parsing/writes, the current UI already sends accepted JSON requests, cross-origin text/plain is rejected, no CORS/token/auth framework was added, and arbitrary user-approved provider destinations remain editable.

- [ ] **Step 8: Commit the accepted milestone**

```zsh
git add src/panel/mutation-guard.ts src/panel/mutation-guard.test.ts src/panel/server.ts docs/test-change-log.md
```

```zsh
git commit -m "fix: block cross-site panel mutations"
```

---

### Task 5: Synchronize Documentation, Handoff, And Memory

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `CHANGELOG.en.md`
- Modify: `docs/security-report.md`
- Modify: `docs/security-hardening/hardening.md`
- Modify: `docs/security-hardening/hardening.json`
- Append: `docs/test-change-log.md`
- Create: `copilot_handoff.md`
- No new memory file in this task: the midpoint note was created after Task 2, and the final note waits for the full regression evidence in Task 6.

**Interfaces:**

- Produces: current documentation that states verified behavior without carrying obsolete findings or unverified completion claims.
- Preserves: Portuguese project diary plus English mirror.

- [ ] **Step 1: Update README with only shipped behavior**

Document:

- explicit `workdir` for file-capable lanes;
- approved providers may intentionally receive code;
- child environments exclude unrelated credentials;
- keyed Claude lanes lack npm shell tools until credential separation exists;
- redirects are rejected;
- `modelLimits` meanings and 10 MiB fallback;
- exact-origin panel mutation protection;
- JSONL stderr event names and forbidden content.

Do not describe MCP roots as enforcement and do not promise writable modes for a CLI that failed or skipped the live confinement gate.

- [ ] **Step 2: Update the bilingual changelogs**

Add one concise current version section to `CHANGELOG.md` in plain Portuguese and an equivalent section to `CHANGELOG.en.md`. Include the four implemented controls and preserved intentional behavior. Do not include planning history, removed findings, or scanner narrative.

- [ ] **Step 3: Update the security and hardening documents from proof**

For each finding in `docs/security-report.md`, mark it resolved only when its focused tests and milestone QA passed. Record the exact commit and command evidence. Leave any failed or unverified item open.

Update `hardening.json` source drift and completion fields without changing its `local_remediation_preferred` assessment. Validate JSON:

```zsh
node -e 'JSON.parse(require("node:fs").readFileSync("docs/security-hardening/hardening.json", "utf8")); console.log("hardening.json ok")'
```

- [ ] **Step 4: Create a concise current-state handoff**

Create `copilot_handoff.md` as a current index, not a diary. Include links to `AGENTS.md`, `README.md`, the corrected report, this plan, `docs/test-change-log.md`, verified commits, exact focused/full test commands, remaining open gates, and the next safe action. Remove repeated or superseded text before committing.

- [ ] **Step 5: Independent documentation QA**

The documentation QA agent compares every behavior claim against source and fresh test evidence, checks Portuguese/English changelog equivalence, rejects stale findings or false completion claims, and verifies the handoff is concise.

- [ ] **Step 6: Commit documentation and handoff**

```zsh
git add README.md CHANGELOG.md CHANGELOG.en.md docs/security-report.md docs/security-hardening/hardening.md docs/security-hardening/hardening.json docs/test-change-log.md copilot_handoff.md
```

```zsh
git commit -m "docs: record verified security boundaries"
```

---

### Task 6: Full Regression And Final Independent QA

**Files:**

- Review only: all files changed by Tasks 1-5
- Modify only if a failing acceptance criterion requires returning work to the responsible original implementer

**Interfaces:**

- Produces: evidence that the integrated original branch meets the corrected report and every non-negotiable requirement.

- [ ] **Step 1: Run the full automated suite**

```zsh
npm test
```

Expected: build succeeds and every `dist/**/*.test.js` test passes.

- [ ] **Step 2: Run repository hygiene checks**

```zsh
git diff --check
```

```zsh
git status --short --branch
```

```zsh
git log --oneline --decorate -8
```

- [ ] **Step 3: Run the final Sol-xhigh QA gate**

Dispatch one fresh read-only `gpt-5.6-sol` reviewer at `xhigh`. Its prompt must include the original user request, corrected security boundary, all non-negotiable rules, acceptance checklist, plan path, milestone commit IDs, test-change log, and full diff.

The reviewer must independently verify:

- every changed behavior maps to an approved finding;
- no approved endpoint, code transfer, or shared task-history feature was removed;
- no child receives unrelated secret sentinels;
- keyed Claude has no shell/npm tools;
- no implicit CLI cwd remains;
- redirects and response limits cover success/error and multibyte/chunked cases;
- panel mutation guard precedes every write;
- logs contain enough flow data and no prohibited content;
- all test rationale/history requirements are satisfied;
- documentation/memory claims match fresh evidence;
- no unrelated source or feature changed.

If QA rejects a milestone, send the exact defect to its original implementer, rerun that milestone's focused tests and QA, then rerun this full gate. Do not bypass, delete, weaken, or skip a test.

- [ ] **Step 4: Verify original-branch state and report completion evidence**

Confirm `HEAD` contains every accepted milestone commit, report branch/HEAD/ahead/dirty state, and provide the exact `npm test` pass count. Do not push, deploy, delete branches/worktrees, or publish anything without separate user authorization.

- [ ] **Step 5: Create the final authorized memory note from completed evidence**

Run:

```zsh
date '+%Y%m%dT%H%M%S%z'
```

Create exactly one new small file in `/Users/ppirooznia/.codex/memories/extensions/ad_hoc/notes/` using that timestamp plus `-multimodels-security-final.md`. Record the intentional approved-transfer/shared-history trust model, all verified milestone commit IDs, child-environment rule, keyed-Claude shell restriction, redirect and response-limit behavior, panel same-origin rule, exact full-regression evidence, final QA result, and remaining limitations. Do not edit `MEMORY.md` or any rollout summary directly.

## Completion Gate

The work is complete only when every acceptance checkbox is supported by a source path, focused test, milestone QA result, full regression result, documentation claim, and final memory note. Near-completion, elapsed time, or token budget is not a substitute for this evidence.
