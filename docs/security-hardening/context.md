# Security Hardening Evidence Context

## Source identity

- Repository revision: `4fea6caa549e37e1fc8e7bbe0cd7236c3049d404`
- Source drift at planning time: none
- Codex Security scan: `7ae6692d-40b0-4de0-a125-ba5ad2efdc23`
- Sealed manifest SHA-256: `59ce71d8a98107707b3a3ed8f0a6a29d712376a885f4d3662616d166c3629753`
- Corrected user-facing evidence: `../security-report.md`

## Authorized behavior

- The user chooses which internal, external, local, LAN, HTTP, or HTTPS endpoint is trusted.
- Approved agents may receive source, edit it, and execute approved commands.
- Shared task history across the user's projects is intentional.
- External transfer by itself is not a security finding.

## Controls requiring local remediation

1. CLI processes receive unrelated environment credentials.
2. The loopback panel does not reject cross-site mutation requests.
3. Provider HTTP requests follow redirects beyond the configured endpoint.
4. Provider response bytes are not bounded locally from model/provider definitions.
5. Delegated filesystem and command confinement must be demonstrated before writable modes are enabled.

## Evidence notes

- The installed Codex CLI exposes `read-only`, `workspace-write`, and `danger-full-access` sandbox modes, `-C`, `--add-dir`, `--ephemeral`, `--ignore-user-config`, and `shell_environment_policy` overrides.
- `agy` and `claude` were not available on the planning shell PATH, so their writable-mode and confinement contracts remain runtime gates rather than assumptions.
- A local two-server Node check confirmed that default Fetch handling forwards a POST body across a `307` redirect and strips the test Authorization header.
- Official MCP roots are useful workspace hints but are not protocol-enforced access control.

## Planning conclusion

The remaining controls are independent and proportionate local fixes. No database, credential service, proxy, policy engine, task namespace, URL allowlist, or model-catalog redesign is justified for this phase.
