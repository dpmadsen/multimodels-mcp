// Ferramenta delegate_task: o coração do garçom. Recebe uma tarefa,
// leva pra "cozinha" escolhida (Codex, API ou modelo local) e devolve
// a resposta pro Claude avaliar.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveModel, type ModelsConfig } from "../config.js";
import { chatCompletion } from "../providers/openai-compat.js";
import { runCodex } from "../providers/codex.js";
import { runGemini } from "../providers/gemini.js";
import { runClaudeCli } from "../providers/claude-cli.js";

export function registerDelegate(server: McpServer, getConfig: () => ModelsConfig): void {
  server.registerTool(
    "delegate_task",
    {
      title: "Delegar tarefa a outro modelo",
      description:
        "Envia uma tarefa para outro modelo de IA processar e devolve a resposta dele. " +
        "Use list_models para ver os ids válidos (ex.: 'codex', 'deepseek:deepseek-chat', 'lmstudio:qwen/qwen3.6-35b-a3b'). " +
        "A resposta vem do modelo delegado — avalie criticamente antes de usar.",
      inputSchema: {
        model: z
          .string()
          .describe("Id do modelo destino, no formato retornado por list_models (ex.: 'codex' ou 'deepseek:deepseek-chat')"),
        task: z
          .string()
          .describe("Instruções completas e autocontidas da tarefa, incluindo todo o contexto necessário — o modelo destino não vê esta conversa"),
        workdir: z
          .string()
          .optional()
          .describe(
            "Somente para o codex: pasta do projeto em que ele pode ler arquivos (caminho absoluto). " +
              "O gemini NÃO lê arquivos no modo headless — mande todo o contexto no texto da tarefa"
          ),
        effort: z
          .string()
          .optional()
          .describe(
            "Esforço de raciocínio: para o codex aceita 'low', 'medium', 'high' ou 'xhigh'; " +
              "para provedores de API (z.ai, OpenRouter etc.) só funciona se o provedor tiver " +
              "'effortStyle' configurado no config/models.json — nesse caso, use o valor que aquele provedor aceitar"
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ model, task, workdir, effort }) => {
      try {
        const ref = resolveModel(getConfig(), model);
        let text: string;
        let footer: string;
        if (ref.provider.type === "claude-cli") {
          // Raia "com mãos" v1: o esforço do GLM na z.ai é configurado pelo
          // endpoint, fora do escopo desta raia — pedir "effort" aqui é engano.
          if (effort !== undefined) {
            throw new Error(
              `A raia "${ref.provider.label}" não aceita o campo "effort" (o esforço do GLM na z.ai é configurado pelo endpoint, fora do escopo desta raia).`
            );
          }
          text = await runClaudeCli(ref.provider, task, workdir, ref.model);
          footer = `[resposta de: ${ref.provider.label} · ${ref.model} · com mãos]`;
        } else if (ref.provider.type === "codex-cli" || ref.provider.type === "gemini-cli") {
          text =
            ref.provider.type === "codex-cli"
              ? await runCodex(task, workdir, ref.model, effort)
              : await runGemini(task, workdir, ref.model, effort);
          const detalhes = [ref.model, effort ? `esforço: ${effort}` : undefined].filter(Boolean);
          footer =
            detalhes.length > 0
              ? `[resposta de: ${ref.provider.label} · ${detalhes.join(" · ")}]`
              : `[resposta de: ${ref.provider.label}]`;
        } else {
          const result = await chatCompletion(ref.provider, ref.model!, task, { effort });
          text = result.truncated
            ? `${result.text}\n\n⚠️ Atenção: a resposta acima foi CORTADA no meio por atingir o limite de tamanho. ` +
              `Peça uma tarefa mais curta (ou em partes), ou aumente o "maxTokens" desse provedor no config/models.json.`
            : result.text;
          const tokens = result.usage
            ? ` · tokens: ${result.usage.prompt_tokens ?? "?"} entrada / ${result.usage.completion_tokens ?? "?"} saída`
            : "";
          // Esforço efetivo é o pedido na delegação, ou o padrão do provedor
          // quando nada foi pedido (mesma conta que o chatCompletion faz).
          const esforcoEfetivo = effort ?? ref.provider.defaultEffort;
          const extras = [
            esforcoEfetivo ? `esforço: ${esforcoEfetivo}` : undefined,
            result.retried ? "repescada 1×" : undefined,
          ].filter(Boolean);
          const sufixoExtras = extras.length > 0 ? ` · ${extras.join(" · ")}` : "";
          footer = `[resposta de: ${ref.provider.label} · ${ref.model}${tokens}${sufixoExtras}]`;
        }
        return { content: [{ type: "text", text: `${text}\n\n${footer}` }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Erro ao delegar: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
