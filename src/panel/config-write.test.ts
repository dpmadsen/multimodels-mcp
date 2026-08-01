// Testes do aplicador de mudanças do painel no cardápio.
// Usam uma configuração de mentira (fixa), porque o config/models.json real
// muda conforme o Daniel mexe no painel.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelsConfig } from "../config.js";
import { applyConfigUpdate } from "./config-write.js";

function fixture(): ModelsConfig {
  return {
    defaults: { timeoutMinutes: 10 },
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
      zai: {
        type: "openai-compat",
        label: "z.ai",
        baseUrl: "https://api.z.ai/api/coding/paas/v4",
        envKey: "ZAI_API_KEY",
        enabled: true,
        models: ["glm-5.2", "glm-5.2-air"],
        effortStyle: "openai",
        effortOptions: ["high", "max"],
      },
      "glm-maos": {
        type: "claude-cli",
        label: "GLM com mãos",
        baseUrl: "https://api.z.ai/api/anthropic",
        envKey: "ZAI_API_KEY",
        enabled: true,
        models: ["glm-5.2"],
      },
      // Raia com mãos que DECLARA os níveis do programa `claude`: é a única
      // "com mãos" que aceita escolher esforço no painel.
      "claude-maos": {
        type: "claude-cli",
        label: "Claude com mãos (assinatura)",
        enabled: true,
        models: ["claude-opus-5", "claude-sonnet-5"],
        effortOptions: ["low", "medium", "high", "xhigh", "max"],
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
        baseUrl: "http://192.168.0.61:1234/v1",
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
        providers: { codex: { baseUrl: "http://192.168.0.70:5000/v1" } },
      }),
    /não pode ser alterado/
  );
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { gemini: { baseUrl: "http://192.168.0.70:5000/v1" } },
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
    providers: { "lmstudio-rede": { baseUrl: "http://192.168.0.70:5000/v1" } },
  });
  const rede = next.providers["lmstudio-rede"];
  assert.ok(rede.type === "openai-compat");
  assert.equal(rede.baseUrl, "http://192.168.0.70:5000/v1");
});

test("rejeita mudança de endereço em provedor de nuvem (tem chave de API)", () => {
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { deepseek: { baseUrl: "http://192.168.0.70:5000/v1" } },
      }),
    /não pode ser alterado/
  );
});

// --- Prazo de execução (timeoutMinutes) ---

test("grava o prazo de um provedor sem tocar nos outros", () => {
  const config = fixture();
  const next = applyConfigUpdate(config, { providers: { deepseek: { timeoutMinutes: 30 } } });
  assert.equal(next.providers.deepseek.timeoutMinutes, 30);
  assert.equal(config.providers.deepseek.timeoutMinutes, undefined, "o original não pode mudar");
  assert.equal(next.providers.openrouter.timeoutMinutes, undefined, "os outros ficam intactos");
});

test("null no provedor apaga o prazo próprio (volta a seguir o padrão)", () => {
  const comPrazo = applyConfigUpdate(fixture(), {
    providers: { deepseek: { timeoutMinutes: 30 } },
  });
  assert.equal(comPrazo.providers.deepseek.timeoutMinutes, 30);
  const limpo = applyConfigUpdate(comPrazo, { providers: { deepseek: { timeoutMinutes: null } } });
  assert.equal(limpo.providers.deepseek.timeoutMinutes, undefined);
  assert.ok(
    !Object.prototype.hasOwnProperty.call(limpo.providers.deepseek, "timeoutMinutes"),
    "o campo precisa sumir do arquivo, não virar null"
  );
});

test("grava o prazo padrão geral (defaults)", () => {
  const config = fixture();
  const next = applyConfigUpdate(config, { defaults: { timeoutMinutes: 45 } });
  assert.equal(next.defaults?.timeoutMinutes, 45);
  assert.equal(config.defaults?.timeoutMinutes, 10, "o original não pode mudar");
});

test("rejeita prazo 0, 500 ou texto, com mensagem em português", () => {
  assert.throws(
    () => applyConfigUpdate(fixture(), { providers: { deepseek: { timeoutMinutes: 0 } } }),
    /O prazo mínimo é 1 minuto/
  );
  assert.throws(
    () => applyConfigUpdate(fixture(), { providers: { deepseek: { timeoutMinutes: 500 } } }),
    /O prazo máximo é 120 minutos/
  );
  assert.throws(
    () => applyConfigUpdate(fixture(), { providers: { deepseek: { timeoutMinutes: "abc" } } }),
    /O prazo precisa ser um número de minutos/
  );
  assert.throws(
    () => applyConfigUpdate(fixture(), { providers: { deepseek: { timeoutMinutes: 10.5 } } }),
    /número inteiro de minutos/
  );
});

