// Tradutor do cardápio para o formato que a tela do painel entende:
// diz, para cada motor, o que a página pode mostrar (nome, ligado/desligado,
// modelos, endereço, prazo) e — quando ele usa chave — só os 4 últimos
// caracteres dela. A chave inteira NUNCA sai daqui.
import {
  controleDeEsforco,
  TIMEOUT_PADRAO_MINUTOS,
  type ModelsConfig,
  type Provider,
} from "../config.js";
import { maskKey } from "./env-file.js";

export interface PanelKeyState {
  envKey: string;
  set: boolean;
  last4: string | null;
}

export interface PanelProviderState {
  id: string;
  label: string;
  type: Provider["type"];
  enabled: boolean;
  models: string[];
  baseUrl: string | null;
  // null = este motor não tem prazo próprio e segue o padrão geral.
  timeoutMinutes: number | null;
  // null = este motor não usa chave (Codex e Gemini entram por assinatura).
  key: PanelKeyState | null;
  // null = este motor não aceita controle de esforço de raciocínio (aí a tela
  // não mostra o seletor). Quando aceita, vem a lista de níveis do fabricante
  // e o esforço já escolhido para cada modelo.
  effortOptions: string[] | null;
  defaultEffortByModel: Record<string, string> | null;
}

export interface PanelState {
  defaults: { timeoutMinutes: number };
  providers: PanelProviderState[];
}

// Motores que precisam de chave no .env: os de API e as raias "com mãos" que
// levam a chave de outro fabricante pro Claude Code descartável. A raia "com
// mãos" de assinatura não declara envKey (entra pelo login do Claude Code),
// então devolve null e não ganha campo de chave na tela.
function envKeyDoProvedor(provider: Provider): string | null {
  if (provider.type === "openai-compat") return provider.envKey ?? null;
  if (provider.type === "claude-cli") return provider.envKey ?? null;
  return null;
}

export function stateSnapshot(
  config: ModelsConfig,
  env: Record<string, string | undefined>
): PanelState {
  const providers = Object.entries(config.providers).map(([id, provider]) => {
    const envKey = envKeyDoProvedor(provider);
    // Quem ganha o seletor de esforço: motor de API com estilo de esforço
    // configurado, e raia "com mãos" que declare os níveis dela (o programa
    // `claude` tem --effort). Quem decide é o controleDeEsforco, no config.ts —
    // aqui a tela só mostra o que a raia declarou. Codex e Gemini ficam de fora
    // (o esforço deles vai direto na chamada, sem padrão por modelo).
    const esforco = controleDeEsforco(provider);
    return {
      id,
      label: provider.label,
      type: provider.type,
      enabled: provider.enabled,
      models: provider.models ?? [],
      baseUrl: provider.type === "openai-compat" ? provider.baseUrl : null,
      timeoutMinutes: provider.timeoutMinutes ?? null,
      key: envKey ? { envKey, ...maskKey(env[envKey]) } : null,
      effortOptions: esforco ? (esforco.effortOptions ?? []) : null,
      defaultEffortByModel: esforco ? (esforco.defaultEffortByModel ?? {}) : null,
    };
  });
  return {
    defaults: { timeoutMinutes: config.defaults?.timeoutMinutes ?? TIMEOUT_PADRAO_MINUTOS },
    providers,
  };
}

// A chave só pode ser gravada se pertencer a algum motor do cardápio —
// exatamente os mesmos que ganham campo de chave na tela.
export function envKeyPertenceAAlgumProvedor(config: ModelsConfig, envKey: string): boolean {
  return Object.values(config.providers).some((p) => envKeyDoProvedor(p) === envKey);
}
