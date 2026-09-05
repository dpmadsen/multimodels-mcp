# Security Review: multimodels-mcp

**Major follow-up on `c4d2dd3`:** The keyed-Claude launch now adds `--settings '{"disableAllHooks":true}'`. Project `.claude/settings.json` and `.claude/settings.local.json` hooks could execute commands with the selected credential even though Bash was unavailable to the model. CLI settings override both project forms, including `disableAllHooks:false`; the shared launch path covers synchronous and background delegation. Subscription arguments remain unchanged. See the official [hook suppression rules](https://code.claude.com/docs/en/hooks#disable-or-remove-hooks) and [settings precedence](https://code.claude.com/docs/en/settings#settings-precedence). Administrator-managed policy/hooks remain a trusted higher-priority configuration. Focused tests passed 31/31 after two expected pre-fix failures; they verify real spawned argv with a fake CLI, not Claude's internal hook execution. Native confirmation is unavailable because `claude` is absent.

**Minor residual from this review:** Early Content-Length overflow and redirect rejection in `src/providers/openai-compat.ts` do not explicitly cancel the response body. No recipient/size acceptance bypass was established; the issue is response-resource cleanup and remains outside this Major+ fix.

**Follow-up regression:** `timeout 120 npm test` passed 313/313 with no skips; output is in `/private/tmp/multimodels-hooks-npm-test.log`.

**Prior reviewed revision:** `bbffffa` (final-review corrections synchronized 2026-09-04)
**Prior review date:** 2026-09-04
**Prior review status:** All six findings from that wave were addressed; its scoped re-review passed with no new Critical/Important breakage. Native writable-permission verification remains open.

## Security boundary

The MCP is intentionally allowed to send project code to any model or endpoint the user approves. The target design permits approved agents to read, edit, and run commands within authority granted by the user and calling Codex session. The current implementation still uses read-only or constrained verification modes; writable delegation remains gated on runtime confinement proof.

The security boundary is crossed only when:

- an agent receives filesystem or command authority beyond the approved scope;
- data or credentials reach a recipient other than the approved provider;
- a webpage or other unapproved caller changes local configuration;
- a provider response exceeds the locally configured resource limit.

## Findings

### High: CLI children inherit unrelated credentials — Resolved

`loadEnvFile()` copies every project `.env` value into global `process.env`. Codex and Gemini inherit that environment automatically, while Claude copies it explicitly. A child selected for one provider therefore receives credentials belonging to other providers and the host process.

Evidence:

- `src/config.ts:207-218`
- `src/providers/codex.ts:49-57`
- `src/providers/gemini.ts:87-92`
- `src/providers/claude-cli.ts:100-136`

Required control: every CLI child receives a minimal allowlisted environment. A keyed Claude lane receives only its selected routing values and credential, and it must not expose shell tools until that credential is separated from tool subprocesses.

Evidence of resolution: commits `50c6737` and `bbffffa`. The final correction uses Claude Code's restrictive `--tools Read,Glob,Grep` option plus `--permission-mode dontAsk` for keyed lanes; `--allowedTools` remains only the matching pre-approval list. Focused final-fix tests passed 64/64 and full `npm test` passed 313/313. The subscription lane retains its earlier arguments and npm verification commands. See the official [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) and [permission-mode reference](https://code.claude.com/docs/en/permission-modes).

### Medium: the localhost panel accepts cross-site mutations — Resolved

The panel binds to `127.0.0.1`, but its key and configuration POST routes do not verify `Origin`, `Host`, or `Content-Type`. A malicious webpage can send a blind cross-site request while the panel is running and change keys or provider settings.

Evidence:

- `src/panel/server.ts:38-76`
- `ui/src/lib/api.ts:58-93`

Required control: accept mutations only from the exact loopback panel origin and host using `application/json`. Keep arbitrary user-approved provider URLs allowed.

Evidence of resolution: commit `0133f9a`; focused panel validation passed 61/61 in Task 4 QA.

### Medium: provider redirects can change the approved recipient — Resolved

OpenAI-compatible completion and LM Studio catalog requests use the default Fetch redirect behavior. A configured endpoint can redirect the request without separate approval. Local validation with the installed Node runtime confirmed that a cross-origin `307` redirect forwards the complete POST body, although Node stripped the test Authorization header.

Evidence:

- `src/providers/openai-compat.ts:131-143`
- `src/panel/catalog.ts:58-64`

Required control: use `redirect: "manual"` and reject every redirect. The initially configured HTTP or HTTPS endpoint remains allowed exactly as entered by the user.

Evidence of resolution: commit `36f7704`; focused provider/limit/logger QA passed 54/54, including 302/307 rejection and unchanged retry behavior.

### Medium: provider response size is not locally enforced — Resolved

`maxTokens` is only sent as the provider's `max_tokens` request hint. Successful and error responses are buffered before parsing, so a faulty or compromised endpoint can exceed the model's intended limit and consume excessive local memory.

Evidence:

- `src/providers/openai-compat.ts:27-30`
- `src/providers/openai-compat.ts:133-142`
- `src/providers/openai-compat.ts:160-170`

Required control: keep model names as strings and add a small optional per-model limits map. Enforce a raw response-byte limit locally while retaining token limits as distinct model metadata.

Evidence of resolution: commits `36f7704`, `e85c7dd`, and `2c9486b`; focused boundary tests passed in Task 3 QA, including exact-limit, chunked UTF-8, success/error, and CLI paths.

## Permission verification requirement

The shared `delegate_task` input keeps `workdir` structurally optional because direct API lanes ignore it. Before dispatching Codex, Gemini, or any Claude/"with hands" CLI lane, the handler requires `workdir`, resolves it to an existing canonical directory, and passes that explicit directory to the child. This removes implicit server-cwd fallback, but it does not prove that the child process cannot exceed the calling Codex session's approved authority. MCP roots can identify workspace directories, but the MCP specification defines them as informational rather than an access-control mechanism.

Before writable delegated modes are enabled, each installed CLI must pass a bounded runtime check showing that reads, writes, and commands cannot exceed the approved scope. If a provider cannot demonstrate that confinement, it must return a result or patch for the primary Codex agent to apply inside its own approved environment.

Evidence:

- `src/tools/delegate.ts`
- `src/pasta-de-trabalho.ts`
- `src/providers/codex.ts`
- `src/providers/gemini.ts`
- `src/providers/claude-cli.ts`
- [MCP Roots specification](https://modelcontextprotocol.io/specification/2026-07-28/client/roots)

## Existing protections

- MCP transport is stdio; it does not expose a network listener.
- The panel binds only to `127.0.0.1`.
- Full saved API keys are not returned by the panel.
- `.env` and `.multimodels/` are excluded from Git.
- Direct OpenAI-compatible providers receive the supplied task text but do not read `workdir`.
- Provider/model enablement and model-name checks are enforced before delegation.

## Final review corrections

The findings from the post-Task 4 review were implemented in `bbffffa`: keyed Claude now restricts actual tool availability and fails closed non-interactively; the registered `workdir` description matches every CLI lane; and the affected assertion/helper groups now carry the required rationale and append-only history record. README and hardening artifacts were synchronized after the 313/313 regression run.

The scoped re-review of this final fix wave passed: all six final findings are addressed, with no new Critical/Important breakage. The focused 64/64 and full 313/313 results remain fix-wave historical evidence, not a new run; the controller freshly verified 313/313 at `14dd609`. The final memory note is recorded at `/Users/ppirooznia/.codex/memories/extensions/ad_hoc/notes/20260904T160959-0700-multimodels-security-final.md`. Native writable confinement remains open. Deferred items remain the Codex/Gemini child-observed sentinel tests, panel HTTP integration test, and transitive SDK advisories. Next safe action is the branch integration decision.

## Implementation plan

See `docs/superpowers/plans/2026-09-04-multimodels-security-hardening.md`.
