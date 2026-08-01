// Testes do motor "com mãos" RODANDO um processo de verdade — só que o
// programa `claude` é um dublê nosso, escrito na hora numa pasta temporária e
// colocado na frente do PATH.
//
// Por que um dublê: estes testes precisam de coisas que o `claude` de verdade
// não faz sob encomenda (morrer de prazo estourado, cuspir mais de 10 MB), e
// rodar o CLI real a cada `npm test` gastaria cota do Daniel à toa. Os eventos
// que o dublê emite seguem o formato REAL, capturado da máquina em 2026-08-01.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runClaudeCli } from "./claude-cli.js";
import { erroComParcial } from "./erro-parcial.js";
import type { ClaudeCliProvider, ModelsConfig } from "../config.js";

// O texto que o dublê "escreve" antes de morrer — é o que tem que sobrar.
const TEXTO_PARCIAL = "Comecei a análise do projeto e já encontrei o primeiro problema:";

// Cria uma pasta com um `claude` de mentira dentro e devolve o caminho dela.
// O modo diz como o dublê deve se comportar.
async function pastaComDuble(modo: "prazo" | "tamanho" | "sucesso" | "sem-result"): Promise<string> {
  const pasta = await mkdtemp(join(tmpdir(), "multimodels-duble-"));
  const script = `#!/usr/bin/env node
const linha = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
// Bastidor que o leitor tem que ignorar sem reclamar.
linha({ type: "system", subtype: "init", cwd: process.cwd() });
linha({ type: "system", subtype: "status", status: "requesting" });
// Uma ida ao modelo que usa uma ferramenta.
linha({ type: "assistant", request_id: "req-1", message: { content: [{ type: "tool_use", name: "Read" }] } });
linha({ type: "user", message: { content: [{ type: "tool_result" }] } });
linha({ type: "stream_event", event: { type: "message_delta", usage: { output_tokens: 40 } } });
// Segunda ida: começa a escrever a resposta, ao vivo.
linha({ type: "assistant", request_id: "req-2", message: { content: [{ type: "tool_use", name: "Grep" }] } });
linha({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: ${JSON.stringify(TEXTO_PARCIAL)} } } });
linha({ type: "stream_event", event: { type: "message_delta", usage: { output_tokens: 20 } } });
const modo = ${JSON.stringify(modo)};
if (modo === "sucesso") {
  linha({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: " e resolvi." } } });
  linha({ type: "result", subtype: "success", is_error: false, result: ${JSON.stringify(TEXTO_PARCIAL)} + " e resolvi.", usage: { output_tokens: 60 } });
  process.exit(0);
}
if (modo === "sem-result") { process.exit(0); }
if (modo === "tamanho") {
  // 12 MB de ruído: passa do teto de 10 MB e o motor tem que cortar.
  const bloco = "x".repeat(1024 * 1024);
  for (let i = 0; i < 12; i++) process.stdout.write(bloco);
}
// Modo "prazo" (e o rabo do "tamanho"): fica vivo até alguém matar.
setTimeout(() => {}, 120000);
`;
  const caminho = join(pasta, "claude");
  await writeFile(caminho, script, "utf8");
  await chmod(caminho, 0o755);
  return pasta;
}

// Roda algo com o dublê na frente do PATH e devolve o PATH ao normal depois.
async function comDuble<T>(
  modo: "prazo" | "tamanho" | "sucesso" | "sem-result",
  fn: () => Promise<T>
): Promise<T> {
  const pasta = await pastaComDuble(modo);
  const pathAntigo = process.env.PATH;
  process.env.PATH = `${pasta}:${pathAntigo ?? ""}`;
  try {
    return await fn();
  } finally {
    if (pathAntigo === undefined) delete process.env.PATH;
    else process.env.PATH = pathAntigo;
  }
}

// Raia de assinatura (sem chave, sem endereço): é a que o Daniel usa de fato, e
// a que não exige nada do .env pra rodar.
function raia(timeoutMinutes: number): ClaudeCliProvider {
  return {
    type: "claude-cli",
    label: "Raia de teste com mãos",
    enabled: true,
    models: ["claude-sonnet-5"],
    maxConcurrent: 1,
    timeoutMinutes,
  };
}

