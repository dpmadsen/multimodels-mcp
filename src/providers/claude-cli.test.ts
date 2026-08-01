// Testes da montagem de argumentos e das travas de segurança das raias
// "com mãos": a de outro fabricante (Claude Code headless apontado pro motor
// da z.ai) e a de assinatura (Claude Code entrando pelo login do Daniel).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildClaudeCliArgs,
  ehRaiaDeAssinatura,
  montarAmbiente,
  runClaudeCli,
} from "./claude-cli.js";
import { registerDelegate } from "../tools/delegate.js";
import type { ClaudeCliProvider, ModelsConfig } from "../config.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const provider: ClaudeCliProvider = {
  type: "claude-cli",
  label: "GLM com mãos (z.ai + Claude Code)",
  baseUrl: "https://api.z.ai/api/anthropic",
  envKey: "ZAI_API_KEY_TESTE_INEXISTENTE",
  enabled: true,
  models: ["glm-5.2"],
  maxConcurrent: 1,
  timeoutMinutes: 15,
};

// Cardápio de mentira: aqui o que importa são as travas de segurança, não o prazo.
const config: ModelsConfig = { providers: { "glm-maos": provider } };

test("monta os argumentos na ordem da receita, com a tarefa logo após -p", () => {
  const args = buildClaudeCliArgs("faça isso", "glm-5.2");
  assert.deepEqual(args, [
    "-p",
    "faça isso",
    "--model",
    "glm-5.2",
    "--allowedTools",
    "Read",
    "Glob",
    "Grep",
    "Bash(npm test:*)",
    "Bash(npm run build:*)",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--strict-mcp-config",
    "--output-format",
    "json",
  ]);
});

test("sem esforço escolhido, --effort nem aparece (vale o padrão do próprio CLI)", () => {
  const args = buildClaudeCliArgs("faça isso", "claude-sonnet-5");
  assert.ok(!args.includes("--effort"), "não pode mandar --effort sem esforço escolhido");
});

test("com esforço escolhido, os argumentos ganham --effort com o nível pedido", () => {
  const args = buildClaudeCliArgs("faça isso", "claude-sonnet-5", "xhigh");
  const i = args.indexOf("--effort");
  assert.ok(i > 0, "o --effort tem que estar nos argumentos");
  assert.equal(args[i + 1], "xhigh", "o nível vem logo depois do --effort");
  // O resto da receita continua igual: só o par --effort <nível> entrou.
  assert.deepEqual(
    args.filter((a, k) => k !== i && k !== i + 1),
    buildClaudeCliArgs("faça isso", "claude-sonnet-5")
  );
});

test("as ferramentas liberadas são só leitura+verificação: nunca Edit nem Write", () => {
  const args = buildClaudeCliArgs("t", "glm-5.2");
  assert.ok(!args.includes("Edit"), "não pode liberar Edit nesta raia");
  assert.ok(!args.includes("Write"), "não pode liberar Write nesta raia");
  assert.ok(args.includes("Read"), "precisa liberar Read");
});

test("usa MCP vazio em modo estrito e saída em JSON", () => {
  const args = buildClaudeCliArgs("t", "glm-5.2");
  assert.ok(args.includes("--strict-mcp-config"));
  const i = args.indexOf("--mcp-config");
  assert.equal(args[i + 1], '{"mcpServers":{}}');
  const j = args.indexOf("--output-format");
  assert.equal(args[j + 1], "json");
});

test("a tarefa é passada por -p (é o argumento logo depois de -p)", () => {
  const args = buildClaudeCliArgs("tarefa longa", "glm-5.2");
  assert.equal(args[0], "-p");
  assert.equal(args[1], "tarefa longa");
});

test("sem a chave no .env dá erro amigável apontando a variável, antes de qualquer spawn", async () => {
  delete process.env.ZAI_API_KEY_TESTE_INEXISTENTE;
  await assert.rejects(runClaudeCli(config, provider, "tarefa", undefined, "glm-5.2"), (err: Error) => {
    assert.match(err.message, /Falta a chave/);
    assert.match(err.message, /ZAI_API_KEY_TESTE_INEXISTENTE/);
    return true;
  });
});

