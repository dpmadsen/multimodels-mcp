// Lado "sujo" da regra do fabricante: pergunta ao SDK quem está chamando e
// anota isso uma vez no diário de bordo. As decisões puras ficam em anfitriao.ts.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fabricanteEfetivo } from "./anfitriao.js";

// O nome do cliente só existe DEPOIS do aperto de mão inicial, então esta
// função tem que ser chamada dentro do handler da ferramenta (na hora da
// chamada) — na inicialização do index.ts ainda seria undefined.
let jaAnotou = false;

export function fabricanteDaSessao(server: McpServer): string | undefined {
  const cliente = server.server.getClientVersion();
  const fabricante = fabricanteEfetivo(cliente?.name, process.env);
  if (!jaAnotou) {
    // Uma linha só por sessão, pra não poluir. É como a gente confere na
    // prática se a detecção acertou o programa que está chamando.
    // console.error de propósito: em servidor MCP por stdio o stdout é do
    // protocolo e NUNCA pode receber log.
    jaAnotou = true;
    console.error(
      `multimodels: cliente "${cliente?.name ?? "(não informado)"}" ${cliente?.version ?? "?"}` +
        ` → fabricante ${fabricante ?? "desconhecido (nada é escondido)"}`
    );
  }
  return fabricante;
}
