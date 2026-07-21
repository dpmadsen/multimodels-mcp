// Testes da fila por provedor: usam marcadores de início/fim empurrados
// numa lista, na ordem em que realmente acontecem, pra provar que a
// serialização (ou a falta dela) funciona de verdade — e não só "parece"
// funcionar por causa da ordem de chamadas no código.
import { test } from "node:test";
import assert from "node:assert/strict";
import { naFila } from "./fila.js";

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("com limite 1, a segunda chamada só começa depois que a primeira termina", async () => {
  const eventos: string[] = [];

  function tarefa(nome: string, ms: number) {
    return naFila("chave-serial", 1, async () => {
      eventos.push(`inicio-${nome}`);
      await esperar(ms);
      eventos.push(`fim-${nome}`);
      return nome;
    });
  }

  // B é mais rápida que A, mas como as duas disputam a mesma chave com
  // limite 1, B não pode "furar a fila": tem que esperar A terminar.
  const [a, b] = await Promise.all([tarefa("A", 40), tarefa("B", 10)]);

  assert.equal(a, "A");
  assert.equal(b, "B");
  assert.deepEqual(eventos, ["inicio-A", "fim-A", "inicio-B", "fim-B"]);
});

test("sem limite (undefined), as chamadas rodam em paralelo", async () => {
  const eventos: string[] = [];

  function tarefa(nome: string, ms: number) {
    return naFila("chave-paralela", undefined, async () => {
      eventos.push(`inicio-${nome}`);
      await esperar(ms);
      eventos.push(`fim-${nome}`);
      return nome;
    });
  }

  await Promise.all([tarefa("A", 40), tarefa("B", 10)]);

  // Sem fila, as duas começam antes de qualquer uma terminar (senão B, que
  // é mais rápida, teria que esperar A como no teste anterior).
  assert.deepEqual(eventos.slice(0, 2).sort(), ["inicio-A", "inicio-B"]);
});

test("chaves diferentes não se bloqueiam mesmo com limite", async () => {
  const eventos: string[] = [];

  function tarefa(chave: string, nome: string, ms: number) {
    return naFila(chave, 1, async () => {
      eventos.push(`inicio-${nome}`);
      await esperar(ms);
      eventos.push(`fim-${nome}`);
      return nome;
    });
  }

  await Promise.all([tarefa("chave-1", "A", 40), tarefa("chave-2", "B", 10)]);

  // Chaves diferentes = filas diferentes: A não segura B.
  assert.deepEqual(eventos.slice(0, 2).sort(), ["inicio-A", "inicio-B"]);
});

test("com limite 1, uma terceira chamada espera a vez depois das duas primeiras", async () => {
  const eventos: string[] = [];

  function tarefa(nome: string, ms: number) {
    return naFila("chave-tres", 1, async () => {
      eventos.push(`inicio-${nome}`);
      await esperar(ms);
      eventos.push(`fim-${nome}`);
      return nome;
    });
  }

  await Promise.all([tarefa("A", 20), tarefa("B", 20), tarefa("C", 20)]);

  assert.deepEqual(eventos, [
    "inicio-A",
    "fim-A",
    "inicio-B",
    "fim-B",
    "inicio-C",
    "fim-C",
  ]);
});
