// Testes da montagem de argumentos do Antigravity CLI (agy), a ponte do Gemini.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeminiArgs, runGemini } from "./gemini.js";

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
  await assert.rejects(runGemini("tarefa", pastaFalsa), (err: Error) => {
    assert.match(err.message, /não existe/);
    assert.match(err.message, /multimodels-teste-xyz/);
    return true;
  });
});
