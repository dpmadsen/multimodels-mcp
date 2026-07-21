// Testes da resolução de instâncias do LM Studio (local e na rede).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLmStudioProvider } from "./catalog.js";
import type { ModelsConfig } from "../config.js";

const config: ModelsConfig = {
  providers: {
    lmstudio: {
      type: "openai-compat",
      label: "LM Studio (local)",
      baseUrl: "http://localhost:1234/v1",
      enabled: true,
      models: [],
    },
    "lmstudio-rede": {
      type: "openai-compat",
      label: "LM Studio (rede)",
      baseUrl: "http://192.168.0.42:1234/v1",
      enabled: true,
      models: [],
    },
    deepseek: {
      type: "openai-compat",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      envKey: "DEEPSEEK_API_KEY",
      enabled: true,
      models: [],
    },
    codex: { type: "codex-cli", label: "Codex", enabled: true },
  },
};

test("resolve a instância local e a da rede", () => {
  assert.equal(resolveLmStudioProvider(config, "lmstudio").label, "LM Studio (local)");
  assert.equal(resolveLmStudioProvider(config, "lmstudio-rede").label, "LM Studio (rede)");
});

test("recusa provedor que usa chave de API (não é LM Studio)", () => {
  assert.throws(() => resolveLmStudioProvider(config, "deepseek"), /não é uma instância do LM Studio/);
});

test("recusa o codex e ids desconhecidos", () => {
  assert.throws(() => resolveLmStudioProvider(config, "codex"), /não é uma instância do LM Studio/);
  assert.throws(() => resolveLmStudioProvider(config, "nao-existe"), /não é uma instância do LM Studio/);
});
