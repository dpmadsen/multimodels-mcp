// Testes do gravador de chaves no .env.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { upsertEnvKey, maskKey } from "./env-file.js";

function tempEnv(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "multimodels-env-test-"));
  const path = join(dir, ".env");
  writeFileSync(path, content);
  return path;
}

test("atualiza chave existente preservando comentários e outras linhas", () => {
  const path = tempEnv("# comentário\nDEEPSEEK_API_KEY=antiga\nZAI_API_KEY=zzz\n");
  upsertEnvKey(path, "DEEPSEEK_API_KEY", "nova-chave");
  const result = readFileSync(path, "utf8");
  assert.match(result, /# comentário/);
  assert.match(result, /DEEPSEEK_API_KEY=nova-chave/);
  assert.match(result, /ZAI_API_KEY=zzz/);
  assert.doesNotMatch(result, /antiga/);
});

test("acrescenta chave que não existia", () => {
  const path = tempEnv("DEEPSEEK_API_KEY=abc\n");
  upsertEnvKey(path, "OPENROUTER_API_KEY", "sk-or-123");
  assert.match(readFileSync(path, "utf8"), /OPENROUTER_API_KEY=sk-or-123/);
});

test("rejeita valor com quebra de linha (proteção contra injeção)", () => {
  const path = tempEnv("");
  assert.throws(() => upsertEnvKey(path, "ZAI_API_KEY", "abc\nHACK=1"), /quebras de linha/);
});

test("rejeita nome de variável inválido", () => {
  const path = tempEnv("");
  assert.throws(() => upsertEnvKey(path, "chave ruim", "x"), /inválido/);
});

test("maskKey mostra só os 4 últimos caracteres", () => {
  assert.deepEqual(maskKey("sk-or-v1-abcdef9876"), { set: true, last4: "9876" });
  assert.deepEqual(maskKey(""), { set: false, last4: null });
  assert.deepEqual(maskKey(undefined), { set: false, last4: null });
});
