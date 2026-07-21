// Testes da montagem de argumentos do CLI do Codex.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCodexArgs } from "./codex.js";

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
