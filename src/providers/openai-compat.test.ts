// Testes da tomada universal (padrão OpenAI), com foco nos modelos de
// raciocínio: resposta cortada por limite, resposta só com "pensamento",
// e envio do max_tokens na requisição.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseChatResponse,
  chatCompletion,
  DEFAULT_MAX_TOKENS,
  lerCorpoLimitado,
} from "./openai-compat.js";
import type { ModelsConfig, OpenAICompatProvider } from "../config.js";

// Cardápio de mentira sem prazo configurado: os testes daqui não são sobre
// prazo, então tudo cai no padrão embutido (10 minutos).
const config: ModelsConfig = { providers: {} };

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
  await assert.rejects(chatCompletion(config, provider, "m", "oi"), /Serve on Local Network/);
});

test("falha de conexão na instância local sugere ligar o servidor do LM Studio", async () => {
  const provider: OpenAICompatProvider = {
    type: "openai-compat",
    label: "LM Studio (local)",
    baseUrl: "http://127.0.0.1:9/v1",
    enabled: true,
    models: ["m"],
  };
  await assert.rejects(chatCompletion(config, provider, "m", "oi"), /lms server start/);
});

// Este grupo protege a renomeação maxTokens -> maxOutputTokens sem mudar o
// contrato wire max_tokens: é só uma dica de saída ao provedor, distinta do
// contextTokens informativo e do maxResponseBytes imposto localmente. Revisar
// requisito, diff, histórico completo, MEMORY.md, plano e docs/test-change-log.md
// antes de alterar ou remover estas asserções (AGENTS.md).
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
    await chatCompletion(config, provider, "m", "oi");
    assert.equal(bodies[0].max_tokens, DEFAULT_MAX_TOKENS);

    await chatCompletion(config, { ...provider, maxOutputTokens: 8000 }, "m", "oi");
    assert.equal(bodies[1].max_tokens, 8000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Protege a fronteira HTTP: redirects nao podem trocar o destino e respostas
// nunca podem ser acumuladas alem do teto. Antes de alterar/remover, conferir
// requisito, diff, historico, MEMORY.md, plano e docs/test-change-log.md.
test("le corpo exatamente no limite e preserva UTF-8 partido entre chunks", async () => {
  const bytes = new TextEncoder().encode("€");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 1));
      controller.enqueue(bytes.slice(1));
      controller.close();
    },
  });
  assert.equal(await lerCorpoLimitado(new Response(body), 3), "€");
});

test("cancela stream quando o corpo passa um byte do limite", async () => {
  let cancelado = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode("abcde")); },
    cancel() { cancelado = true; },
  });
  await assert.rejects(lerCorpoLimitado(new Response(body), 4), /excedeu o limite local de 4 bytes/);
  assert.equal(cancelado, true);
});

test("completion usa redirect manual", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.redirect, "manual");
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
  }) as typeof fetch;
  try {
    const provider: OpenAICompatProvider = { type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"] };
    assert.equal((await chatCompletion(config, provider, "m", "oi")).text, "ok");
  } finally { globalThis.fetch = originalFetch; }
});

