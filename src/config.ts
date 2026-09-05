// Leitor do cardápio: carrega config/models.json e as chaves do .env,
// e resolve ids de modelo no formato "provedor:modelo" (ou "codex").
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Vocabulário do esforço de raciocínio, um só para todas as raias que sabem
// controlá-lo. Ficou separado porque dois tipos de raia usam os MESMOS três
// campos: os motores de API (que mandam o esforço no corpo da requisição) e a
// raia "com mãos" da assinatura (onde o programa `claude` tem a opção
// --effort). Campos ausentes = a raia não oferece esse controle.
export interface ControleDeEsforco {
  // Níveis de esforço que ESTE motor aceita, com o nome cru dele (a z.ai fala
  // "high"/"max"; a OpenRouter, "low"/"medium"/"high"; o programa `claude`,
  // "low"/"medium"/"high"/"xhigh"/"max"). É a lista que o painel oferece.
  effortOptions?: string[];
  // Esforço aplicado quando a delegação não especifica nenhum.
  defaultEffort?: string;
  // Esforço padrão escolhido no painel para cada modelo deste motor.
  // Chave = id do modelo; valor = um dos effortOptions. Modelo ausente
  // daqui segue o padrão do motor (defaultEffort) ou, na falta dele, o
  // padrão de fábrica do próprio fabricante.
  defaultEffortByModel?: Record<string, string>;
}

// Limites opcionais de uma raia. contextTokens e so informacao de catalogo;
// os dois limites de saida sao aplicados localmente antes de acumular resposta.
export interface ModelLimits {
  contextTokens?: number;
  maxOutputTokens?: number;
  maxResponseBytes?: number;
}

export interface ControleDeLimites {
  maxOutputTokens?: number;
  maxResponseBytes?: number;
  modelLimits?: Record<string, ModelLimits>;
}

export interface OpenAICompatProvider extends ControleDeEsforco, ControleDeLimites {
  type: "openai-compat";
  label: string;
  baseUrl: string;
  envKey?: string;
  enabled: boolean;
  // Regra do fabricante (ver anfitriao.ts). Existe aqui pra o campo ser o mesmo
  // em todos os tipos de raia, mas na prática fica VAZIO nestas: um provedor de
  // API é um endereço, não um fabricante — a OpenRouter serve modelo de meio
  // mundo, e uma etiqueta única por provedor esconderia raia útil por engano.
  // Além disso o rodeio caro aqui nem existe: é uma chamada de API, não um
  // programa novo recarregando a configuração global.
  fabricante?: string;
  models: string[];
  // Limite de tamanho da resposta (em tokens). Modelos de raciocínio gastam
  // parte desse limite "pensando", então o padrão precisa ser generoso.
  // Máximo de chamadas simultâneas a este provedor (fila por provedor).
  // Ausente = sem fila, chama direto (comportamento de sempre). Provedores
  // que engasgam com chamadas ao mesmo tempo (z.ai, LM Studio) usam isso
  // pra enfileirar em vez de derrubar a conexão.
  maxConcurrent?: number;
  // Prazo (em minutos) por chamada a este provedor. Ausente = segue o
  // padrão geral (defaults.timeoutMinutes). Ver resolveTimeoutMs.
  timeoutMinutes?: number;
  // Como enviar o esforço de raciocínio no corpo da requisição:
  // "openai" manda o campo de topo reasoning_effort (formato da z.ai);
  // "openrouter" manda o objeto reasoning: { effort }.
  // Ausente: o provedor não aceita controle de esforço de raciocínio.
  // Os campos de esforço (effortOptions, defaultEffort, defaultEffortByModel)
  // vêm de ControleDeEsforco e só valem aqui combinados com effortStyle: sem
  // ele o provedor não sabe MONTAR o campo no corpo da requisição.
  effortStyle?: "openai" | "openrouter";
}

// Fabricante do motor desta raia ("openai", "google", "anthropic"). Serve só
// pra regra do fabricante: quando o programa que está chamando é do MESMO
// fabricante, a raia some do cardápio e a delegação é recusada, porque o
// caminho barato ali é o subagente nativo do próprio programa (ver anfitriao.ts).
// Campo AUSENTE = a raia nunca é escondida.

