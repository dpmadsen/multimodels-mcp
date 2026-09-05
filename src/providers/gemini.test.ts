// Testes da montagem de argumentos do Antigravity CLI (agy), a ponte do Gemini.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGeminiArgs, runGemini } from "./gemini.js";
import type { ModelsConfig } from "../config.js";

// Cardápio de mentira sem prazo configurado: cai no padrão embutido (10 min).
const config: ModelsConfig = { providers: {} };

test("monta os argumentos básicos: modo plan (somente-leitura), prazo de 11m e tarefa via -p", () => {
  const args = buildGeminiArgs("faça isso");
  assert.deepEqual(args, ["--mode", "plan", "--print-timeout", "11m", "-p", "faça isso"]);
});

test("inclui --model <modelo> antes da tarefa quando 'model' é passado", () => {
  const args = buildGeminiArgs("faça isso", { model: "gemini-3.1-pro-high" });
  assert.deepEqual(args, [
    "--mode",
    "plan",
    "--print-timeout",
    "11m",
    "--model",
    "gemini-3.1-pro-high",
    "-p",
    "faça isso",
  ]);
});

test("a tarefa é sempre o último argumento, logo depois de -p", () => {
  const args = buildGeminiArgs("tarefa longa", { model: "gemini-3.6-flash-low" });
  assert.equal(args[args.length - 1], "tarefa longa");
  assert.equal(args[args.length - 2], "-p");
});

test("o prazo do agy (11m) é maior que o nosso kill (10m), pra ele nunca desistir primeiro", () => {
  const args = buildGeminiArgs("t");
  const i = args.indexOf("--print-timeout");
  assert.equal(args[i + 1], "11m");
});

test("o --print-timeout é sempre o prazo configurado + 1 minuto", () => {
  const casos: Array<[number, string]> = [
    [1, "2m"],
    [10, "11m"],
    [15, "16m"],
    [30, "31m"],
    [120, "121m"],
  ];
  for (const [minutos, esperado] of casos) {
    const args = buildGeminiArgs("t", { timeoutMs: minutos * 60 * 1000 });
    const i = args.indexOf("--print-timeout");
    assert.equal(args[i + 1], esperado, `prazo de ${minutos} min deveria virar ${esperado}`);
  }
});

test("inclui --add-dir <workdir> quando 'workdir' é passado, antes do -p (tarefa continua última)", () => {
  const args = buildGeminiArgs("faça isso", { model: "gemini-3.6-flash-low", workdir: "/uma/pasta" });
  const i = args.indexOf("--add-dir");
  assert.notEqual(i, -1);
  assert.equal(args[i + 1], "/uma/pasta");
  // --add-dir vem antes do -p, e a tarefa segue sendo o último argumento.
  assert.ok(i < args.indexOf("-p"));
  assert.equal(args[args.length - 1], "faça isso");
  assert.equal(args[args.length - 2], "-p");
});

test("sem 'workdir' não inclui --add-dir", () => {
  const args = buildGeminiArgs("faça isso", { model: "gemini-3.6-flash-low" });
  assert.equal(args.indexOf("--add-dir"), -1);
});

test("pedir esforço dá erro amigável apontando pro sufixo do modelo (-low/-medium/-high)", () => {
  assert.throws(() => buildGeminiArgs("t", { effort: "high" }), /sufixo do modelo/);
});

test("workdir inexistente é rejeitado antes do spawn, culpando a pasta (não o agy)", async () => {
  const pastaFalsa = "/caminho/que/nao/existe/multimodels-teste-xyz";
  await assert.rejects(runGemini(config, undefined, "tarefa", pastaFalsa), (err: Error) => {
    assert.match(err.message, /não existe/);
    assert.match(err.message, /multimodels-teste-xyz/);
    return true;
  });
});

// Este grupo protege a fronteira direta do provider e o cwd efetivamente
// entregue ao processo; é necessário porque um agy instalado fora do PATH
// poderia escapar do dublê. Antes de alterar/remover, conferir requisito,
// diff, histórico completo, MEMORY.md, plano e docs/test-change-log.md.
test("recusa workdir ausente antes de iniciar o agy", async () => {
  await assert.rejects(runGemini(config, undefined, "t", undefined as never), /workdir.*obrigatório/i);
});

test("passa o workdir explícito ao processo agy", async () => {
  const bin = await mkdtemp(join(tmpdir(), "multimodels-agy-bin-"));
  const workdir = await mkdtemp(join(tmpdir(), "multimodels-agy-scope-"));
  const fake = join(bin, "agy");
  await writeFile(fake, '#!/bin/sh\nprintf "%s" "$PWD"\n', "utf8");
  await chmod(fake, 0o755);
  const oldPath = process.env.PATH;
  const oldHome = process.env.HOME;
  process.env.PATH = `${bin}:${oldPath ?? ""}`;
  process.env.HOME = await mkdtemp(join(tmpdir(), "multimodels-agy-home-"));
  try {
    assert.equal(await runGemini(config, undefined, "t", workdir), await realpath(workdir));
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
  }
});

// Protege a aplicacao real do helper de bytes pelo stream do Gemini, sem rodar
// agy/modelo real. Antes de alterar/remover, conferir requisito, diff,
// historico, MEMORY.md, plano e docs/test-change-log.md.
test("Gemini encerra stdout que ultrapassa o limite resolvido", async () => {
  const bin = await mkdtemp(join(tmpdir(), "multimodels-agy-limit-bin-"));
  const workdir = await mkdtemp(join(tmpdir(), "multimodels-agy-limit-workdir-"));
  const fake = join(bin, "agy");
  await writeFile(fake, "#!/bin/sh\nprintf abcde\n", "utf8");
  await chmod(fake, 0o755);
  const oldPath = process.env.PATH;
  const oldHome = process.env.HOME;
  process.env.PATH = `${bin}:${oldPath ?? ""}`;
  process.env.HOME = await mkdtemp(join(tmpdir(), "multimodels-agy-limit-home-"));
  try {
    const provider = { type: "gemini-cli", label: "Gemini", enabled: true, maxResponseBytes: 4 } as const;
    await assert.rejects(runGemini(config, provider, "t", workdir), /excedeu o limite local de 4 bytes/);
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
  }
});

// O handler deve abortar antes de acrescentar o chunk excedente a stdout. O
// dublê não chama agy/modelo real; antes de alterar/remover, conferir requisito,
// diff, historico, MEMORY.md, plano e docs/test-change-log.md.
test("Gemini rejeita um unico chunk acima do limite sem expor seu texto", async () => {
  const bin = await mkdtemp(join(tmpdir(), "multimodels-agy-chunk-bin-"));
  const workdir = await mkdtemp(join(tmpdir(), "multimodels-agy-chunk-workdir-"));
  const fake = join(bin, "agy");
  await writeFile(fake, "#!/bin/sh\nprintf DADO_EXCEDENTE_NAO_RETER_DADO_EXCEDENTE_NAO_RETER\n", "utf8");
  await chmod(fake, 0o755);
  const oldPath = process.env.PATH;
  const oldHome = process.env.HOME;
  process.env.PATH = `${bin}:${oldPath ?? ""}`;
  process.env.HOME = await mkdtemp(join(tmpdir(), "multimodels-agy-chunk-home-"));
  try {
    const provider = { type: "gemini-cli", label: "Gemini", enabled: true, maxResponseBytes: 4 } as const;
    await assert.rejects(runGemini(config, provider, "t", workdir), (err: Error) => {
      assert.ok(!err.message.includes("DADO_EXCEDENTE_NAO_RETER"));
      return true;
    });
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
  }
});
