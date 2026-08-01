// Testes do leitor do stream do `claude`.
//
// O material NÃO é inventado: `claude-stream.fixture.jsonl` é um stream de
// verdade, capturado nesta máquina em 2026-08-01 rodando o CLI com
// `--output-format stream-json --include-partial-messages --verbose`. Só duas
// coisas foram encurtadas nele: as assinaturas criptográficas dos blocos de
// raciocínio (base64 gigante que o leitor ignora) e o miolo dos eventos de
// bastidor (system/user). Todos os eventos "assistant", "stream_event" e o
// "result" estão exatamente como saíram do programa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "../config.js";
import {
  ESTADO_INICIAL,
  consumirLinha,
  consumirPedaco,
  extrairResultado,
  finalizar,
  lerStreamInteiro,
  progressoDoEstado,
  textoAcumulado,
} from "./claude-stream.js";

const FIXTURE = readFileSync(
  join(projectRoot, "src", "providers", "claude-stream.fixture.jsonl"),
  "utf8"
);

// O texto que o `claude` de verdade devolveu naquela execução.
const TEXTO_FINAL_ESPERADO =
  'A palavra "spawn" não aparece em `fila.ts` — só em codex.ts, gemini.ts e claude-cli.ts ' +
  "(onde os processos externos são de fato chamados).\n\n" +
  "Sobre `fila.ts`: ele limita quantas chamadas simultâneas cada provedor pode receber por vez, " +
  'usando uma "chave" (a baseUrl do provedor) para separar os limites — enquanto os "balcões" ' +
  "disponíveis daquele provedor estiverem todos ocupados, quem chega espera numa fila em ordem " +
  "de chegada. Isso existe porque alguns provedores (z.ai, LM Studio) engasgam ou derrubam a " +
  "conexão se receberem duas chamadas ao mesmo tempo.";

// ---------------------------------------------------------------------------
// O ponto mais perigoso da versão: o texto final NÃO pode ter mudado.
// ---------------------------------------------------------------------------

// Esta é a CÓPIA FIEL do jeito antigo de ler (0.11.0): um documento JSON só,
// com o texto no campo "result". Ela fica aqui de propósito, como testemunha:
// enquanto o leitor novo concordar com ela, o Daniel recebe exatamente o mesmo
// texto de antes. Se alguém mudar o leitor e o texto sair diferente, este teste
// quebra.
function extrairResultadoDoJeitoAntigo(stdout: string, stderr: string, code: number | null, label: string): string {
  const bruto = stdout.trim();
  if (!bruto) {
    throw new Error(
      `O ${label} terminou sem produzir saída (código ${code ?? "?"}). Detalhe: ${stderr.slice(-500) || "(sem detalhes)"}`
    );
  }
  let dados: { result?: string; is_error?: boolean; subtype?: string; error?: string };
  try {
    dados = JSON.parse(bruto);
  } catch {
    throw new Error(
      `Não entendi a resposta do ${label} (esperava um JSON). Detalhe: ${stderr.slice(-500) || bruto.slice(-500)}`
    );
  }
  if (dados.is_error || (dados.subtype && dados.subtype !== "success")) {
    const motivo = dados.error || dados.result || stderr.slice(-500) || "(sem detalhes)";
    throw new Error(`O ${label} terminou com erro. Detalhe: ${motivo}`);
  }
  const message = (dados.result ?? "").trim();
  if (!message) {
    throw new Error(`O ${label} terminou sem deixar uma resposta final. Detalhe: ${stderr.slice(-500) || "(sem detalhes)"}`);
  }
  return message;
}

// A linha do evento "result" é, sozinha, exatamente o documento que o
// `--output-format json` devolvia antes (conferido: o conjunto de chaves é
// idêntico). Por isso ela serve de entrada pros dois jeitos de ler.
const LINHA_DO_RESULT = FIXTURE.split("\n")
  .filter(Boolean)
  .find((linha) => (JSON.parse(linha) as { type?: string }).type === "result")!;

