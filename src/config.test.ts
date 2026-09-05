// Testes do leitor do cardápio.
// Os testes de resolução usam uma configuração de mentira (fixa), porque o
// config/models.json real muda conforme o Daniel habilita modelos no painel.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  controleDeEsforco,
  loadConfig,
  resolveEffort,
  resolveMaxOutputTokens,
  resolveMaxResponseBytes,
  resolveModel,
  resolveTimeoutMs,
  TIMEOUT_PADRAO_MINUTOS,
  type ClaudeCliProvider,
  type ModelsConfig,
  type OpenAICompatProvider,
  type Provider,
} from "./config.js";

const fixture: ModelsConfig = {
  providers: {
    codex: {
      type: "codex-cli",
      label: "Codex",
      enabled: true,
      models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
    },
    "codex-sem-modelos": { type: "codex-cli", label: "Codex sem lista", enabled: true },
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
    "deepseek-maos": {
      type: "claude-cli",
      label: "DeepSeek com mãos",
      baseUrl: "https://api.deepseek.com/anthropic",
      envKey: "DEEPSEEK_API_KEY",
      enabled: true,
      models: ["deepseek-v4-pro", "deepseek-v4-flash"],
    },
    "kimi-maos": {
      type: "claude-cli",
      label: "Kimi com mãos",
      baseUrl: "https://api.moonshot.ai/anthropic",
      envKey: "MOONSHOT_API_KEY",
      enabled: true,
      models: ["kimi-k3"],
    },
    "kimi-maos-desligado": {
      type: "claude-cli",
      label: "Kimi com mãos (desligado)",
      baseUrl: "https://api.moonshot.ai/anthropic",
      envKey: "MOONSHOT_API_KEY",
      enabled: false,
      models: ["kimi-k3"],
    },
    // Raia de assinatura: sem endereço e sem chave, de propósito.
    "claude-maos": {
      type: "claude-cli",
      label: "Claude com mãos (assinatura)",
      enabled: true,
      models: ["claude-opus-5", "claude-sonnet-5"],
    },
    "claude-maos-desligado": {
      type: "claude-cli",
      label: "Claude com mãos (desligado)",
      enabled: false,
      models: ["claude-opus-5"],
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
    rede.type === "openai-compat" && rede.baseUrl.startsWith("http://192.168.0.61"),
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

test("resolve 'codex:gpt-5.6-luna' quando o modelo está na lista habilitada", () => {
  const ref = resolveModel(fixture, "codex:gpt-5.6-luna");
  assert.equal(ref.providerId, "codex");
  assert.equal(ref.model, "gpt-5.6-luna");
});

test("'codex:<modelo>' fora da lista habilitada dá erro amigável", () => {
  assert.throws(
    () => resolveModel(fixture, "codex:gpt-5.6-inexistente"),
    /não está habilitado/
  );
});

test("'codex:<modelo>' quando o provedor não tem lista 'models' dá erro explicando", () => {
  assert.throws(
    () => resolveModel(fixture, "codex-sem-modelos:gpt-5.6-luna"),
    /não tem nenhum modelo explícito habilitado/
  );
});

// --- Raias "com mãos" (Claude Code descartável apontado pra outro motor) ---

test("resolve 'deepseek-maos:deepseek-v4-pro' quando a raia está ligada", () => {
  const ref = resolveModel(fixture, "deepseek-maos:deepseek-v4-pro");
  assert.equal(ref.providerId, "deepseek-maos");
  assert.equal(ref.provider.type, "claude-cli");
  assert.equal(ref.model, "deepseek-v4-pro");
});

test("resolve 'kimi-maos:kimi-k3' quando a raia está ligada", () => {
  const ref = resolveModel(fixture, "kimi-maos:kimi-k3");
  assert.equal(ref.providerId, "kimi-maos");
  assert.equal(ref.provider.type, "claude-cli");
  assert.equal(ref.model, "kimi-k3");
});

test("raia com mãos desligada avisa que o provedor está desabilitado", () => {
  assert.throws(
    () => resolveModel(fixture, "kimi-maos-desligado:kimi-k3"),
    /está desabilitado/
  );
});

test("modelo fora da lista da raia com mãos dá erro amigável", () => {
  assert.throws(
    () => resolveModel(fixture, "deepseek-maos:deepseek-v9-imaginario"),
    /não está habilitado/
  );
});

test("raia com mãos sem modelo no id dá erro orientando o formato", () => {
  assert.throws(() => resolveModel(fixture, "kimi-maos"), /precisa incluir o modelo/);
});

// O liga/desliga de cada raia é escolha do Daniel no painel, então o teste
// não prende esse estado — só a forma da entrada no cardápio de verdade.
test("as raias novas existem no config real, apontando pro endereço e pra chave certos", () => {
  const config = loadConfig();
  const ds = config.providers["deepseek-maos"];
  const kimi = config.providers["kimi-maos"];
  assert.ok(ds && kimi, "deepseek-maos e kimi-maos devem existir no cardápio");
  assert.ok(ds.type === "claude-cli" && ds.envKey === "DEEPSEEK_API_KEY");
  assert.equal(ds.type === "claude-cli" && ds.baseUrl, "https://api.deepseek.com/anthropic");
  assert.ok(kimi.type === "claude-cli" && kimi.envKey === "MOONSHOT_API_KEY");
  assert.equal(kimi.type === "claude-cli" && kimi.baseUrl, "https://api.moonshot.ai/anthropic");
});

// --- Raia "com mãos" de assinatura (sem endereço e sem chave) ---

test("resolve 'claude-maos:claude-opus-5' mesmo sem endereço e sem chave na raia", () => {
  const ref = resolveModel(fixture, "claude-maos:claude-opus-5");
  assert.equal(ref.providerId, "claude-maos");
  assert.equal(ref.provider.type, "claude-cli");
  assert.equal(ref.model, "claude-opus-5");
  assert.ok(
    ref.provider.type === "claude-cli" && !ref.provider.baseUrl && !ref.provider.envKey,
    "a raia de assinatura não declara endereço nem chave"
  );
});

test("raia de assinatura sem modelo no id dá erro orientando o formato", () => {
  assert.throws(() => resolveModel(fixture, "claude-maos"), /precisa incluir o modelo/);
});

test("modelo fora da lista da raia de assinatura dá erro amigável", () => {
  assert.throws(
    () => resolveModel(fixture, "claude-maos:claude-inventado-9"),
    /não está habilitado/
  );
});

test("raia de assinatura desligada avisa que o provedor está desabilitado", () => {
  assert.throws(
    () => resolveModel(fixture, "claude-maos-desligado:claude-opus-5"),
    /está desabilitado/
  );
});

// O liga/desliga é escolha do Daniel no painel; o teste prende só a forma.
test("a raia claude-maos existe no config real, sem endereço e sem chave", () => {
  const raia = loadConfig().providers["claude-maos"];
  assert.ok(raia, "claude-maos deve existir no cardápio");
  assert.equal(raia.type, "claude-cli");
  assert.ok(raia.type === "claude-cli" && raia.baseUrl === undefined, "não pode ter endereço");
  assert.ok(raia.type === "claude-cli" && raia.envKey === undefined, "não pode ter chave");
  assert.ok(
    raia.type === "claude-cli" && raia.models.includes("claude-opus-5"),
    "o cardápio precisa trazer os modelos da assinatura"
  );
});

// --- Cascata do prazo de execução ---

const MINUTO = 60 * 1000;

function provedorComPrazo(timeoutMinutes?: number): Provider {
  return { type: "codex-cli", label: "Codex de mentira", enabled: true, timeoutMinutes };
}

test("prazo: o do provedor vence o padrão do arquivo", () => {
  const config: ModelsConfig = { defaults: { timeoutMinutes: 10 }, providers: {} };
  assert.equal(resolveTimeoutMs(config, provedorComPrazo(30)), 30 * MINUTO);
});

test("prazo: sem prazo no provedor, vale o padrão do arquivo (defaults)", () => {
  const config: ModelsConfig = { defaults: { timeoutMinutes: 25 }, providers: {} };
  assert.equal(resolveTimeoutMs(config, provedorComPrazo(undefined)), 25 * MINUTO);
});

test("prazo: sem defaults no arquivo, valem os 10 minutos embutidos", () => {
  const config: ModelsConfig = { providers: {} };
  assert.equal(resolveTimeoutMs(config, provedorComPrazo(undefined)), TIMEOUT_PADRAO_MINUTOS * MINUTO);
  assert.equal(TIMEOUT_PADRAO_MINUTOS, 10);
});

// Protege a cascata de limites de saida e sua validacao fail-closed. Antes de
// alterar/remover, conferir requisito, diff, historico, MEMORY.md, plano e
// docs/test-change-log.md: contexto e metadado, nunca estimativa de tokens.
test("limite de tokens usa modelo, depois provedor e por fim o padrao", () => {
  const provider: OpenAICompatProvider = {
    type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"],
    maxOutputTokens: 200, modelLimits: { m: { contextTokens: 999, maxOutputTokens: 100 } },
  };
  assert.equal(resolveMaxOutputTokens(provider, "m"), 100);
  assert.equal(resolveMaxOutputTokens(provider, "other"), 200);
  assert.equal(resolveMaxOutputTokens({ ...provider, maxOutputTokens: undefined, modelLimits: {} }, "m"), 32_000);
  assert.equal(provider.modelLimits?.other?.contextTokens, undefined, "contexto ausente continua apenas metadado");
});

test("limite de bytes usa modelo, provedor, defaults e padrao", () => {
  const provider: OpenAICompatProvider = {
    type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"],
    maxResponseBytes: 200, modelLimits: { m: { maxResponseBytes: 100 } },
  };
  assert.equal(resolveMaxResponseBytes({ defaults: { maxResponseBytes: 300 }, providers: {} }, provider, "m"), 100);
  assert.equal(resolveMaxResponseBytes({ defaults: { maxResponseBytes: 300 }, providers: {} }, provider, "other"), 200);
  assert.equal(resolveMaxResponseBytes({ defaults: { maxResponseBytes: 300 }, providers: {} }, { ...provider, maxResponseBytes: undefined, modelLimits: {} }, "m"), 300);
  assert.equal(resolveMaxResponseBytes({ providers: {} }, { ...provider, maxResponseBytes: undefined, modelLimits: {} }, "m"), 10 * 1024 * 1024);
});

test("limites invalidos falham fechados", () => {
  const base: OpenAICompatProvider = { type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"] };
  for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => resolveMaxOutputTokens({ ...base, maxOutputTokens: invalid }, "m"), /inteiro positivo seguro/i);
    assert.throws(() => resolveMaxOutputTokens({ ...base, modelLimits: { m: { maxOutputTokens: invalid } } }, "m"), /inteiro positivo seguro/i);
    assert.throws(() => resolveMaxResponseBytes({ providers: {} }, { ...base, maxResponseBytes: invalid }, "m"), /inteiro positivo seguro/i);
    assert.throws(() => resolveMaxResponseBytes({ defaults: { maxResponseBytes: invalid }, providers: {} }, base, "m"), /inteiro positivo seguro/i);
  }
});

test("codex sem modelo usa o limite declarado pelo provedor", () => {
  const provider = { type: "codex-cli", label: "Codex", enabled: true, maxOutputTokens: 123 } as const;
  assert.equal(resolveMaxOutputTokens(provider), 123);
});

test("prazo: sem arquivo nenhum e sem provedor, ainda valem os 10 minutos embutidos", () => {
  assert.equal(resolveTimeoutMs(undefined, undefined), 10 * MINUTO);
});

test("prazo: um provedor com prazo próprio não muda o prazo dos outros", () => {
  const config: ModelsConfig = { defaults: { timeoutMinutes: 10 }, providers: {} };
  assert.equal(resolveTimeoutMs(config, provedorComPrazo(45)), 45 * MINUTO);
  assert.equal(resolveTimeoutMs(config, provedorComPrazo(undefined)), 10 * MINUTO);
});

// --- Cascata do esforço de raciocínio ---
// Mora aqui (e não no motor de API) porque hoje vale pra mais de um tipo de
// raia: os motores de API e a raia "com mãos" da assinatura.

const provedorDeApi: OpenAICompatProvider = {
  type: "openai-compat",
  label: "z.ai (de mentira)",
  baseUrl: "http://localhost:9999/v1",
  enabled: true,
  models: ["a", "b"],
  effortStyle: "openai",
  effortOptions: ["high", "max"],
  defaultEffort: "high",
  defaultEffortByModel: { a: "max" },
};

test("esforço: a cascata é pedido → modelo → provedor → nada", () => {
  assert.equal(resolveEffort(provedorDeApi, "a", "high"), "high", "o pedido vence tudo");
  assert.equal(resolveEffort(provedorDeApi, "a"), "max", "padrão do modelo vence o do provedor");
  assert.equal(resolveEffort(provedorDeApi, "b"), "high", "sem padrão do modelo, vale o do provedor");
  assert.equal(
    resolveEffort({ ...provedorDeApi, defaultEffort: undefined, defaultEffortByModel: {} }, "b"),
    undefined,
    "sem nada configurado, nenhum esforço"
  );
});

test("esforço: a mesma cascata vale na raia com mãos (a conta não foi duplicada)", () => {
  const comMaos: ClaudeCliProvider = {
    type: "claude-cli",
    label: "Claude com mãos (assinatura)",
    enabled: true,
    models: ["claude-opus-5", "claude-sonnet-5"],
    effortOptions: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: "medium",
    defaultEffortByModel: { "claude-opus-5": "xhigh" },
  };
  assert.equal(resolveEffort(comMaos, "claude-opus-5", "low"), "low", "o pedido vence tudo");
  assert.equal(resolveEffort(comMaos, "claude-opus-5"), "xhigh", "padrão do modelo vence o da raia");
  assert.equal(resolveEffort(comMaos, "claude-sonnet-5"), "medium", "sem padrão do modelo, o da raia");
  assert.equal(
    resolveEffort({ ...comMaos, defaultEffort: undefined, defaultEffortByModel: {} }, "claude-sonnet-5"),
    undefined,
    "sem nada escolhido, nenhum esforço (vale o padrão do próprio CLI)"
  );
});

test("esforço: quem tem o controle é quem DECLARA, sem nome de raia no código", () => {
  // Raia "com mãos" só ganha o controle declarando effortOptions.
  const semDeclaracao: ClaudeCliProvider = {
    type: "claude-cli",
    label: "DeepSeek com mãos",
    baseUrl: "https://api.deepseek.com/anthropic",
    envKey: "DEEPSEEK_API_KEY",
    enabled: true,
    models: ["deepseek-v4-pro"],
  };
  assert.equal(controleDeEsforco(semDeclaracao), undefined, "sem effortOptions, sem controle");
  assert.equal(controleDeEsforco({ ...semDeclaracao, effortOptions: [] }), undefined, "lista vazia também não vale");
  assert.ok(controleDeEsforco({ ...semDeclaracao, effortOptions: ["low", "max"] }), "declarou, tem controle");
  // Motor de API precisa de effortStyle (é ele que sabe montar o campo).
  assert.ok(controleDeEsforco(provedorDeApi), "motor de API com effortStyle tem controle");
  assert.equal(
    controleDeEsforco({ ...provedorDeApi, effortStyle: undefined }),
    undefined,
    "sem effortStyle o motor de API não sabe mandar o esforço"
  );
  // Codex e Gemini tratam o esforço em outro lugar: aqui não entram.
  assert.equal(
    controleDeEsforco({ type: "codex-cli", label: "Codex", enabled: true }),
    undefined
  );
});

test("o cardápio real dá à claude-maos os cinco níveis do programa claude", () => {
  const raia = loadConfig().providers["claude-maos"];
  assert.equal(raia.type, "claude-cli");
  assert.deepEqual(
    raia.type === "claude-cli" ? raia.effortOptions : undefined,
    ["low", "medium", "high", "xhigh", "max"]
  );
  // Sem padrão escolhido: quem não mede não inventa padrão.
  assert.equal(raia.type === "claude-cli" ? raia.defaultEffort : "x", undefined);
});

test("o cardápio real NÃO dá controle de esforço às raias com mãos de outro fabricante", () => {
  const config = loadConfig();
  for (const [id, provider] of Object.entries(config.providers)) {
    if (provider.type !== "claude-cli" || id === "claude-maos") continue;
    assert.equal(
      controleDeEsforco(provider),
      undefined,
      `a raia "${id}" não deve ter controle de esforço (medido: o motor do outro lado descarta)`
    );
  }
});
