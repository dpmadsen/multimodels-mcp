# Project diary — multimodels-mcp

> English translation of [CHANGELOG.md](CHANGELOG.md) (Portuguese original — the project is built in Portuguese, in plain non-technical language, by design).

## 2026-07-20 — Delegation benchmark (198 runs) and z.ai endpoint fix
- New `benchmark/` folder with the full study of which models can safely receive delegated tasks: 6 stations × 11 models × 3 rounds, all graded by automated tests the models never saw. Includes the station prompts, the graders, every raw response, the reports, and the ready-to-share Reddit kit (images + English text).
- Key findings: the Codex family (Sol, Terra and Luna) scored 100% on everything; Luna costs 5× less than Sol and tied with it; structured JSON extraction was perfect across every model; and running each station 3 times overturned several conclusions a single round had suggested.
- Fixed the z.ai address: coding-subscription keys only work at the coding endpoint (`/api/coding/paas/v4`). At the old address they failed with a misleading "insufficient balance" error.

## 2026-07-20 — Second LM Studio instance (another machine on the network)
- New "LM Studio (network)" provider: models running for free on another machine on the local network, through its LM Studio.
- The panel's "Detect downloaded models" button now works for any LM Studio instance — the Mac's own and however many get added later.
- Tailored messages when something doesn't respond: the local instance suggests turning on LM Studio's server; the network one reminds you to check that the other machine is on with "Serve on Local Network" enabled.
- A badge in the panel distinguishes "free · local" from "free · network".
- Editable nickname: a pencil next to each LM Studio instance lets you rename it right in the panel — genuinely tested: the network instance was christened "Celta".
- Editable address: the machine's IP and port can also be changed in the panel ("Machine address" field), with the technical details (http:// and /v1) filled in automatically. Cloud provider addresses (DeepSeek, OpenRouter etc.) stay locked, for safety.
- All live in the panel at http://127.0.0.1:4747 (just reload the page) — merged into the project's main line.
- The panel port is now configurable (MULTIMODELS_PANEL_PORT variable), handy for testing without killing an open panel.
- Note: at test time the other machine was off — its model list starts empty and fills with one click of the detect button once it's on.
- 34 automated tests passing; interface checked on desktop and mobile. Old tests that depended on the panel's real choices were replaced with fixed-configuration tests (they no longer break when the enabled models change).

## 2026-07-20 — Fix: "thinking" models on long tasks
- Problem: delegating a long task to a reasoning model (one that "thinks" before answering) sometimes returned a response cut off mid-sentence, or a confusing "no text in response" error. The cause: the model's thinking was eating the space reserved for the answer.
- Requests now reserve much more room for the answer (32k tokens, adjustable per provider in config/models.json via the "maxTokens" field).
- If the model still spends everything just thinking, the error message explains that in plain language and suggests what to do.
- If the response gets cut off for lack of space, a clear warning appears at the end — no more silently truncated text.
- Tested live with the very model that had failed (Qwen 3.6 35B on LM Studio): the bug scenario now produces the clear message, and the long task comes back complete.
- 24 automated tests passing (7 new in this fix).

## 2026-07-20 — Control panel
- The panel is born: a local page (npm run panel) to manage API keys and pick models, no manual file editing.
- Search across the OpenRouter catalog (338 models, with price and context size) and one-click enabling — tested by adding Gemini 3 Flash.
- A button that detects the models downloaded in LM Studio.
- Keys never appear in full on screen (only the last 4 characters) and the panel only accepts connections from the Mac itself.
- Panel changes apply instantly: the server re-reads the configuration on every request from Claude.
- New rule: only models enabled in the panel accept delegation (the panel is the real menu).
- Delegation successfully tested on a local LM Studio model (Qwen 4B): correct answer, zero cost.
- Discovery: "preview" models on OpenRouter require adjusting the account's privacy policy (openrouter.ai/settings/privacy) — the owner's decision, not automated.
- 17 automated tests passing (11 new in this feature).

## 2026-07-20 — Server working (proof of life)
- The waiter is born: Claude Code now sees the "multimodels" server as connected.
- Two tools ready: list the available models, and delegate a task to another model.
- Genuinely tested: a task was delegated to Codex (through the ChatGPT subscription) and the answer came back correct.
- Models already on the menu: Codex, DeepSeek (2), z.ai (1) and the 3 local LM Studio models. OpenRouter joins once models are picked in the future panel.
- 6 automated tests created and passing.
- Fixed along the way: Codex would wait forever for a "go ahead" when called by the server — now the door closes by itself.

## 2026-07-20 — Foundation
- Project created: defined what it is, who it's for, and what problem it solves.
- Working rules recorded in CLAUDE.md.
- Day-1 security: keys file (.env) created and protected from leaking into git.