test("as mesmas regras valem para o prazo padrão geral, e null nele é recusado", () => {
  assert.throws(() => applyConfigUpdate(fixture(), { defaults: { timeoutMinutes: 0 } }));
  assert.throws(() => applyConfigUpdate(fixture(), { defaults: { timeoutMinutes: 500 } }));
  assert.throws(() => applyConfigUpdate(fixture(), { defaults: { timeoutMinutes: "abc" } }));
  assert.throws(
    () => applyConfigUpdate(fixture(), { defaults: { timeoutMinutes: null } }),
    /número de minutos/
  );
});

test("prazo inválido não salva nada: as outras mudanças do mesmo pedido são descartadas", () => {
  const config = fixture();
  assert.throws(() =>
    applyConfigUpdate(config, {
      providers: { deepseek: { enabled: false, timeoutMinutes: 999 } },
    })
  );
  assert.equal(config.providers.deepseek.enabled, true, "nada pode ter sido aplicado");
});

// --- Esforço de raciocínio padrão por modelo (defaultEffortByModel) ---

// Atalho pra ler o esforço salvo sem repetir a checagem de tipo em cada teste.
function esforcos(config: ModelsConfig, providerId: string): Record<string, string> | undefined {
  const provider = config.providers[providerId];
  assert.equal(provider.type, "openai-compat");
  return provider.type === "openai-compat" ? provider.defaultEffortByModel : undefined;
}

test("grava o esforço de um modelo do zai", () => {
  const config = fixture();
  const next = applyConfigUpdate(config, {
    providers: { zai: { defaultEffortByModel: { "glm-5.2": "high" } } },
  });
  assert.deepEqual(esforcos(next, "zai"), { "glm-5.2": "high" });
  assert.equal(esforcos(config, "zai"), undefined, "o original não pode mudar");
});

test("recusa um nível que não está nos effortOptions do provedor", () => {
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { zai: { defaultEffortByModel: { "glm-5.2": "medium" } } },
      }),
    /não existe em "zai".*high, max/s
  );
});

test("recusa esforço para modelo que não está habilitado", () => {
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { zai: { defaultEffortByModel: { "glm-9": "high" } } },
      }),
    /não está habilitado/
  );
});

// --- Esforço na raia "com mãos" que declara os níveis (claude-maos) ---

// Atalho pra ler o esforço salvo na raia com mãos.
function esforcosDaRaia(config: ModelsConfig, providerId: string): Record<string, string> | undefined {
  const provider = config.providers[providerId];
  assert.equal(provider.type, "claude-cli");
  return provider.type === "claude-cli" ? provider.defaultEffortByModel : undefined;
}

test("grava o esforço de um modelo da raia com mãos que declara níveis", () => {
  const config = fixture();
  const next = applyConfigUpdate(config, {
    providers: { "claude-maos": { defaultEffortByModel: { "claude-opus-5": "xhigh" } } },
  });
  assert.deepEqual(esforcosDaRaia(next, "claude-maos"), { "claude-opus-5": "xhigh" });
  assert.equal(esforcosDaRaia(config, "claude-maos"), undefined, "o original não pode mudar");
});

test("na raia com mãos, recusa nível fora dos effortOptions e não grava nada", () => {
  const config = fixture();
  assert.throws(
    () =>
      applyConfigUpdate(config, {
        providers: {
          "claude-maos": { defaultEffortByModel: { "claude-opus-5": "turbinado" } },
        },
      }),
    /não existe em "claude-maos".*low, medium, high, xhigh, max/s
  );
  assert.equal(esforcosDaRaia(config, "claude-maos"), undefined);
});

test("na raia com mãos, recusa esforço para modelo não habilitado", () => {
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { "claude-maos": { defaultEffortByModel: { "claude-inventado": "high" } } },
      }),
    /não está habilitado/
  );
});

test("na raia com mãos, um pedido com parte inválida não grava a parte válida", () => {
  assert.throws(() =>
    applyConfigUpdate(fixture(), {
      providers: {
        "claude-maos": {
          defaultEffortByModel: { "claude-opus-5": "max", "claude-sonnet-5": "turbinado" },
        },
      },
    })
  );
});

