// Testes da regra do fabricante: quem está chamando, e o que ele não precisa ver.
// Tudo aqui é função pura, então nada de mexer no process.env global: o ambiente
// entra por parâmetro.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fabricanteDoAnfitriao,
  fabricanteEfetivo,
  filtrarRaiasDoAnfitriao,
  linhaDeOmissao,
  mensagemDeRecusa,
  raiaEhDoAnfitriao,
} from "./anfitriao.js";
import { loadConfig, type ModelsConfig } from "./config.js";
import { registerDelegate } from "./tools/delegate.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Ambiente vazio: nenhuma variável de escape ligada.
const SEM_AMBIENTE: Record<string, string | undefined> = {};

// --- Quem está chamando (casamento por pedaço do nome) ---

test("nomes com 'claude' viram fabricante anthropic, em qualquer caixa", () => {
  assert.equal(fabricanteDoAnfitriao("claude-code"), "anthropic");
  assert.equal(fabricanteDoAnfitriao("Claude Code"), "anthropic");
  assert.equal(fabricanteDoAnfitriao("CLAUDE-DESKTOP"), "anthropic");
  assert.equal(fabricanteDoAnfitriao("claude-ai/1.2.3"), "anthropic");
});

test("nomes com 'codex' viram fabricante openai", () => {
  assert.equal(fabricanteDoAnfitriao("codex-mcp-client"), "openai");
  assert.equal(fabricanteDoAnfitriao("Codex CLI"), "openai");
  assert.equal(fabricanteDoAnfitriao("openai-codex"), "openai");
});

test("nomes com 'gemini' viram fabricante google", () => {
  assert.equal(fabricanteDoAnfitriao("gemini-cli"), "google");
  assert.equal(fabricanteDoAnfitriao("Gemini Code Assist"), "google");
});

test("programa desconhecido não tem fabricante (e por isso nada é bloqueado)", () => {
  assert.equal(fabricanteDoAnfitriao("cursor"), undefined);
  assert.equal(fabricanteDoAnfitriao("algum-editor-novo"), undefined);
  assert.equal(fabricanteDoAnfitriao(""), undefined);
});

test("cliente que não se identificou não tem fabricante", () => {
  assert.equal(fabricanteDoAnfitriao(undefined), undefined);
});

// --- Escape hatch: a variável de ambiente manda mais que a detecção ---

test("ambiente vazio: vale a detecção pelo nome do cliente", () => {
  assert.equal(fabricanteEfetivo("claude-code", SEM_AMBIENTE), "anthropic");
  assert.equal(fabricanteEfetivo("cursor", SEM_AMBIENTE), undefined);
});

test("MULTIMODELS_ANFITRIAO força o fabricante, mesmo contra a detecção", () => {
  const env = { MULTIMODELS_ANFITRIAO: "openai" };
  assert.equal(fabricanteEfetivo("claude-code", env), "openai");
  // Também serve pra ensinar um programa que a detecção não conhece.
  assert.equal(fabricanteEfetivo("editor-desconhecido", env), "openai");
  // Caixa alta e espaços sobrando não atrapalham.
  assert.equal(fabricanteEfetivo("claude-code", { MULTIMODELS_ANFITRIAO: " OpenAI " }), "openai");
});

test("MULTIMODELS_ANFITRIAO=nenhum (ou none) desliga a regra inteira", () => {
  assert.equal(fabricanteEfetivo("claude-code", { MULTIMODELS_ANFITRIAO: "nenhum" }), undefined);
  assert.equal(fabricanteEfetivo("claude-code", { MULTIMODELS_ANFITRIAO: "none" }), undefined);
  assert.equal(fabricanteEfetivo("codex-mcp-client", { MULTIMODELS_ANFITRIAO: "NENHUM" }), undefined);
});

test("variável vazia é como se não existisse: cai na detecção", () => {
  assert.equal(fabricanteEfetivo("codex-mcp-client", { MULTIMODELS_ANFITRIAO: "" }), "openai");
  assert.equal(fabricanteEfetivo("codex-mcp-client", { MULTIMODELS_ANFITRIAO: "   " }), "openai");
});

// --- A raia é do anfitrião? ---

test("raia sem campo 'fabricante' NUNCA é bloqueada", () => {
  assert.equal(raiaEhDoAnfitriao({}, "anthropic"), false);
  assert.equal(raiaEhDoAnfitriao({ fabricante: undefined }, "openai"), false);
});

test("raia de outro fabricante não é bloqueada (é justamente pra isso que servimos)", () => {
  assert.equal(raiaEhDoAnfitriao({ fabricante: "openai" }, "anthropic"), false);
  assert.equal(raiaEhDoAnfitriao({ fabricante: "google" }, "anthropic"), false);
  assert.equal(raiaEhDoAnfitriao({ fabricante: "anthropic" }, "openai"), false);
});

test("raia do mesmo fabricante do anfitrião é bloqueada", () => {
  assert.equal(raiaEhDoAnfitriao({ fabricante: "anthropic" }, "anthropic"), true);
  assert.equal(raiaEhDoAnfitriao({ fabricante: "openai" }, "openai"), true);
});

test("anfitrião desconhecido não bloqueia nada", () => {
  assert.equal(raiaEhDoAnfitriao({ fabricante: "anthropic" }, undefined), false);
  assert.equal(raiaEhDoAnfitriao({ fabricante: "openai" }, undefined), false);
});

// --- Filtro do cardápio ---

