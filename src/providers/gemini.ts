// Ponte com o Gemini: usa o programa `agy` (Antigravity CLI do Google) já
// instalado e logado na conta Google (assinatura Google AI Pro — sem custo de
// API). Roda em modo "plan" (somente-leitura): analisa e responde, mas não
// altera arquivos. Nota: o antigo `gemini-cli` foi aposentado pelo Google em
// 2026-06-18 para contas pessoais; o `agy` é o substituto oficial.
import { spawn } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TIMEOUT_MS = 10 * 60 * 1000;

// Teto de memória da saída (a delegação pode durar até 10 minutos):
// stderr guarda só um rabo rolante — usamos apenas o final (slice(-500) e as
// regexes de diagnóstico), então mais que isso é desperdício.
const MAX_STDERR_CHARS = 8192;
// stdout tem teto de 10 MB; passando disso, abortamos em vez de estourar a RAM.
const MAX_STDOUT_CHARS = 10 * 1024 * 1024;

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
export function buildGeminiArgs(task: string, opts: { model?: string; effort?: string } = {}): string[] {
  if (opts.effort !== undefined) {
    // No agy o esforço faz parte do nome do modelo (sufixo -low/-medium/-high).
    throw new Error(
      'Para o Gemini, escolha o esforço pelo sufixo do modelo (ex.: "gemini:gemini-3.1-pro-high" ou "gemini:gemini-3.6-flash-low") em vez do campo "effort".'
    );
  }
  // --print-timeout: damos ao agy 11m de propósito, um minuto a mais que o nosso
  // kill de 10m. Assim o agy vira só a rede de segurança e nunca é o primeiro a
  // desistir — se fossem iguais e ele vencesse a corrida, sairia com código 0 e
  // stdout vazio, e o usuário levaria uma mensagem enganosa. Do nosso jeito, a
  // mensagem clara de "passou de 10 minutos" é sempre a que fala.
  const args: string[] = ["--mode", "plan", "--print-timeout", "11m"];
  if (opts.model) {
    args.push("--model", opts.model);
  }
  args.push("-p", task);
  return args;
}

export async function runGemini(task: string, workdir?: string, model?: string, effort?: string): Promise<string> {
  // Validamos a pasta antes do spawn: se ela não existir, o spawn falharia com
  // ENOENT e a mensagem de erro culparia o agy ("não encontrei o programa agy"),
  // um diagnóstico errado. Melhor apontar direto para a pasta inexistente.
  if (workdir !== undefined && !existsSync(workdir)) {
    throw new Error(`A pasta indicada em workdir não existe: ${workdir}`);
  }
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(resolveAgyBinary(), buildGeminiArgs(task, { model, effort }), {
      cwd: workdir ?? process.cwd(),
      // stdin fechado ("ignore"): sem isso o agy fica esperando
      // entrada para sempre e a delegação trava.
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Decodificação em UTF-8 no próprio stream: sem isso, um caractere multibyte
    // (emoji, acento) partido entre dois eventos "data" viraria "�".
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "";
    let stderr = "";
    // Flags de aborto por nossa conta: quando matamos o processo (prazo ou
    // tamanho), o evento "close" chega com code === null e fabricaria um segundo
    // reject inútil — a rejeição do aborto já falou, então o close só volta.
    let mortoPorPrazo = false;
    let mortoPorTamanho = false;
    const timer = setTimeout(() => {
      mortoPorPrazo = true;
      child.kill("SIGKILL");
      reject(new Error(`O Gemini passou de ${TIMEOUT_MS / 60000} minutos e foi interrompido.`));
    }, TIMEOUT_MS);
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > MAX_STDOUT_CHARS) {
        mortoPorTamanho = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(
          new Error(
            "A resposta do Gemini passou de 10 MB e foi interrompida. Refaça a tarefa pedindo respostas menores."
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
              ? "O Gemini tentou usar uma ferramenta (provavelmente ler um arquivo) que o modo headless não permite. Reenvie a tarefa incluindo todo o conteúdo necessário no próprio texto."
              : "O Gemini terminou sem deixar uma resposta final."
          )
        );
        return;
      }
      resolve(message);
    });
  });
}
