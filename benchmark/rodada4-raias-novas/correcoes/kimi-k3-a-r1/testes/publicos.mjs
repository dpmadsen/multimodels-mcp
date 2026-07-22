// Testes públicos da Estação A — orientação leve para os modelos.
// A nota real vem do grade-a.mjs (corretor oculto). Estes cobrem só o básico.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarConfiguracao } from "../src/validador.mjs";

const base = {
  nome: "Agência Central",
  email: "contato@agencia.com",
  servidorIp: "192.168.0.10",
  faixaLiberada: "10.0.0.0/8",
  porta: 8080,
  precosPorServico: { ensaio: 150000, edicao: 30000 },
};

const V = (over = {}) => validarConfiguracao({ ...base, ...over });
const msg = (r, campo) => (r.erros || []).find((e) => e.campo === campo)?.mensagem;

test("config válida passa e devolve os dados", () => {
  const r = V();
  assert.equal(r.ok, true);
  assert.equal(r.dados.porta, 8080);
});

test("nome curto → 'nome muito curto'", () => {
  const r = V({ nome: "ab" });
  assert.equal(r.ok, false);
  assert.equal(msg(r, "nome"), "nome muito curto");
});

test("email inválido → 'email inválido'", () => {
  const r = V({ email: "nao-e-email" });
  assert.equal(r.ok, false);
  assert.equal(msg(r, "email"), "email inválido");
});

test("IPv4 inválido → 'endereço IPv4 inválido'", () => {
  const r = V({ servidorIp: "10.0.0.256" });
  assert.equal(r.ok, false);
  assert.equal(msg(r, "servidorIp"), "endereço IPv4 inválido");
});

test("CIDR inválido → 'faixa CIDR inválida'", () => {
  const r = V({ faixaLiberada: "10.0.0.0/33" });
  assert.equal(r.ok, false);
  assert.equal(msg(r, "faixaLiberada"), "faixa CIDR inválida");
});

test("porta com tipo errado → 'porta deve ser um número'", () => {
  const r = V({ porta: "8080" });
  assert.equal(r.ok, false);
  assert.equal(msg(r, "porta"), "porta deve ser um número");
});

test("porta fora da faixa → 'porta fora da faixa'", () => {
  const r = V({ porta: 70000 });
  assert.equal(r.ok, false);
  assert.equal(msg(r, "porta"), "porta fora da faixa");
});
