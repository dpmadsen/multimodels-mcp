// Testes da montagem de argumentos do Antigravity CLI (agy), a ponte do Gemini.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeminiArgs } from "./gemini.js";

test("monta os argumentos básicos: modo plan (somente-leitura), prazo de 10m e tarefa via -p", () => {
  const args = buildGeminiArgs("faça isso");
  assert.deepEqual(args, ["--mode", "plan", "--print-timeout", "10m", "-p", "faça isso"]);
});

test("inclui --model <modelo> antes da tarefa quando 'model' é passado", () => {
  const args = buildGeminiArgs("faça isso", { model: "gemini-3.1-pro-high" });
  assert.deepEqual(args, [
    "--mode",
    "plan",
    "--print-timeout",
    "10m",
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

test("pedir esforço dá erro amigável apontando pro sufixo do modelo (-low/-medium/-high)", () => {
  assert.throws(() => buildGeminiArgs("t", { effort: "high" }), /sufixo do modelo/);
});
