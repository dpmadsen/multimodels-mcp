// Tomada universal: fala com qualquer provedor que use o padrão OpenAI
// (DeepSeek, z.ai, OpenRouter, LM Studio local).
import type { OpenAICompatProvider } from "../config.js";
import { naFila } from "./fila.js";

export interface ChatResult {
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  // true quando o provedor cortou a resposta por atingir o limite de tokens.
  truncated?: boolean;
  // true quando a primeira tentativa falhou e a repescagem (2ª tentativa)
  // deu certo.
  retried?: boolean;
}

// Prazo padrão por chamada quando o provedor não configura "timeoutMs".
const TIMEOUT_PADRAO_MS = 5 * 60 * 1000;

// Quanto esperar antes de repescar (tentar de novo) uma chamada que falhou
// por erro de rede ou por status repescável (429 / 5xx).
const ESPERA_REPESCAGEM_MS = 2000;

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

// Erro "marcado" como repescável: usado internamente pra sinalizar que vale
// a pena tentar a chamada de novo (erro de rede, ou status 429/5xx). Erros
// de outro tipo (ex.: resposta sem texto) não usam esta classe e por isso
// nunca são repescados.
class ErroRepescavel extends Error {}

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

// Monta o pedaço extra do corpo da requisição que carrega o esforço de
// raciocínio, no formato que cada provedor espera.
function corpoDeEsforco(
  effortStyle: OpenAICompatProvider["effortStyle"],
  effort: string
): Record<string, unknown> {
  if (effortStyle === "openai") {
    return { reasoning_effort: effort };
  }
  if (effortStyle === "openrouter") {
    return { reasoning: { effort } };
  }
  return {};
}

// Diz se vale a pena tentar de novo depois de um status HTTP:
// 429 (limite de pedidos por minuto) ou qualquer 5xx (erro do próprio
// provedor). Status 4xx fora o 429 é erro do pedido — repetir não resolve.
function statusValeRepescar(status: number): boolean {
  return status === 429 || status >= 500;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Faz uma única tentativa de chamada ao provedor. Erros de rede e status
// repescáveis (429/5xx) são lançados como ErroRepescavel, pra quem chama
// decidir se vale repescar; os demais erros são o Error comum de sempre.
async function tentarUmaVez(
  provider: OpenAICompatProvider,
  model: string,
  prompt: string,
  extraEsforco: Record<string, unknown>,
  timeoutMs: number
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
        ...extraEsforco,
      }),
      signal: AbortSignal.timeout(timeoutMs),
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
    // Falha de rede (conexão recusada, resetada, prazo estourado etc.):
    // sempre vale a pena repescar.
    throw new ErroRepescavel(
      `Não consegui conectar ao ${provider.label}.${hint} Detalhe: ${String(err)}`
    );
  }

  if (!response.ok) {
    const body = await response.text();
    const mensagem = `${provider.label} respondeu com erro ${response.status}: ${body.slice(0, 500)}`;
    if (statusValeRepescar(response.status)) {
      throw new ErroRepescavel(mensagem);
    }
    throw new Error(mensagem);
  }

  const data = (await response.json()) as ChatResponseBody;
  return parseChatResponse(data, provider.label, model);
}

// Tenta uma vez; se falhar de um jeito repescável, espera um pouco e tenta
// mais uma vez (repescagem). Se a segunda também falhar, o erro final
// deixa claro que houve duas tentativas.
async function chamarComRepescagem(
  provider: OpenAICompatProvider,
  model: string,
  prompt: string,
  extraEsforco: Record<string, unknown>,
  timeoutMs: number
): Promise<ChatResult> {
  try {
    return await tentarUmaVez(provider, model, prompt, extraEsforco, timeoutMs);
  } catch (err) {
    if (!(err instanceof ErroRepescavel)) {
      throw err;
    }
    await esperar(ESPERA_REPESCAGEM_MS);
    try {
      const resultado = await tentarUmaVez(provider, model, prompt, extraEsforco, timeoutMs);
      return { ...resultado, retried: true };
    } catch (segundoErro) {
      const motivo = segundoErro instanceof Error ? segundoErro.message : String(segundoErro);
      throw new Error(`${motivo} (repescagem também falhou — foram 2 tentativas no total)`);
    }
  }
}

export async function chatCompletion(
  provider: OpenAICompatProvider,
  model: string,
  prompt: string,
  opts?: { effort?: string }
): Promise<ChatResult> {
  if (opts?.effort !== undefined && !provider.effortStyle) {
    throw new Error(
      `${provider.label} não aceita controle de esforço de raciocínio (não tem "effortStyle" configurado no config/models.json).`
    );
  }

  const effortEfetivo = opts?.effort ?? provider.defaultEffort;
  const extraEsforco =
    effortEfetivo && provider.effortStyle ? corpoDeEsforco(provider.effortStyle, effortEfetivo) : {};

  const timeoutMs = provider.timeoutMs ?? TIMEOUT_PADRAO_MS;

  // A baseUrl é única por provedor, então serve de chave da fila.
  return naFila(provider.baseUrl, provider.maxConcurrent, () =>
    chamarComRepescagem(provider, model, prompt, extraEsforco, timeoutMs)
  );
}
