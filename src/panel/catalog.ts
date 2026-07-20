// Busca catálogos de modelos nos provedores:
// - OpenRouter: catálogo público completo (nome, contexto, preços)
// - LM Studio: modelos baixados no Mac (requer o servidor local ligado)
import type { ModelsConfig, OpenAICompatProvider } from "../config.js";

export interface CatalogModel {
  id: string;
  name: string;
  context: number | null;
  promptPrice: string | null;
  completionPrice: string | null;
}

let openRouterCache: { at: number; models: CatalogModel[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export async function fetchOpenRouterCatalog(): Promise<CatalogModel[]> {
  if (openRouterCache && Date.now() - openRouterCache.at < CACHE_MS) {
    return openRouterCache.models;
  }
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`OpenRouter respondeu com erro ${response.status} ao listar o catálogo.`);
  }
  const data = (await response.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
    }>;
  };
  const models: CatalogModel[] = (data.data ?? []).map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    context: m.context_length ?? null,
    promptPrice: m.pricing?.prompt ?? null,
    completionPrice: m.pricing?.completion ?? null,
  }));
  models.sort((a, b) => a.name.localeCompare(b.name));
  openRouterCache = { at: Date.now(), models };
  return models;
}

// Encontra uma instância do LM Studio pelo id do provedor. Só aceita
// provedores sem chave de API (é assim que reconhecemos um LM Studio,
// local ou em outra máquina da rede).
export function resolveLmStudioProvider(config: ModelsConfig, providerId: string): OpenAICompatProvider {
  const provider = config.providers[providerId];
  if (!provider || provider.type !== "openai-compat" || provider.envKey) {
    throw new Error(`O provedor "${providerId}" não é uma instância do LM Studio configurada.`);
  }
  return provider;
}

export async function fetchLmStudioModels(
  provider: OpenAICompatProvider
): Promise<{ available: boolean; models: string[] }> {
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { available: false, models: [] };
    const data = (await response.json()) as { data?: Array<{ id: string }> };
    return { available: true, models: (data.data ?? []).map((m) => m.id) };
  } catch {
    return { available: false, models: [] };
  }
}
