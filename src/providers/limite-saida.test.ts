// Testa a conta pura de bytes usada pelos streams CLI. Antes de alterar ou
// remover, revisar requisito, diff, histórico, MEMORY.md, plano e changelog:
// caracteres JavaScript nao sao bytes UTF-8 e o teto protege a memoria.
import { test } from "node:test";
import assert from "node:assert/strict";
import { somarBytesDeSaida } from "./limite-saida.js";

test("aceita uma saida exatamente no limite de bytes", () => {
  assert.deepEqual(somarBytesDeSaida(0, "abcd", 4), { total: 4, excedeu: false });
});

test("recusa uma saida que ultrapassa o limite por um byte", () => {
  assert.deepEqual(somarBytesDeSaida(4, "e", 4), { total: 5, excedeu: true });
});

test("conta UTF-8 por bytes em vez de caracteres JavaScript", () => {
  assert.deepEqual(somarBytesDeSaida(0, "€", 3), { total: 3, excedeu: false });
  assert.deepEqual(somarBytesDeSaida(3, "€", 3), { total: 6, excedeu: true });
});
