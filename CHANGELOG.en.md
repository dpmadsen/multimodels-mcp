# Project diary — multimodels-mcp

> English translation of [CHANGELOG.md](CHANGELOG.md) (Portuguese original — the project is built in Portuguese, in plain non-technical language, by design).

## 0.4.1 (2026-07-23) — Longer OpenRouter deadline and Kimi's consolidated scoreboard
- The OpenRouter deadline went up to 15 minutes: models that reason a lot needed more room to finish before the system gives up.
- With that, Kimi K3 closed round 4 at 5 of 6 perfect, thinking 6 to 12 minutes per task (the slowest in the study).
- One failure of the model's own remains: on one station it finishes reasoning but never emits the final answer.
- Cost: because it thinks so much, it runs ~US$ 0.20 per delivered task, about 5× Grok. Details in `benchmark/rodada4-raias-novas/`.

## 2026-07-22 — Benchmark round 4 (partial): Kimi K3 debuts; Gemini waits on quota
- We tested two new lanes on the same two stations as round 3 (the validator against the really-installed zod v4, and the cents-allocation puzzle), with the same hidden graders. Only Kimi K3 got to run; the two Gemini lanes were postponed.
- The Kimi K3 finding (it only receives text, never looks at the files): it beat the "new-library trap" — it wrote the current zod API from memory and aced it (14/14). It's only the second text-only model to pull this off; the other was Grok, in the previous round. The "fresh-memory club" now has two members.
- Kimi closed the round at 5 of 6 perfect, with a single failure of the model's own (on one station it finishes reasoning but never emits the answer). It's slow and pricey: the heaviest reasoner in the study (6 to 12 minutes per task) and ~US$ 0.20 per delivered task, about 5× Grok.
- The two Gemini lanes (3.1 Pro and 3.6 Flash) didn't run: the Google subscription quota ran out that day. It reopens around Jul 29, and they'll be tested then. Until then they're marked "postponed", never scored zero.
- Everything (scoreboard, raw answers and the round write-up) is in `benchmark/rodada4-raias-novas/`.

## 0.4.0 (2026-07-22) — Gemini got eyes: file reading in delegations
- The Gemini lane is no longer text-only: given the task folder (workdir), Gemini now actually READS project files — same read-only scheme as Codex (reading yes, touching no).
- What unlocked it: we discovered agy ignores the old config file and only honors permissions in `~/.gemini/antigravity-cli/settings.json` (Daniel created it with read-only rules), and that the task folder must be attached with `--add-dir` (without it agy cannot even see the folder).
- Error messages updated: if permissions are not configured, the message now teaches the right file path instead of just telling you to paste the context into the text.
- 2 new tests (73 total, all passing). Really tested 4 times: Gemini read a secret file and answered the exact content every time.

## 0.3.1 (2026-07-22) — Panel: subscription cards now show their models
- The Codex, Gemini and GLM-with-hands cards looked "empty" in the panel: enabled models were not shown (a flaw inherited since the Codex card). Now every card shows the "Enabled models" list and allows adding/removing, just like the API cards.
- 3 new panel-server tests (71 total, all passing).

