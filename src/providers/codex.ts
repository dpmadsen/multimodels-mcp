// Ponte com o Codex: usa o programa `codex` já instalado e logado no Mac
// (assinatura do ChatGPT — sem custo de API). Roda em modo somente-leitura:
// o Codex analisa e responde, mas não altera arquivos.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TIMEOUT_MS = 10 * 60 * 1000;

export async function runCodex(task: string, workdir?: string): Promise<string> {
  const scratch = await mkdtemp(join(tmpdir(), "multimodels-codex-"));
  const outFile = join(scratch, "last-message.txt");
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "codex",
        [
          "exec",
          "--skip-git-repo-check",
          "--sandbox", "read-only",
          "--output-last-message", outFile,
          task,
        ],
        {
          cwd: workdir ?? process.cwd(),
          // stdin fechado ("ignore"): sem isso o codex fica esperando
          // entrada para sempre e a delegação trava.
          stdio: ["ignore", "ignore", "pipe"],
        }
      );
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`O Codex passou de ${TIMEOUT_MS / 60000} minutos e foi interrompido.`));
      }, TIMEOUT_MS);
      child.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (err.code === "ENOENT") {
          reject(
            new Error("Não encontrei o programa `codex` no Mac. Instale com: npm install -g @openai/codex e faça login.")
          );
        } else {
          reject(err);
        }
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`O Codex terminou com erro (código ${code}). Detalhe: ${stderr.slice(-500)}`));
        }
      });
    });
    const message = (await readFile(outFile, "utf8")).trim();
    if (!message) {
      throw new Error("O Codex terminou sem deixar uma resposta final.");
    }
    return message;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
