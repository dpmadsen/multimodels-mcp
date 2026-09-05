import { realpath, stat } from "node:fs/promises";

export async function resolverPastaDeTrabalho(workdir: string | undefined): Promise<string> {
  if (!workdir?.trim()) {
    throw new Error("O campo workdir é obrigatório para modelos que acessam arquivos.");
  }
  let canonica: string;
  try {
    canonica = await realpath(workdir);
  } catch {
    throw new Error(`A pasta indicada em workdir não existe: ${workdir}`);
  }
  if (!(await stat(canonica)).isDirectory()) {
    throw new Error(`O caminho indicado em workdir não é uma pasta: ${workdir}`);
  }
  return canonica;
}
