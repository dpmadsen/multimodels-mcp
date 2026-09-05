# Security Hardening Review: multimodels-mcp

## Evidence Basis

This review uses the corrected security boundary in [`../security-report.md`](../security-report.md), the sealed Codex Security scan identified in [`context.md`](context.md), Tasks 1-4 evidence, and the final-review correction commit `bbffffa`.

## Constraints

Approved code transfer, endpoints, and shared all-project task history remain current product behavior. Approved file editing and command execution are target behavior, but the current CLI lanes remain read-only or constrained until their native confinement is proven. The work must be surgical, test-driven, dependency-free, observable through safe stderr logs, and executed by scoped agents with independent QA after each milestone.

## Opportunity Portfolio

No structural hardening opportunity qualified; the implemented local controls remain the appropriate remediation, with only native writable CLI confinement still open.

## Current verified state

Tasks 1-4 are implemented and reviewed. All four report findings are resolved: credential isolation, redirect rejection, response limits, and exact-origin panel mutation controls. The final review findings were corrected in `bbffffa`, and the post-fix full suite passed 313/313.

The keyed-Claude lane exposes only `Read`/`Glob`/`Grep` through the restrictive `--tools` option and uses `dontAsk` to fail closed without an interactive prompt while its provider credential is present. The subscription lane preserves `Read`/`Glob`/`Grep` plus `npm test`/`npm run build`. The `workdir` field is optional in the shared input shape, required and canonicalized for every CLI lane, and ignored by direct API lanes. Approved code transfer, arbitrary approved endpoints, and shared all-project task history remain intentional behavior.

The scoped re-review passed: all six final findings are addressed, with no new Critical/Important breakage. The focused 64/64 and full 313/313 results remain fix-wave historical evidence, not a new run; the controller freshly verified 313/313 at `14dd609`. The final memory note is recorded at `/Users/ppirooznia/.codex/memories/extensions/ad_hoc/notes/20260904T160959-0700-multimodels-security-final.md`. Native writable CLI confinement remains open; MCP roots are informational and do not prove enforcement. Do not claim writable agents are enabled. Deferred items remain the Codex/Gemini child-observed sentinel tests, panel HTTP integration test, and transitive SDK advisories. Next safe action is the branch integration decision.

The implementation details remain in the [implementation plan](../superpowers/plans/2026-09-04-multimodels-security-hardening.md).
