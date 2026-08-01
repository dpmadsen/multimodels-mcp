// Testes dos textos da ferramenta check_task (as funções puras: só montam
// frases a partir de uma tarefa, sem tocar em disco nem em modelo nenhum).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { TarefaApresentada } from "../tarefas/deposito.js";
import {
  duracaoEmTexto,
  ferramentasEmTexto,
  textoDaLista,
  textoDaTarefa,
  textoDeIdDesconhecido,
  textoDoProgresso,
} from "./check-task.js";

function tarefa(extra: Partial<TarefaApresentada> = {}): TarefaApresentada {
  return {
    id: "tarefa-1",
    estado: "rodando",
    modelo: "deepseek:deepseek-chat",
    resumo: "Resuma o relatório",
    inicio: "2026-08-01T10:00:00.000Z",
    prazoMs: 15 * 60_000,
    provavelmenteInterrompida: false,
    ...extra,
  };
}

const agora = new Date("2026-08-01T10:05:00.000Z");

test("tarefa pronta devolve o resultado inteiro, com o rodapé", () => {
  const texto = textoDaTarefa(
    tarefa({
      estado: "pronta",
      resultado: "a resposta\n\n[resposta de: DeepSeek · deepseek-chat]",
      fim: "2026-08-01T10:03:00.000Z",
    }),
    agora
  );
  assert.match(texto, /a resposta/);
  assert.match(texto, /\[resposta de: DeepSeek · deepseek-chat\]/);
  assert.match(texto, /levou 3 minutos/);
});

test("duração curta aparece em segundos, não em '0 minutos'", () => {
  assert.equal(duracaoEmTexto(3_000), "3 segundos");
  assert.equal(duracaoEmTexto(1_000), "1 segundo");
  assert.equal(duracaoEmTexto(90_000), "2 minutos");
  const texto = textoDaTarefa(
    tarefa({ estado: "pronta", resultado: "pronto", fim: "2026-08-01T10:00:04.000Z" }),
    agora
  );
  assert.match(texto, /levou 4 segundos/);
});

test("tarefa rodando diz há quanto tempo e pede pra não consultar em looping", () => {
  const texto = textoDaTarefa(tarefa(), agora);
  assert.match(texto, /ainda está rodando/);
  assert.match(texto, /faz 5 minutos/);
  assert.match(texto, /até 15 minutos/);
  assert.match(texto, /não fique consultando em looping/);
});

test("tarefa com erro mostra o motivo", () => {
  const texto = textoDaTarefa(tarefa({ estado: "erro", erro: "provedor fora do ar" }), agora);
  assert.match(texto, /terminou com erro/);
  assert.match(texto, /provedor fora do ar/);
});

test("tarefa órfã é apresentada como provavelmente interrompida", () => {
  const texto = textoDaTarefa(tarefa({ provavelmenteInterrompida: true }), new Date("2026-08-01T10:20:00.000Z"));
  assert.match(texto, /provavelmente interrompida/);
  assert.match(texto, /a sessão que iniciou essa tarefa foi fechada/);
});

test("a lista vem com id, estado, modelo e resumo", () => {
  const texto = textoDaLista([
    tarefa({ id: "tarefa-2", estado: "pronta", resumo: "Traduza o texto" }),
    tarefa({ id: "tarefa-1" }),
  ]);
  assert.match(texto, /- tarefa-2 · pronta · deepseek:deepseek-chat · Traduza o texto/);
  assert.match(texto, /- tarefa-1 · rodando · deepseek:deepseek-chat · Resuma o relatório/);
  // A mais recente é a que aparece no exemplo do rodapé.
  assert.match(texto, /ex\.: "tarefa-2"/);
});

test("a lista mostra o aviso de órfã no lugar do estado", () => {
  const texto = textoDaLista([tarefa({ provavelmenteInterrompida: true })]);
  assert.match(texto, /provavelmente interrompida/);
});

test("lista vazia explica em vez de vir em branco", () => {
  assert.match(textoDaLista([]), /Nenhuma tarefa registrada ainda/);
});

test("id desconhecido explica o que fazer", () => {
  const texto = textoDeIdDesconhecido("tarefa-99");
  assert.match(texto, /tarefa-99/);
  assert.match(texto, /50 mais recentes/);
  assert.match(texto, /sem id/);
});