test("o texto final entregue é IDÊNTICO ao do formato antigo", () => {
  const pelaFormaNova = extrairResultado(lerStreamInteiro(FIXTURE), FIXTURE, "", 0, "Raia de teste");
  const pelaFormaAntiga = extrairResultadoDoJeitoAntigo(LINHA_DO_RESULT, "", 0, "Raia de teste");
  assert.equal(pelaFormaNova, pelaFormaAntiga, "ler por stream não pode mudar o texto entregue");
  // E é mesmo o texto que o modelo escreveu, caractere por caractere.
  assert.equal(pelaFormaNova, TEXTO_FINAL_ESPERADO);
});

test("o evento result do stream tem o MESMO formato do documento antigo", () => {
  const evento = JSON.parse(LINHA_DO_RESULT) as Record<string, unknown>;
  // Os quatro campos de que a extração depende continuam lá, com os mesmos nomes.
  for (const campo of ["result", "is_error", "subtype", "type"]) {
    assert.ok(campo in evento, `o campo "${campo}" precisa existir no evento result`);
  }
  assert.equal(evento.type, "result");
  assert.equal(evento.subtype, "success");
});

// ---------------------------------------------------------------------------
// Robustez: nada de estranho no stream pode derrubar a raia.
// ---------------------------------------------------------------------------

test("evento de tipo desconhecido é ignorado em silêncio", () => {
  const inventado = JSON.stringify({
    type: "tipo_que_ainda_nao_existe",
    campo_novo: { seja_o_que_for: [1, 2, 3] },
  });
  const comLixo = `${inventado}\n${FIXTURE}\n${inventado}`;
  const estado = lerStreamInteiro(comLixo);
  assert.equal(extrairResultado(estado, comLixo, "", 0, "Raia"), TEXTO_FINAL_ESPERADO);
  // E não contaminou nenhum sinal.
  assert.deepEqual(progressoDoEstado(estado), progressoDoEstado(lerStreamInteiro(FIXTURE)));
});

test("linha que não é JSON válido é ignorada, não explode", () => {
  const ruido = ["isto não é json", "{quebrado", "", "   ", "<html>erro do proxy</html>"].join("\n");
  const comRuido = `${ruido}\n${FIXTURE}`;
  const estado = lerStreamInteiro(comRuido);
  assert.equal(extrairResultado(estado, comRuido, "", 0, "Raia"), TEXTO_FINAL_ESPERADO);
});

test("JSON válido que não é objeto (número, texto, lista) também é ignorado", () => {
  const estado = lerStreamInteiro(`42\n"um texto"\n[1,2,3]\nnull\n${FIXTURE}`);
  assert.equal(estado.resultado?.result, TEXTO_FINAL_ESPERADO);
});

test("evento sem os campos esperados não quebra o leitor", () => {
  const capengas = [
    JSON.stringify({ type: "assistant" }),
    JSON.stringify({ type: "assistant", message: { content: "não é lista" } }),
    JSON.stringify({ type: "assistant", message: { content: [null, 7, { type: "tool_use" }] } }),
    JSON.stringify({ type: "stream_event" }),
    JSON.stringify({ type: "stream_event", event: { type: "message_delta" } }),
    JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: {} } }),
  ].join("\n");
  const estado = lerStreamInteiro(capengas);
  // Nenhuma exceção, e nada de lixo nos números.
  assert.equal(progressoDoEstado(estado).tokensSaida, 0);
  assert.deepEqual(progressoDoEstado(estado).ferramentas, {});
});

test("stream sem evento de resultado dá erro amigável em português", () => {
  // Tiramos justamente a última linha (o "result").
  const semResultado = FIXTURE.split("\n")
    .filter(Boolean)
    .filter((linha) => (JSON.parse(linha) as { type?: string }).type !== "result")
    .join("\n");
  assert.throws(
    () => extrairResultado(lerStreamInteiro(semResultado), semResultado, "", 1, "Claude com mãos"),
    (err: Error) => {
      assert.match(err.message, /terminou sem deixar uma resposta final/);
      assert.match(err.message, /Claude com mãos/);
      return true;
    }
  );
});

