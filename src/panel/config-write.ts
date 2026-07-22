// Aplica mudanças vindas do painel no config/models.json,
// validando tudo antes: só provedores conhecidos, só campos permitidos.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ModelsConfig } from "../config.js";

const updateSchema = z.object({
  providers: z.record(
    z.object({
      enabled: z.boolean().optional(),
      label: z.string().trim().min(1).max(60).optional(),
      baseUrl: z
        .string()
        .trim()
        .url()
        .max(200)
        .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
          message: "O endereço precisa começar com http:// ou https://",
        })
        .optional(),
      models: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
    })
  ),
});

export type ConfigUpdate = z.infer<typeof updateSchema>;

export function applyConfigUpdate(config: ModelsConfig, rawUpdate: unknown): ModelsConfig {
  const update = updateSchema.parse(rawUpdate);
  const next: ModelsConfig = structuredClone(config);
  for (const [providerId, change] of Object.entries(update.providers)) {
    const provider = next.providers[providerId];
    if (!provider) {
      throw new Error(`Provedor desconhecido: "${providerId}".`);
    }
    if (change.enabled !== undefined) {
      provider.enabled = change.enabled;
    }
    if (change.label !== undefined) {
      provider.label = change.label;
    }
    if (change.baseUrl !== undefined) {
      // Só instâncias do LM Studio (sem chave de API) têm endereço editável:
      // os provedores de nuvem têm endereço fixo do fabricante.
      if (provider.type !== "openai-compat" || provider.envKey) {
        throw new Error(`O endereço do provedor "${providerId}" não pode ser alterado pelo painel.`);
      }
      provider.baseUrl = change.baseUrl;
    }
    if (change.models !== undefined) {
      // Todos os tipos aceitam lista de modelos: os de nuvem (openai-compat) e
      // os de CLI por assinatura (codex-cli, gemini-cli) e a raia claude-cli.
      // Guardamos sempre um array (nos tipos de CLI o campo é opcional na
      // interface, mas no arquivo escrevemos a lista já sem duplicados).
      provider.models = [...new Set(change.models)];
    }
  }
  return next;
}

export function saveConfig(root: string, config: ModelsConfig): void {
  const path = join(root, "config", "models.json");
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}
