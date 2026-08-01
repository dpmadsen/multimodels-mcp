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
import { ErroComParcial } from "../providers/erro-parcial.js";

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

// --- Andamento e texto parcial (0.12.0) ---

test("o andamento avisado pelo motor é anotado no papelzinho", async () => {
  const pasta = await pastaNova();
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: async (aoProgredir) => {
      aoProgredir?.({ passos: 1, ferramentas: { Read: 1 }, tokensSaida: 30 });
      return "terminou";
    },
  });
  await concluida;
  const lida = await lerTarefa(pasta, tarefa.id);
  assert.equal(lida?.estado, "pronta");
  assert.equal(lida?.progresso?.passos, 1);
  assert.deepEqual(lida?.progresso?.ferramentas, { Read: 1 });
  assert.equal(lida?.progresso?.tokensSaida, 30);
});

test("dá pra ver o andamento ENQUANTO a tarefa ainda roda", async () => {
  const pasta = await pastaNova();
  let liberar: () => void = () => {};
  const presa = new Promise<string>((resolve) => { liberar = () => resolve("fim"); });
  let avisar: ((s: { passos: number; ferramentas: Record<string, number>; tokensSaida: number }) => void) | undefined;
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: (aoProgredir) => { avisar = aoProgredir; return presa; },
  });
  avisar?.({ passos: 2, ferramentas: { Grep: 4 }, tokensSaida: 111 });
  // Espera a gravação do andamento chegar ao disco sem terminar a tarefa.
  for (let i = 0; i < 50; i++) {
    if ((await lerTarefa(pasta, tarefa.id))?.progresso) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  const noMeio = await lerTarefa(pasta, tarefa.id);
  assert.equal(noMeio?.estado, "rodando", "a tarefa ainda não acabou");
  assert.equal(noMeio?.progresso?.passos, 2, "e já dá pra saber o que ela andou fazendo");
  assert.deepEqual(noMeio?.progresso?.ferramentas, { Grep: 4 });
  liberar();
  await concluida;
});

test("aviso que chega logo depois do outro NÃO é gravado na hora", async () => {
  // Prova, no caminho real da execução, que o disco não apanha a cada evento:
  // o primeiro aviso entra na hora; os seguintes, dentro da janela de 3
  // segundos, ficam esperando — e só o último entra, no fim.
  const pasta = await pastaNova();
  let liberar: () => void = () => {};
  const presa = new Promise<string>((resolve) => { liberar = () => resolve("fim"); });
  type Aviso = { passos: number; ferramentas: Record<string, number>; tokensSaida: number };
  let avisar: ((s: Aviso) => void) | undefined;
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: (aoProgredir) => { avisar = aoProgredir; return presa; },
  });

  avisar?.({ passos: 1, ferramentas: {}, tokensSaida: 10 });
  for (let i = 0; i < 50; i++) {
    if ((await lerTarefa(pasta, tarefa.id))?.progresso) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal((await lerTarefa(pasta, tarefa.id))?.progresso?.passos, 1, "o primeiro aviso entra na hora");

  // Mais 300 avisos em seguida, todos dentro da janela.
  for (let i = 2; i <= 301; i++) avisar?.({ passos: i, ferramentas: {}, tokensSaida: i * 10 });
  // Dá tempo de sobra pra qualquer gravação solta chegar ao disco.
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(
    (await lerTarefa(pasta, tarefa.id))?.progresso?.passos,
    1,
    "os 300 avisos seguintes NÃO podem ter ido pro disco um a um"
  );

  liberar();
  await concluida;
  // E no fim nada se perdeu: o último valor está lá.
  assert.equal((await lerTarefa(pasta, tarefa.id))?.progresso?.passos, 301, "a última notícia sempre entra");
});

test("morte com parcial: o rascunho é guardado junto do erro", async () => {
  const pasta = await pastaNova();
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: async () => {
      throw new ErroComParcial("passou de 20 minutos e foi interrompido.", "metade do relatório", {
        passos: 4,
        ferramentas: { Read: 2 },
        tokensSaida: 900,
      });
    },
  });
  await concluida;
  const lida = await lerTarefa(pasta, tarefa.id);
  assert.equal(lida?.estado, "erro");
  assert.match(lida?.erro ?? "", /passou de 20 minutos/);
  assert.equal(lida?.parcial, "metade do relatório");
  assert.equal(lida?.resultado, undefined, "rascunho jamais vira resultado");
});

test("erro comum (sem rascunho) continua sem campo de parcial", async () => {
  const pasta = await pastaNova();
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: async () => { throw new Error("o provedor devolveu 500"); },
  });
  await concluida;
  const lida = await lerTarefa(pasta, tarefa.id);
  assert.equal(lida?.estado, "erro");
  assert.equal(lida?.parcial, undefined);
});

test("motor que não sabe dar notícia continua funcionando igual", async () => {
  // As raias de API e o Codex ignoram o parâmetro: nada pode mudar pra elas.
  const pasta = await pastaNova();
  const { tarefa, concluida } = await dispararEmSegundoPlano({
    pasta,
    ...base,
    executar: async () => "resposta sem andamento",
  });
  await concluida;
  const lida = await lerTarefa(pasta, tarefa.id);
  assert.equal(lida?.estado, "pronta");
  assert.equal(lida?.resultado, "resposta sem andamento");
  assert.equal(lida?.progresso, undefined);
});
