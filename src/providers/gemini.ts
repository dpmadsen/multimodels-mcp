// Ponte com o Gemini: usa o programa `agy` (Antigravity CLI do Google) já
// instalado e logado na conta Google (assinatura Google AI Pro — sem custo de
// API). Roda em modo "plan" (somente-leitura): analisa e responde, mas não
// altera arquivos. Nota: o antigo `gemini-cli` foi aposentado pelo Google em
// 2026-06-18 para contas pessoais; o `agy` é o substituto oficial.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TIMEOUT_MS = 10 * 60 * 1000;

// O instalador oficial coloca o agy em ~/.local/bin, que nem sempre está no
// PATH do processo do servidor. Preferimos o caminho completo quando existe.
export function resolveAgyBinary(): string {
  const instalado = join(homedir(), ".local", "bin", "agy");
  return existsSync(instalado) ? instalado : "agy";
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
  // --print-timeout: o agy tem prazo próprio de 5 minutos no modo headless;
  // alinhamos com o nosso prazo de 10 pra quem manda a última palavra sermos nós.
  const args: string[] = ["--mode", "plan", "--print-timeout", "10m"];
  if (opts.model) {
    args.push("--model", opts.model);
  }
  args.push("-p", task);
  return args;
}

export async function runGemini(task: string, workdir?: string, model?: string, effort?: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(resolveAgyBinary(), buildGeminiArgs(task, { model, effort }), {
      cwd: workdir ?? process.cwd(),
      // stdin fechado ("ignore"): sem isso o agy fica esperando
      // entrada para sempre e a delegação trava.
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`O Gemini passou de ${TIMEOUT_MS / 60000} minutos e foi interrompido.`));
    }, TIMEOUT_MS);
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
