// Testes do depósito de tarefas.
// TODOS usam uma pasta temporária criada na hora (mkdtemp) — nunca a pasta
// real do projeto, pra teste nenhum apagar tarefa de verdade do Daniel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  apresentar,
  criarTarefa,
  faxina,
  lerTarefa,
  listarTarefas,
  marcarErro,
  marcarPronta,
  provavelmenteInterrompida,
  resumirTarefa,
  type Tarefa,
} from "./deposito.js";

function pastaNova(): Promise<string> {
  return mkdtemp(join(tmpdir(), "multimodels-tarefas-"));
}

const dados = { modelo: "deepseek:deepseek-chat", task: "Resuma este texto", prazoMs: 60_000 };

test("criar tarefa devolve id legível e crescente", async () => {
  const pasta = await pastaNova();
  const primeira = await criarTarefa(pasta, dados);
  const segunda = await criarTarefa(pasta, dados);
  assert.equal(primeira.id, "tarefa-1");
  assert.equal(segunda.id, "tarefa-2");
  assert.equal(primeira.estado, "rodando");
});

test("id continua de onde parou mesmo depois de reabrir a pasta", async () => {
  const pasta = await pastaNova();
  await criarTarefa(pasta, dados);
  await criarTarefa(pasta, dados);
  // Simula outra sessão do Claude Code chegando depois: mesma pasta, começo do zero.
  const terceira = await criarTarefa(pasta, dados);
  assert.equal(terceira.id, "tarefa-3");
});

test("na disputa por id, quem perde pula pro número seguinte", async () => {
  const pasta = await pastaNova();
  // Dublê do sistema de arquivos: finge que outra sessão criou a tarefa-1
  // no exato instante entre olhar a pasta e gravar o arquivo.
  let primeiraTentativa = true;
  const criarComDisputa = async (caminho: string, conteudo: string) => {
    if (primeiraTentativa) {
      primeiraTentativa = false;
      const erro = new Error("EEXIST") as NodeJS.ErrnoException;
      erro.code = "EEXIST";
      throw erro;
    }
    await writeFile(caminho, conteudo, { encoding: "utf8", flag: "wx" });
  };
  const tarefa = await criarTarefa(pasta, dados, new Date(), criarComDisputa);
  assert.equal(tarefa.id, "tarefa-2");
  const noDisco = await lerTarefa(pasta, "tarefa-2");
  assert.equal(noDisco?.id, "tarefa-2");
});

test("duas tarefas criadas ao mesmo tempo nunca ocupam o mesmo id", async () => {
  const pasta = await pastaNova();
  const criadas = await Promise.all([
    criarTarefa(pasta, dados),
    criarTarefa(pasta, dados),
    criarTarefa(pasta, dados),
    criarTarefa(pasta, dados),
    criarTarefa(pasta, dados),
  ]);
  const ids = new Set(criadas.map((t) => t.id));
  assert.equal(ids.size, 5, "cada tarefa precisa ter um id só dela");
  const arquivos = await readdir(pasta);
  assert.equal(arquivos.length, 5);
});

test("marcar pronta grava o resultado e é lido de volta", async () => {
  const pasta = await pastaNova();
  const tarefa = await criarTarefa(pasta, dados);
  await marcarPronta(pasta, tarefa.id, "a resposta do modelo\n\n[resposta de: DeepSeek]");
  const lida = await lerTarefa(pasta, tarefa.id);
  assert.equal(lida?.estado, "pronta");
  assert.match(lida?.resultado ?? "", /\[resposta de: DeepSeek\]/);
  assert.ok(lida?.fim, "tarefa pronta precisa registrar o instante do fim");
});

test("marcar erro grava o motivo e é lido de volta", async () => {
  const pasta = await pastaNova();
  const tarefa = await criarTarefa(pasta, dados);
  await marcarErro(pasta, tarefa.id, "provedor fora do ar");
  const lida = await lerTarefa(pasta, tarefa.id);
  assert.equal(lida?.estado, "erro");
  assert.equal(lida?.erro, "provedor fora do ar");
  assert.equal(lida?.resultado, undefined);
});

test("marcar tarefa que não existe não derruba nada", async () => {
  const pasta = await pastaNova();
  assert.equal(await marcarPronta(pasta, "tarefa-99", "oi"), undefined);
  assert.equal(await marcarErro(pasta, "tarefa-99", "erro"), undefined);
});

test("ler tarefa inexistente devolve indefinido", async () => {
  const pasta = await pastaNova();
  assert.equal(await lerTarefa(pasta, "tarefa-7"), undefined);
  assert.equal(await lerTarefa(pasta, "../../etc/passwd"), undefined);
});

test("listar devolve as mais recentes primeiro", async () => {
  const pasta = await pastaNova();
  await criarTarefa(pasta, dados);
  await criarTarefa(pasta, dados);
  await criarTarefa(pasta, dados);
  const lista = await listarTarefas(pasta);
  assert.deepEqual(
    lista.map((t) => t.id),
    ["tarefa-3", "tarefa-2", "tarefa-1"]
  );
});

