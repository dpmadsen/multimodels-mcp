// Raias "com mãos": rodam o próprio Claude Code em modo silencioso (headless).
// O modelo ganha mãos limitadas — pode LER o projeto, procurar e rodar
// `npm test`/`npm run build`, mas NÃO pode editar arquivos (sem Edit/Write nas
// ferramentas liberadas). Um motor só atende as duas configurações:
//   • com baseUrl + envKey: aponta pro motor de outro fabricante (GLM, DeepSeek,
//     Kimi), com a chave vinda do .env (nunca do código);
//   • sem baseUrl e sem envKey: entra pela assinatura do Claude Code do Daniel,
//     usando o login de verdade dele, sem chave nenhuma.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTimeoutMs, type ClaudeCliProvider, type ModelsConfig } from "../config.js";
import { naFila } from "./fila.js";

// Folga dada ao próprio Claude Code (via API_TIMEOUT_MS) por cima do nosso
// kill: 1 minuto a mais, pra que o nosso prazo seja sempre o primeiro a falar
// e a mensagem clara de "passou de X minutos" nunca perca a corrida.
const FOLGA_TIMEOUT_MS = 60 * 1000;

// Teto de memória da saída (a delegação pode durar muitos minutos):
// stderr guarda só um rabo rolante — usamos apenas o final no diagnóstico.
const MAX_STDERR_CHARS = 8192;
// stdout tem teto de 10 MB; passando disso, abortamos em vez de estourar a RAM.
const MAX_STDOUT_CHARS = 10 * 1024 * 1024;

// Ferramentas liberadas ao modelo: leitura + verificação, nunca edição.
// Read/Glob/Grep pra ler e procurar; os dois Bash restritos só deixam rodar
// os testes e a compilação (nada de comandos arbitrários).
const FERRAMENTAS_LIBERADAS = [
  "Read",
  "Glob",
  "Grep",
  "Bash(npm test:*)",
  "Bash(npm run build:*)",
] as const;

// Monta os argumentos passados ao `spawn("claude", args)` — função pura, sem
// efeitos colaterais, pra ficar fácil de testar. Não inclui o próprio executável.
// O modelo é obrigatório nesta raia (a receita exige --model explícito).
// O esforço é opcional: sem ele NÃO mandamos --effort, e aí vale o padrão do
// próprio programa `claude` (a gente não inventa padrão sem medir).
export function buildClaudeCliArgs(task: string, model: string, effort?: string): string[] {
  return [
    "-p",
    task,
    "--model",
    model,
    // O quanto o modelo pensa. Medido em 2026-08-01 com o claude-sonnet-5:
    // --effort low deu 168 tokens de saída em 6s; --effort max, 1321 em 16s.
    ...(effort ? ["--effort", effort] : []),
    "--allowedTools",
    ...FERRAMENTAS_LIBERADAS,
    // Servidor MCP vazio + modo estrito: o Claude descartável não herda
    // nenhuma ferramenta externa da configuração do Daniel.
    "--mcp-config",
    '{"mcpServers":{}}',
    "--strict-mcp-config",
    // Saída em UM documento JSON no stdout; o texto final fica no campo "result".
    "--output-format",
    "json",
  ];
}

// A convenção do cardápio: raia sem endereço e sem chave é a que entra pela
// assinatura do Claude Code. Uma função só pra essa pergunta, porque ela decide
// coisas diferentes em três lugares (chave, pasta de configuração e ambiente).
export function ehRaiaDeAssinatura(provider: ClaudeCliProvider): boolean {
  return !provider.baseUrl && !provider.envKey;
}