test("redirects 302 e 307 falham sem repescagem nem Location", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [302, 307]) {
      let chamadas = 0;
      globalThis.fetch = (async () => {
        chamadas++;
        return new Response("", { status, headers: { Location: "https://private.example/?token=secret" } });
      }) as typeof fetch;
      const provider: OpenAICompatProvider = { type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"] };
      await assert.rejects(chatCompletion(config, provider, "m", "oi"), (err: Error) => {
        assert.match(err.message, new RegExp(String(status)));
        assert.ok(!err.message.includes("private.example"));
        return true;
      });
      assert.equal(chamadas, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("corpos grandes de sucesso ou erro falham sem repescagem", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [200, 500]) {
      let chamadas = 0;
      globalThis.fetch = (async () => {
        chamadas++;
        return new Response("abcde", { status });
      }) as typeof fetch;
      const provider: OpenAICompatProvider = { type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"], maxResponseBytes: 4 };
      await assert.rejects(chatCompletion(config, provider, "m", "oi"), /excedeu o limite local/);
      assert.equal(chamadas, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

// A segunda tentativa tambem e uma fronteira: registrar a rejeicao tipada sem
// expor corpo/Location. Antes de alterar/remover, conferir requisito, diff,
// historico, MEMORY.md, plano e docs/test-change-log.md.
test("retry seguida de redirect registra reject antes do finish, sem terceira tentativa", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const linhas: string[] = [];
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas++;
    return chamadas === 1
      ? new Response("instabilidade", { status: 500 })
      : new Response("", { status: 302, headers: { Location: "https://nao-vazar.test/?secret=1" } });
  }) as typeof fetch;
  console.error = (linha?: unknown) => linhas.push(String(linha));
  try {
    const provider: OpenAICompatProvider = { type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"] };
    await assert.rejects(chatCompletion(config, provider, "m", "oi"), /302/);
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
  const eventos = linhas.filter((linha) => linha.startsWith("{")).map((linha) => JSON.parse(linha) as { event: string; reason?: string; status?: number });
  assert.deepEqual(eventos.map((evento) => evento.event), ["provider.start", "provider.retry", "provider.reject", "provider.finish"]);
  assert.equal(eventos[2].reason, "redirect");
  assert.equal(eventos[2].status, 302);
  assert.equal(chamadas, 2);
  assert.ok(linhas.every((linha) => !linha.includes("nao-vazar.test")));
});

test("retry seguida de corpo grande registra reject de bytes sem terceira tentativa", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const linhas: string[] = [];
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas++;
    return chamadas === 1 ? new Response("instabilidade", { status: 500 }) : new Response("abc".repeat(100));
  }) as typeof fetch;
  console.error = (linha?: unknown) => linhas.push(String(linha));
  try {
    const provider: OpenAICompatProvider = { type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"], maxResponseBytes: 20 };
    await assert.rejects(chatCompletion(config, provider, "m", "oi"), /excedeu o limite local/);
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
  const eventos = linhas.filter((linha) => linha.startsWith("{")).map((linha) => JSON.parse(linha) as { event: string; reason?: string; observedBytes?: number; limitBytes?: number });
  assert.deepEqual(eventos.map((evento) => evento.event), ["provider.start", "provider.retry", "provider.reject", "provider.finish"]);
  assert.equal(eventos[2].reason, "response_bytes");
  assert.equal(eventos[2].observedBytes, 300);
  assert.equal(eventos[2].limitBytes, 20);
  assert.equal(chamadas, 2);
});

// --- Esforço de raciocínio nos provedores openai-compat ---

function fakeFetchOk(bodies: Array<Record<string, unknown>>): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }),
      { status: 200 }
    );
  }) as typeof fetch;
}

