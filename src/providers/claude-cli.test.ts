// Testes da montagem de argumentos e das travas de segurança da raia
// "com mãos" (Claude Code headless apontado pro motor da z.ai).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClaudeCliArgs, runClaudeCli } from "./claude-cli.js";
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
  timeoutMs: 900000,
};

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
  await assert.rejects(runClaudeCli(provider, "tarefa", undefined, "glm-5.2"), (err: Error) => {
    assert.match(err.message, /Falta a chave/);
    assert.match(err.message, /ZAI_API_KEY_TESTE_INEXISTENTE/);
    return true;
  });
});

test("workdir inexistente é rejeitado antes do spawn, culpando a pasta (não o binário claude)", async () => {
  process.env.ZAI_API_KEY_TESTE_INEXISTENTE = "chave-de-mentira";
  const pastaFalsa = "/caminho/que/nao/existe/multimodels-glm-maos-xyz";
  await assert.rejects(
    runClaudeCli(provider, "tarefa", pastaFalsa, "glm-5.2"),
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
  await assert.rejects(runClaudeCli(provider, "tarefa", undefined, undefined), (err: Error) => {
    assert.match(err.message, /modelo explícito/);
    return true;
  });
  delete process.env.ZAI_API_KEY_TESTE_INEXISTENTE;
});

// A trava de "effort não suportado" vive na rota do delegate_task; testamos
// capturando o handler que o registerDelegate registra e chamando-o direto.
test("pedir 'effort' nesta raia dá erro amigável antes de qualquer spawn", async () => {
  const config: ModelsConfig = {
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
  let handler:
    | ((args: { model: string; task: string; effort?: string }) => Promise<{
        isError?: boolean;
        content: Array<{ text: string }>;
      }>)
    | undefined;
  const fakeServer = {
    registerTool: (_name: string, _cfg: unknown, fn: typeof handler) => {
      handler = fn;
    },
  } as unknown as McpServer;
  registerDelegate(fakeServer, () => config);
  assert.ok(handler, "o delegate_task deve ter sido registrado");
  const result = await handler!({ model: "glm-maos:glm-5.2", task: "leia o projeto", effort: "high" });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /não aceita o campo "effort"/);
});