// Monta o ambiente do processo filho — função pura (só lê process.env), pra
// dar pra provar por teste que a trava de segurança da assinatura funciona.
export function montarAmbiente(
  provider: ClaudeCliProvider,
  apiKey: string | undefined,
  configDir: string | undefined,
  timeoutMs: number
): NodeJS.ProcessEnv {
  // Partimos do ambiente atual porque o filho precisa do básico (PATH, HOME).
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Damos ao Claude Code um minuto a mais que o nosso kill, pra ele
  // ser só a rede de segurança e nunca desistir antes de nós.
  env.API_TIMEOUT_MS = String(timeoutMs + FOLGA_TIMEOUT_MS);

  if (ehRaiaDeAssinatura(provider)) {
    // TRAVA DE SEGURANÇA: se alguma destas três variáveis vier herdada do
    // ambiente, o Claude Code usaria a chave de API (ou o motor de outro
    // fabricante) em vez da assinatura — cobrando por fora, sem avisar.
    // Apagamos as três com `delete`: no Node, atribuir undefined não some
    // com a variável, ela chegaria ao filho com o texto "undefined".
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.ANTHROPIC_BASE_URL;
    // E nada de CLAUDE_CONFIG_DIR: medido em 2026-08-01, com pasta de
    // configuração descartável o CLI responde "Not logged in · Please run
    // /login". A assinatura só vale com a configuração real (~/.claude).
    return env;
  }

  // Raia de outro fabricante: endereço e chave dele, em identidade descartável.
  if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
  if (provider.baseUrl) env.ANTHROPIC_BASE_URL = provider.baseUrl;
  if (apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = apiKey;
    env.ANTHROPIC_API_KEY = apiKey;
  }
  return env;
}

// Formato do JSON devolvido pelo `claude -p --output-format json`.
interface SaidaClaudeCli {
  result?: string;
  is_error?: boolean;
  subtype?: string;
  error?: string;
}

export async function runClaudeCli(
  config: ModelsConfig | undefined,
  provider: ClaudeCliProvider,
  task: string,
  workdir?: string,
  model?: string,
  effort?: string
): Promise<string> {
  if (!model) {
    throw new Error(`A raia "${provider.label}" exige um modelo explícito (ex.: "${provider.models[0] ?? "glm-5.2"}").`);
  }

  // Sem chave configurada não adianta nem tentar: mensagem amigável antes do
  // spawn. Só cobramos chave de quem declara envKey — a raia de assinatura
  // entra pelo login do Claude Code e não tem chave nenhuma pra cobrar.
  let apiKey: string | undefined;
  if (provider.envKey) {
    apiKey = process.env[provider.envKey];
    if (!apiKey) {
      throw new Error(
        `Falta a chave da ${provider.label}: preencha ${provider.envKey} no arquivo .env do projeto.`
      );
    }
  }

  // Validamos a pasta antes do spawn: se ela não existir, o spawn falharia com
  // ENOENT e a mensagem culparia o binário `claude`, um diagnóstico errado.
  if (workdir !== undefined && !existsSync(workdir)) {
    throw new Error(`A pasta indicada em workdir não existe: ${workdir}`);
  }

  // Prazo vem sempre da cascata (provedor → padrão do arquivo → embutido).
  const timeoutMs = resolveTimeoutMs(config, provider);

  // A baseUrl é única por provedor, então serve de chave da fila (a z.ai
  // engasga com chamadas ao mesmo tempo — maxConcurrent 1 no models.json).
  // A raia de assinatura não tem baseUrl; nela o label faz esse papel, porque
  // também é único por raia no cardápio — e assim ela ganha a fila dela,
  // separada das outras raias.
  return naFila(provider.baseUrl ?? provider.label, provider.maxConcurrent, () =>
    executarClaudeCli(provider, task, model, workdir, timeoutMs, apiKey, effort)
  );
}

