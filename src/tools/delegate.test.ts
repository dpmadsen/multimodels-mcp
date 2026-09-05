import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerDelegate } from "./delegate.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelsConfig } from "../config.js";

// Este teste protege a classificação de mutação da ferramenta: delegações com
// mãos podem alterar arquivos, portanto a anotação não pode alegar somente
// leitura; a mudança só é válida após conferir requisito, histórico, memória,
// plano e docs/test-change-log.md.
test("registra delegate_task como não somente leitura e open-world", () => {
  let registro: { name: string; config: { annotations?: unknown } } | undefined;
  const fakeServer = {
    registerTool: (name: string, config: { annotations?: unknown }) => {
      registro = { name, config };
    },
    server: { getClientVersion: () => undefined },
  } as unknown as McpServer;
  registerDelegate(fakeServer, () => ({ providers: {} } satisfies ModelsConfig));
  assert.ok(registro);
  assert.equal(registro.name, "delegate_task");
  assert.deepEqual(registro.config.annotations, { readOnlyHint: false, openWorldHint: true });
});

// Este contrato protege a orientação dada ao chamador: workdir continua
// opcional no formato compartilhado, mas toda raia CLI/com mãos o exige antes de
// executar, enquanto APIs diretas o ignoram. Revisar requisito, diff, histórico,
// MEMORY.md, plano e docs/test-change-log.md antes de alterar/remover (AGENTS.md).
test("descreve workdir como obrigatório em toda raia CLI e ignorado nas APIs diretas", () => {
  type CampoWorkdir = {
    description?: string;
    safeParse: (valor: unknown) => { success: boolean };
  };
  let campo: CampoWorkdir | undefined;
  const fakeServer = {
    registerTool: (_name: string, config: { inputSchema?: { workdir?: CampoWorkdir } }) => {
      campo = config.inputSchema?.workdir;
    },
    server: { getClientVersion: () => undefined },
  } as unknown as McpServer;
  registerDelegate(fakeServer, () => ({ providers: {} } satisfies ModelsConfig));
  assert.ok(campo);
  assert.equal(campo.safeParse(undefined).success, true, "o formato compartilhado continua opcional");
  assert.equal(
    campo.description,
    "Obrigatório para Codex, Gemini e toda raia CLI/com mãos: pasta do projeto que o modelo pode LER (caminho absoluto). " +
      "Ignorado pelas raias de API direta. Para o Gemini, requer o arquivo de permissões do agy configurado " +
      "(senão, mande o contexto no texto)"
  );
});

// Protege a identidade segura dos logs de producao: API recebe providerId e
// Codex sem modelo usa o proprio id. Antes de alterar/remover, conferir
// requisito, diff, historico, MEMORY.md, plano e docs/test-change-log.md.
test("delegacao API registra o providerId configurado sem texto da tarefa", async () => {
  let handler: ((input: { model: string; task: string; wait?: boolean }) => Promise<unknown>) | undefined;
  const server = {
    registerTool: (_name: string, _config: unknown, registered: typeof handler) => { handler = registered; },
    server: { getClientVersion: () => undefined },
  } as unknown as McpServer;
  const config: ModelsConfig = { providers: {
    fake: { type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"] },
  } };
  registerDelegate(server, () => config);
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const linhas: string[] = [];
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }))) as typeof fetch;
  console.error = (linha?: unknown) => linhas.push(String(linha));
  try {
    assert.ok(handler);
    await handler({ model: "fake:m", task: "prompt que nao pode aparecer", wait: true });
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
  const eventos = linhas.filter((linha) => linha.startsWith("{")).map((linha) => JSON.parse(linha) as { event: string; providerId?: string; modelId?: string });
  assert.deepEqual(eventos.map((evento) => evento.event), ["provider.start", "provider.finish"]);
  assert.equal(eventos[0].providerId, "fake");
  assert.equal(eventos[0].modelId, "m");
  assert.ok(linhas.every((linha) => !linha.includes("prompt que nao pode aparecer")));
});

test("delegacao Codex sem modelo registra o id do provedor como modelId", async () => {
  let handler: ((input: { model: string; task: string; workdir?: string; wait?: boolean }) => Promise<unknown>) | undefined;
  const server = {
    registerTool: (_name: string, _config: unknown, registered: typeof handler) => { handler = registered; },
    server: { getClientVersion: () => undefined },
  } as unknown as McpServer;
  const config: ModelsConfig = { providers: { codex: { type: "codex-cli", label: "Codex", enabled: true } } };
  const bin = await mkdtemp(join(tmpdir(), "multimodels-delegate-codex-bin-"));
  const workdir = await mkdtemp(join(tmpdir(), "multimodels-delegate-codex-workdir-"));
  await writeFile(join(bin, "codex"), '#!/bin/sh\nout=""\nwhile [ "$#" -gt 0 ]; do [ "$1" = "--output-last-message" ] && out="$2"; shift; done\nprintf ok > "$out"\n', "utf8");
  await chmod(join(bin, "codex"), 0o755);
  registerDelegate(server, () => config);
  const oldPath = process.env.PATH;
  const originalError = console.error;
  const linhas: string[] = [];
  process.env.PATH = `${bin}:${oldPath ?? ""}`;
  console.error = (linha?: unknown) => linhas.push(String(linha));
  try {
    assert.ok(handler);
    await handler({ model: "codex", task: "prompt que nao pode aparecer", workdir, wait: true });
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    console.error = originalError;
  }
  const inicio = linhas.map((linha) => JSON.parse(linha) as { event: string; providerId?: string; modelId?: string }).find((evento) => evento.event === "provider.start");
  assert.equal(inicio?.providerId, "codex");
  assert.equal(inicio?.modelId, "codex");
});
