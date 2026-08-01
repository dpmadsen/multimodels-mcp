// Ferramenta list_models: mostra pro Claude o cardápio de modelos habilitados
// e o status de cada um (chave configurada, local, etc.).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelsConfig } from "../config.js";
import { filtrarRaiasDoAnfitriao, linhaDeOmissao } from "../anfitriao.js";
import { fabricanteDaSessao } from "../anfitriao-sessao.js";

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
      // Regra do fabricante: a raia do mesmo fabricante do programa que está
      // chamando não entra no cardápio (lá o barato é o subagente nativo).
      // O nome do cliente só existe depois do aperto de mão, por isso é lido
      // aqui dentro, na hora da chamada.
      const habilitadas = Object.entries(config.providers).filter(([, p]) => p.enabled);
      const { visiveis, escondidas } = filtrarRaiasDoAnfitriao(habilitadas, fabricanteDaSessao(server));
      const lines: string[] = ["Modelos disponíveis para delegação (use o id com delegate_task):", ""];
      for (const [providerId, provider] of visiveis) {
        if (provider.type === "codex-cli" || provider.type === "gemini-cli") {
          lines.push(`- id: ${providerId} — ${provider.label} [CLI local, sem chave]`);
          for (const model of provider.models ?? []) {
            lines.push(`- id: ${providerId}:${model} — ${provider.label} [CLI local, sem chave]`);
          }
          continue;
        }
        if (provider.type === "claude-cli") {
          // Raia "com mãos": CLI local. Com envKey, precisa da chave do motor
          // no .env; sem envKey, entra pela assinatura do Claude Code (como o
          // Codex e o Gemini fazem com as assinaturas deles).
          const envKey = provider.envKey;
          const status = !envKey
            ? "CLI local, assinatura do Claude Code, sem chave"
            : process.env[envKey]
              ? `CLI local + chave ${envKey}: chave OK`
              : `CLI local + chave ${envKey}: SEM CHAVE — preencher ${envKey} no .env`;
          for (const model of provider.models) {
            lines.push(`- id: ${providerId}:${model} — ${provider.label} [${status}]`);
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
      // Nunca esconder em silêncio: se algo saiu do cardápio, o aviso explica.
      const aviso = linhaDeOmissao(escondidas);
      if (aviso) lines.push("", aviso);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
