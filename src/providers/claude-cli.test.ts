// Testes da montagem de argumentos e das travas de segurança das raias
// "com mãos": a de outro fabricante (Claude Code headless apontado pro motor
// da z.ai) e a de assinatura (Claude Code entrando pelo login do Daniel).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildClaudeCliArgs,
  ehRaiaDeAssinatura,
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

// Estas provas protegem a separação entre assinatura e chave API e a
// disponibilidade real das ferramentas: --allowedTools só pré-aprova, então a
// raia com chave também precisa de --tools e dontAsk para Bash/Edit/Write não
// poderem vir de configurações locais. Revisar requisito, diff, histórico,
// MEMORY.md, plano e docs/test-change-log.md antes de alterá-las (AGENTS.md).
// A opção de sessão disableAllHooks fecha a execução automática de comandos
// do projeto, que --tools não bloqueia; a precedência oficial do --settings
// impede settings.json/settings.local.json de reativá-los com false.
test("a raia com chave restringe as ferramentas disponíveis a Read, Glob e Grep", () => {
  const args = buildClaudeCliArgs(provider, "faça isso", "glm-5.2");
  assert.deepEqual(args, [
    "-p",
    "faça isso",
    "--model",
    "glm-5.2",
    "--allowedTools",
    "Read",
    "Glob",
    "Grep",
    "--tools",
    "Read,Glob,Grep",
    "--permission-mode",
    "dontAsk",
    "--settings",
    '{"disableAllHooks":true}',
    "--mcp-config",
    '{"mcpServers":{}}',
    "--strict-mcp-config",
    // Desde a 0.12.0 a saída vem em muitas linhas (uma por evento), pra dar
    // pra acompanhar o andamento sem esperar o fim.
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
  ]);
});

test("sem esforço escolhido, --effort nem aparece (vale o padrão do próprio CLI)", () => {
  const args = buildClaudeCliArgs(provider, "faça isso", "claude-sonnet-5");
  assert.ok(!args.includes("--effort"), "não pode mandar --effort sem esforço escolhido");
});

test("com esforço escolhido, os argumentos ganham --effort com o nível pedido", () => {
  const args = buildClaudeCliArgs(provider, "faça isso", "claude-sonnet-5", "xhigh");
  const i = args.indexOf("--effort");
  assert.ok(i > 0, "o --effort tem que estar nos argumentos");
  assert.equal(args[i + 1], "xhigh", "o nível vem logo depois do --effort");
  // O resto da receita continua igual: só o par --effort <nível> entrou.
  assert.deepEqual(
    args.filter((a, k) => k !== i && k !== i + 1),
    buildClaudeCliArgs(provider, "faça isso", "claude-sonnet-5")
  );
});

test("as ferramentas liberadas são só leitura+verificação: nunca Edit nem Write", () => {
  const args = buildClaudeCliArgs(provider, "t", "glm-5.2");
  assert.ok(!args.includes("Edit"), "não pode liberar Edit nesta raia");
  assert.ok(!args.includes("Write"), "não pode liberar Write nesta raia");
  assert.ok(args.includes("Read"), "precisa liberar Read");
});

test("usa MCP vazio em modo estrito e saída em stream de eventos", () => {
  const args = buildClaudeCliArgs(provider, "t", "glm-5.2");
  assert.ok(args.includes("--strict-mcp-config"));
  const i = args.indexOf("--mcp-config");
  assert.equal(args[i + 1], '{"mcpServers":{}}');
  const j = args.indexOf("--output-format");
  assert.equal(args[j + 1], "stream-json");
});

test("pede os pedacinhos ao vivo e o --verbose que o CLI exige junto do stream", () => {
  const args = buildClaudeCliArgs(provider, "t", "glm-5.2");
  assert.ok(args.includes("--include-partial-messages"), "sem isto não há texto ao vivo pro parcial");
  // Medido em 2026-08-01: sem --verbose o CLI recusa na hora, com
  // "When using --print, --output-format=stream-json requires --verbose".
  assert.ok(args.includes("--verbose"), "o CLI exige --verbose junto do stream-json");
});

test("a tarefa é passada por -p (é o argumento logo depois de -p)", () => {
  const args = buildClaudeCliArgs(provider, "tarefa longa", "glm-5.2");
  assert.equal(args[0], "-p");
  assert.equal(args[1], "tarefa longa");
});

// O workdir existente usado nestes testes é apenas o preparo necessário para
// alcançar as validações de chave/modelo; a exigência e o cwd do Claude têm
// cobertura própria. Revisar requisito, diff, commits de introdução/subsequentes,
// cobertura substituta, MEMORY.md, plano e docs/test-change-log.md antes de mudar.
test("sem a chave no .env dá erro amigável apontando a variável, antes de qualquer spawn", async () => {
  delete process.env.ZAI_API_KEY_TESTE_INEXISTENTE;
  await assert.rejects(runClaudeCli(config, provider, "tarefa", ".", "glm-5.2"), (err: Error) => {
    assert.match(err.message, /Falta a chave/);
    assert.match(err.message, /ZAI_API_KEY_TESTE_INEXISTENTE/);
    return true;
  });
});

