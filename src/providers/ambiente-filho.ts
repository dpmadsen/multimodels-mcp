import type { ClaudeCliProvider } from "../config.js";

const NOMES_BASE = [
  "PATH", "HOME", "USER", "LOGNAME", "SHELL",
  "TMPDIR", "TMP", "TEMP",
  "LANG", "LC_ALL", "LC_CTYPE", "TERM", "COLORTERM", "NO_COLOR",
  "SSL_CERT_FILE", "SSL_CERT_DIR"
] as const;

function copiarDefinidos(
  destino: NodeJS.ProcessEnv,
  origem: NodeJS.ProcessEnv,
  nomes: readonly string[]
): void {
  for (const nome of nomes) {
    const valor = origem[nome];
    if (valor !== undefined) destino[nome] = valor;
  }
}

export function montarAmbienteBase(origem: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  copiarDefinidos(env, origem, NOMES_BASE);
  return env;
}

export function montarAmbienteCodex(origem: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = montarAmbienteBase(origem);
  copiarDefinidos(env, origem, ["CODEX_HOME"]);
  return env;
}

export function montarAmbienteGemini(origem: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return montarAmbienteBase(origem);
}

export function montarAmbienteClaude(
  origem: NodeJS.ProcessEnv,
  provider: ClaudeCliProvider,
  apiKey: string | undefined,
  configDir: string | undefined,
  apiTimeoutMs: number
): NodeJS.ProcessEnv {
  const env = montarAmbienteBase(origem);
  env.API_TIMEOUT_MS = String(apiTimeoutMs);

  if (!provider.baseUrl && !provider.envKey) {
    return env;
  }

  if (configDir !== undefined) env.CLAUDE_CONFIG_DIR = configDir;
  if (provider.baseUrl !== undefined) env.ANTHROPIC_BASE_URL = provider.baseUrl;
  if (apiKey !== undefined) {
    env.ANTHROPIC_AUTH_TOKEN = apiKey;
    env.ANTHROPIC_API_KEY = apiKey;
  }
  return env;
}