export interface CodexProvider extends ControleDeLimites {
  type: "codex-cli";
  label: string;
  enabled: boolean;
  fabricante?: string;
  // Lista de modelos do Codex habilitados para escolha explícita
  // (ex.: "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna").
  // Sem essa lista (ou vazia), só o id "codex" simples funciona —
  // que usa o modelo padrão configurado no CLI.
  models?: string[];
  // Prazo (em minutos) por delegação. Ausente = segue o padrão geral.
  timeoutMinutes?: number;
}

export interface GeminiProvider extends ControleDeLimites {
  type: "gemini-cli";
  label: string;
  enabled: boolean;
  // Ver o comentário da regra do fabricante em CodexProvider.
  fabricante?: string;
  // Lista de modelos do Gemini habilitados para escolha explícita
  // (ex.: "gemini-3-pro", "gemini-3-flash").
  // Sem essa lista (ou vazia), só o id "gemini" simples funciona —
  // que usa o modelo padrão configurado no CLI.
  models?: string[];
  // Prazo (em minutos) por delegação. Ausente = segue o padrão geral.
  timeoutMinutes?: number;
}

export interface ClaudeCliProvider extends ControleDeEsforco, ControleDeLimites {
  type: "claude-cli";
  label: string;
  enabled: boolean;
  // Ver o comentário da regra do fabricante em CodexProvider. Aqui só a raia de
  // assinatura (claude-maos) declara "anthropic": as raias com mãos de OUTROS
  // motores (glm-maos, deepseek-maos...) usam o Claude Code só como carroceria,
  // o modelo que responde é de outro fabricante — elas nunca são escondidas.
  fabricante?: string;
  // Convenção das raias "com mãos" (um motor só, duas configurações):
  //   • baseUrl + envKey PRESENTES = raia de outro fabricante. O Claude Code
  //     roda apontado pro endereço dele, com a chave do .env, numa pasta de
  //     configuração descartável (pra não misturar com o login do Daniel).
  //   • baseUrl + envKey AUSENTES = raia de assinatura. O Claude Code entra
  //     pelo login de verdade do Daniel (sem chave, sem cobrança por API).
  // Endereço do motor de outro fabricante (vira ANTHROPIC_BASE_URL).
  baseUrl?: string;
  // Nome da variável do .env com a chave desse motor (ex.: "ZAI_API_KEY").
  envKey?: string;
  // Lista de modelos habilitados. O modelo é obrigatório nesta raia
  // (a receita exige --model explícito), então nunca há forma "pelada".
  models: string[];
  // Máximo de chamadas simultâneas (fila por provedor). A z.ai engasga com
  // paralelo, então usa 1. Ausente = sem fila.
  maxConcurrent?: number;
  // Prazo (em minutos) por delegação. Ausente = segue o padrão geral.
  timeoutMinutes?: number;
  // Os campos de esforço vêm de ControleDeEsforco. Aqui a regra é declarativa:
  // só a raia que DECLARA effortOptions ganha o controle (o programa `claude`
  // tem a opção --effort, então na raia de assinatura ele funciona de verdade).
  // As raias de outro fabricante não declaram, porque foi medido em 2026-07-31
  // que o motor do outro lado descarta o ajuste — e sem declaração a delegação
  // recusa o campo "effort" em vez de aceitar calado e enganar o Daniel.
}

export type Provider = OpenAICompatProvider | CodexProvider | GeminiProvider | ClaudeCliProvider;

// Provedores que funcionam por programa de linha de comando já logado
// (assinatura), em vez de chave de API.
export type CliProvider = CodexProvider | GeminiProvider;

export function isCliProvider(provider: Provider): provider is CliProvider {
  return provider.type === "codex-cli" || provider.type === "gemini-cli";
}

// Ajustes que valem para todos os provedores, quando o provedor não tem
// um valor próprio.
export interface ConfigDefaults {
  // Prazo (em minutos) para desistir de uma delegação.
  timeoutMinutes?: number;
  maxResponseBytes?: number;
}

export interface ModelsConfig {
  defaults?: ConfigDefaults;
  providers: Record<string, Provider>;
}

// Prazo embutido no programa: usado só quando nem o provedor nem o
// config/models.json dizem nada.
export const TIMEOUT_PADRAO_MINUTOS = 10;
export const MAX_TOKENS_PADRAO = 32_000;
export const MAX_RESPONSE_BYTES_PADRAO = 10 * 1024 * 1024;