test("listar em pasta que nem existe devolve lista vazia", async () => {
  const pasta = join(await pastaNova(), "ainda-nao-criada");
  assert.deepEqual(await listarTarefas(pasta), []);
});

test("resumo pega o começo da tarefa em uma linha só", () => {
  assert.equal(resumirTarefa("  linha um\n  linha dois  "), "linha um linha dois");
  const longo = "a".repeat(300);
  const resumo = resumirTarefa(longo);
  assert.equal(resumo.length, 201, "200 caracteres mais as reticências");
  assert.ok(resumo.endsWith("…"));
});

test("faxina mantém o teto e apaga as mais antigas", async () => {
  const pasta = await pastaNova();
  for (let i = 0; i < 5; i++) {
    const tarefa = await criarTarefa(pasta, dados);
    await marcarPronta(pasta, tarefa.id, "pronto");
  }
  const apagadas = await faxina(pasta, 3);
  assert.deepEqual(apagadas, ["tarefa-1", "tarefa-2"]);
  const sobraram = await listarTarefas(pasta);
  assert.deepEqual(
    sobraram.map((t) => t.id),
    ["tarefa-5", "tarefa-4", "tarefa-3"]
  );
});

test("faxina não apaga tarefa que ainda está rodando dentro do prazo", async () => {
  const pasta = await pastaNova();
  await criarTarefa(pasta, dados); // fica rodando
  for (let i = 0; i < 4; i++) {
    const tarefa = await criarTarefa(pasta, dados);
    await marcarPronta(pasta, tarefa.id, "pronto");
  }
  await faxina(pasta, 3);
  const ids = (await listarTarefas(pasta)).map((t) => t.id);
  assert.ok(ids.includes("tarefa-1"), "a que ainda está rodando precisa sobreviver");
});

test("criar tarefa faz a faxina sozinha e a pasta para de crescer em 50", async () => {
  const pasta = await pastaNova();
  for (let i = 0; i < 55; i++) {
    const tarefa = await criarTarefa(pasta, dados);
    await marcarPronta(pasta, tarefa.id, "pronto");
  }
  const lista = await listarTarefas(pasta);
  assert.equal(lista.length, 50);
  assert.equal(lista[0].id, "tarefa-55", "a mais recente continua lá");
  assert.equal(await lerTarefa(pasta, "tarefa-1"), undefined, "a mais antiga saiu");
});

test("tarefa rodando estourada de prazo é APRESENTADA como interrompida, sem mexer no arquivo", async () => {
  const pasta = await pastaNova();
  const inicio = new Date("2026-08-01T10:00:00.000Z");
  const tarefa = await criarTarefa(pasta, { ...dados, prazoMs: 10 * 60_000 }, inicio);
  const cruAntes = await readFile(join(pasta, `${tarefa.id}.json`), "utf8");

  // Dentro do prazo: nada de aviso.
  const cedo = new Date("2026-08-01T10:05:00.000Z");
  assert.equal((await lerTarefa(pasta, tarefa.id, cedo))?.provavelmenteInterrompida, false);

  // Passou do prazo mais a folga de 2 minutos: aparece como interrompida.
  const tarde = new Date("2026-08-01T10:13:00.000Z");
  const lida = await lerTarefa(pasta, tarefa.id, tarde);
  assert.equal(lida?.provavelmenteInterrompida, true);
  assert.equal(lida?.estado, "rodando", "o estado guardado continua o mesmo");
  const listada = (await listarTarefas(pasta, tarde))[0];
  assert.equal(listada.provavelmenteInterrompida, true);

  const cruDepois = await readFile(join(pasta, `${tarefa.id}.json`), "utf8");
  assert.equal(cruDepois, cruAntes, "o arquivo no disco não pode ter sido alterado");
});

test("a folga de 2 minutos vale antes de acusar interrupção", () => {
  const base: Tarefa = {
    id: "tarefa-1",
    estado: "rodando",
    modelo: "codex",
    resumo: "algo",
    inicio: "2026-08-01T10:00:00.000Z",
    prazoMs: 10 * 60_000,
  };
  // 11 minutos: passou do prazo, mas ainda dentro da folga.
  assert.equal(provavelmenteInterrompida(base, new Date("2026-08-01T10:11:00.000Z")), false);
  // 13 minutos: passou do prazo e da folga.
  assert.equal(provavelmenteInterrompida(base, new Date("2026-08-01T10:13:00.000Z")), true);
  // Tarefa já terminada nunca é acusada de interrompida, por mais velha que seja.
  const pronta: Tarefa = { ...base, estado: "pronta" };
  assert.equal(provavelmenteInterrompida(pronta, new Date("2027-01-01T00:00:00.000Z")), false);
  assert.equal(apresentar(pronta, new Date("2027-01-01T00:00:00.000Z")).provavelmenteInterrompida, false);
});