## 0.3.0 (2026-07-22) — GLM-with-hands lane: GLM now reads the project and runs the tests
- The trick that shone in the benchmark became an official provider: the new id `glm-maos:glm-5.2` runs GLM piloting a disposable Claude Code pointed at z.ai — it READS project files, searches the code and actually runs `npm test`/`npm run build`, but CANNOT edit anything (write tools stay blocked).
- In benchmark round 2.1 this recipe turned text-only GLM (which shipped a broken test without knowing) into the author of the largest test suite of any lane. Now it is one delegation away, no manual script.
- Uses the z.ai key already in .env (subscription, no extra cost); disposable identity per call (never touches Daniel's Claude login); queue of 1 call at a time and a 15-minute deadline, because z.ai is slow and chokes on parallel calls.
- All the Gemini lane protections came along: memory caps, timeouts that never tie, intact accents and errors explained in Portuguese.
- 8 new automated tests (69 total, all passing). Really tested: GLM read a secret file in a test folder and answered the correct content on the first try.

## 0.2.0 (2026-07-22) — New lane: Gemini through the Google AI Pro subscription (via Antigravity)
- You can now delegate tasks to Google's Gemini using Google AI Pro subscription credits (the one bundled with Google One) — no API cost, same scheme as Codex.
- New menu ids: `gemini` (default model), `gemini:gemini-3.1-pro-high`, `gemini:gemini-3.1-pro-low`, `gemini:gemini-3.6-flash-high` and `gemini:gemini-3.6-flash-low`. Reasoning effort is chosen by the name suffix (high thinks harder, low answers faster).
- Under the hood it uses the `agy` program (Antigravity CLI) — Google retired the old `gemini-cli` for personal accounts in June 2026, and `agy` is the official replacement. Runs in read-only mode: it analyzes and answers, never edits files.
- Known limitation: in headless mode Gemini cannot READ project files (the permission is silently denied) — so the delegated task must carry the full context in its own text, just like the DeepSeek and GLM lanes. When it happens, the error message explains what to do.
- The panel shows the Gemini card with the "subscription" badge, same as Codex.
- 4 new automated tests, all 59 passing. Really tested: simple question and context-in-text task, correct answers from both Flash and Pro.
- Cross-review by two outside models (GPT-5.6 at max effort and GLM) hardened the lane the same day: timeouts that no longer tie (the right error message always speaks), accents that no longer break mid-character, a memory cap on responses and more honest error diagnostics. 61 tests total.

## 2026-07-22 — First community contributions: cross-platform panel and old-Node warning
- Two improvements contributed by Sean Campbell (@rudi193-cmd), who found the project through Reddit — the first outside contributions accepted into the project:
- The panel now opens the browser automatically on Windows and Linux too (it used to work only on the Mac), and the Codex error message no longer says "on the Mac" to people on other systems.
- Anyone installing with an old Node version (below 21) now gets a clear warning at install time — before, `npm test` would pretend it had run the tests while running none, without saying a word.
- On top of the contribution we added a safeguard: if the machine has no browser (e.g. a headless server), the panel keeps running instead of shutting itself down.

## 2026-07-21 — Per-provider queue with retry, and reasoning effort for API providers
- Two improvements that came straight out of the benchmark lessons: z.ai and LM Studio choked on simultaneous calls (the session silently hung or the connection dropped), and reasoning effort changes GLM's results (max effort gets right what high effort got wrong).
- Per-provider queue: you can now cap how many simultaneous calls each provider takes (z.ai and both LM Studio entries are now limited to 1 at a time); extra calls wait their turn instead of killing the connection.
- Automatic retry: if a call fails from a connection problem or a transient provider error (rate limit or server instability on their side), the system waits 2 seconds and retries once on its own. Malformed-request errors don't retry (repeating wouldn't help).
- Per-call timeout is now adjustable per provider (z.ai got 15 minutes and the LM Studio entries 30, because local models are slower).
- Reasoning effort (how hard the model "thinks" before answering) now works on API providers too, not just Codex: z.ai ships configured with its format and OpenRouter with its own. Callers can request an effort per delegation or rely on each provider's default.
- The response footer now shows the effort used (when any) and flags answers that only arrived after a retry.
- 12 new automated tests (4 queue + 8 effort/retry), all 55 passing.

## 2026-07-21 — Benchmark round 3: the fresh-knowledge exam
- New round built from the Reddit community's ideas: 13 lanes (including debutants Grok 4.5, Qwen 27B and GLM at two effort levels), 2 new stations × 3 runs each, with controlled reasoning effort and mandatory verification.
- The star station used a genuinely installed current library: models with stale knowledge (DeepSeek, budget GLM, both Qwens) wrote old-version code 9 times out of 9 — code that doesn't even boot. Whoever has "hands" to check (Codex, Claude agents) or fresh memory (Grok) walked through unharmed.
- Other findings: too much effort backfires (Codex at max effort hesitated and marathon-ran; at high it was fast and perfect); the pure-math station was aced by nearly everyone, from the 1-cent model to the priciest; and delivery failures (hanging, not answering) are random while knowledge failures are dead-consistent.
- Full report, the 78-run scoreboard, stations and graders in `benchmark/rodada3-esforco-e-cutoff/`.

## 2026-07-20 — Benchmark round 2: 5 models implemented the same real feature
- The feature below (choosing the Codex model) became an experiment: Sonnet, Opus, GPT-5.6 Terra, GPT-5.6 Luna and DS4 Pro each implemented the same task on their own branch, graded by 12 hidden checks written beforehand.
- All of them aced the hidden checks — but the close review separated the field: Sonnet did the best work (more tests, project-style comments, best changelog) and its version was the one merged. DS4 Pro, which only receives text, accidentally deleted 7 existing tests — proof that attaching the FULL context is not overkill.
- Full study, with costs and lessons, in `benchmark/rodada2-implementacao/`. Each model's branch was preserved.

## 2026-07-20 — Choosing the Codex model and reasoning effort at delegation time
- You can now request a specific model from the Codex family when delegating: besides the plain id "codex" (which keeps using the Mac's default model), "codex:gpt-5.6-sol", "codex:gpt-5.6-terra" and "codex:gpt-5.6-luna" also work.
- You can also pick the reasoning effort (how hard the model "thinks" before answering): low, medium, high or extra-high — useful because Luna costs a fifth of Sol and ties it on technical tasks (see today's benchmark).
- The "list models" tool now shows one line per enabled Codex model instead of the single generic line.
- Asking for a model or effort that doesn't exist returns an error message spelling out the valid options.
- 8 new automated tests covering these cases, all passing.

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
