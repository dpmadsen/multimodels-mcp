// Ponte com o Codex: usa o programa `codex` já instalado e logado (Mac, Linux ou Windows)
// (assinatura do ChatGPT — sem custo de API). Roda em modo somente-leitura:
// o Codex analisa e responde, mas não altera arquivos.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveMaxResponseBytes, resolveTimeoutMs, type CodexProvider, type ModelsConfig } from "../config.js";
import { montarAmbienteCodex } from "./ambiente-filho.js";
import { ErroLimiteDeSaida } from "./limite-saida.js";

// Valores aceitos pelo CLI para "quanto o modelo deve pensar" antes de responder.
const EFFORT_VALIDOS = ["low", "medium", "high", "xhigh"] as const;

// Monta os argumentos passados ao `spawn("codex", args)` — função pura, sem
// efeitos colaterais, pra ficar fácil de testar. Não inclui o próprio executável.
export function buildCodexArgs(
  task: string,
  opts: { outFile: string; model?: string; effort?: string }
): string[] {
  const args: string[] = ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "--output-last-message", opts.outFile];
  if (opts.model) {
    args.push("-m", opts.model);
  }
  if (opts.effort !== undefined) {
    if (!(EFFORT_VALIDOS as readonly string[]).includes(opts.effort)) {
      throw new Error(
        `Esforço de raciocínio inválido: "${opts.effort}". Valores aceitos: ${EFFORT_VALIDOS.join(", ")}.`
      );
    }
    args.push("-c", `model_reasoning_effort=${opts.effort}`);
  }
  args.push(task);
  return args;
}

export async function runCodex(
  config: ModelsConfig | undefined,
  provider: CodexProvider | undefined,
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
  const scratch = await mkdtemp(join(tmpdir(), "multimodels-codex-"));
  const outFile = join(scratch, "last-message.txt");
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "codex",
        buildCodexArgs(task, { outFile, model, effort }),
        {
          cwd: workdir,
          // stdin fechado ("ignore"): sem isso o codex fica esperando
          // entrada para sempre e a delegação trava.
          stdio: ["ignore", "ignore", "pipe"],
          env: montarAmbienteCodex(process.env),
        }
      );
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`O Codex passou de ${timeoutMs / 60000} minutos e foi interrompido.`));
      }, timeoutMs);
      child.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (err.code === "ENOENT") {
          reject(
            new Error("Não encontrei o programa `codex` no PATH. Instale com: npm install -g @openai/codex e faça login.")
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
    const tamanho = (await stat(outFile)).size;
    if (tamanho > maxResponseBytes) {
      throw new ErroLimiteDeSaida(tamanho, maxResponseBytes);
    }
    const message = (await readFile(outFile, "utf8")).trim();
    if (!message) {
      throw new Error("O Codex terminou sem deixar uma resposta final.");
    }
    return message;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