test("chave presente porém vazia conta como chave faltando", async () => {
  process.env.ZAI_API_KEY_TESTE_INEXISTENTE = "";
  await assert.rejects(runClaudeCli(config, provider, "tarefa", undefined, "glm-5.2"), (err: Error) => {
    assert.match(err.message, /Falta a chave/);
    return true;
  });
  delete process.env.ZAI_API_KEY_TESTE_INEXISTENTE;
});

test("workdir inexistente é rejeitado antes do spawn, culpando a pasta (não o binário claude)", async () => {
  process.env.ZAI_API_KEY_TESTE_INEXISTENTE = "chave-de-mentira";
  const pastaFalsa = "/caminho/que/nao/existe/multimodels-glm-maos-xyz";
  await assert.rejects(
    runClaudeCli(config, provider, "tarefa", pastaFalsa, "glm-5.2"),
    (err: Error) => {
      assert.match(err.message, /não existe/);
      assert.match(err.message, /multimodels-glm-maos-xyz/);
      return true;
    }
  );
  delete process.env.ZAI_API_KEY_TESTE_INEXISTENTE;
});

test("sem modelo explícito dá erro amigável (a receita exige --model)", async () => {
  process.env.ZAI_API_KEY_TESTE_INEXISTENTE = "chave-de-mentira";
  await assert.rejects(runClaudeCli(config, provider, "tarefa", undefined, undefined), (err: Error) => {
    assert.match(err.message, /modelo explícito/);
    return true;
  });
  delete process.env.ZAI_API_KEY_TESTE_INEXISTENTE;
});

// A trava do "effort" vive na rota do delegate_task; testamos capturando o
// handler que o registerDelegate registra e chamando-o direto.
type HandlerDelegate = (args: {
  model: string;
  task: string;
  effort?: string;
  wait?: boolean;
}) => Promise<{ isError?: boolean; content: Array<{ text: string }> }>;

function handlerDoDelegate(config: ModelsConfig): HandlerDelegate {
  let handler: HandlerDelegate | undefined;
  const fakeServer = {
    registerTool: (_name: string, _cfg: unknown, fn: HandlerDelegate) => {
      handler = fn;
    },
    // O delegate_task pergunta ao SDK quem está chamando (regra do fabricante).
    // Cliente que não se identificou = nenhuma raia é escondida, que é o
    // cenário certo pra estes testes, que são sobre o campo "effort".
    server: { getClientVersion: () => undefined },
  } as unknown as McpServer;
  registerDelegate(fakeServer, () => config);
  assert.ok(handler, "o delegate_task deve ter sido registrado");
  return handler!;
}

// Raia "com mãos" SEM effortOptions: a recusa de sempre continua valendo.
const configSemEsforco: ModelsConfig = {
  providers: {
    "glm-maos": {
      type: "claude-cli",
      label: "GLM com mãos (z.ai + Claude Code)",
      baseUrl: "https://api.z.ai/api/anthropic",
      envKey: "ZAI_API_KEY_TESTE_INEXISTENTE",
      enabled: true,
      models: ["glm-5.2"],
      maxConcurrent: 1,
    },
  },
};

// A MESMA raia, só que declarando os níveis. Usamos uma raia de outro
// fabricante de propósito: prova que quem manda é a declaração no cardápio,
// não o nome da raia. A chave dela não existe no .env, então a delegação
// morre no "Falta a chave" — antes de qualquer spawn do programa `claude`.
const configComEsforco: ModelsConfig = {
  providers: {
    "raia-com-esforco": {
      type: "claude-cli",
      label: "Raia de teste com mãos",
      baseUrl: "https://api.exemplo.invalido/anthropic",
      envKey: "CHAVE_QUE_NAO_EXISTE_NO_ENV",
      enabled: true,
      models: ["modelo-a", "modelo-b"],
      effortOptions: ["low", "medium", "high", "xhigh", "max"],
      defaultEffort: "medium",
      defaultEffortByModel: { "modelo-a": "xhigh" },
    },
  },
};

test("raia com mãos SEM effortOptions continua recusando 'effort', antes de qualquer spawn", async () => {
  const handler = handlerDoDelegate(configSemEsforco);
  const result = await handler({ model: "glm-maos:glm-5.2", task: "leia o projeto", effort: "high" });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /não aceita o campo "effort"/);
});

