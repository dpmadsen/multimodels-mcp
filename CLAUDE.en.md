# Project: multimodels-mcp

> English translation of [CLAUDE.md](CLAUDE.md) — the author's working instructions for Claude Code, kept in Portuguese because that's how this project is actually built. [AGENTS.md](AGENTS.md) is the same document addressed to the Codex CLI.

## What it is
An MCP server that works as a "waiter" between Claude Code and other AI models: Claude delegates a task, the server processes it with the chosen model and brings the result back for Claude to evaluate. Available models: Codex (via ChatGPT subscription, through the `codex` CLI already installed on the Mac), DeepSeek, z.ai and OpenRouter (via API keys), and local models via LM Studio. Includes a local control panel to manage keys and enable/disable models.

## Who it's for
For Daniel, personal use, running only on his Mac inside Claude Code.

## Stack and commands
- Server: TypeScript + Anthropic's official MCP SDK (stdio transport, runs locally)
- Universal connector: OpenAI-compatible standard (covers DeepSeek, z.ai, OpenRouter and LM Studio — a new provider = 1 line of configuration + a key in .env)
- Codex: integrated via the `codex` CLI (uses the subscription, no API cost)
- Configuration panel: shadcn/ui + Tailwind (Vite, `ui/` folder), local page in the browser — open with `npm run panel` (http://127.0.0.1:4747); after changing interface code, `npm run build:ui`
- Model configuration: local `config/models.json` file (no database)
- Keys: ALWAYS in `.env` (never in models.json, never in code)
- Run the tests: `npm test` (builds and tests; tests live in `src/*.test.ts`)
- Build after changing code: `npm run build` (Claude Code runs the result from `dist/`)
- The server is registered in Claude Code under the name `multimodels` (user scope, valid in every project); check with `claude mcp list`
- Exposed tools: `list_models` (the menu) and `delegate_task` (delegation)

## How to work with me

### About me
- I do NOT know how to program. I've done vibecoding projects, but I need direction.
- Explain everything in Portuguese, with everyday analogies. NEVER assume I know technical terms.
- Objective answers. If I want more detail, I'll ask.

### How to communicate with me
- When you do something, show: (1) what you did, (2) how I see/test it, (3) what to do if it fails.
- On errors, explain in simple language FIRST, then suggest the fix.
- Vague request? Ask questions until you understand. Important decisions: present options and explain the differences in simple terms.
- Unless I say "do it now", treat my request as a conversation: think with me, propose an approach, and only modify files after I confirm.

### How to build
- Start with the minimum that works; we add complexity gradually.
- BEFORE creating anything new (UI component or feature), you MUST: (1) search the project for something similar, (2) if it exists, COPY and ADAPT it — same design conventions, naming and navigation — never build from scratch, (3) if it doesn't exist, show me the intended pattern and wait for my confirmation. Each UI component gets its own file. Inconsistency is unacceptable in this project.
- Each file must have one clear responsibility — one feature or section of the app. If a file starts mixing features, split it before continuing. Test: if you can't describe what the file does in one sentence, it's too big.
- Every interface must work on mobile and desktop. Show me how it looks on a small screen.
- Always handle errors: if something fails, show a friendly message in Portuguese; never let the screen break.

### How to verify your work
- For every new feature, write automated tests and RUN them before telling me you're done.
- Show me EVIDENCE that it works (test output, executed command, screenshot) — don't just claim it works.
- If a test fails, fix the CAUSE; never delete or disable a test to make it "pass".

### Security
- NEVER put API keys, passwords or secrets in code. Use a .env file, and make sure .env is in .gitignore (create it if it doesn't exist).
- If the project is public (multi-user), NEVER build authentication from scratch — use Supabase's or Firebase's native features.
- Validate all user input; never trust frontend data. CORS only for the app's domain, never *.
- Payments, personal data or cryptography: STOP and warn me before doing anything.
- Project-specific: the local panel must NEVER display saved keys in full (last 4 characters only) and may only accept connections from the Mac itself (localhost).

### Permissions and sensitive actions
- Never deploy, install dependencies or delete files/functions without explaining what and why, and waiting for my explicit confirmation.

### Versioning
- Completed and tested feature = commit with a descriptive message. Don't pile up uncommitted changes.
- With each completed feature, update the CHANGELOG.md at the root, in plain Portuguese, without technical jargon.
- Version number (since 0.2.0): a new feature bumps the middle (0.2.0 → 0.3.0), a fix bumps the end (0.2.0 → 0.2.1). Update the package.json "version" together with the feature commit, and the CHANGELOG entry title carries the version: "## 0.3.0 (date) — Feature name".
