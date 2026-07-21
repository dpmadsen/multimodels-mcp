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
  // Máximo de chamadas simultâneas a este provedor (fila por provedor).
  // Ausente = sem fila, chama direto (comportamento de sempre). Provedores
  // que engasgam com chamadas ao mesmo tempo (z.ai, LM Studio) usam isso
  // pra enfileirar em vez de derrubar a conexão.
  maxConcurrent?: number;
  // Prazo (em milissegundos) por chamada a este provedor.
  // Ausente = 300000 (5 minutos), o valor fixo que já existia.
  timeoutMs?: number;
  // Como enviar o esforço de raciocínio no corpo da requisição:
  // "openai" manda o campo de topo reasoning_effort (formato da z.ai);
  // "openrouter" manda o objeto reasoning: { effort }.
  // Ausente: o provedor não aceita controle de esforço de raciocínio.
  effortStyle?: "openai" | "openrouter";
  // Esforço aplicado quando a delegação não especifica nenhum.
  // Só faz sentido combinado com effortStyle.
  defaultEffort?: string;
}

export interface CodexProvider {
  type: "codex-cli";
  label: string;
  enabled: boolean;
  // Lista de modelos do Codex habilitados para escolha explícita
  // (ex.: "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna").
  // Sem essa lista (ou vazia), só o id "codex" simples funciona —
  // que usa o modelo padrão configurado no CLI.
  models?: string[];
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
  if (provider.type === "codex-cli" && model) {
    // "codex:<modelo>" escolhe explicitamente um modelo da família do Codex.
    // Sem lista configurada (ou lista vazia), nenhum modelo explícito existe.
    const enabled = provider.models ?? [];
    if (enabled.length === 0) {
      throw new Error(
        `O provedor "${providerId}" não tem nenhum modelo explícito habilitado. ` +
          `Use apenas "codex" (sem dois-pontos) para usar o modelo padrão do CLI, ou adicione modelos em "models" no config/models.json.`
      );
    }
    if (!enabled.includes(model)) {
      throw new Error(
        `O modelo "${model}" não está habilitado para ${provider.label}. ` +
          `Habilitados: ${enabled.join(", ")}.`
      );
    }
  }
  return { providerId, provider, model };
}