test("raia com mãos COM effortOptions recusa nível inválido citando os aceitos", async () => {
  const handler = handlerDoDelegate(configComEsforco);
  const result = await handler({
    model: "raia-com-esforco:modelo-a",
    task: "leia o projeto",
    effort: "turbinado",
  });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /esforço "turbinado" não existe/);
  assert.match(result.content[0].text, /low, medium, high, xhigh, max/);
});

test("raia com mãos COM effortOptions aceita nível válido (passa da montagem)", async () => {
  const handler = handlerDoDelegate(configComEsforco);
  // wait: true faz a delegação acontecer aqui mesmo; ela para no "Falta a
  // chave", que é DEPOIS da conferência do esforço e ANTES de rodar o `claude`.
  const result = await handler({
    model: "raia-com-esforco:modelo-a",
    task: "leia o projeto",
    effort: "max",
    wait: true,
  });
  assert.doesNotMatch(result.content[0].text, /não aceita o campo "effort"/);
  assert.doesNotMatch(result.content[0].text, /não existe na raia/);
  assert.match(result.content[0].text, /Falta a chave/, "só a chave deveria barrar");
});

test("raia com mãos COM effortOptions aceita delegação SEM effort (o campo é opcional)", async () => {
  const handler = handlerDoDelegate(configComEsforco);
  const result = await handler({ model: "raia-com-esforco:modelo-b", task: "leia", wait: true });
  assert.match(result.content[0].text, /Falta a chave/);
});

// --- Raia de assinatura (sem baseUrl e sem envKey) ---

// A convenção do cardápio: essa raia não declara endereço nem chave, porque
// entra pelo login de verdade do Claude Code.
const assinatura: ClaudeCliProvider = {
  type: "claude-cli",
  label: "Claude com mãos (assinatura)",
  enabled: true,
  models: ["claude-opus-5", "claude-sonnet-5"],
  maxConcurrent: 1,
  timeoutMinutes: 20,
};

const configAssinatura: ModelsConfig = { providers: { "claude-maos": assinatura } };

test("raia sem endereço e sem chave é reconhecida como raia de assinatura", () => {
  assert.equal(ehRaiaDeAssinatura(assinatura), true);
  assert.equal(ehRaiaDeAssinatura(provider), false, "a do fabricante tem endereço e chave");
});

test("a raia de assinatura não cobra chave (o erro que sobra é o da pasta, não o da chave)", async () => {
  // Nenhuma variável de chave foi preenchida de propósito: se a cobrança de
  // chave ainda existisse aqui, ela falaria antes da checagem da pasta.
  const pastaFalsa = "/caminho/que/nao/existe/multimodels-claude-maos-xyz";
  await assert.rejects(
    runClaudeCli(configAssinatura, assinatura, "tarefa", pastaFalsa, "claude-opus-5"),
    (err: Error) => {
      assert.doesNotMatch(err.message, /Falta a chave/);
      assert.match(err.message, /não existe/);
      return true;
    }
  );
});

test("a raia de assinatura continua exigindo modelo explícito", async () => {
  await assert.rejects(
    runClaudeCli(configAssinatura, assinatura, "tarefa", undefined, undefined),
    (err: Error) => {
      assert.match(err.message, /modelo explícito/);
      return true;
    }
  );
});

test("as mãos da raia de assinatura são exatamente as mesmas das outras raias", () => {
  const daAssinatura = buildClaudeCliArgs("t", "claude-opus-5");
  const doFabricante = buildClaudeCliArgs("t", "glm-5.2");
  // Só o nome do modelo muda; o resto (ferramentas, MCP vazio, JSON) é igual.
  assert.deepEqual(
    daAssinatura.filter((a) => a !== "claude-opus-5"),
    doFabricante.filter((a) => a !== "glm-5.2")
  );
  assert.ok(!daAssinatura.includes("Edit"), "não pode liberar Edit nesta raia");
  assert.ok(!daAssinatura.includes("Write"), "não pode liberar Write nesta raia");
});

// --- Ambiente do processo filho (a trava de segurança da assinatura) ---