// --- Sinais de andamento e texto parcial (0.12.0) ---

const progressoDeExemplo = {
  passos: 3,
  ferramentas: { Read: 2, Grep: 1 },
  tokensSaida: 1840,
  atualizadoEm: "2026-08-01T10:04:00.000Z",
};

test("tarefa rodando mostra passos, ferramentas e tokens", () => {
  const texto = textoDaTarefa(tarefa({ progresso: progressoDeExemplo }), agora);
  assert.match(texto, /ainda está rodando/);
  assert.match(texto, /3 passos/);
  assert.match(texto, /Read 2×/);
  assert.match(texto, /Grep/);
  assert.match(texto, /1840 tokens escritos/);
  // O pedido de não ficar consultando em looping continua lá.
  assert.match(texto, /não fique consultando em looping/);
});

test("ferramenta usada uma vez sai sem o 'vezes'", () => {
  assert.equal(ferramentasEmTexto({ Read: 1 }), "Read");
  assert.equal(ferramentasEmTexto({ Read: 2, Grep: 1 }), "Read 2×, Grep");
  assert.equal(ferramentasEmTexto({}), "nenhuma ainda");
});

test("tarefa rodando sem notícia explica que aquela raia não manda sinal", () => {
  const texto = textoDaTarefa(tarefa(), agora);
  assert.match(texto, /Ainda não chegou notícia do andamento/);
  assert.match(texto, /com mãos/);
});

test("um passo só sai no singular", () => {
  const texto = textoDoProgresso(
    tarefa({ progresso: { ...progressoDeExemplo, passos: 1 } })
  );
  assert.match(texto, /1 passo /);
  assert.doesNotMatch(texto, /1 passos/);
});

test("tarefa órfã também mostra o quanto tinha andado", () => {
  const texto = textoDaTarefa(
    tarefa({ provavelmenteInterrompida: true, progresso: progressoDeExemplo }),
    new Date("2026-08-01T10:20:00.000Z")
  );
  assert.match(texto, /provavelmente interrompida/);
  assert.match(texto, /3 passos/);
});

test("tarefa com rascunho mostra o texto CERCADO de aviso de incompleto", () => {
  const texto = textoDaTarefa(
    tarefa({ estado: "erro", erro: "passou de 20 minutos", parcial: "Comecei o relatório e" }),
    agora
  );
  assert.match(texto, /terminou com erro/);
  assert.match(texto, /Comecei o relatório e/);
  // O aviso aparece ANTES e DEPOIS do rascunho.
  const avisos = texto.match(/INCOMPLETO/g) ?? [];
  assert.equal(avisos.length, 2, "o aviso tem que cercar o rascunho dos dois lados");
  assert.match(texto, /NÃO é a resposta final/);
  assert.match(texto, /delegue a tarefa de novo/);
  // E o rascunho tem começo e fim marcados, pra não se misturar com o resto.
  assert.match(texto, /rascunho incompleto \(tarefa-1\), início/);
  assert.match(texto, /rascunho incompleto \(tarefa-1\), fim/);
});

test("tarefa com erro SEM rascunho não inventa aviso de incompleto", () => {
  const texto = textoDaTarefa(tarefa({ estado: "erro", erro: "provedor fora do ar" }), agora);
  assert.doesNotMatch(texto, /INCOMPLETO/);
  assert.doesNotMatch(texto, /rascunho/);
});

test("tarefa pronta NUNCA ganha aviso de incompleto", () => {
  const texto = textoDaTarefa(
    tarefa({ estado: "pronta", resultado: "a resposta boa", fim: "2026-08-01T10:03:00.000Z" }),
    agora
  );
  assert.match(texto, /a resposta boa/);
  assert.doesNotMatch(texto, /INCOMPLETO/);
});

test("a lista avisa quando um erro deixou rascunho", () => {
  const texto = textoDaLista([
    tarefa({ id: "tarefa-2", estado: "erro", parcial: "meio caminho" }),
    tarefa({ id: "tarefa-1", estado: "erro" }),
  ]);
  assert.match(texto, /- tarefa-2 · erro \(com rascunho incompleto\)/);
  assert.match(texto, /- tarefa-1 · erro · /);
});
