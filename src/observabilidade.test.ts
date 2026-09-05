// O logger aceita somente o vocabulário fechado de eventos. Antes de alterar
// ou remover, revisar requisito, diff, histórico, MEMORY.md, plano e changelog:
// diagnosticos nunca podem vazar prompt, resposta, segredo ou URL de consulta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registrarEvento } from "./observabilidade.js";

test("cada evento sai como uma unica linha JSON sem dados sensiveis arbitrarios", () => {
  const linhas: string[] = [];
  const original = console.error;
  console.error = (linha?: unknown) => linhas.push(String(linha));
  try {
    const erroComSegredos = new Error("prompt-fragment response-fragment Bearer secret https://example.test/?token=secret");
    assert.throws(() => registrarEvento(erroComSegredos as never), /evento invalido/i);
    registrarEvento({ event: "provider.reject", providerId: "fake", modelId: "m", reason: "response_bytes", observedBytes: 11, limitBytes: 10 });
  } finally {
    console.error = original;
  }
  assert.equal(linhas.length, 1);
  const evento = JSON.parse(linhas[0]) as Record<string, unknown>;
  assert.equal(evento.event, "provider.reject");
  assert.equal(evento.providerId, "fake");
  assert.equal(evento.observedBytes, 11);
  assert.ok(typeof evento.ts === "string");
  for (const proibido of ["prompt-fragment", "response-fragment", "Bearer secret", "https://example.test/?token=secret"]) {
    assert.ok(!linhas[0].includes(proibido));
  }
});
