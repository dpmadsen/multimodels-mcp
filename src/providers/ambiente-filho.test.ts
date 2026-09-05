// Protege o isolamento de credenciais entre provedores: estas provas não podem
// ser enfraquecidas sem a revisão completa de histórico, memória e plano que
// AGENTS.md exige, pois um segredo ambiente pode alcançar outro CLI sem aviso.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarAmbienteBase,
  montarAmbienteClaude,
  montarAmbienteCodex,
  montarAmbienteGemini,
} from "./ambiente-filho.js";
import type { ClaudeCliProvider } from "../config.js";

const origem: NodeJS.ProcessEnv = {
  PATH: "/test/bin",
  HOME: "/test/home",
  USER: "daniel",
  LOGNAME: "daniel",
  SHELL: "/bin/zsh",
  TMPDIR: "/test/tmp",
  TMP: "/test/tmp-alt",
  TEMP: "/test/temp",
  LANG: "pt_BR.UTF-8",
  LC_ALL: "pt_BR.UTF-8",
  LC_CTYPE: "pt_BR.UTF-8",
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
  NO_COLOR: "1",
  SSL_CERT_FILE: "/test/cert.pem",
  SSL_CERT_DIR: "/test/certs",
  CODEX_HOME: "/test/codex-home",
  HTTP_PROXY: "http://proxy.test",
  AWS_SECRET_ACCESS_KEY: "aws-secret-sentinel",
  OPENROUTER_API_KEY: "openrouter-secret-sentinel",
  ZAI_API_KEY: "zai-secret-sentinel",
  DEEPSEEK_API_KEY: "deepseek-secret-sentinel",
  UNRELATED_SECRET: "unrelated-secret-sentinel",
  ANTHROPIC_API_KEY: "anthropic-secret-sentinel",
  ANTHROPIC_AUTH_TOKEN: "anthropic-token-sentinel",
  ANTHROPIC_BASE_URL: "https://ambient.example",
  CLAUDE_CONFIG_DIR: "/ambient/claude",
  API_TIMEOUT_MS: "ambient-timeout",
};

const assinatura: ClaudeCliProvider = {
  type: "claude-cli",
  label: "Claude por assinatura",
  enabled: true,
  models: ["claude-sonnet-5"],
};

const comChave: ClaudeCliProvider = {
  type: "claude-cli",
  label: "Claude com chave",
  baseUrl: "https://selected.example/anthropic",
  envKey: "CHAVE_DE_TESTE",
  enabled: true,
  models: ["modelo-teste"],
};

test("ambiente base mantém só o sistema permitido e exclui segredos de outros provedores", () => {
  const env = montarAmbienteBase(origem);
  assert.equal(env.PATH, origem.PATH);
  assert.equal(env.HOME, origem.HOME);
  assert.ok(!("UNRELATED_SECRET" in env));
  assert.ok(!("OPENROUTER_API_KEY" in env));
  assert.ok(!("AWS_SECRET_ACCESS_KEY" in env));
  assert.ok(!("ZAI_API_KEY" in env));
  assert.ok(!("DEEPSEEK_API_KEY" in env));
  assert.ok(!("HTTP_PROXY" in env));
  assert.ok(!("ANTHROPIC_API_KEY" in env));
});

test("Codex recebe a base e CODEX_HOME, sem credenciais ambiente", () => {
  const env = montarAmbienteCodex(origem);
  assert.equal(env.CODEX_HOME, origem.CODEX_HOME);
  assert.equal(env.PATH, origem.PATH);
  assert.ok(!("UNRELATED_SECRET" in env));
  assert.ok(!("OPENROUTER_API_KEY" in env));
});

test("Gemini recebe só a base, sem CODEX_HOME nem variáveis não verificadas", () => {
  const env = montarAmbienteGemini(origem);
  assert.equal(env.PATH, origem.PATH);
  assert.equal(env.HOME, origem.HOME);
  assert.ok(!("CODEX_HOME" in env));
  assert.ok(!("UNRELATED_SECRET" in env));
  assert.ok(!("OPENROUTER_API_KEY" in env));
});

test("Claude por assinatura preserva o login em HOME e somente seu prazo", () => {
  const env = montarAmbienteClaude(origem, assinatura, undefined, undefined, 61_000);
  assert.equal(env.HOME, origem.HOME);
  assert.equal(env.API_TIMEOUT_MS, "61000");
  assert.ok(!("CLAUDE_CONFIG_DIR" in env));
  assert.ok(!("ANTHROPIC_API_KEY" in env));
  assert.ok(!("ANTHROPIC_AUTH_TOKEN" in env));
  assert.ok(!("ANTHROPIC_BASE_URL" in env));
  assert.ok(!("UNRELATED_SECRET" in env));
});

test("ambientes filhos nunca serializam valor ausente como texto undefined", () => {
  const env = montarAmbienteClaude(origem, assinatura, undefined, undefined, 61_000);
  for (const [nome, valor] of Object.entries(env)) {
    assert.notEqual(valor, "undefined", `${nome} não pode virar o texto undefined`);
  }
});

test("Claude com chave adiciona somente a rota e credencial selecionadas", () => {
  const env = montarAmbienteClaude(origem, comChave, "selected-key-sentinel", "/selected/claude", 61_000);
  assert.equal(env.CLAUDE_CONFIG_DIR, "/selected/claude");
  assert.equal(env.ANTHROPIC_BASE_URL, "https://selected.example/anthropic");
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, "selected-key-sentinel");
  assert.equal(env.ANTHROPIC_API_KEY, "selected-key-sentinel");
  assert.equal(env.API_TIMEOUT_MS, "61000");
  assert.ok(!("UNRELATED_SECRET" in env));
  assert.ok(!("OPENROUTER_API_KEY" in env));
  assert.ok(!("ZAI_API_KEY" in env));
});