test("effortStyle 'openai' manda reasoning_effort no corpo", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = fakeFetchOk(bodies);
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "z.ai (fake)",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["m"],
      effortStyle: "openai",
    };
    await chatCompletion(config, provider, "m", "oi", { effort: "max" });
    assert.equal(bodies[0].reasoning_effort, "max");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("effortStyle 'openrouter' manda reasoning: { effort } no corpo", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = fakeFetchOk(bodies);
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "OpenRouter (fake)",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["m"],
      effortStyle: "openrouter",
    };
    await chatCompletion(config, provider, "m", "oi", { effort: "high" });
    assert.deepEqual(bodies[0].reasoning, { effort: "high" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("defaultEffort é usado quando a delegação não pede esforço, e opts.effort sobrepõe", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = fakeFetchOk(bodies);
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "z.ai (fake)",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["m"],
      effortStyle: "openai",
      defaultEffort: "medium",
    };
    await chatCompletion(config, provider, "m", "oi");
    assert.equal(bodies[0].reasoning_effort, "medium");

    await chatCompletion(config, provider, "m", "oi", { effort: "high" });
    assert.equal(bodies[1].reasoning_effort, "high");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("esforço padrão do MODELO é usado quando a delegação não pede nada", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = fakeFetchOk(bodies);
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "z.ai (fake)",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["devagar", "rapido"],
      effortStyle: "openai",
      effortOptions: ["high", "max"],
      defaultEffortByModel: { devagar: "max" },
    };
    await chatCompletion(config, provider, "devagar", "oi");
    assert.equal(bodies[0].reasoning_effort, "max");

    // Modelo sem padrão escolhido e sem defaultEffort do provedor:
    // nada de esforço vai no corpo (vale o padrão do fabricante).
    await chatCompletion(config, provider, "rapido", "oi");
    assert.ok(
      !Object.prototype.hasOwnProperty.call(bodies[1], "reasoning_effort"),
      "sem padrão escolhido, o corpo não pode levar campo de esforço"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("precedência: delegação vence o padrão do modelo, que vence o do provedor", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = fakeFetchOk(bodies);
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "z.ai (fake)",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["m"],
      effortStyle: "openai",
      effortOptions: ["high", "max"],
      defaultEffort: "high",
      defaultEffortByModel: { m: "max" },
    };
    // Padrão do modelo ganha do padrão do provedor.
    await chatCompletion(config, provider, "m", "oi");
    assert.equal(bodies[0].reasoning_effort, "max");

    // Pedido da delegação ganha de todo mundo.
    await chatCompletion(config, provider, "m", "oi", { effort: "high" });
    assert.equal(bodies[1].reasoning_effort, "high");

    // Modelo sem padrão próprio cai no padrão do provedor.
    await chatCompletion(config, { ...provider, defaultEffortByModel: {} }, "m", "oi");
    assert.equal(bodies[2].reasoning_effort, "high");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("padrão do modelo também sai no formato da OpenRouter (reasoning: { effort })", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = fakeFetchOk(bodies);
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "OpenRouter (fake)",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["x-ai/grok-4.5"],
      effortStyle: "openrouter",
      effortOptions: ["low", "medium", "high"],
      defaultEffortByModel: { "x-ai/grok-4.5": "low" },
    };
    await chatCompletion(config, provider, "x-ai/grok-4.5", "oi");
    assert.deepEqual(bodies[0].reasoning, { effort: "low" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sem esforço nenhum configurado, o corpo não leva campo de esforço", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = fakeFetchOk(bodies);
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "z.ai (fake)",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["m"],
      effortStyle: "openai",
      effortOptions: ["high", "max"],
    };
    await chatCompletion(config, provider, "m", "oi");
    assert.ok(!Object.prototype.hasOwnProperty.call(bodies[0], "reasoning_effort"));
    assert.ok(!Object.prototype.hasOwnProperty.call(bodies[0], "reasoning"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pedir esforço num provedor sem effortStyle dá erro amigável citando o provedor", async () => {
  const provider: OpenAICompatProvider = {
    type: "openai-compat",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    enabled: true,
    models: ["m"],
  };
  await assert.rejects(
    chatCompletion(config, provider, "m", "oi", { effort: "high" }),
    /DeepSeek.*não aceita controle de esforço/
  );
});

// --- Repescagem automática ---

test("repescagem: erro de rede na 1ª tentativa, sucesso na 2ª (retried: true)", async () => {
  const originalFetch = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas++;
    if (chamadas === 1) throw new Error("ECONNRESET simulado");
    return new Response(
      JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "ok na 2ª" } }] }),
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
    const result = await chatCompletion(config, provider, "m", "oi");
    assert.equal(result.text, "ok na 2ª");
    assert.equal(result.retried, true);
    assert.equal(chamadas, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("erro 400 não repesca: falha na hora, fetch chamado só 1 vez", async () => {
  const originalFetch = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas++;
    return new Response("pedido inválido", { status: 400 });
  }) as typeof fetch;
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "Fake",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["m"],
    };
    await assert.rejects(chatCompletion(config, provider, "m", "oi"), /erro 400/);
    assert.equal(chamadas, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("erro 500 repesca: 1º falha, 2º dá certo (retried: true)", async () => {
  const originalFetch = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas++;
    if (chamadas === 1) return new Response("instabilidade", { status: 500 });
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
    const result = await chatCompletion(config, provider, "m", "oi");
    assert.equal(result.retried, true);
    assert.equal(chamadas, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Este caso protege a repescagem histórica de 429 após o endurecimento de
// redirects/limites: deve haver exatamente uma segunda tentativa, sem ampliar a
// política. Revisar requisito, diff, commits de retry posteriores, MEMORY.md,
// plano e docs/test-change-log.md antes de alterar/remover (AGENTS.md).
test("erro 429 preserva uma unica repescagem", async () => {
  const originalFetch = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas++;
    if (chamadas === 1) return new Response("aguarde", { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
  }) as typeof fetch;
  try {
    const provider: OpenAICompatProvider = { type: "openai-compat", label: "Fake", baseUrl: "http://localhost/v1", enabled: true, models: ["m"] };
    assert.equal((await chatCompletion(config, provider, "m", "oi")).retried, true);
    assert.equal(chamadas, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("se as duas tentativas falharem, o erro final avisa que houve 2 tentativas", async () => {
  const originalFetch = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas++;
    return new Response("instabilidade", { status: 500 });
  }) as typeof fetch;
  try {
    const provider: OpenAICompatProvider = {
      type: "openai-compat",
      label: "Fake",
      baseUrl: "http://localhost:9999/v1",
      enabled: true,
      models: ["m"],
    };
    await assert.rejects(chatCompletion(config, provider, "m", "oi"), /2 tentativas/);
    assert.equal(chamadas, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
