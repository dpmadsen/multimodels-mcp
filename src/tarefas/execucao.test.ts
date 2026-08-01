// Testes do disparo em segundo plano.
// Nenhuma delegação de verdade acontece aqui: a "cozinha" é um dublê — uma
// função que devolve texto (ou dá erro) sem chamar modelo nenhum.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lerTarefa, listarTarefas } from "./deposito.js";
import { dispararEmSegundoPlano, mensagemDeSenha } from "./execucao.js";

function pastaNova(): Promise<string> {
  return mkdtemp(join(tmpdir(), "multimodels-execucao-"));
}

const base = { modelo: "codex", task: "Escreva um haicai", prazoMs: 60_000 };

test("o disparo devolve na hora, com a tarefa ainda rodando", async () => {
  const pasta = await pastaNova();
  let liberar: () => void = () => {};
  const presa = new Promise<string>((resolve) => {
    liberar = () => resolve("terminou");
  });

  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: () => presa,
  });

  // A delegação ainda nem começou a terminar e a sessão já está livre.
  assert.equal(tarefa.estado, "rodando");
  assert.equal((await lerTarefa(pasta, tarefa.id))?.estado, "rodando");

  liberar();
  await concluida;
  const pronta = await lerTarefa(pasta, tarefa.id);
  assert.equal(pronta?.estado, "pronta");
  assert.equal(pronta?.resultado, "terminou");
});

test("o resultado guardado preserva o rodapé montado pela delegação", async () => {
  const pasta = await pastaNova();
  const texto = "resposta do modelo\n\n[resposta de: DeepSeek · deepseek-chat · tokens: 10 entrada / 20 saída]";
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: async () => texto,
  });
  await concluida;
  assert.equal((await lerTarefa(pasta, tarefa.id))?.resultado, texto);
});

test("erro na delegação vira estado 'erro' e NÃO derruba o processo", async () => {
  const pasta = await pastaNova();
  // Se uma promessa rejeitada escapasse sem catch, o Node derrubaria o
  // processo inteiro — ou seja, o servidor MCP morreria no meio do trabalho.
  // Este é o teste mais importante da funcionalidade.
  const escapadas: unknown[] = [];
  const vigia = (motivo: unknown) => escapadas.push(motivo);
  process.on("unhandledRejection", vigia);
  try {
    const { tarefa, concluida } = await dispararEmSegundoPlano({
      pasta,
      ...base,
      executar: async () => {
        throw new Error("o provedor devolveu 500");
      },
    });
    await concluida;
    // Dá tempo de o Node acusar qualquer promessa solta antes de conferir.
    await new Promise((resolve) => setImmediate(resolve));

    const lida = await lerTarefa(pasta, tarefa.id);
    assert.equal(lida?.estado, "erro");
    assert.equal(lida?.erro, "o provedor devolveu 500");
    assert.deepEqual(escapadas, [], "nenhuma promessa pode escapar sem tratamento");
  } finally {
    process.off("unhandledRejection", vigia);
  }
});

test("erro que não é Error também vira texto legível", async () => {
  const pasta = await pastaNova();
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: async () => {
      throw "deu ruim sem objeto de erro";
    },
  });
  await concluida;
  assert.equal((await lerTarefa(pasta, tarefa.id))?.erro, "deu ruim sem objeto de erro");
});

test("tarefa apagada por fora não faz o acompanhamento explodir", async () => {
  const pasta = await pastaNova();
  let liberar: () => void = () => {};
  const presa = new Promise<string>((resolve) => {
    liberar = () => resolve("ok");
  });
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: () => presa,
  });
  // Outra sessão fazendo faxina apaga o papelzinho no meio do caminho.
  await unlink(join(pasta, `${tarefa.id}.json`));
  liberar();
  await concluida; // não pode rejeitar
  assert.equal(await lerTarefa(pasta, tarefa.id), undefined);
});

test("várias tarefas em segundo plano convivem na mesma pasta", async () => {
  const pasta = await pastaNova();
  const disparos = await Promise.all([
    dispararEmSegundoPlano({ pasta, ...base, executar: async () => "um" }),
    dispararEmSegundoPlano({ pasta, ...base, executar: async () => "dois" }),
    dispararEmSegundoPlano({ pasta, ...base, executar: async () => "três" }),
  ]);
  await Promise.all(disparos.map((d) => d.concluida));
  const lista = await listarTarefas(pasta);
  assert.equal(lista.length, 3);
  assert.deepEqual(
    lista.map((t) => t.estado),
    ["pronta", "pronta", "pronta"]
  );
  assert.deepEqual(new Set(lista.map((t) => t.resultado)), new Set(["um", "dois", "três"]));
});

test("a senha entregue na hora traz o id, o modelo e como buscar depois", () => {
  const texto = mensagemDeSenha(
    {
      id: "tarefa-3",
      estado: "rodando",
      modelo: "codex",
      resumo: "algo",
      inicio: new Date().toISOString(),
      prazoMs: 20 * 60_000,
    },
    "check_task"
  );
  assert.match(texto, /tarefa-3/);
  assert.match(texto, /codex/);
  assert.match(texto, /check_task/);
  assert.match(texto, /20 minutos/);
  assert.match(texto, /looping/);
});
