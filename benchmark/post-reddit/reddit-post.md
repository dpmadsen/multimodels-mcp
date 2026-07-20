# I built an MCP server so Claude Code can delegate work to GPT-5.6, DeepSeek, GLM and a local Qwen — then benchmarked all of them against Claude itself (198 runs, hidden tests)

*Same idea works for any MCP-capable agent — the point is you can hand tasks to other companies' models without ever leaving your main app.*

**Before anything else:** I did all of this for my own testing, to make my own decisions about my own setup — I'm just sharing it because it might be useful to someone. And yes, I used AI to write this post, because I don't have time to write it myself. If you came here to complain that the post was written by AI instead of engaging with the content, please just scroll on.

**TL;DR:** I built a small MCP server so that Claude Code — the native app I live in — can delegate tasks to ANY other model (Codex CLI, DeepSeek, z.ai, local LM Studio over LAN) without me ever leaving the app. The same pattern works for any agentic system that speaks MCP. Then I had Claude benchmark all the lanes: 6 stations × 11 models × 3 rounds, graded by hidden test suites written before any model saw the tasks. Single-run results LIED in both directions: the "cheap model mistake" I caught in round 1 turned out to be the NORM for that model (its perfect round was the fluke), and two Anthropic baselines failed the same station 2-of-3 rounds — while the entire GPT-5.6 Codex family (including Luna at $1/M!) went 100% on everything, all 54 of their runs.

## Setup

I'm a non-programmer building things through vibecoding, with Claude Code (Fable 5) as my daily driver. The MCP server ("multimodels") exposes two tools — `list_models` and `delegate_task` — and routes to:

- **GPT-5.6 Sol, Terra and Luna** via the Codex CLI (ChatGPT subscription; xhigh reasoning)
- **DS4 Flash / DS4 Pro** (DeepSeek v4) via OpenRouter
- **GLM 5.2** via z.ai's coding-plan subscription (tip: sub keys only work on the `/coding/` endpoint — the generic endpoint returns a misleading "insufficient balance")
- **Qwen3.6 35B A3B** running locally on LM Studio, on a second machine over LAN

Baselines: **Claude Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5** as generic Claude Code sub-agents at default effort.

The question: *as an orchestrator, what can Claude safely hand off to the cheap/free lanes — and what does that cost?*

## Method

- 6 stations simulating real delegation: build-from-spec (BR currency parser, 18 hidden edge-case tests), find-and-fix-a-bug (9 tests), code review (3 seeded bugs + false-positive bait), strict JSON extraction (parsed programmatically), long compound deliverable (plan + sliding-window rate limiter + tests), and honesty under missing context ("fix services/estoque.js" — a file that doesn't exist).
- **Hidden graders written BEFORE delegating.** Models never saw them.
- **3 independent runs per cell**, identical prompts (in Portuguese — that's how I work). Cells report pass rates, not best-of.

## What 3 rounds revealed that 1 round hid

1. **DS4 Flash's perfect parser was the fluke.** Round 1: 18/18. Rounds 2 and 3: 17/18, failing `"1234,56"` (no thousands separator) — the *exact* edge case Sonnet 5 missed in round 1. One run told me "Flash > Sonnet at parsing." Three runs told me "this edge case trips most models sometimes."
2. **Sonnet 5 and Haiku 4.5 have a systematic weakness, not bad luck.** The bill-splitting contract requires spreading leftover cents so no two people differ by more than 1 cent. Sonnet dumped the whole remainder on person #1 in rounds 1 AND 3 (pass rate 1/3). Haiku did the same in rounds 2 AND 3 (1/3). Every single cheap delegate implemented it correctly 3/3. Fable 5 and Opus 4.8 also 3/3 — the flagships and the budget rivals got it; the mid-tier baselines didn't.
3. **The Codex family swept. All of it.** Sol, Terra, and Luna: perfect scores on every technical station, every round — 54/54 runs. And on the honesty station (fix a nonexistent file), all three *went and checked*: "there's no services/estoque.js in this project or its git history" — 9 out of 9 times. Luna costs $1/$6 per M. That's the single most useful discovery of the whole exercise.
4. **Strict JSON extraction is a solved problem.** 11 models × 3 rounds = 33/33 perfect, byte-exact, no markdown fences, correct ISO dates from mixed formats, correct cents from "mil e duzentos reais" written out in words. Delegate it to anything (and still validate on return).
5. **Local models are free AND flaky in creative ways.** Qwen3.6 35B matched frontier on most runs — then once shipped a compound task with tests where the code should be (no module at all), and once wrote a parser whose regex *required* the string to start with "R". Its review lane flagged the same speculative non-bug all 3 rounds. Free labor: keep work orders small and always verify.
6. **Hallucination under missing context is a personality trait, and it's stable.** Asked 3× to fix the phantom file: DS4 Flash invented complete imaginary MongoDB code in 2 of 3 rounds (emoji headers included). Haiku refused honestly 3/3. Fable refused 2/3 with the best line of the benchmark: fixing a function it can't see would be "like a mechanic fixing your engine without opening the hood." The Codex models just... checked. Tool access + honesty beats raw IQ here.

## Costs (USD, API-equivalent per full 6-task run)

| Model | Cost/run | Note |
|---|---|---|
| Qwen3.6 35B (local) | $0.000 | my own hardware |
| DS4 Flash | $0.0028 | measured from API usage |
| GPT-5.6 Luna | ~$0.013+ | $0 for me (ChatGPT sub); hidden reasoning not counted |
| Claude Haiku 4.5 | ~$0.016 | est. |
| DS4 Pro | $0.0166 | measured |
| GPT-5.6 Terra | ~$0.033+ | $0 for me (sub) |
| GLM 5.2 | ~$0.048 | $0 for me (coding-plan sub) |
| GPT-5.6 Sol | ~$0.063+ | $0 for me (sub); xhigh hidden reasoning → true cost higher |
| Claude Sonnet 5 | ~$0.065 | est. |
| Claude Opus 4.8 | ~$0.124 | est. |
| Claude Fable 5 | ~$0.27 | est. |

## The playbook (v2, consistency-validated)

1. **Tight spec + your own hidden tests = quality becomes a constant.** Then route by price. With three subscriptions (ChatGPT → Codex family, z.ai → GLM, Claude) plus a local box, my marginal cost for most delegations is zero.
2. **Never delegate without attaching ALL the context.** The models that hallucinate missing files do it *consistently*. The models that check, check consistently. Know which lane you're using.
3. **Local models get one-piece work orders, always verified.** Their failures aren't dumb — they're *weird* (missing modules, phantom "R" prefixes), which makes automated verification non-negotiable.
4. **Run everything 3×, judge nothing on 1×.** Half my round-1 narratives ("Flash beats Sonnet at parsing!") died in rounds 2–3. The other half got *stronger* (the cent-distribution gap is real). n=1 benchmarks are vibes with a table.

## Caveats

- n=3 is better than n=1, still small. No temperature control (whatever each provider defaults to).
- Anthropic models ran as generic sub-agents at default effort — likely underselling them (the same harness overhead applied to all baselines).
- Codex CLI hides reasoning tokens; Sol/Terra/Luna costs are floors, not totals.
- Tasks in Portuguese; results may differ in English.
- Graders were written by Claude, which also orchestrated everything — including judging its own model family. The automated stations are objective; station 6's classification involves judgment. Draw your own conclusions.

Happy to share the station prompts and graders if anyone wants to reproduce this.
