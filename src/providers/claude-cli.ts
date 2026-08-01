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
import {
  ESTADO_INICIAL,
  consumirPedaco,
  extrairResultado,
  finalizar,
  progressoDoEstado,
  textoAcumulado,
  type EstadoDoStream,
  type ProgressoDoStream,
} from "./claude-stream.js";
import { ErroComParcial } from "./erro-parcial.js";

// Aviso de progresso pra quem chamou. O motor não sabe o que é uma "tarefa" —
// ele só grita "estou aqui, já fiz isso" e quem ligou decide o que fazer com
// isso. É de propósito que este arquivo não importe nada de ../tarefas/.
export type AoProgredir = (progresso: ProgressoDoStream) => void;

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
    // Saída em MUITAS linhas JSON (uma por evento), conforme as coisas
    // acontecem — é o que permite saber do andamento sem esperar o fim. O
    // desfecho vem no último evento ("result"), no MESMO formato do documento
    // único que o "--output-format json" devolvia antes.
    "--output-format",
    "stream-json",
    // Sem isto os eventos só chegam de bloco fechado em bloco fechado; com
    // isto vêm também os pedacinhos de texto ao vivo, que são o que salva o
    // trabalho quando a tarefa morre no meio.
    "--include-partial-messages",
    // Exigência do próprio CLI, medida em 2026-08-01: sem --verbose ele recusa
    // na hora com "When using --print, --output-format=stream-json requires
    // --verbose". Não é escolha nossa; é a única forma de o modo existir.
    "--verbose",
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

export async function runClaudeCli(
  config: ModelsConfig | undefined,
  provider: ClaudeCliProvider,
  task: string,
  workdir?: string,
  model?: string,
  effort?: string,
  aoProgredir?: AoProgredir
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
    executarClaudeCli(provider, task, model, workdir, timeoutMs, apiKey, effort, aoProgredir)
  );
}

async function executarClaudeCli(
  provider: ClaudeCliProvider,
  task: string,
  model: string,
  workdir: string | undefined,
  timeoutMs: number,
  apiKey: string | undefined,
  effort: string | undefined,
  aoProgredir: AoProgredir | undefined
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
      let stderr = "";
      // Quanto texto o stdout já trouxe. Antes a gente guardava o stdout
      // inteiro numa variável; agora ele é consumido linha a linha e o que
      // fica guardado é só o ESTADO do leitor. Mas o teto de 10 MB continua
      // valendo, então o tamanho é contado à parte.
      let tamanhoDoStdout = 0;
      // Rabo do stdout, só pra mensagem de diagnóstico quando nada dá certo.
      let rabaoDoStdout = "";
      let estado: EstadoDoStream = ESTADO_INICIAL;
      // Começo da linha que ainda não terminou (o stdout chega em pedaços que
      // não respeitam a quebra de linha).
      let sobra = "";
      // Flag de aborto por nossa conta: quando matamos o processo por prazo, o
      // evento "close" chega com code === null e fabricaria um segundo reject
      // inútil — a rejeição do prazo já falou, então o close só retorna.
      let mortoPorPrazo = false;
      let mortoPorTamanho = false;

      // Erro que leva junto o que já tinha sido produzido. Só é usado nos dois
      // caminhos de morte violenta (prazo e tamanho): são exatamente os casos
      // em que, antes, vinte minutos de trabalho viravam zero.
      const erroComOParcial = (mensagem: string): ErroComParcial => {
        // Fecha a última linha pendente antes de olhar o estado: ela pode ser
        // justamente o evento que traz o último pedaço de texto ou a última
        // ferramenta usada — e é o que sobrou, não dá pra desperdiçar.
        const fechado = finalizar(estado, sobra);
        return new ErroComParcial(mensagem, textoAcumulado(fechado), progressoDoEstado(fechado));
      };

      const timer = setTimeout(() => {
        mortoPorPrazo = true;
        child.kill("SIGKILL");
        reject(
          erroComOParcial(`O ${provider.label} passou de ${timeoutMs / 60000} minutos e foi interrompido.`)
        );
      }, timeoutMs);
      child.stdout.on("data", (chunk: string) => {
        tamanhoDoStdout += chunk.length;
        rabaoDoStdout = (rabaoDoStdout + chunk).slice(-500);
        const passo = consumirPedaco(estado, sobra, chunk);
        const antes = estado;
        estado = passo.estado;
        sobra = passo.sobra;
        // Só avisamos quando algum sinal mudou de verdade — a maioria dos
        // eventos é bastidor e não muda nada que valha um recado.
        if (aoProgredir && houveMudanca(antes, estado)) {
          try {
            aoProgredir(progressoDoEstado(estado));
          } catch {
            // Quem ouve o progresso NUNCA pode derrubar a delegação: um erro
            // ao anotar o andamento não vale perder a resposta inteira.
          }
        }
        if (tamanhoDoStdout > MAX_STDOUT_CHARS) {
          mortoPorTamanho = true;
          clearTimeout(timer);
          child.kill("SIGKILL");
          reject(
            erroComOParcial(
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
        // A última linha pode ter chegado sem "\n" no fim.
        estado = finalizar(estado, sobra);
        try {
          resolve(extrairResultado(estado, rabaoDoStdout, stderr, code, provider.label));
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

// Vale a pena avisar do progresso? Só quando um dos sinais que a gente mostra
// mudou. Sem isso, cada pedacinho de texto ao vivo (são centenas) viraria um
// recado, e a camada de cima levaria uma martelada de gravações.
function houveMudanca(antes: EstadoDoStream, depois: EstadoDoStream): boolean {
  return (
    antes.idasAoModelo.length !== depois.idasAoModelo.length ||
    antes.tokensSaida !== depois.tokensSaida ||
    antes.ferramentas !== depois.ferramentas
  );
}