async function executarClaudeCli(
  provider: ClaudeCliProvider,
  task: string,
  model: string,
  workdir: string | undefined,
  timeoutMs: number,
  apiKey: string | undefined,
  effort: string | undefined
): Promise<string> {
  // Identidade limpa e descartável: sem uma pasta de configuração própria, o
  // Claude Code usaria o login salvo do Daniel e mandaria a credencial errada
  // pra z.ai — o que volta como um 401 enganoso. Apagamos a pasta no finally.
  // Na raia de assinatura é o contrário: ela PRECISA do login salvo, então não
  // criamos pasta nenhuma (com pasta descartável o CLI diz "Not logged in").
  const configDir = ehRaiaDeAssinatura(provider)
    ? undefined
    : await mkdtemp(join(tmpdir(), "multimodels-claudecli-"));
  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn("claude", buildClaudeCliArgs(task, model, effort), {
        cwd: workdir ?? process.cwd(),
        // stdin fechado ("ignore"): sem isso o claude poderia ficar esperando
        // entrada e a delegação travaria.
        stdio: ["ignore", "pipe", "pipe"],
        env: montarAmbiente(provider, apiKey, configDir, timeoutMs),
      });
      // Decodificação em UTF-8 no próprio stream: sem isso, um caractere
      // multibyte (emoji, acento) partido entre dois eventos "data" viraria "�".
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      let stdout = "";
      let stderr = "";
      // Flag de aborto por nossa conta: quando matamos o processo por prazo, o
      // evento "close" chega com code === null e fabricaria um segundo reject
      // inútil — a rejeição do prazo já falou, então o close só retorna.
      let mortoPorPrazo = false;
      let mortoPorTamanho = false;
      const timer = setTimeout(() => {
        mortoPorPrazo = true;
        child.kill("SIGKILL");
        reject(new Error(`O ${provider.label} passou de ${timeoutMs / 60000} minutos e foi interrompido.`));
      }, timeoutMs);
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        if (stdout.length > MAX_STDOUT_CHARS) {
          mortoPorTamanho = true;
          clearTimeout(timer);
          child.kill("SIGKILL");
          reject(
            new Error(
              `A resposta do ${provider.label} passou de 10 MB e foi interrompida. Refaça a tarefa pedindo respostas menores.`
            )
          );
        }
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
        if (stderr.length > MAX_STDERR_CHARS) {
          stderr = stderr.slice(-MAX_STDERR_CHARS);
        }
      });
      child.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (err.code === "ENOENT") {
          reject(
            new Error(
              "Não encontrei o programa `claude` (Claude Code) no PATH. Instale o Claude Code e garanta que o comando `claude` funciona no terminal."
            )
          );
        } else {
          reject(err);
        }
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        // Já rejeitamos por prazo ou por tamanho: não fabricar um segundo erro.
        if (mortoPorPrazo || mortoPorTamanho) {
          return;
        }
        try {
          resolve(extrairResultado(stdout, stderr, code, provider.label));
        } catch (err) {
          reject(err);
        }
      });
    });
  } finally {
    // Só há pasta pra apagar na raia com chave (a de assinatura usa a real).
    if (configDir) await rm(configDir, { recursive: true, force: true });
  }
}

// Interpreta o documento JSON do stdout e devolve o texto final (campo "result").
// Erros viram mensagem amigável em português com o final do stderr pra diagnóstico.
function extrairResultado(stdout: string, stderr: string, code: number | null, label: string): string {
  const bruto = stdout.trim();
  if (!bruto) {
    throw new Error(
      `O ${label} terminou sem produzir saída (código ${code ?? "?"}). Detalhe: ${stderr.slice(-500) || "(sem detalhes)"}`
    );
  }
  let dados: SaidaClaudeCli;
  try {
    dados = JSON.parse(bruto) as SaidaClaudeCli;
  } catch {
    throw new Error(
      `Não entendi a resposta do ${label} (esperava um JSON). Detalhe: ${stderr.slice(-500) || bruto.slice(-500)}`
    );
  }
  if (dados.is_error || (dados.subtype && dados.subtype !== "success")) {
    const motivo = dados.error || dados.result || stderr.slice(-500) || "(sem detalhes)";
    throw new Error(`O ${label} terminou com erro. Detalhe: ${motivo}`);
  }
  const message = (dados.result ?? "").trim();
  if (!message) {
    throw new Error(`O ${label} terminou sem deixar uma resposta final. Detalhe: ${stderr.slice(-500) || "(sem detalhes)"}`);
  }
  return message;
}
