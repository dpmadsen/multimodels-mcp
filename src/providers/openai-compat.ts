// Tomada universal: fala com qualquer provedor que use o padrão OpenAI
// (DeepSeek, z.ai, OpenRouter, LM Studio local).
import type { OpenAICompatProvider } from "../config.js";

export interface ChatResult {
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  // true quando o provedor cortou a resposta por atingir o limite de tokens.
  truncated?: boolean;
}

const TIMEOUT_MS = 5 * 60 * 1000;

// Padrão generoso: modelos de raciocínio gastam parte do limite "pensando"
// antes de escrever a resposta final. Ajustável por provedor via "maxTokens"
// no config/models.json.
export const DEFAULT_MAX_TOKENS = 32_000;

interface ChatResponseBody {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      // Modelos de raciocínio devolvem o "pensamento" nestes campos
      // (reasoning_content no DeepSeek/LM Studio, reasoning no OpenRouter).
      reasoning_content?: string | null;
      reasoning?: string | null;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Separa a resposta final do raciocínio interno e detecta corte por limite.
// Exportada para os testes.
export function parseChatResponse(
  data: ChatResponseBody,
  providerLabel: string,
  model: string
): ChatResult {
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? "";
  const reasoning = choice?.message?.reasoning_content ?? choice?.message?.reasoning ?? "";
  const cortadaPorLimite = choice?.finish_reason === "length";

  if (!content.trim()) {
    if (reasoning.trim() && cortadaPorLimite) {
      throw new Error(
        `${providerLabel}: o modelo "${model}" gastou todo o limite de tamanho só "pensando" e não chegou a escrever a resposta final. ` +
          `Tente uma tarefa mais curta ou divida-a em partes; se precisar, aumente o campo "maxTokens" desse provedor no config/models.json.`
      );
    }
    if (reasoning.trim()) {
      throw new Error(
        `${providerLabel}: o modelo "${model}" devolveu apenas o raciocínio interno, sem a resposta final. Tente delegar de novo.`
      );
    }
    throw new Error(
      `${providerLabel} respondeu, mas sem texto na resposta (modelo "${model}" existe?).`
    );
  }

  return { text: content, usage: data.usage, truncated: cortadaPorLimite };
}

export async function chatCompletion(
  provider: OpenAICompatProvider,
  model: string,
  prompt: string
): Promise<ChatResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.envKey) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) {
      throw new Error(
        `Falta a chave de API do ${provider.label}: preencha ${provider.envKey} no arquivo .env do projeto.`
      );
    }
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: provider.maxTokens ?? DEFAULT_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // Provedor sem chave de API = instância do LM Studio (local ou na rede).
    const isLocal =
      provider.baseUrl.includes("localhost") || provider.baseUrl.includes("127.0.0.1");
    const hint = provider.envKey
      ? ""
      : isLocal
        ? " O LM Studio está aberto com o servidor local ligado? (comando: lms server start)"
        : ` A outra máquina (${provider.baseUrl}) está ligada, com o LM Studio servindo na rede? (no LM Studio dela: aba Developer, ligar o servidor e ativar "Serve on Local Network")`;
    throw new Error(`Não consegui conectar ao ${provider.label}.${hint} Detalhe: ${String(err)}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${provider.label} respondeu com erro ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as ChatResponseBody;
  return parseChatResponse(data, provider.label, model);
}