test("stdout completamente vazio continua com a mensagem de sempre", () => {
  assert.throws(
    () => extrairResultado(ESTADO_INICIAL, "", "detalhe do stderr", 2, "Claude com mãos"),
    (err: Error) => {
      assert.match(err.message, /terminou sem produzir saída \(código 2\)/);
      assert.match(err.message, /detalhe do stderr/);
      return true;
    }
  );
});

test("result marcado como erro vira a mensagem de erro de sempre", () => {
  const linha = JSON.stringify({ type: "result", subtype: "error", is_error: true, error: "Not logged in · Please run /login" });
  assert.throws(
    () => extrairResultado(lerStreamInteiro(linha), linha, "", 1, "Claude com mãos"),
    (err: Error) => {
      assert.match(err.message, /O Claude com mãos terminou com erro/);
      assert.match(err.message, /Not logged in/);
      return true;
    }
  );
});

test("result com texto vazio dá 'sem deixar uma resposta final'", () => {
  const linha = JSON.stringify({ type: "result", subtype: "success", result: "   " });
  assert.throws(
    () => extrairResultado(lerStreamInteiro(linha), linha, "", 0, "Raia"),
    (err: Error) => {
      assert.match(err.message, /sem deixar uma resposta final/);
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// Os sinais de progresso, tirados do stream de verdade.
// ---------------------------------------------------------------------------

test("passos, ferramentas e tokens saem certos do stream capturado", () => {
  const progresso = progressoDoEstado(lerStreamInteiro(FIXTURE));
  // Três idas ao modelo: o CLI manda vários eventos "assistant" por ida (um por
  // bloco), e eles são agrupados pelo request_id — contar eventos daria 5.
  assert.equal(progresso.passos, 3);
  // Foi exatamente o que a tarefa pediu: listar, procurar e ler.
  assert.deepEqual(progresso.ferramentas, { Glob: 1, Grep: 1, Read: 1 });
  // 695 é o total que o próprio evento "result" declara em usage.output_tokens.
  assert.equal(progresso.tokensSaida, 695);
  const doResult = JSON.parse(LINHA_DO_RESULT) as { usage: { output_tokens: number } };
  assert.equal(progresso.tokensSaida, doResult.usage.output_tokens, "a soma tem que bater com o total oficial");
});

test("a mesma ferramenta usada duas vezes é contada duas vezes", () => {
  const evento = (n: number) =>
    JSON.stringify({
      type: "assistant",
      request_id: `req-${n}`,
      message: { content: [{ type: "tool_use", name: "Read" }] },
    });
  const progresso = progressoDoEstado(lerStreamInteiro(`${evento(1)}\n${evento(2)}\n${evento(2)}`));
  assert.deepEqual(progresso.ferramentas, { Read: 3 });
  // Duas idas ao modelo, apesar dos três eventos: req-2 aparece duas vezes.
  assert.equal(progresso.passos, 2);
});

test("o progresso vai crescendo no meio do caminho (não só no fim)", () => {
  const linhas = FIXTURE.split("\n").filter(Boolean);
  let estado = ESTADO_INICIAL;
  const passosVistos: number[] = [];
  for (const linha of linhas) {
    estado = consumirLinha(estado, linha);
    passosVistos.push(progressoDoEstado(estado).passos);
  }
  // Antes do fim do stream já dava pra saber que havia trabalho acontecendo.
  const naMetade = passosVistos[Math.floor(passosVistos.length / 2)];
  assert.ok(naMetade > 0, "no meio do stream já tem que haver passo contado");
  // E a contagem nunca anda pra trás.
  for (let i = 1; i < passosVistos.length; i++) {
    assert.ok(passosVistos[i] >= passosVistos[i - 1], "o número de passos não pode diminuir");
  }
});

// ---------------------------------------------------------------------------
// O texto acumulado (o que vira PARCIAL quando a tarefa morre).
// ---------------------------------------------------------------------------

test("o texto acumulado reproduz o texto final, caractere por caractere", () => {
  assert.equal(textoAcumulado(lerStreamInteiro(FIXTURE)), TEXTO_FINAL_ESPERADO);
});

test("o texto acumulado no meio do caminho é um pedaço do texto final", () => {
  const linhas = FIXTURE.split("\n").filter(Boolean);
  let estado = ESTADO_INICIAL;
  // Para antes da última linha (o "result"), como se a tarefa tivesse morrido.
  for (const linha of linhas.slice(0, -1)) estado = consumirLinha(estado, linha);
  const parcial = textoAcumulado(estado);
  assert.ok(parcial.length > 0, "tem que sobrar texto");
  assert.ok(TEXTO_FINAL_ESPERADO.startsWith(parcial), "o parcial é o começo da resposta, não outra coisa");
});

test("sem pedacinhos ao vivo, o parcial vem dos blocos já fechados", () => {
  // Simula um CLI que parou de mandar os text_delta: sobram os "assistant".
  const semDeltas = FIXTURE.split("\n")
    .filter(Boolean)
    .filter((linha) => {
      const e = JSON.parse(linha) as { type?: string; event?: { delta?: { type?: string } } };
      return !(e.type === "stream_event" && e.event?.delta?.type === "text_delta");
    })
    .join("\n");
  assert.equal(textoAcumulado(lerStreamInteiro(semDeltas)), TEXTO_FINAL_ESPERADO);
});

test("o texto do raciocínio NUNCA entra no texto acumulado", () => {
  // Decisão do Daniel: o meio do caminho de um modelo que raciocina traz
  // conclusão que ele mesmo revisa depois. O fixture TEM raciocínio; se ele
  // vazasse pro parcial, este teste quebraria.
  const estado = lerStreamInteiro(FIXTURE);
  const temRaciocinioNoFixture = FIXTURE.includes('"thinking_delta"');
  assert.ok(temRaciocinioNoFixture, "o fixture precisa ter raciocínio pra este teste valer");
  assert.equal(textoAcumulado(estado), TEXTO_FINAL_ESPERADO);
});

// ---------------------------------------------------------------------------
// A quebra de linha: o stdout chega em pedaços que não respeitam a linha.
// ---------------------------------------------------------------------------

test("evento partido entre dois pedaços do stdout é remontado", () => {
  // Corta o stream em pedacinhos de 7 caracteres, bem no meio das linhas.
  let estado = ESTADO_INICIAL;
  let sobra = "";
  for (let i = 0; i < FIXTURE.length; i += 7) {
    const passo = consumirPedaco(estado, sobra, FIXTURE.slice(i, i + 7));
    estado = passo.estado;
    sobra = passo.sobra;
  }
  estado = finalizar(estado, sobra);
  assert.equal(extrairResultado(estado, FIXTURE, "", 0, "Raia"), TEXTO_FINAL_ESPERADO);
  assert.equal(progressoDoEstado(estado).tokensSaida, 695);
});

test("última linha sem quebra no fim ainda é lida (processo morto no meio)", () => {
  const semQuebraFinal = FIXTURE.trimEnd();
  const { estado, sobra } = consumirPedaco(ESTADO_INICIAL, "", semQuebraFinal);
  // Sem o finalizar, o "result" ficaria preso na sobra.
  assert.ok(sobra.length > 0, "a última linha deve ficar pendente");
  assert.equal(extrairResultado(finalizar(estado, sobra), semQuebraFinal, "", 0, "Raia"), TEXTO_FINAL_ESPERADO);
});

test("o leitor é puro: consumir uma linha não altera o estado recebido", () => {
  const antes = lerStreamInteiro(FIXTURE);
  const copia = JSON.parse(JSON.stringify(antes));
  consumirLinha(antes, JSON.stringify({ type: "assistant", request_id: "novo", message: { content: [{ type: "tool_use", name: "Bash" }] } }));
  assert.deepEqual(JSON.parse(JSON.stringify(antes)), copia, "o estado antigo não pode ser mexido");
});
