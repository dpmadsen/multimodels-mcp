// Corretor oculto da rodada 2 (implementação real).
// Uso: node grade-impl.mjs /caminho/do/worktree
// Importa o código COMPILADO (dist/) da branch avaliada e roda 12 verificações.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
if (!root) {
  console.error("Uso: node grade-impl.mjs /caminho/do/worktree (com dist/ já compilado)");
  process.exit(2);
}

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err: String(err && err.message ? err.message : err) });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function expectThrow(fn, contains) {
  let threw = null;
  try {
    fn();
  } catch (err) {
    threw = String(err && err.message ? err.message : err);
  }
  assert(threw !== null, "esperava erro, mas não lançou");
  if (contains) {
    assert(
      threw.toLowerCase().includes(contains.toLowerCase()),
      `mensagem de erro não menciona "${contains}": ${threw}`
    );
  }
  return threw;
}

let config, codex;
try {
  config = await import(pathToFileURL(join(root, "dist", "config.js")).href);
} catch (err) {
  console.error("FALHA CRÍTICA: não consegui importar dist/config.js —", err.message);
}
try {
  codex = await import(pathToFileURL(join(root, "dist", "providers", "codex.js")).href);
} catch (err) {
  console.error("FALHA CRÍTICA: não consegui importar dist/providers/codex.js —", err.message);
}

const plainProvider = { type: "codex-cli", label: "Codex", enabled: true };
const listedProvider = {
  type: "codex-cli",
  label: "Codex",
  enabled: true,
  models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
};
const cfg = (p) => ({ providers: { codex: p } });

// --- resolução de ids ---
check("T1 retrocompat: id 'codex' puro segue funcionando (model undefined)", () => {
  const ref = config.resolveModel(cfg(plainProvider), "codex");
  assert(ref.provider.type === "codex-cli", "provider errado");
  assert(ref.model === undefined, `model deveria ser undefined, veio: ${ref.model}`);
});

check("T2 id 'codex:gpt-5.6-luna' resolve com model preenchido", () => {
  const ref = config.resolveModel(cfg(listedProvider), "codex:gpt-5.6-luna");
  assert(ref.model === "gpt-5.6-luna", `model veio: ${ref.model}`);
});

check("T3 modelo fora da lista → erro citando os habilitados", () => {
  expectThrow(() => config.resolveModel(cfg(listedProvider), "codex:gpt-4"), "gpt-5.6");
});

check("T4 provedor sem lista models → pedir modelo explícito dá erro", () => {
  expectThrow(() => config.resolveModel(cfg(plainProvider), "codex:gpt-5.6-luna"));
});

check("T5 retrocompat: 'codex' puro também funciona com lista configurada", () => {
  const ref = config.resolveModel(cfg(listedProvider), "codex");
  assert(ref.model === undefined, `model deveria ser undefined, veio: ${ref.model}`);
});

// --- montagem de argumentos ---
const OUT = "/tmp/x.txt";
check("T6 buildCodexArgs existe e é função", () => {
  assert(typeof codex.buildCodexArgs === "function", "export buildCodexArgs ausente");
});

check("T7 args padrão: exec, skip-git, sandbox read-only, output, tarefa no fim; sem -m", () => {
  const args = codex.buildCodexArgs("minha tarefa", { outFile: OUT });
  assert(args.includes("exec"), "faltou exec");
  assert(args.includes("--skip-git-repo-check"), "faltou --skip-git-repo-check");
  const si = args.indexOf("--sandbox");
  assert(si >= 0 && args[si + 1] === "read-only", "faltou --sandbox read-only");
  const oi = args.indexOf("--output-last-message");
  assert(oi >= 0 && args[oi + 1] === OUT, "faltou --output-last-message <outFile>");
  assert(args[args.length - 1] === "minha tarefa", "a tarefa deve ser o último argumento");
  assert(!args.includes("-m"), "não deveria ter -m sem model");
});

check("T8 com model: '-m gpt-5.6-luna' presente, antes da tarefa", () => {
  const args = codex.buildCodexArgs("t", { outFile: OUT, model: "gpt-5.6-luna" });
  const mi = args.indexOf("-m");
  assert(mi >= 0 && args[mi + 1] === "gpt-5.6-luna", "faltou -m gpt-5.6-luna");
  assert(mi < args.length - 1 && args[args.length - 1] === "t", "opções devem vir antes da tarefa");
});

check("T9 com effort: '-c model_reasoning_effort=high' presente", () => {
  const args = codex.buildCodexArgs("t", { outFile: OUT, effort: "high" });
  const ci = args.indexOf("-c");
  assert(ci >= 0, "faltou -c");
  const hasKV = args.some((a) => a.replace(/"/g, "") === "model_reasoning_effort=high");
  assert(hasKV, `faltou model_reasoning_effort=high; args: ${JSON.stringify(args)}`);
});

check("T10 effort inválido → erro amigável citando os válidos", () => {
  const msg = expectThrow(() => codex.buildCodexArgs("t", { outFile: OUT, effort: "turbo" }));
  assert(/low|medium|high/i.test(msg), `erro não lista valores válidos: ${msg}`);
});

check("T11 model + effort juntos: ambos presentes e sandbox segue read-only", () => {
  const args = codex.buildCodexArgs("t", { outFile: OUT, model: "gpt-5.6-terra", effort: "xhigh" });
  const mi = args.indexOf("-m");
  assert(mi >= 0 && args[mi + 1] === "gpt-5.6-terra", "faltou -m gpt-5.6-terra");
  assert(args.some((a) => a.replace(/"/g, "") === "model_reasoning_effort=xhigh"), "faltou effort xhigh");
  const si = args.indexOf("--sandbox");
  assert(si >= 0 && args[si + 1] === "read-only", "sandbox deixou de ser read-only");
});

check("T12 esforços válidos todos aceitos (low, medium, high, xhigh)", () => {
  for (const e of ["low", "medium", "high", "xhigh"]) {
    const args = codex.buildCodexArgs("t", { outFile: OUT, effort: e });
    assert(args.some((a) => a.replace(/"/g, "").endsWith(`=${e}`)), `esforço ${e} não aplicado`);
  }
});

// --- relatório ---
let pass = 0;
for (const r of results) {
  if (r.ok) {
    pass++;
    console.log(`PASS  ${r.name}`);
  } else {
    console.log(`FAIL  ${r.name} — ${r.err}`);
  }
}
console.log(`\nResultado: ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
