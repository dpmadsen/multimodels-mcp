// Testes do tradutor do cardápio para a tela do painel.
// Usam uma configuração de mentira (fixa), porque o config/models.json real
// muda conforme o Daniel mexe no painel.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelsConfig } from "../config.js";
import { stateSnapshot, envKeyPertenceAAlgumProvedor } from "./provider-view.js";

function fixture(): ModelsConfig {
  return {
    defaults: { timeoutMinutes: 10 },
    providers: {
      codex: { type: "codex-cli", label: "Codex", enabled: true, models: ["gpt-5.6-sol"] },
      gemini: { type: "gemini-cli", label: "Gemini", enabled: true, models: ["gemini-3.1-pro-high"] },
      "glm-maos": {
        type: "claude-cli",
        label: "GLM com mãos",
        baseUrl: "https://api.z.ai/api/anthropic",
        envKey: "ZAI_API_KEY",
        enabled: true,
        models: ["glm-5.2"],
      },
      "kimi-maos": {
        type: "claude-cli",
        label: "Kimi com mãos",
        baseUrl: "https://api.moonshot.ai/anthropic",
        envKey: "MOONSHOT_API_KEY",
        enabled: false,
        models: ["kimi-k3"],
      },
      // Raia "com mãos" de assinatura: sem endereço e sem chave, de propósito.
      "claude-maos": {
        type: "claude-cli",
        label: "Claude com mãos (assinatura)",
        enabled: true,
        models: ["claude-opus-5", "claude-sonnet-5"],
      },
      deepseek: {
        type: "openai-compat",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        envKey: "DEEPSEEK_API_KEY",
        enabled: true,
        models: ["deepseek-chat"],
      },
      zai: {
        type: "openai-compat",
        label: "z.ai",
        baseUrl: "https://api.z.ai/api/coding/paas/v4",
        envKey: "ZAI_API_KEY",
        enabled: true,
        models: ["glm-5.2"],
        effortStyle: "openai",
        effortOptions: ["high", "max"],
        defaultEffortByModel: { "glm-5.2": "high" },
      },
      lmstudio: {
        type: "openai-compat",
        label: "LM Studio (local)",
        baseUrl: "http://localhost:1234/v1",
        enabled: true,
        models: ["qwen/qwen3.6-35b-a3b"],
      },
    },
  };
}

function provedor(estado: ReturnType<typeof stateSnapshot>, id: string) {
  const encontrado = estado.providers.find((p) => p.id === id);
  assert.ok(encontrado, `o painel deveria mostrar o provedor "${id}"`);
  return encontrado;
}

test("painel mostra a chave (mascarada) das raias com mãos", () => {
  const estado = stateSnapshot(fixture(), { ZAI_API_KEY: "chave-secreta-1234" });
  const glm = provedor(estado, "glm-maos");
  assert.ok(glm.key, "a raia com mãos precisa ter campo de chave");
  assert.equal(glm.key.envKey, "ZAI_API_KEY");
  assert.equal(glm.key.set, true);
  assert.equal(glm.key.last4, "1234");
});

test("painel nunca devolve a chave inteira", () => {
  const estado = stateSnapshot(fixture(), { ZAI_API_KEY: "chave-secreta-1234" });
  assert.ok(
    !JSON.stringify(estado).includes("chave-secreta-1234"),
    "a chave inteira não pode aparecer na resposta do painel"
  );
});

test("raia com mãos sem chave preenchida aparece como 'não configurada'", () => {
  const estado = stateSnapshot(fixture(), {});
  const kimi = provedor(estado, "kimi-maos");
  assert.ok(kimi.key);
  assert.equal(kimi.key.envKey, "MOONSHOT_API_KEY");
  assert.equal(kimi.key.set, false);
  assert.equal(kimi.key.last4, null);
});

test("Codex e Gemini continuam sem campo de chave (entram por assinatura)", () => {
  const estado = stateSnapshot(fixture(), { ZAI_API_KEY: "abcd1234" });
  assert.equal(provedor(estado, "codex").key, null);
  assert.equal(provedor(estado, "gemini").key, null);
});

test("motores de API continuam com campo de chave, como antes", () => {
  const estado = stateSnapshot(fixture(), { DEEPSEEK_API_KEY: "ds-0000abcd" });
  const ds = provedor(estado, "deepseek");
  assert.ok(ds.key);
  assert.equal(ds.key.last4, "abcd");
  assert.equal(ds.baseUrl, "https://api.deepseek.com/v1");
});

test("a raia com mãos de assinatura não ganha campo de chave no painel", () => {
  const estado = stateSnapshot(fixture(), { ZAI_API_KEY: "chave-secreta-1234" });
  const claude = provedor(estado, "claude-maos");
  assert.equal(claude.key, null, "quem entra por assinatura não tem chave pra pedir");
  assert.equal(claude.baseUrl, null, "raia com mãos nunca mostra endereço no painel");
  assert.equal(claude.type, "claude-cli");
  assert.deepEqual(claude.models, ["claude-opus-5", "claude-sonnet-5"]);
});

test("a raia com mãos com chave continua mostrando a chave mascarada", () => {
  const estado = stateSnapshot(fixture(), { ZAI_API_KEY: "chave-secreta-1234" });
  const glm = provedor(estado, "glm-maos");
  assert.equal(glm.key?.envKey, "ZAI_API_KEY");
  assert.equal(glm.key?.last4, "1234");
});

