import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolverPastaDeTrabalho } from "./pasta-de-trabalho.js";

// Este grupo protege a fronteira explícita do projeto delegado: ele é necessário
// porque o cwd implícito do servidor não é autoridade escolhida pelo usuário e
// só pode ser alterado após conferir requisito original, diff atual, histórico,
// cobertura substituta, MEMORY.md, plano e docs/test-change-log.md.
test("resolve uma pasta existente para o caminho canônico", async () => {
  const pasta = await mkdtemp(join(tmpdir(), "multimodels-workdir-"));
  assert.equal(await resolverPastaDeTrabalho(pasta), await realpath(pasta));
});

test("recusa workdir ausente ou inexistente", async () => {
  await assert.rejects(resolverPastaDeTrabalho(undefined), /workdir.*obrigatório/i);
  await assert.rejects(resolverPastaDeTrabalho(join(tmpdir(), "nao-existe")), /não existe/i);
});

test("recusa um arquivo regular como workdir", async () => {
  const pasta = await mkdtemp(join(tmpdir(), "multimodels-workdir-"));
  const arquivo = join(pasta, "arquivo.txt");
  await writeFile(arquivo, "teste");
  await assert.rejects(resolverPastaDeTrabalho(arquivo), /não é uma pasta/i);
});
