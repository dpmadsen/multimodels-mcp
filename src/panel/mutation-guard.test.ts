import { test } from "node:test";
import assert from "node:assert/strict";
import { validarMutacaoDoPainel } from "./mutation-guard.js";

// Estes guard tests protegem a autoridade de mutação do painel do usuário:
// bloqueiam requisições cross-site antes da persistência. Antes de enfraquecer
// ou remover esta cobertura, é obrigatório revisar o requisito original, o
// diff, o histórico, a memória, o plano e o registro de mudanças de testes.

const origem = "http://127.0.0.1:4747";
const aceitos = {
  origin: origem,
  host: "127.0.0.1:4747",
  "content-type": "application/json; charset=utf-8",
};

test("aceita mutação com Origin, Host e JSON exatos", () => {
  assert.deepEqual(validarMutacaoDoPainel(aceitos, origem), { ok: true });
});

test("rejeita Origin ausente ou diferente da origem esperada", () => {
  assert.deepEqual(validarMutacaoDoPainel({ ...aceitos, origin: "http://evil.example" }, origem), {
    ok: false,
    reason: "origin",
  });
  const { origin: _origin, ...semOrigin } = aceitos;
  assert.deepEqual(validarMutacaoDoPainel(semOrigin, origem), { ok: false, reason: "origin" });
});

test("rejeita Host ausente ou diferente do painel local", () => {
  assert.deepEqual(validarMutacaoDoPainel({ ...aceitos, host: "evil.example" }, origem), {
    ok: false,
    reason: "host",
  });
  const { host: _host, ...semHost } = aceitos;
  assert.deepEqual(validarMutacaoDoPainel(semHost, origem), { ok: false, reason: "host" });
});

test("rejeita Content-Type ausente, text/plain e formulários", () => {
  for (const contentType of [undefined, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
    const headers: Record<string, string> = { ...aceitos };
    if (contentType === undefined) {
      delete headers["content-type"];
    } else {
      headers["content-type"] = contentType;
    }
    assert.deepEqual(validarMutacaoDoPainel(headers, origem), { ok: false, reason: "content_type" });
  }
});