test("o config real do projeto traz a raia claude-maos sem campo de chave", async () => {
  const { loadConfig } = await import("../config.js");
  const estado = stateSnapshot(loadConfig(), {});
  assert.equal(provedor(estado, "claude-maos").key, null);
});

test("gravar chave: aceita a variável do Kimi com mãos", () => {
  assert.equal(envKeyPertenceAAlgumProvedor(fixture(), "MOONSHOT_API_KEY"), true);
});

test("gravar chave: aceita as variáveis dos motores de API", () => {
  assert.equal(envKeyPertenceAAlgumProvedor(fixture(), "DEEPSEEK_API_KEY"), true);
});

test("gravar chave: recusa variável que não é de nenhum motor", () => {
  assert.equal(envKeyPertenceAAlgumProvedor(fixture(), "CHAVE_INVENTADA"), false);
});

// --- Esforço de raciocínio no painel ---

test("painel mostra os níveis de esforço só de quem aceita esse controle", () => {
  const estado = stateSnapshot(fixture(), {});
  const zai = provedor(estado, "zai");
  assert.deepEqual(zai.effortOptions, ["high", "max"]);
  assert.deepEqual(zai.defaultEffortByModel, { "glm-5.2": "high" });
});

test("motor de API sem controle de esforço não ganha seletor", () => {
  const estado = stateSnapshot(fixture(), {});
  assert.equal(provedor(estado, "lmstudio").effortOptions, null);
  assert.equal(provedor(estado, "lmstudio").defaultEffortByModel, null);
  assert.equal(provedor(estado, "deepseek").effortOptions, null, "fixture sem effortStyle");
});

test("Codex, Gemini e raia com mãos que não declara níveis não ganham seletor", () => {
  const estado = stateSnapshot(fixture(), {});
  for (const id of ["codex", "gemini", "glm-maos", "kimi-maos", "claude-maos"]) {
    assert.equal(provedor(estado, id).effortOptions, null, `${id} não pode ter seletor`);
    assert.equal(provedor(estado, id).defaultEffortByModel, null, `${id} não pode ter seletor`);
  }
});

test("raia com mãos que DECLARA effortOptions ganha o seletor, como os motores de API", () => {
  const config = fixture();
  const raia = config.providers["claude-maos"];
  if (raia.type === "claude-cli") {
    raia.effortOptions = ["low", "medium", "high", "xhigh", "max"];
    raia.defaultEffortByModel = { "claude-opus-5": "xhigh" };
  }
  const estado = stateSnapshot(config, {});
  const claude = provedor(estado, "claude-maos");
  assert.deepEqual(claude.effortOptions, ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(claude.defaultEffortByModel, { "claude-opus-5": "xhigh" });
  // Continua sem campo de chave: esforço e chave são assuntos separados.
  assert.equal(claude.key, null);
});

test("raia com mãos com lista de níveis VAZIA não ganha seletor (nada pra escolher)", () => {
  const config = fixture();
  const raia = config.providers["claude-maos"];
  if (raia.type === "claude-cli") raia.effortOptions = [];
  const estado = stateSnapshot(config, {});
  assert.equal(provedor(estado, "claude-maos").effortOptions, null);
});

test("provedor que aceita esforço mas ainda não escolheu nada vem com listas vazias", () => {
  const config = fixture();
  const zai = config.providers.zai;
  if (zai.type === "openai-compat") delete zai.defaultEffortByModel;
  const estado = stateSnapshot(config, {});
  assert.deepEqual(provedor(estado, "zai").defaultEffortByModel, {});
});

test("o config real do projeto oferece esforço em zai, openrouter e deepseek", async () => {
  const { loadConfig } = await import("../config.js");
  const estado = stateSnapshot(loadConfig(), {});
  assert.deepEqual(provedor(estado, "zai").effortOptions, ["high", "max"]);
  assert.deepEqual(provedor(estado, "openrouter").effortOptions, ["low", "medium", "high"]);
  assert.deepEqual(provedor(estado, "deepseek").effortOptions, ["low", "high", "max"]);
  assert.equal(provedor(estado, "lmstudio-rede").effortOptions, null);
  assert.equal(provedor(estado, "glm-maos").effortOptions, null);
});

test("o config real do projeto oferece esforço também na raia claude-maos", async () => {
  const { loadConfig } = await import("../config.js");
  const estado = stateSnapshot(loadConfig(), {});
  assert.deepEqual(provedor(estado, "claude-maos").effortOptions, [
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ]);
  // As outras raias com mãos seguem de fora (medido: lá o ajuste é descartado).
  assert.equal(provedor(estado, "deepseek-maos").effortOptions, null);
  assert.equal(provedor(estado, "kimi-maos").effortOptions, null);
});

test("o config real do projeto já traz as raias deepseek-maos e kimi-maos com chave no painel", async () => {
  const { loadConfig } = await import("../config.js");
  const estado = stateSnapshot(loadConfig(), {});
  assert.equal(provedor(estado, "deepseek-maos").key?.envKey, "DEEPSEEK_API_KEY");
  assert.equal(provedor(estado, "kimi-maos").key?.envKey, "MOONSHOT_API_KEY");
});