test("chave presente porém vazia conta como chave faltando", async () => {
  process.env.ZAI_API_KEY_TESTE_INEXISTENTE = "";
  await assert.rejects(runClaudeCli(config, provider, "tarefa", ".", "glm-5.2"), (err: Error) => {
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
  await assert.rejects(runClaudeCli(config, provider, "tarefa", ".", undefined), (err: Error) => {
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
  workdir?: string;
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
  return async (args) => handler!({ ...args, workdir: args.workdir ?? "." });
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
    runClaudeCli(configAssinatura, assinatura, "tarefa", ".", undefined),
    (err: Error) => {
      assert.match(err.message, /modelo explícito/);
      return true;
    }
  );
});

// A supressão de hooks é exclusiva da raia com chave; este controle evita
// alterar as automações da assinatura. Antes de modificar/remover, revisar
// requisito, diff, histórico completo, memória, plano e docs/test-change-log.md.
test("a assinatura conserva as ferramentas de verificação, enquanto a chave fica só na leitura", () => {
  const daAssinatura = buildClaudeCliArgs(assinatura, "t", "claude-opus-5");
  const doFabricante = buildClaudeCliArgs(provider, "t", "glm-5.2");
  assert.ok(daAssinatura.includes("Read"));
  assert.ok(daAssinatura.includes("Glob"));
  assert.ok(daAssinatura.includes("Grep"));
  assert.ok(daAssinatura.includes("Bash(npm test:*)"));
  assert.ok(daAssinatura.includes("Bash(npm run build:*)"));
  assert.ok(doFabricante.includes("Read"));
  assert.ok(doFabricante.includes("Glob"));
  assert.ok(doFabricante.includes("Grep"));
  assert.ok(!doFabricante.includes("Bash(npm test:*)"));
  assert.ok(!doFabricante.includes("Bash(npm run build:*)"));
  assert.ok(!daAssinatura.includes("--tools"), "a receita da assinatura precisa permanecer inalterada");
  assert.ok(!daAssinatura.includes("dontAsk"), "a assinatura preserva seu modo de permissões atual");
  assert.ok(!daAssinatura.includes("--settings"), "a assinatura preserva suas configurações e hooks");
  assert.equal(doFabricante[doFabricante.indexOf("--tools") + 1], "Read,Glob,Grep");
  assert.equal(doFabricante[doFabricante.indexOf("--permission-mode") + 1], "dontAsk");
  assert.ok(!daAssinatura.includes("Edit"), "não pode liberar Edit nesta raia");
  assert.ok(!daAssinatura.includes("Write"), "não pode liberar Write nesta raia");
});

// Removed tests and their Task 2 replacements in ambiente-filho.test.ts:
// - "assinatura: as variáveis ANTHROPIC herdadas são removidas do ambiente do filho"
//   -> "Claude por assinatura preserva o login em HOME e somente seu prazo".
// - "assinatura: nenhuma variável do filho fica com o texto 'undefined'"
//   -> "ambientes filhos nunca serializam valor ausente como texto undefined".
// - "assinatura: não define CLAUDE_CONFIG_DIR (pasta descartável dá 'Not logged in')"
//   -> "Claude por assinatura preserva o login em HOME e somente seu prazo".
// - "assinatura: o filho continua herdando o básico do sistema (PATH)"
//   -> "ambiente base mantém só o sistema permitido e exclui segredos de outros provedores".
// - "raia de fabricante: define endereço, chave e pasta descartável"
//   -> "Claude com chave adiciona somente a rota e credencial selecionadas".
// - "raia de fabricante: o endereço herdado do ambiente é sobrescrito pelo do cardápio"
//   -> "Claude com chave adiciona somente a rota e credencial selecionadas".
// - "as duas raias dão ao Claude Code 1 minuto a mais que o nosso prazo"
//   -> "Claude por assinatura preserva o login em HOME e somente seu prazo" and
//      "Claude com chave adiciona somente a rota e credencial selecionadas".
// Reason: Task 2 consolidates narrow Claude-only assertions into the approved
// all-CLI environment allowlist coverage; do not weaken it without AGENTS.md review.

test("o cardápio real traz a raia claude-maos sem endereço e sem chave", async () => {
  const { loadConfig } = await import("../config.js");
  const raia = loadConfig().providers["claude-maos"];
  assert.ok(raia, "a raia claude-maos deve existir no cardápio");
  assert.equal(raia.type, "claude-cli");
  assert.ok(raia.type === "claude-cli" && ehRaiaDeAssinatura(raia), "tem que ser de assinatura");
});
