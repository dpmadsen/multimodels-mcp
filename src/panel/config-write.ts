// Aplica mudanças vindas do painel no config/models.json,
// validando tudo antes: só provedores conhecidos, só campos permitidos.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { controleDeEsforco, type ModelsConfig } from "../config.js";

// Prazo de execução em minutos: número inteiro, de 1 a 120 (duas horas).
// Mensagens em português simples, porque elas aparecem no painel.
const timeoutMinutesSchema = z
  .number({ invalid_type_error: "O prazo precisa ser um número de minutos." })
  .int("O prazo precisa ser um número inteiro de minutos.")
  .min(1, "O prazo mínimo é 1 minuto.")
  .max(120, "O prazo máximo é 120 minutos (2 horas).");

const updateSchema = z.object({
  // Ajustes gerais: hoje só o prazo padrão, que vale pros provedores
  // que não têm prazo próprio. Aqui null não é aceito — sempre há um padrão.
  defaults: z
    .object({
      timeoutMinutes: timeoutMinutesSchema.optional(),
    })
    .optional(),
  providers: z
    .record(
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
        // null limpa o prazo próprio: o provedor volta a seguir o padrão geral.
        timeoutMinutes: timeoutMinutesSchema.nullable().optional(),
        // Esforço padrão de cada modelo. Chave = id do modelo; valor = um dos
        // níveis que o fabricante aceita, ou null pra apagar o padrão daquele
        // modelo (voltando ao padrão do fabricante).
        defaultEffortByModel: z
          .record(
            z
              .string({ invalid_type_error: "O esforço precisa ser um texto." })
              .trim()
              .min(1)
              .max(40)
              .nullable()
          )
          .optional(),
      })
    )
    .optional(),
});

export type ConfigUpdate = z.infer<typeof updateSchema>;

export function applyConfigUpdate(config: ModelsConfig, rawUpdate: unknown): ModelsConfig {
  const update = updateSchema.parse(rawUpdate);
  const next: ModelsConfig = structuredClone(config);
  if (update.defaults?.timeoutMinutes !== undefined) {
    next.defaults = { ...next.defaults, timeoutMinutes: update.defaults.timeoutMinutes };
  }
  for (const [providerId, change] of Object.entries(update.providers ?? {})) {
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
      // Modelo que saiu da lista não pode deixar esforço órfão no arquivo.
      // Vale nos dois tipos que guardam esforço por modelo (API e "com mãos").
      if (
        (provider.type === "openai-compat" || provider.type === "claude-cli") &&
        provider.defaultEffortByModel
      ) {
        for (const modelo of Object.keys(provider.defaultEffortByModel)) {
          if (!provider.models.includes(modelo)) {
            delete provider.defaultEffortByModel[modelo];
          }
        }
        if (Object.keys(provider.defaultEffortByModel).length === 0) {
          delete provider.defaultEffortByModel;
        }
      }
    }
    if (change.defaultEffortByModel !== undefined) {
      // Quem aceita esse ajuste é quem DECLARA controle de esforço: motor de
      // API com effortStyle e raia "com mãos" com effortOptions. A mesma regra
      // que o painel usa pra mostrar (ou não) o seletor, no config.ts.
      const alvo = controleDeEsforco(provider);
      if (!alvo) {
        throw new Error(
          `O motor "${providerId}" não aceita controle de esforço de raciocínio.`
        );
      }
      const niveis = alvo.effortOptions ?? [];
      const habilitados = provider.models ?? [];
      for (const [modelo, esforco] of Object.entries(change.defaultEffortByModel)) {
        if (!habilitados.includes(modelo)) {
          throw new Error(
            `O modelo "${modelo}" não está habilitado em "${providerId}", então não dá pra escolher o esforço dele.`
          );
        }
        if (esforco !== null && !niveis.includes(esforco)) {
          throw new Error(
            `O esforço "${esforco}" não existe em "${providerId}". Escolha um destes: ${niveis.join(", ") || "(nenhum)"}.`
          );
        }
      }
      // Só grava depois de conferir o pedido inteiro: pedido com qualquer
      // parte inválida não muda nada.
      for (const [modelo, esforco] of Object.entries(change.defaultEffortByModel)) {
        if (esforco === null) {
          delete alvo.defaultEffortByModel?.[modelo];
        } else {
          alvo.defaultEffortByModel = { ...alvo.defaultEffortByModel, [modelo]: esforco };
        }
      }
      if (alvo.defaultEffortByModel && Object.keys(alvo.defaultEffortByModel).length === 0) {
        delete alvo.defaultEffortByModel;
      }
    }
    if (change.timeoutMinutes !== undefined) {
      // null = apagar o prazo próprio e voltar a seguir o padrão geral.
      if (change.timeoutMinutes === null) {
        delete provider.timeoutMinutes;
      } else {
        provider.timeoutMinutes = change.timeoutMinutes;
      }
    }
  }
  return next;
}

export function saveConfig(root: string, config: ModelsConfig): void {
  const path = join(root, "config", "models.json");
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}
