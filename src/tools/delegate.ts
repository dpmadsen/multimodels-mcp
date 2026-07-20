// Ferramenta delegate_task: o coração do garçom. Recebe uma tarefa,
// leva pra "cozinha" escolhida (Codex, API ou modelo local) e devolve
// a resposta pro Claude avaliar.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveModel, type ModelsConfig } from "../config.js";
import { chatCompletion } from "../providers/openai-compat.js";
import { runCodex } from "../providers/codex.js";

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
          .describe("Somente para o codex: pasta do projeto em que ele pode ler arquivos (caminho absoluto)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ model, task, workdir }) => {
      try {
        const ref = resolveModel(getConfig(), model);
        let text: string;
        let footer: string;
        if (ref.provider.type === "codex-cli") {
          text = await runCodex(task, workdir);
          footer = `[resposta de: ${ref.provider.label}]`;
        } else {
          const result = await chatCompletion(ref.provider, ref.model!, task);
          text = result.truncated
            ? `${result.text}\n\n⚠️ Atenção: a resposta acima foi CORTADA no meio por atingir o limite de tamanho. ` +
              `Peça uma tarefa mais curta (ou em partes), ou aumente o "maxTokens" desse provedor no config/models.json.`
            : result.text;
          const tokens = result.usage
            ? ` · tokens: ${result.usage.prompt_tokens ?? "?"} entrada / ${result.usage.completion_tokens ?? "?"} saída`
            : "";
          footer = `[resposta de: ${ref.provider.label} · ${ref.model}${tokens}]`;
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
