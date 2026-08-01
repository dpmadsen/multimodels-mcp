// Testes do limitador de gravação: ele existe pra o andamento não virar uma
// martelada de gravações em disco.
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarLimitador } from "./limitador.js";

// Relógio de mentira: assim o teste não depende de esperar de verdade.
function relogioFalso(): { agora: () => number; avancar: (ms: number) => void } {
  let t = 1_000_000;
  return { agora: () => t, avancar: (ms) => { t += ms; } };
}

test("a primeira notícia é gravada na hora", async () => {
  const relogio = relogioFalso();
  const gravados: number[] = [];
  const limitador = criarLimitador<number>(3000, async (v) => { gravados.push(v); }, relogio.agora);
  limitador.registrar(1);
  await limitador.finalizar();
  assert.deepEqual(gravados, [1]);
});

test("cem eventos seguidos NÃO viram cem gravações", async () => {
  const relogio = relogioFalso();
  const gravados: number[] = [];
  const limitador = criarLimitador<number>(3000, async (v) => { gravados.push(v); }, relogio.agora);
  // Cem eventos chegando praticamente juntos (10 ms entre um e outro).
  for (let i = 1; i <= 100; i++) {
    limitador.registrar(i);
    relogio.avancar(10);
  }
  await limitador.finalizar();
  // Um segundo inteiro se passou (100 × 10 ms), menos que a janela de 3 s:
  // a primeira gravação + a do fim. Nada de cem.
  assert.equal(gravados.length, 2, `gravou ${gravados.length} vezes; era pra ser 2`);
  assert.equal(gravados[0], 1, "a primeira notícia entra na hora");
  assert.equal(gravados[1], 100, "a última notícia nunca se perde");
});

test("passada a janela, uma nova gravação é liberada", async () => {
  const relogio = relogioFalso();
  const gravados: number[] = [];
  const limitador = criarLimitador<number>(3000, async (v) => { gravados.push(v); }, relogio.agora);
  limitador.registrar(1);
  relogio.avancar(3000);
  limitador.registrar(2);
  relogio.avancar(3000);
  limitador.registrar(3);
  await limitador.finalizar();
  assert.deepEqual(gravados, [1, 2, 3]);
});

test("o valor pendente é sempre o mais recente (o velho é descartado)", async () => {
  const relogio = relogioFalso();
  const gravados: number[] = [];
  const limitador = criarLimitador<number>(3000, async (v) => { gravados.push(v); }, relogio.agora);
  limitador.registrar(1); // grava na hora
  limitador.registrar(2); // fica pendente
  limitador.registrar(3); // substitui o pendente
  limitador.registrar(4); // substitui de novo
  await limitador.finalizar();
  assert.deepEqual(gravados, [1, 4]);
});

test("finalizar sem nada pendente não grava de novo", async () => {
  const relogio = relogioFalso();
  const gravados: number[] = [];
  const limitador = criarLimitador<number>(3000, async (v) => { gravados.push(v); }, relogio.agora);
  limitador.registrar(1);
  await limitador.finalizar();
  await limitador.finalizar();
  assert.deepEqual(gravados, [1]);
});

test("gravação que falha NÃO derruba o processo (nem escapa como promessa solta)", async () => {
  const relogio = relogioFalso();
  const escapadas: unknown[] = [];
  const vigia = (motivo: unknown) => escapadas.push(motivo);
  process.on("unhandledRejection", vigia);
  try {
    const limitador = criarLimitador<number>(3000, async () => {
      throw new Error("o disco encheu");
    }, relogio.agora);
    limitador.registrar(1);
    relogio.avancar(3000);
    limitador.registrar(2);
    await limitador.finalizar(); // não pode rejeitar
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(escapadas, [], "nenhuma promessa pode escapar sem tratamento");
  } finally {
    process.off("unhandledRejection", vigia);
  }
});

test("as gravações saem em ordem, uma esperando a outra", async () => {
  const relogio = relogioFalso();
  const ordem: string[] = [];
  const limitador = criarLimitador<number>(0, async (v) => {
    ordem.push(`começou ${v}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
    ordem.push(`terminou ${v}`);
  }, relogio.agora);
  limitador.registrar(1);
  limitador.registrar(2);
  await limitador.finalizar();
  // Nunca duas gravações do mesmo arquivo ao mesmo tempo.
  assert.deepEqual(ordem, ["começou 1", "terminou 1", "começou 2", "terminou 2"]);
});
