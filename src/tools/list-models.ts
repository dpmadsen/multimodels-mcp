// Ferramenta list_models: mostra pro Claude o cardápio de modelos habilitados
// e o status de cada um (chave configurada, local, etc.).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelsConfig } from "../config.js";

export function registerListModels(server: McpServer, getConfig: () => ModelsConfig): void {
  server.registerTool(
    "list_models",
    {
      title: "Listar modelos disponíveis",
      description:
        "Lista os modelos de IA habilitados para delegação, com o id exato a usar na ferramenta delegate_task e o status de cada provedor.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      // Relê o cardápio a cada chamada: mudanças feitas no painel valem na hora.
      const config = getConfig();
      const lines: string[] = ["Modelos disponíveis para delegação (use o id com delegate_task):", ""];
      for (const [providerId, provider] of Object.entries(config.providers)) {
        if (!provider.enabled) continue;
        if (provider.type === "codex-cli" || provider.type === "gemini-cli") {
          lines.push(`- id: ${providerId} — ${provider.label} [CLI local, sem chave]`);
          for (const model of provider.models ?? []) {
            lines.push(`- id: ${providerId}:${model} — ${provider.label} [CLI local, sem chave]`);
          }
          continue;
        }
        const status = provider.envKey
          ? process.env[provider.envKey]
            ? "chave OK"
            : `SEM CHAVE — preencher ${provider.envKey} no .env`
          : "local, sem chave (requer LM Studio com servidor ligado)";
        if (provider.models.length === 0) {
          lines.push(`- ${provider.label} [${status}] — nenhum modelo habilitado ainda`);
          continue;
        }
        for (const model of provider.models) {
          lines.push(`- id: ${providerId}:${model} — ${provider.label} [${status}]`);
        }
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
