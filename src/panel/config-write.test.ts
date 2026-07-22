// Testes do aplicador de mudanças do painel no cardápio.
// Usam uma configuração de mentira (fixa), porque o config/models.json real
// muda conforme o Daniel mexe no painel.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelsConfig } from "../config.js";
import { applyConfigUpdate } from "./config-write.js";

function fixture(): ModelsConfig {
  return {
    providers: {
      codex: { type: "codex-cli", label: "Codex", enabled: true },
      gemini: { type: "gemini-cli", label: "Gemini", enabled: true, models: ["gemini-3-pro"] },
      deepseek: {
        type: "openai-compat",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        envKey: "DEEPSEEK_API_KEY",
        enabled: true,
        models: ["deepseek-chat"],
      },
      openrouter: {
        type: "openai-compat",
        label: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        envKey: "OPENROUTER_API_KEY",
        enabled: true,
        models: [],
      },
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
        baseUrl: "http://192.168.68.61:1234/v1",
        enabled: true,
        models: [],
      },
    },
  };
}

test("liga/desliga um provedor sem tocar no resto", () => {
  const config = fixture();
  const next = applyConfigUpdate(config, { providers: { deepseek: { enabled: false } } });
  assert.equal(next.providers.deepseek.enabled, false);
  assert.equal(config.providers.deepseek.enabled, true, "o original não pode mudar");
  assert.deepEqual(
    next.providers.lmstudio,
    config.providers.lmstudio,
    "outros provedores ficam intactos"
  );
});

test("troca a lista de modelos removendo duplicados", () => {
  const next = applyConfigUpdate(fixture(), {
    providers: { openrouter: { models: ["a/b", "a/b", "c/d"] } },
  });
  const openrouter = next.providers.openrouter;
  assert.equal(openrouter.type, "openai-compat");
  if (openrouter.type === "openai-compat") {
    assert.deepEqual(openrouter.models, ["a/b", "c/d"]);
  }
});

test("rejeita provedor desconhecido", () => {
  assert.throws(
    () => applyConfigUpdate(fixture(), { providers: { hacker: { enabled: true } } }),
    /desconhecido/
  );
});

test("atualiza a lista de modelos de um provedor codex-cli", () => {
  const config = fixture();
  const next = applyConfigUpdate(config, {
    providers: { codex: { models: ["gpt-5.6-sol", "gpt-5.6-sol", "gpt-5.6-luna"] } },
  });
  const codex = next.providers.codex;
  assert.equal(codex.type, "codex-cli");
  if (codex.type === "codex-cli") {
    assert.deepEqual(codex.models, ["gpt-5.6-sol", "gpt-5.6-luna"], "sem duplicados");
  }
  assert.equal(config.providers.codex.type === "codex-cli" && config.providers.codex.models, undefined, "o original não pode mudar");
});

test("atualiza a lista de modelos de um provedor gemini-cli", () => {
  const next = applyConfigUpdate(fixture(), {
    providers: { gemini: { models: ["gemini-3-pro", "gemini-3-flash"] } },
  });
  const gemini = next.providers.gemini;
  assert.equal(gemini.type, "gemini-cli");
  if (gemini.type === "gemini-cli") {
    assert.deepEqual(gemini.models, ["gemini-3-pro", "gemini-3-flash"]);
  }
});

test("rejeita mudança de endereço em provedor de CLI (assinatura, sem endereço editável)", () => {
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { codex: { baseUrl: "http://192.168.68.70:5000/v1" } },
      }),
    /não pode ser alterado/
  );
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { gemini: { baseUrl: "http://192.168.68.70:5000/v1" } },
      }),
    /não pode ser alterado/
  );
});

test("rejeita formato inválido (modelo vazio)", () => {
  assert.throws(() =>
    applyConfigUpdate(fixture(), { providers: { openrouter: { models: [""] } } })
  );
});

test("troca o apelido de um provedor (com espaços aparados)", () => {
  const config = fixture();
  const next = applyConfigUpdate(config, {
    providers: { "lmstudio-rede": { label: "  Mac da sala  " } },
  });
  assert.equal(next.providers["lmstudio-rede"].label, "Mac da sala");
  assert.equal(config.providers["lmstudio-rede"].label, "LM Studio (rede)", "o original não pode mudar");
});

test("rejeita apelido vazio ou comprido demais", () => {
  assert.throws(() => applyConfigUpdate(fixture(), { providers: { lmstudio: { label: "   " } } }));
  assert.throws(() =>
    applyConfigUpdate(fixture(), { providers: { lmstudio: { label: "x".repeat(61) } } })
  );
});

test("troca o endereço de uma instância do LM Studio", () => {
  const next = applyConfigUpdate(fixture(), {
    providers: { "lmstudio-rede": { baseUrl: "http://192.168.68.70:5000/v1" } },
  });
  const rede = next.providers["lmstudio-rede"];
  assert.ok(rede.type === "openai-compat");
  assert.equal(rede.baseUrl, "http://192.168.68.70:5000/v1");
});

test("rejeita mudança de endereço em provedor de nuvem (tem chave de API)", () => {
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { deepseek: { baseUrl: "http://192.168.68.70:5000/v1" } },
      }),
    /não pode ser alterado/
  );
});

test("rejeita endereço que não é uma URL http válida", () => {
  assert.throws(() =>
    applyConfigUpdate(fixture(), { providers: { "lmstudio-rede": { baseUrl: "não é url" } } })
  );
  assert.throws(() =>
    applyConfigUpdate(fixture(), { providers: { "lmstudio-rede": { baseUrl: "ftp://192.168.68.70" } } })
  );
});
