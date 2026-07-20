// Testes do leitor do cardápio.
// Os testes de resolução usam uma configuração de mentira (fixa), porque o
// config/models.json real muda conforme o Daniel habilita modelos no painel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, resolveModel, type ModelsConfig } from "./config.js";

const fixture: ModelsConfig = {
  providers: {
    codex: { type: "codex-cli", label: "Codex", enabled: true },
    deepseek: {
      type: "openai-compat",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      envKey: "DEEPSEEK_API_KEY",
      enabled: true,
      models: ["deepseek-chat"],
    },
    lmstudio: {
      type: "openai-compat",
      label: "LM Studio (local)",
      baseUrl: "http://localhost:1234/v1",
      enabled: true,
      models: ["qwen/qwen3-vl-4b"],
    },
  },
};

test("carrega o config/models.json real do projeto", () => {
  const config = loadConfig();
  assert.ok(config.providers.codex, "provedor codex deve existir");
  assert.ok(config.providers.deepseek, "provedor deepseek deve existir");
  assert.ok(config.providers.lmstudio, "provedor lmstudio deve existir");
  const rede = config.providers["lmstudio-rede"];
  assert.ok(rede, "provedor lmstudio-rede (outra máquina) deve existir");
  assert.ok(
    rede.type === "openai-compat" && rede.baseUrl.startsWith("http://192.168.0.42"),
    "lmstudio-rede deve apontar pra outra máquina da rede"
  );
});

test("resolve o id 'codex' sem nome de modelo", () => {
  const ref = resolveModel(fixture, "codex");
  assert.equal(ref.provider.type, "codex-cli");
  assert.equal(ref.model, undefined);
});

test("resolve 'deepseek:deepseek-chat' em provedor + modelo", () => {
  const ref = resolveModel(fixture, "deepseek:deepseek-chat");
  assert.equal(ref.providerId, "deepseek");
  assert.equal(ref.model, "deepseek-chat");
});

test("modelo local com barra no nome funciona ('lmstudio:qwen/qwen3-vl-4b')", () => {
  const ref = resolveModel(fixture, "lmstudio:qwen/qwen3-vl-4b");
  assert.equal(ref.model, "qwen/qwen3-vl-4b");
});

test("provedor desconhecido dá erro claro", () => {
  assert.throws(() => resolveModel(fixture, "inexistente:modelo"), /Provedor desconhecido/);
});

test("modelo não habilitado no painel é recusado", () => {
  assert.throws(
    () => resolveModel(fixture, "deepseek:modelo-que-nao-habilitei"),
    /não está habilitado/
  );
});

test("openai-compat sem modelo dá erro orientando o formato", () => {
  assert.throws(() => resolveModel(fixture, "deepseek"), /precisa incluir o modelo/);
});
