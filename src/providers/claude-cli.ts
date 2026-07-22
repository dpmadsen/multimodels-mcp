// Raia "com mãos": roda o próprio Claude Code em modo silencioso (headless)
// apontado pro motor de outro fabricante (hoje o GLM da z.ai). O modelo ganha
// mãos limitadas — pode LER o projeto, procurar e rodar `npm test`/`npm run build`,
// mas NÃO pode editar arquivos (sem Edit/Write nas ferramentas liberadas).
// A chave vem do .env (nunca do código) e entra direto no processo via ambiente.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClaudeCliProvider } from "../config.js";
import { naFila } from "./fila.js";

// Prazo padrão por delegação: 15 minutos. O GLM na z.ai é lento e uma
// tarefa que lê arquivos e roda os testes pode demorar bastante.
const TIMEOUT_PADRAO_MS = 15 * 60 * 1000;

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
export function buildClaudeCliArgs(task: string, model: string): string[] {
  return [
    "-p",
    task,
    "--model",
    model,
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

// Formato do JSON devolvido pelo `claude -p --output-format json`.
interface SaidaClaudeCli {
  result?: string;
  is_error?: boolean;
  subtype?: string;
  error?: string;
}

export async function runClaudeCli(
  provider: ClaudeCliProvider,
  task: string,
  workdir?: string,
  model?: string
): Promise<string> {
  if (!model) {
    throw new Error(`A raia "${provider.label}" exige um modelo explícito (ex.: "${provider.models[0] ?? "glm-5.2"}").`);
  }

  // Sem chave configurada não adianta nem tentar: mensagem amigável antes do spawn.
  const apiKey = process.env[provider.envKey];
  if (!apiKey) {
    throw new Error(
      `Falta a chave da ${provider.label}: preencha ${provider.envKey} no arquivo .env do projeto.`
    );
  }

  // Validamos a pasta antes do spawn: se ela não existir, o spawn falharia com
  // ENOENT e a mensagem culparia o binário `claude`, um diagnóstico errado.
  if (workdir !== undefined && !existsSync(workdir)) {
    throw new Error(`A pasta indicada em workdir não existe: ${workdir}`);
  }

  const timeoutMs = provider.timeoutMs ?? TIMEOUT_PADRAO_MS;

  // A baseUrl é única por provedor, então serve de chave da fila (a z.ai
  // engasga com chamadas ao mesmo tempo — maxConcurrent 1 no models.json).
  return naFila(provider.baseUrl, provider.maxConcurrent, () =>
    executarClaudeCli(provider, task, model, workdir, timeoutMs, apiKey)
  );
}

async function executarClaudeCli(
  provider: ClaudeCliProvider,
  task: string,
  model: string,
  workdir: string | undefined,
  timeoutMs: number,
  apiKey: string
): Promise<string> {
  // Identidade limpa e descartável: sem uma pasta de configuração própria, o
  // Claude Code usaria o login salvo do Daniel e mandaria a credencial errada
  // pra z.ai — o que volta como um 401 enganoso. Apagamos a pasta no finally.
  const configDir = await mkdtemp(join(tmpdir(), "multimodels-claudecli-"));
  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn("claude", buildClaudeCliArgs(task, model), {
        cwd: workdir ?? process.cwd(),
        // stdin fechado ("ignore"): sem isso o claude poderia ficar esperando
        // entrada e a delegação travaria.
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: configDir,
          ANTHROPIC_BASE_URL: provider.baseUrl,
          ANTHROPIC_AUTH_TOKEN: apiKey,
          ANTHROPIC_API_KEY: apiKey,
          // Damos ao Claude Code um minuto a mais que o nosso kill, pra ele
          // ser só a rede de segurança e nunca desistir antes de nós.
          API_TIMEOUT_MS: String(timeoutMs + FOLGA_TIMEOUT_MS),
        },
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
    await rm(configDir, { recursive: true, force: true });
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
