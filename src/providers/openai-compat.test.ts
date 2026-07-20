// Testes da tomada universal (padrão OpenAI), com foco nos modelos de
// raciocínio: resposta cortada por limite, resposta só com "pensamento",
// e envio do max_tokens na requisição.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseChatResponse,
  chatCompletion,
  DEFAULT_MAX_TOKENS,
} from "./openai-compat.js";
import type { OpenAICompatProvider } from "../config.js";

test("resposta normal devolve o texto e descarta o raciocínio", () => {
  const result = parseChatResponse(
    {
      choices: [
        {
          finish_reason: "stop",
          message: { content: "Resposta final.", reasoning_content: "pensando..." },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    },
    "LM Studio (local)",
    "qwen/teste"
  );
  assert.equal(result.text, "Resposta final.");
  assert.equal(result.truncated, false);
  assert.equal(result.usage?.completion_tokens, 20);
});

test("resposta cortada por limite vem marcada como truncada", () => {
  const result = parseChatResponse(
    {
      choices: [{ finish_reason: "length", message: { content: "Começou a responder mas..." } }],
    },
    "LM Studio (local)",
    "qwen/teste"
  );
  assert.equal(result.truncated, true);
  assert.equal(result.text, "Começou a responder mas...");
});

test("só raciocínio + corte por limite dá erro explicando o limite", () => {
  assert.throws(
    () =>
      parseChatResponse(
        {
          choices: [
            {
              finish_reason: "length",
              message: { content: "", reasoning_content: "pensando sem parar..." },
            },
          ],
        },
        "LM Studio (local)",
        "qwen/teste"
      ),
    /gastou todo o limite de tamanho só "pensando"/
  );
});

test("só raciocínio sem corte dá erro pedindo pra tentar de novo", () => {
  assert.throws(
    () =>
      parseChatResponse(
        {
          choices: [
            { finish_reason: "stop", message: { content: null, reasoning_content: "hmm..." } },
          ],
        },
        "LM Studio (local)",
        "qwen/teste"
      ),
    /apenas o raciocínio interno/
  );
});

test("campo 'reasoning' (estilo OpenRouter) também é reconhecido", () => {
  assert.throws(
    () =>
      parseChatResponse(
        {
          choices: [{ finish_reason: "length", message: { content: "", reasoning: "pensando..." } }],
        },
        "OpenRouter",
        "modelo/teste"
      ),
    /gastou todo o limite/
  );
});

test("resposta vazia sem raciocínio mantém o erro antigo", () => {
  assert.throws(
    () => parseChatResponse({ choices: [{ message: { content: "" } }] }, "DeepSeek", "x"),
    /sem texto na resposta/
  );
});

test("falha de conexão em instância da rede explica o 'Serve on Local Network'", async () => {
  // Endereço de loopback que não é "localhost" nem "127.0.0.1": conexão
  // recusada na hora, mas tratada como máquina da rede.
  const provider: OpenAICompatProvider = {
    type: "openai-compat",
    label: "LM Studio (rede)",
    baseUrl: "http://127.0.0.99:9/v1",
    enabled: true,
    models: ["m"],
  };
  await assert.rejects(chatCompletion(provider, "m", "oi"), /Serve on Local Network/);
});

test("falha de conexão na instância local sugere ligar o servidor do LM Studio", async () => {
  const provider: OpenAICompatProvider = {
    type: "openai-compat",
    label: "LM Studio (local)",
    baseUrl: "http://127.0.0.1:9/v1",
    enabled: true,
    models: ["m"],
  };
  await assert.rejects(chatCompletion(provider, "m", "oi"), /lms server start/);
});

test("a requisição envia max_tokens (padrão e configurado)", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }),
      { status: 200 }
    );
  }) as typeof fetch;

  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "Fake",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["m"],
    };
    await chatCompletion(provider, "m", "oi");
    assert.equal(bodies[0].max_tokens, DEFAULT_MAX_TOKENS);

    await chatCompletion({ ...provider, maxTokens: 8000 }, "m", "oi");
    assert.equal(bodies[1].max_tokens, 8000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
