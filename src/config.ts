// Leitor do cardápio: carrega config/models.json e as chaves do .env,
// e resolve ids de modelo no formato "provedor:modelo" (ou "codex").
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface OpenAICompatProvider {
  type: "openai-compat";
  label: string;
  baseUrl: string;
  envKey?: string;
  enabled: boolean;
  models: string[];
  // Limite de tamanho da resposta (em tokens). Modelos de raciocínio gastam
  // parte desse limite "pensando", então o padrão precisa ser generoso.
  maxTokens?: number;
}

export interface CodexProvider {
  type: "codex-cli";
  label: string;
  enabled: boolean;
}

export type Provider = OpenAICompatProvider | CodexProvider;

export interface ModelsConfig {
  providers: Record<string, Provider>;
}

export const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadConfig(root: string = projectRoot): ModelsConfig {
  const path = join(root, "config", "models.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ModelsConfig;
}

// Carrega o .env do projeto sem sobrescrever variáveis já definidas.
export function loadEnvFile(root: string = projectRoot): void {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (value !== "" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export interface ModelRef {
  providerId: string;
  provider: Provider;
  model?: string;
}

export function resolveModel(config: ModelsConfig, id: string): ModelRef {
  const [providerId, ...rest] = id.split(":");
  const model = rest.length > 0 ? rest.join(":") : undefined;
  const provider = config.providers[providerId];
  if (!provider) {
    const known = Object.keys(config.providers).join(", ");
    throw new Error(
      `Provedor desconhecido: "${providerId}". Provedores configurados: ${known}. Use a ferramenta list_models para ver os ids válidos.`
    );
  }
  if (!provider.enabled) {
    throw new Error(`O provedor "${providerId}" está desabilitado no config/models.json.`);
  }
  if (provider.type === "openai-compat") {
    if (!model) {
      throw new Error(
        `Para o provedor "${providerId}" o id precisa incluir o modelo, ex.: "${providerId}:${provider.models[0] ?? "nome-do-modelo"}".`
      );
    }
    // O painel é o cardápio: só modelos habilitados podem receber delegação.
    if (!provider.models.includes(model)) {
      throw new Error(
        `O modelo "${model}" não está habilitado para ${provider.label}. ` +
          `Habilitados: ${provider.models.join(", ") || "(nenhum)"}. Habilite-o no painel de controle (npm run panel).`
      );
    }
  }
  return { providerId, provider, model };
}