const CARDAPIO: Array<[string, { fabricante?: string }]> = [
  ["codex", { fabricante: "openai" }],
  ["gemini", { fabricante: "google" }],
  ["claude-maos", { fabricante: "anthropic" }],
  ["glm-maos", {}],
  ["zai", {}],
];

test("de dentro do Claude Code, só a raia anthropic some do cardápio", () => {
  const { visiveis, escondidas } = filtrarRaiasDoAnfitriao(CARDAPIO, "anthropic");
  assert.deepEqual(escondidas, ["claude-maos"]);
  assert.deepEqual(
    visiveis.map(([id]) => id),
    ["codex", "gemini", "glm-maos", "zai"]
  );
});

test("de dentro do Codex, só a raia openai some do cardápio", () => {
  const { visiveis, escondidas } = filtrarRaiasDoAnfitriao(CARDAPIO, "openai");
  assert.deepEqual(escondidas, ["codex"]);
  assert.ok(visiveis.some(([id]) => id === "claude-maos"), "o Claude continua à disposição do Codex");
});

test("anfitrião desconhecido vê o cardápio inteiro", () => {
  const { visiveis, escondidas } = filtrarRaiasDoAnfitriao(CARDAPIO, undefined);
  assert.deepEqual(escondidas, []);
  assert.equal(visiveis.length, CARDAPIO.length);
});

test("o filtro não mexe na ordem nem na lista original", () => {
  const copia = [...CARDAPIO];
  filtrarRaiasDoAnfitriao(CARDAPIO, "anthropic");
  assert.deepEqual(CARDAPIO, copia, "a lista de entrada não pode ser alterada");
});

// --- Avisos em português ---

test("nada escondido: nenhuma linha de aviso no cardápio", () => {
  assert.equal(linhaDeOmissao([]), undefined);
});

test("escondeu: o aviso diz o que sumiu, por quê e como reverter", () => {
  const linha = linhaDeOmissao(["claude-maos"]) ?? "";
  assert.match(linha, /claude-maos/);
  assert.match(linha, /mesmo fabricante/);
  assert.match(linha, /subagente nativo/);
  assert.match(linha, /MULTIMODELS_ANFITRIAO=nenhum/);
});

test("a recusa da delegação explica o motivo e aponta o caminho certo", () => {
  const msg = mensagemDeRecusa("claude-maos", "Claude com mãos (assinatura)", "anthropic");
  assert.match(msg, /claude-maos/);
  assert.match(msg, /Claude com mãos/);
  assert.match(msg, /subagente nativo/);
  assert.match(msg, /MULTIMODELS_ANFITRIAO=nenhum/);
});

// --- O cardápio de verdade ---

// O liga/desliga de cada raia é escolha do Daniel no painel, então o teste
// prende só a marcação de fabricante — que é o que a regra usa.
test("as três raias de fabricante conhecido estão marcadas no config real", () => {
  const providers = loadConfig().providers;
  assert.equal(providers.codex?.fabricante, "openai");
  assert.equal(providers.gemini?.fabricante, "google");
  assert.equal(providers["claude-maos"]?.fabricante, "anthropic");
});

test("as raias com mãos de outros motores não são marcadas como anthropic", () => {
  // Elas usam o Claude Code só como carroceria; quem responde é outro
  // fabricante, então nunca podem sumir do cardápio dentro do Claude Code.
  const providers = loadConfig().providers;
  for (const id of ["glm-maos", "deepseek-maos", "kimi-maos"]) {
    assert.equal(providers[id]?.fabricante, undefined, `${id} não pode ter fabricante marcado`);
  }
});

test("no cardápio real, de dentro do Claude Code só claude-maos é escondida", () => {
  const entradas = Object.entries(loadConfig().providers);
  const { escondidas } = filtrarRaiasDoAnfitriao(entradas, "anthropic");
  assert.deepEqual(escondidas, ["claude-maos"]);
});

test("no cardápio real, de dentro do Codex só a raia codex é escondida", () => {
  const entradas = Object.entries(loadConfig().providers);
  const { escondidas } = filtrarRaiasDoAnfitriao(entradas, "openai");
  assert.deepEqual(escondidas, ["codex"]);
});

// --- A porta trancada do delegate_task ---

// Mesmo padrão já usado em providers/claude-cli.test.ts: captura o handler que
// o registerDelegate registra e chama ele direto, sem subir servidor nenhum.
test("delegar pra raia do próprio fabricante é recusado antes de qualquer spawn", async () => {
  const config: ModelsConfig = {
    providers: {
      "claude-maos": {
        type: "claude-cli",
        label: "Claude com mãos (assinatura)",
        fabricante: "anthropic",
        enabled: true,
        models: ["claude-opus-5"],
      },
    },
  };
  let handler:
    | ((args: { model: string; task: string; effort?: string }) => Promise<{
        isError?: boolean;
        content: Array<{ text: string }>;
      }>)
    | undefined;
  const fakeServer = {
    registerTool: (_name: string, _cfg: unknown, fn: typeof handler) => {
      handler = fn;
    },
    // O programa anfitrião se identificou como Claude Code no aperto de mão.
    server: { getClientVersion: () => ({ name: "claude-code", version: "9.9.9" }) },
  } as unknown as McpServer;
  registerDelegate(fakeServer, () => config);
  assert.ok(handler, "o delegate_task deve ter sido registrado");
  const result = await handler!({ model: "claude-maos:claude-opus-5", task: "leia o projeto" });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /mesmo fabricante/);
  assert.match(result.content[0].text, /subagente nativo/);
});