test("na raia com mãos, null apaga o esforço daquele modelo", () => {
  const comEsforco = applyConfigUpdate(fixture(), {
    providers: {
      "claude-maos": { defaultEffortByModel: { "claude-opus-5": "max", "claude-sonnet-5": "low" } },
    },
  });
  const next = applyConfigUpdate(comEsforco, {
    providers: { "claude-maos": { defaultEffortByModel: { "claude-opus-5": null } } },
  });
  assert.deepEqual(esforcosDaRaia(next, "claude-maos"), { "claude-sonnet-5": "low" });
});

test("na raia com mãos, modelo tirado da lista não deixa esforço órfão", () => {
  const comEsforco = applyConfigUpdate(fixture(), {
    providers: { "claude-maos": { defaultEffortByModel: { "claude-opus-5": "max" } } },
  });
  const next = applyConfigUpdate(comEsforco, {
    providers: { "claude-maos": { models: ["claude-sonnet-5"] } },
  });
  assert.equal(esforcosDaRaia(next, "claude-maos"), undefined);
});

test("recusa esforço em motor sem effortStyle e na raia com mãos sem effortOptions", () => {
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { lmstudio: { defaultEffortByModel: { qualquer: "high" } } },
      }),
    /não aceita controle de esforço/
  );
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { "glm-maos": { defaultEffortByModel: { "glm-5.2": "high" } } },
      }),
    /não aceita controle de esforço/
  );
  assert.throws(
    () =>
      applyConfigUpdate(fixture(), {
        providers: { codex: { defaultEffortByModel: { "gpt-5.6-sol": "high" } } },
      }),
    /não aceita controle de esforço/
  );
});

test("null apaga o esforço daquele modelo, sem mexer nos outros", () => {
  const comEsforco = applyConfigUpdate(fixture(), {
    providers: { zai: { defaultEffortByModel: { "glm-5.2": "high", "glm-5.2-air": "max" } } },
  });
  assert.deepEqual(esforcos(comEsforco, "zai"), { "glm-5.2": "high", "glm-5.2-air": "max" });

  const limpo = applyConfigUpdate(comEsforco, {
    providers: { zai: { defaultEffortByModel: { "glm-5.2": null } } },
  });
  assert.deepEqual(esforcos(limpo, "zai"), { "glm-5.2-air": "max" });

  const vazio = applyConfigUpdate(limpo, {
    providers: { zai: { defaultEffortByModel: { "glm-5.2-air": null } } },
  });
  assert.equal(esforcos(vazio, "zai"), undefined, "sem nenhum esforço, o campo some do arquivo");
});

test("pedido de esforço inválido não salva nada do mesmo pedido", () => {
  const config = fixture();
  assert.throws(() =>
    applyConfigUpdate(config, {
      providers: {
        zai: {
          enabled: false,
          defaultEffortByModel: { "glm-5.2": "high", "glm-5.2-air": "inventado" },
        },
      },
    })
  );
  assert.equal(config.providers.zai.enabled, true, "nada pode ter sido aplicado");
  assert.equal(esforcos(config, "zai"), undefined, "nem o nível válido do mesmo pedido");
});

test("remover um modelo da lista limpa o esforço padrão dele", () => {
  const comEsforco = applyConfigUpdate(fixture(), {
    providers: { zai: { defaultEffortByModel: { "glm-5.2": "high", "glm-5.2-air": "max" } } },
  });
  const semAir = applyConfigUpdate(comEsforco, {
    providers: { zai: { models: ["glm-5.2"] } },
  });
  assert.deepEqual(esforcos(semAir, "zai"), { "glm-5.2": "high" });

  const semNada = applyConfigUpdate(semAir, { providers: { zai: { models: [] } } });
  assert.equal(esforcos(semNada, "zai"), undefined, "sem modelos, o campo some do arquivo");
});

test("no mesmo pedido, dá pra habilitar um modelo e já escolher o esforço dele", () => {
  const next = applyConfigUpdate(fixture(), {
    providers: {
      zai: { models: ["glm-5.2", "glm-6"], defaultEffortByModel: { "glm-6": "max" } },
    },
  });
  assert.deepEqual(esforcos(next, "zai"), { "glm-6": "max" });
});

test("rejeita endereço que não é uma URL http válida", () => {
  assert.throws(() =>
    applyConfigUpdate(fixture(), { providers: { "lmstudio-rede": { baseUrl: "não é url" } } })
  );
  assert.throws(() =>
    applyConfigUpdate(fixture(), { providers: { "lmstudio-rede": { baseUrl: "ftp://192.168.0.70" } } })
  );
});
