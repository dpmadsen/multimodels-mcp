# Round 3: the comment section designed my benchmark — 13 lanes, controlled reasoning effort, and a knowledge-cutoff trap. The cheap models didn't fail at reasoning; they failed at *knowing what year it is*.

**Follow-up to [my post from yesterday](https://www.reddit.com/r/ClaudeAI/comments/1v1tnmn/)** — the one where an MCP server lets Claude Code delegate work to GPT-5.6, DS4, GLM and a local Qwen, benchmarked across 198 runs. The comment section there didn't just discuss the results: it redesigned the methodology. So this time, following your ideas, we ran a whole new round — and every upgrade has a name attached:

- **u/TyrianMurex** — the two biggest upgrades: *verification as an executed step, not an instruction* (every lane with file access now must run the tests and quote raw output; the orchestrator re-runs everything), and the **knowledge-cutoff station**: implement against the *actually installed* current version of a library (zod v4), graded by running the real dependency. Their follow-up warning — "agreement isn't correctness" — got confirmed by the data before I could even test it (see below).
- **u/jake_that_dude** — retry-agreement: everything now runs **3×**, and consistency gets scored, not just pass/fail.
- **u/Physical_Gold_1485** (with u/miscUser2134's diplomatic translation) — reasoning effort is now **controlled per lane**: Codex at high vs xhigh, GLM at high vs max.
- **u/mark_99** — "your tests need to be harder." The cutoff station finally separated the field (and your calibration-curve idea is on the backlog).
- **u/DarkSkyKnight** and **u/Exodus_Green** — "add Grok 4.5." Oh boy. See below.
- **u/Unlikely_Rope_81** — the cost challenge: measured properly across rounds, agentic work ≈ **20× the tokens of chat work** for the same model. You were right that it's real; subscriptions+caching are what make it survivable.
- **u/kantorcodes1** — per-model permissions: the agentic GLM lane ran with a scoped tool allowlist (read/edit/run-tests only, isolated config).
- **u/2frames_app** — full English translations shipped in the repo; per-provider budget caps on the backlog.
- **u/C6ntFor9et**, **u/tackylitre06**, **u/vitaminwhite** — error-cataloging per lane, CLAUDE.md routing defaults, and Kimi as a candidate lane: all on the backlog.

## Setup

Two new stations, both with hidden graders written before any model saw them: **A)** build a validator using the *installed* zod v4 — the API changed from v3, so stale training data produces code that dies on import; **B)** a brutal cents-allocation algorithm with caps (pure reasoning, zero dependencies). 13 lanes × 2 stations × 3 rounds.

Besides Grok, we added one more lane of our own: **Qwen3.6 27B** (the dense sibling that local-LLM folks kept saying beats the 35B MoE). Spoiler: on knowledge it fails the same way — but on *reliability* it's a different animal.

## Results

**Perfect 6/6:** Claude Sonnet 5, Claude Opus 4.8, GPT-5.6 Terra (high), GPT-5.6 Luna (high) — and **Grok 4.5, text-only**, the only lane without file access to survive the cutoff trap. It just *knows* current APIs. Three times in a row. ~$0.04/task.

**The cutoff massacre:** DS4 Pro, GLM 5.2 (high effort), Qwen 27B and Qwen 35B all scored **0/14 on the zod station, nine-for-nine, identically** — v3 API written from memory, confidently, in code that doesn't even load. The same models were nearly flawless on the pure-reasoning station (18/18 across the board). The cheap models don't reason worse. They know a world that no longer exists.

**"Agreement isn't correctness," confirmed:** u/TyrianMurex predicted that stale-knowledge failures would be *consistent* — run it twice, both runs agree, both are wrong. Exactly what happened: every knowledge failure was identical across all 3 rounds. Retry-agreement catches flaky failures; only the live dependency catches systematic ones.

**Effort has a sweet spot, and past it things get weird:** Codex at high = perfect and fast (2-4 min/task). At xhigh: same scores where it delivered, but one run *planned everything and then asked "may I implement this?" into a headless void* (nothing was there to answer), and another took **60 minutes** on a task high does in 4. Meanwhile GLM at max effort *remembers* the new zod API 2 rounds out of 3, where GLM at high forgets it 3 out of 3 — more thinking literally rescued its memory. And Grok at default effort needed nothing.

**Delivery reliability is its own axis:** knowledge failures were perfectly consistent, but *delivery* failures (agentic GLM stalling silently, xhigh hesitating, Qwen 35B twice burning its entire token budget on pure thinking and once shipping an infinite loop) were random across rounds — only visible because everything ran 3×. The new Qwen 27B settled the 27B-vs-35B debate for my use case: same stale knowledge, but it delivered all 6 tasks like a metronome while the 35B melted down three different ways. For local delegation, slow-and-reliable beats fast-and-erratic.

**Update, minutes before posting — the GLM stall mystery is solved, and it wasn't the model.** I re-ran the "stubborn" stalled task completely solo, with zero other traffic hitting z.ai: **18/18 in 7m45s**, first try. The silent stalls only ever happened while other z.ai calls (and zombie generations from killed runs) were in flight — the coding plan has concurrency limits, and an agentic session that can't get a slot just hangs quietly instead of erroring. Lesson for anyone running GLM agentically on the coding plan: **serialize your z.ai traffic**, one request at a time, and it behaves.

## Where I landed (my stack going forward)

I'm consolidating on **Anthropic + GPT + GLM** — not because the others are worse, but because those three are the ones I can run **as agents with file access via CLI on my machine** (native Claude Code agents, Codex CLI, and Claude Code pointed at z.ai's endpoint — an officially supported setup). Full project context + the ability to check installed versions + run tests before delivering is what actually separated lanes in these benchmarks, more than raw intelligence. Grok stays as my text-only exception (fresh knowledge, no hands needed) and DS4 for penny-cheap self-contained algorithms.

The economics: **$100 Claude + $20 ChatGPT + ~$16 GLM ≈ $136/month** buys an orchestrator plus three implementation teams from three different companies, all flat-rate — which matters because agentic work eats ~20× the tokens of chat. Spreading delegation across three subscriptions means I basically never hit anyone's limit. The entire 3-round benchmark (~290 graded executions) cost **under $1** in actual API spend.

**About the repo link:** https://github.com/dpmadsen/multimodels-mcp is temporarily down — GitHub's anti-spam automation suspended my account hours after the first post, apparently because a brand-new public repo suddenly getting a wave of traffic from Reddit looks exactly like a spam campaign to a robot. The irony of being flagged for *sharing open source too successfully* is not lost on me. An appeal is in with GitHub support; the moment the account is reinstated, the same link will work again and I'll push the full Round 3 study there too (stations, hidden graders, per-cell scoreboard).

Thanks again to everyone who shaped this. Round 4 backlog is already writing itself.