function limiteInteiroPositivo(valor: number, campo: string): number {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new Error(`O limite ${campo} precisa ser um inteiro positivo seguro.`);
  }
  return valor;
}

export function resolveMaxOutputTokens(provider: ControleDeLimites, model?: string): number {
  const valor = model ? provider.modelLimits?.[model]?.maxOutputTokens : undefined;
  return limiteInteiroPositivo(valor ?? provider.maxOutputTokens ?? MAX_TOKENS_PADRAO, "maxOutputTokens");
}

export function resolveMaxResponseBytes(
  config: ModelsConfig | undefined,
  provider: ControleDeLimites,
  model?: string
): number {
  const valor = model ? provider.modelLimits?.[model]?.maxResponseBytes : undefined;
  return limiteInteiroPositivo(
    valor ?? provider.maxResponseBytes ?? config?.defaults?.maxResponseBytes ?? MAX_RESPONSE_BYTES_PADRAO,
    "maxResponseBytes"
  );
}

// Cascata do prazo de execução, do mais específico ao mais geral:
// prazo do provedor → padrão do arquivo (defaults) → 10 minutos embutidos.
// É a ÚNICA fonte do prazo: todos os motores chamam esta função.
export function resolveTimeoutMs(
  config: ModelsConfig | undefined,
  provider?: Provider
): number {
  const minutos =
    provider?.timeoutMinutes ?? config?.defaults?.timeoutMinutes ?? TIMEOUT_PADRAO_MINUTOS;
  return minutos * 60 * 1000;
}

// Diz se esta raia aceita controle de esforço de raciocínio e, quando aceita,
// devolve a própria raia já vista pela janelinha dos campos de esforço.
// É a ÚNICA fonte dessa resposta: painel e delegação perguntam aqui.
// A regra é declarativa — nenhum nome de raia escrito no código:
//   • motor de API: precisa de effortStyle (é ele que sabe montar o campo);
//   • raia "com mãos": precisa declarar effortOptions.
// Codex e Gemini têm o esforço tratado em outro lugar (o CLI deles recebe o
// nível direto, sem padrão por modelo), então não entram aqui.
export function controleDeEsforco(provider: Provider): ControleDeEsforco | undefined {
  if (provider.type === "openai-compat") {
    return provider.effortStyle ? provider : undefined;
  }
  if (provider.type === "claude-cli") {
    return provider.effortOptions && provider.effortOptions.length > 0 ? provider : undefined;
  }
  return undefined;
}

// Cascata do esforço de raciocínio, do mais específico ao mais geral:
// pedido da delegação → padrão daquele modelo → padrão do motor → nada
// (aí vale o padrão de fábrica do fabricante). Mora aqui, junto da cascata do
// prazo, porque serve a mais de um tipo de raia — motor de API e "com mãos".
export function resolveEffort(
  provider: ControleDeEsforco,
  model: string,
  pedido?: string
): string | undefined {
  return pedido ?? provider.defaultEffortByModel?.[model] ?? provider.defaultEffort;
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
  if (provider.type === "claude-cli") {
    // A receita exige --model explícito, então não existe forma "pelada":
    // o id precisa trazer o modelo, e ele tem que estar na lista habilitada.
    if (!model) {
      throw new Error(
        `Para o provedor "${providerId}" o id precisa incluir o modelo, ex.: "${providerId}:${provider.models[0] ?? "glm-5.2"}".`
      );
    }
    if (!provider.models.includes(model)) {
      throw new Error(
        `O modelo "${model}" não está habilitado para ${provider.label}. ` +
          `Habilitados: ${provider.models.join(", ") || "(nenhum)"}. Habilite-o no painel de controle (npm run panel).`
      );
    }
  }
  if (isCliProvider(provider) && model) {
    // "<provedor>:<modelo>" escolhe explicitamente um modelo da família.
    // Sem lista configurada (ou lista vazia), nenhum modelo explícito existe.
    const enabled = provider.models ?? [];
    if (enabled.length === 0) {
      throw new Error(
        `O provedor "${providerId}" não tem nenhum modelo explícito habilitado. ` +
          `Use apenas "${providerId}" (sem dois-pontos) para usar o modelo padrão do CLI, ou adicione modelos em "models" no config/models.json.`
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
