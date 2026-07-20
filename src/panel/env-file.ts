// Grava chaves de API no .env do projeto de forma segura:
// atualiza a linha da chave se existir, senão acrescenta no fim,
// sempre preservando comentários e as demais linhas.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function upsertEnvKey(envPath: string, key: string, value: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`Nome de variável inválido: "${key}".`);
  }
  const trimmed = value.trim();
  if (/[\r\n]/.test(trimmed)) {
    throw new Error("O valor da chave não pode ter quebras de linha.");
  }
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const lines = existing.split("\n");
  const lineRegex = new RegExp(`^\\s*${key}\\s*=`);
  let replaced = false;
  const updated = lines.map((line) => {
    if (!replaced && lineRegex.test(line)) {
      replaced = true;
      return `${key}=${trimmed}`;
    }
    return line;
  });
  if (!replaced) {
    if (updated.length > 0 && updated[updated.length - 1] === "") {
      updated.splice(updated.length - 1, 0, `${key}=${trimmed}`);
    } else {
      updated.push(`${key}=${trimmed}`);
    }
  }
  writeFileSync(envPath, updated.join("\n"), "utf8");
}

export function maskKey(value: string | undefined): { set: boolean; last4: string | null } {
  if (!value || value.trim() === "") return { set: false, last4: null };
  const v = value.trim();
  return { set: true, last4: v.slice(-4) };
}
