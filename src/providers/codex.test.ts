// Testes da montagem de argumentos do CLI do Codex.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexArgs, runCodex } from "./codex.js";
import type { ModelsConfig } from "../config.js";

test("monta os argumentos básicos (sem modelo nem esforço), igual ao comportamento antigo", () => {
  const args = buildCodexArgs("faça isso", { outFile: "/tmp/saida.txt" });
  assert.deepEqual(args, [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--output-last-message",
    "/tmp/saida.txt",
    "faça isso",
  ]);
});

test("inclui -m <modelo> antes da tarefa quando 'model' é passado", () => {
  const args = buildCodexArgs("faça isso", { outFile: "/tmp/saida.txt", model: "gpt-5.6-luna" });
  assert.deepEqual(args, [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--output-last-message",
    "/tmp/saida.txt",
    "-m",
    "gpt-5.6-luna",
    "faça isso",
  ]);
});

test("inclui -c model_reasoning_effort=<valor> antes da tarefa quando 'effort' é passado", () => {
  const args = buildCodexArgs("faça isso", { outFile: "/tmp/saida.txt", effort: "high" });
  assert.deepEqual(args, [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--output-last-message",
    "/tmp/saida.txt",
    "-c",
    "model_reasoning_effort=high",
    "faça isso",
  ]);
});

test("combina model e effort, ambos antes da tarefa (tarefa continua o último argumento)", () => {
  const args = buildCodexArgs("faça isso", {
    outFile: "/tmp/saida.txt",
    model: "gpt-5.6-sol",
    effort: "xhigh",
  });
  assert.deepEqual(args, [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--output-last-message",
    "/tmp/saida.txt",
    "-m",
    "gpt-5.6-sol",
    "-c",
    "model_reasoning_effort=xhigh",
    "faça isso",
  ]);
  assert.equal(args[args.length - 1], "faça isso", "a tarefa precisa ser o último argumento");
});

test("aceita os quatro valores válidos de esforço", () => {
  for (const effort of ["low", "medium", "high", "xhigh"]) {
    assert.doesNotThrow(() => buildCodexArgs("t", { outFile: "/tmp/out.txt", effort }));
  }
});

test("esforço inválido lança erro amigável listando os valores aceitos", () => {
  assert.throws(
    () => buildCodexArgs("t", { outFile: "/tmp/out.txt", effort: "turbo" }),
    /Esforço de raciocínio inválido.*low, medium, high, xhigh/
  );
});

// Este grupo protege a exigência de workdir e a passagem do escopo canônico ao
// processo; é necessário para impedir cwd implícito. Antes de modificar ou
// remover, conferir requisito, diff, histórico, memória, plano e changelog.
// Protege o limite direto do provider: cwd implícito não é escopo autorizado.
test("recusa workdir ausente antes de iniciar o Codex", async () => {
  await assert.rejects(runCodex({ providers: {} } satisfies ModelsConfig, undefined, "t", undefined as never), /workdir.*obrigatório/i);
});

test("passa o workdir explícito ao processo Codex", async () => {
  const bin = await mkdtemp(join(tmpdir(), "multimodels-codex-bin-"));
  const workdir = await mkdtemp(join(tmpdir(), "multimodels-codex-scope-"));
  const fake = join(bin, "codex");
  await writeFile(fake, '#!/bin/sh\nout=""\nwhile [ "$#" -gt 0 ]; do [ "$1" = "--output-last-message" ] && out="$2"; shift; done\nprintf "%s" "$PWD" > "$out"\n', "utf8");
  await chmod(fake, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath ?? ""}`;
  try {
    assert.equal(await runCodex({ providers: {} }, undefined, "t", workdir), await realpath(workdir));
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
  }
});

// Protege a leitura do arquivo de resultado: stat precisa barrar resposta
// grande antes de readFile. Antes de alterar/remover, conferir requisito,
// diff, historico, MEMORY.md, plano e docs/test-change-log.md.
test("Codex verifica o tamanho do arquivo de resultado antes de le-lo", async () => {
  const bin = await mkdtemp(join(tmpdir(), "multimodels-codex-limit-bin-"));
  const workdir = await mkdtemp(join(tmpdir(), "multimodels-codex-limit-workdir-"));
  const fake = join(bin, "codex");
  await writeFile(fake, '#!/bin/sh\nout=""\nwhile [ "$#" -gt 0 ]; do [ "$1" = "--output-last-message" ] && out="$2"; shift; done\nprintf "abcde" > "$out"\n', "utf8");
  await chmod(fake, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath ?? ""}`;
  try {
    const provider = { type: "codex-cli", label: "Codex", enabled: true, maxResponseBytes: 4 } as const;
    await assert.rejects(runCodex({ providers: {} }, provider, "t", workdir), /excedeu o limite local de 4 bytes/);
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
  }
});