const config: ModelsConfig = { providers: {} };

test("execução que dá certo devolve o texto do evento result", async () => {
  const provider = raia(1);
  const texto = await comDuble("sucesso", () =>
    runClaudeCli(config, provider, "tarefa", undefined, "claude-sonnet-5")
  );
  assert.equal(texto, `${TEXTO_PARCIAL} e resolvi.`);
});

test("o progresso é avisado DURANTE a execução, não só no fim", async () => {
  const provider = raia(1);
  const avisos: Array<{ passos: number; ferramentas: Record<string, number>; tokensSaida: number }> = [];
  const texto = await comDuble("sucesso", () =>
    runClaudeCli(config, provider, "tarefa", undefined, "claude-sonnet-5", undefined, (p) => {
      avisos.push({ ...p, ferramentas: { ...p.ferramentas } });
    })
  );
  assert.ok(avisos.length > 0, "tinha que ter chegado notícia do andamento");
  const ultimo = avisos[avisos.length - 1];
  assert.equal(ultimo.passos, 2, "foram duas idas ao modelo");
  assert.deepEqual(ultimo.ferramentas, { Read: 1, Grep: 1 });
  assert.equal(ultimo.tokensSaida, 60);
  assert.equal(texto, `${TEXTO_PARCIAL} e resolvi.`);
});

test("morte por PRAZO guarda o texto parcial junto do erro", async () => {
  // Prazo minúsculo: o dublê escreve, e o motor mata antes de qualquer result.
  const provider = raia(0.01); // 600 ms
  await comDuble("prazo", async () => {
    await assert.rejects(
      runClaudeCli(config, provider, "tarefa", undefined, "claude-sonnet-5"),
      (err: Error) => {
        // A mensagem amigável de sempre continua lá.
        assert.match(err.message, /passou de .* minutos e foi interrompido/);
        // E agora o trabalho não virou zero.
        const sobrou = erroComParcial(err);
        assert.ok(sobrou, "o erro tinha que trazer o parcial junto");
        assert.equal(sobrou.parcial, TEXTO_PARCIAL);
        assert.equal(sobrou.progresso.passos, 2);
        assert.deepEqual(sobrou.progresso.ferramentas, { Read: 1, Grep: 1 });
        return true;
      }
    );
  });
});

test("morte por TAMANHO (mais de 10 MB) também guarda o texto parcial", async () => {
  const provider = raia(2); // prazo folgado: quem tem que matar é o teto de tamanho
  await comDuble("tamanho", async () => {
    await assert.rejects(
      runClaudeCli(config, provider, "tarefa", undefined, "claude-sonnet-5"),
      (err: Error) => {
        assert.match(err.message, /passou de 10 MB e foi interrompida/);
        const sobrou = erroComParcial(err);
        assert.ok(sobrou, "o erro tinha que trazer o parcial junto");
        assert.equal(sobrou.parcial, TEXTO_PARCIAL);
        return true;
      }
    );
  });
});

test("stream que acaba sem evento de resultado dá erro amigável em português", async () => {
  const provider = raia(1);
  await comDuble("sem-result", async () => {
    await assert.rejects(
      runClaudeCli(config, provider, "tarefa", undefined, "claude-sonnet-5"),
      (err: Error) => {
        assert.match(err.message, /terminou sem deixar uma resposta final/);
        assert.match(err.message, /Raia de teste com mãos/);
        return true;
      }
    );
  });
});

test("um ouvinte de progresso que dá erro NÃO derruba a delegação", async () => {
  const provider = raia(1);
  const texto = await comDuble("sucesso", () =>
    runClaudeCli(config, provider, "tarefa", undefined, "claude-sonnet-5", undefined, () => {
      throw new Error("quem escuta o progresso quebrou");
    })
  );
  // A resposta chega igual: anotar o andamento é um extra, nunca um risco.
  assert.equal(texto, `${TEXTO_PARCIAL} e resolvi.`);
});