// Guarda e devolve as variáveis que os testes de ambiente mexem, pra um teste
// não sujar o outro.
function comAmbienteSujo(fn: () => void): void {
  const antes = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
  };
  process.env.ANTHROPIC_API_KEY = "chave-herdada-que-cobraria-por-api";
  process.env.ANTHROPIC_AUTH_TOKEN = "token-herdado";
  process.env.ANTHROPIC_BASE_URL = "https://endereco-herdado.example";
  try {
    fn();
  } finally {
    for (const [nome, valor] of Object.entries(antes)) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  }
}

test("assinatura: as variáveis ANTHROPIC herdadas são removidas do ambiente do filho", () => {
  comAmbienteSujo(() => {
    const env = montarAmbiente(assinatura, undefined, undefined, 60_000);
    // Não basta estar vazio: a variável não pode existir, senão o Claude Code
    // trocaria a assinatura por cobrança na API sem avisar.
    assert.ok(!("ANTHROPIC_API_KEY" in env), "ANTHROPIC_API_KEY tem que sumir");
    assert.ok(!("ANTHROPIC_AUTH_TOKEN" in env), "ANTHROPIC_AUTH_TOKEN tem que sumir");
    assert.ok(!("ANTHROPIC_BASE_URL" in env), "ANTHROPIC_BASE_URL tem que sumir");
  });
});

test("assinatura: nenhuma variável do filho fica com o texto 'undefined'", () => {
  comAmbienteSujo(() => {
    const env = montarAmbiente(assinatura, undefined, undefined, 60_000);
    for (const [nome, valor] of Object.entries(env)) {
      assert.notEqual(valor, "undefined", `${nome} virou o texto "undefined"`);
    }
  });
});

test("assinatura: não define CLAUDE_CONFIG_DIR (pasta descartável dá 'Not logged in')", () => {
  const env = montarAmbiente(assinatura, undefined, "/tmp/pasta-descartavel", 60_000);
  assert.ok(!("CLAUDE_CONFIG_DIR" in env), "a raia de assinatura precisa do login real");
});

test("assinatura: o filho continua herdando o básico do sistema (PATH)", () => {
  const env = montarAmbiente(assinatura, undefined, undefined, 60_000);
  assert.equal(env.PATH, process.env.PATH);
});

test("raia de fabricante: define endereço, chave e pasta descartável", () => {
  const env = montarAmbiente(provider, "chave-de-mentira", "/tmp/pasta-descartavel", 60_000);
  assert.equal(env.ANTHROPIC_BASE_URL, "https://api.z.ai/api/anthropic");
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, "chave-de-mentira");
  assert.equal(env.ANTHROPIC_API_KEY, "chave-de-mentira");
  assert.equal(env.CLAUDE_CONFIG_DIR, "/tmp/pasta-descartavel");
});

test("raia de fabricante: o endereço herdado do ambiente é sobrescrito pelo do cardápio", () => {
  comAmbienteSujo(() => {
    const env = montarAmbiente(provider, "chave-de-mentira", "/tmp/x", 60_000);
    assert.equal(env.ANTHROPIC_BASE_URL, "https://api.z.ai/api/anthropic");
    assert.equal(env.ANTHROPIC_API_KEY, "chave-de-mentira");
  });
});

test("as duas raias dão ao Claude Code 1 minuto a mais que o nosso prazo", () => {
  const env = montarAmbiente(assinatura, undefined, undefined, 5 * 60_000);
  assert.equal(env.API_TIMEOUT_MS, String(6 * 60_000));
  const envFabricante = montarAmbiente(provider, "k", "/tmp/x", 5 * 60_000);
  assert.equal(envFabricante.API_TIMEOUT_MS, String(6 * 60_000));
});

test("o cardápio real traz a raia claude-maos sem endereço e sem chave", async () => {
  const { loadConfig } = await import("../config.js");
  const raia = loadConfig().providers["claude-maos"];
  assert.ok(raia, "a raia claude-maos deve existir no cardápio");
  assert.equal(raia.type, "claude-cli");
  assert.ok(raia.type === "claude-cli" && ehRaiaDeAssinatura(raia), "tem que ser de assinatura");
});
