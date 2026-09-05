// Ponte com o Gemini: usa o programa `agy` (Antigravity CLI do Google) já
// instalado e logado na conta Google (assinatura Google AI Pro — sem custo de
// API). Roda em modo "plan" (somente-leitura): analisa e responde, mas não
// altera arquivos. Nota: o antigo `gemini-cli` foi aposentado pelo Google em
// 2026-06-18 para contas pessoais; o `agy` é o substituto oficial.
import { spawn } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  MAX_RESPONSE_BYTES_PADRAO,
  resolveMaxResponseBytes,
  resolveTimeoutMs,
  TIMEOUT_PADRAO_MINUTOS,
  type GeminiProvider,
  type ModelsConfig,
} from "../config.js";
import { montarAmbienteGemini } from "./ambiente-filho.js";
import { ErroLimiteDeSaida, somarBytesDeSaida } from "./limite-saida.js";

// Teto de memória da saída (a delegação pode durar muitos minutos):
// stderr guarda só um rabo rolante — usamos apenas o final (slice(-500) e as
// regexes de diagnóstico), então mais que isso é desperdício.
const MAX_STDERR_CHARS = 8192;

// O instalador oficial coloca o agy em ~/.local/bin, que nem sempre está no
// PATH do processo do servidor. Preferimos o caminho completo quando ele existe
// E é executável — se for sobra de instalação quebrada (existe mas sem permissão
// de execução), caímos para o "agy" do PATH em vez de estourar EACCES no spawn.
export function resolveAgyBinary(): string {
  const instalado = join(homedir(), ".local", "bin", "agy");
  try {
    accessSync(instalado, constants.X_OK);
    return instalado;
  } catch {
    return "agy";
  }
}

// Monta os argumentos passados ao `spawn(agy, args)` — função pura, sem
// efeitos colaterais, pra ficar fácil de testar. Não inclui o próprio executável.
export function buildGeminiArgs(
  task: string,
  opts: { model?: string; effort?: string; workdir?: string; timeoutMs?: number } = {}
): string[] {
  if (opts.effort !== undefined) {
    // No agy o esforço faz parte do nome do modelo (sufixo -low/-medium/-high).
    throw new Error(
      'Para o Gemini, escolha o esforço pelo sufixo do modelo (ex.: "gemini:gemini-3.1-pro-high" ou "gemini:gemini-3.6-flash-low") em vez do campo "effort".'
    );
  }
  // --print-timeout: damos ao agy sempre um minuto a mais que o nosso kill.
  // Assim o agy vira só a rede de segurança e nunca é o primeiro a desistir —
  // se fossem iguais e ele vencesse a corrida, sairia com código 0 e stdout
  // vazio, e o usuário levaria uma mensagem enganosa. Do nosso jeito, a
  // mensagem clara de "passou de X minutos" é sempre a que fala.
  const minutos = Math.round((opts.timeoutMs ?? TIMEOUT_PADRAO_MINUTOS * 60 * 1000) / 60000);
  const args: string[] = ["--mode", "plan", "--print-timeout", `${minutos + 1}m`];
  if (opts.model) {
    args.push("--model", opts.model);
  }
  // --add-dir: sem isso o agy ignora o cwd do spawn e usa uma workspace interna
  // dele, não enxergando a pasta da tarefa. Passando a pasta aqui, a leitura de
  // arquivos (com as allow-rules do agy configuradas) funciona.
  if (opts.workdir) {
    args.push("--add-dir", opts.workdir);
  }
  args.push("-p", task);
  return args;
}

export async function runGemini(
  config: ModelsConfig | undefined,
  provider: GeminiProvider | undefined,
  task: string,
  workdir: string,
  model?: string,
  effort?: string
): Promise<string> {
  if (!workdir) {
    throw new Error("O campo workdir é obrigatório para modelos que acessam arquivos.");
  }
  // Prazo vem sempre da cascata (provedor → padrão do arquivo → embutido).
  const timeoutMs = resolveTimeoutMs(config, provider);
  const maxResponseBytes = resolveMaxResponseBytes(config, provider ?? {}, model);
  // Validamos a pasta antes do spawn: se ela não existir, o spawn falharia com
  // ENOENT e a mensagem de erro culparia o agy ("não encontrei o programa agy"),
  // um diagnóstico errado. Melhor apontar direto para a pasta inexistente.
  if (!existsSync(workdir)) {
    throw new Error(`A pasta indicada em workdir não existe: ${workdir}`);
  }
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(resolveAgyBinary(), buildGeminiArgs(task, { model, effort, workdir, timeoutMs }), {
      cwd: workdir,
      // stdin fechado ("ignore"): sem isso o agy fica esperando
      // entrada para sempre e a delegação trava.
      stdio: ["ignore", "pipe", "pipe"],
      env: montarAmbienteGemini(process.env),
    });
    // Decodificação em UTF-8 no próprio stream: sem isso, um caractere multibyte
    // (emoji, acento) partido entre dois eventos "data" viraria "�".
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "";
    let bytesDoStdout = 0;
    let stderr = "";
    // Flags de aborto por nossa conta: quando matamos o processo (prazo ou
    // tamanho), o evento "close" chega com code === null e fabricaria um segundo
    // reject inútil — a rejeição do aborto já falou, então o close só volta.
    let mortoPorPrazo = false;
    let mortoPorTamanho = false;
    const timer = setTimeout(() => {
      mortoPorPrazo = true;
      child.kill("SIGKILL");
      reject(new Error(`O Gemini passou de ${timeoutMs / 60000} minutos e foi interrompido.`));
    }, timeoutMs);
    child.stdout.on("data", (chunk: string) => {
      if (mortoPorTamanho) return;
      const conta = somarBytesDeSaida(bytesDoStdout, chunk, maxResponseBytes);
      if (conta.excedeu) {
        mortoPorTamanho = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(
          new ErroLimiteDeSaida(
            conta.total,
            maxResponseBytes,
            maxResponseBytes === MAX_RESPONSE_BYTES_PADRAO
              ? "A resposta do Gemini passou de 10 MB e foi interrompida. Refaça a tarefa pedindo respostas menores."
              : undefined
          )
        );
        return;
      }
      bytesDoStdout = conta.total;
      stdout += chunk;
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
            "Não encontrei o programa `agy` (Antigravity CLI). Instale com o script oficial do Google (https://antigravity.google/product/antigravity-cli) e rode `agy` uma vez para fazer login na conta Google."
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
      const saida = `${stdout}\n${stderr}`;
      if (code !== 0) {
        // Sem login o agy pede pra entrar na conta; a dica poupa uma ida ao Google.
        const dica = /sign in|login|auth|credential/i.test(saida)
          ? " Parece problema de login: rode `agy` no terminal uma vez e entre com a conta Google."
          : "";
        reject(new Error(`O Gemini terminou com erro (código ${code}).${dica} Detalhe: ${stderr.slice(-500)}`));
        return;
      }
      const message = stdout.trim();
      if (!message) {
        // Caso clássico: o modelo tentou usar uma ferramenta (ex.: ler arquivo)
        // e o modo headless negou a permissão em silêncio.
        const negado = /no output produced|auto-denied|permission/i.test(saida);
        reject(
          new Error(
            negado
              ? "O Gemini tentou usar uma ferramenta que o modo headless bloqueou. A leitura de arquivos precisa do arquivo de permissões do agy (~/.gemini/antigravity-cli/settings.json) com allow-rules de leitura; ou reenvie a tarefa com todo o conteúdo no próprio texto."
              : "O Gemini terminou sem deixar uma resposta final."
          )
        );
        return;
      }
      resolve(message);
    });
  });
}
