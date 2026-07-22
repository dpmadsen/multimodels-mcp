// Runner de UMA execução da RODADA 4. Uso:
//   node run-one.mjs <lane> <estacao a|b> <rodada r1|r2|r3>
// lane ∈ { gemini31pro-high, gemini36flash-high, kimi-k3 }
import { runGemini } from "/Users/danielmadsen/Documents/Claude Code/Multimodels/dist/providers/gemini.js";
import { chatCompletion } from "/Users/danielmadsen/Documents/Claude Code/Multimodels/dist/providers/openai-compat.js";
import { loadConfig, loadEnvFile } from "/Users/danielmadsen/Documents/Claude Code/Multimodels/dist/config.js";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = "/Users/danielmadsen/Documents/Claude Code/Multimodels";
const R4 = `${ROOT}/benchmark/rodada4-raias-novas`;
const R3 = `${ROOT}/benchmark/rodada3-esforco-e-cutoff`;
const CEN_A = `${R4}/cenario-a`;
const SAIDAS = `${R4}/saidas`;
const CORR = `${R4}/correcoes`;
const SCRATCH = "/private/tmp/claude-501/-Users-danielmadsen-Documents-Claude-Code-Multimodels/369ddde6-01e9-4732-a452-6b93af295127/scratchpad/r4";

loadEnvFile(ROOT);
const config = loadConfig(ROOT);

const [lane, estacao, rodada] = process.argv.slice(2);
const modelDe = {
  "gemini31pro-high": "gemini-3.1-pro-high",
  "gemini36flash-high": "gemini-3.6-flash-high",
};
const arquivoEntregavel = estacao === "a" ? "src/validador.mjs" : "src/ratear.mjs";

// ---- monta a tarefa ----
const provaMd = readFileSync(`${R3}/estacao-${estacao}.md`, "utf8");
let apendice =
  `\n\n---\n\nENTREGA: responda com o conteúdo COMPLETO do arquivo ${arquivoEntregavel} ` +
  "dentro de UM ÚNICO bloco de código ```javascript. Nada de explicações fora do bloco.";
const isGeminiA = lane.startsWith("gemini") && estacao === "a";
if (isGeminiA) {
  apendice +=
    "\n\nA pasta do projeto está acessível SOMENTE PARA LEITURA. Confira a versão instalada do zod " +
    "(package.json e node_modules/zod/package.json) antes de escrever. Você não consegue rodar npm test — revise com cuidado.";
}
const tarefa = provaMd + apendice;

// ---- extrai o bloco de código ----
function extrairBloco(texto) {
  const re = /```(?:javascript|js|mjs)?\s*\n([\s\S]*?)```/gi;
  const blocos = [];
  let m;
  while ((m = re.exec(texto)) !== null) blocos.push(m[1]);
  if (blocos.length === 0) return { code: null, n: 0 };
  // pega o maior bloco (o entregável costuma ser o mais longo)
  blocos.sort((a, b) => b.length - a.length);
  return { code: blocos[0], n: blocos.length };
}

async function chamar() {
  const t0 = Date.now();
  let texto = "";
  let usage = null;
  if (lane === "kimi-k3") {
    const r = await chatCompletion(config.providers.openrouter, "moonshotai/kimi-k3", tarefa);
    texto = r.text;
    usage = r.usage;
  } else {
    const model = modelDe[lane];
    let workdir;
    if (isGeminiA) {
      workdir = `${SCRATCH}/${lane}-a-${rodada}`;
      rmSync(workdir, { recursive: true, force: true });
      cpSync(CEN_A, workdir, { recursive: true });
    }
    texto = await runGemini(tarefa, workdir, model);
  }
  const dur = (Date.now() - t0) / 1000;
  return { texto, usage, dur };
}

function corrigir(code) {
  const pasta = `${CORR}/${lane}-${estacao}-${rodada}`;
  rmSync(pasta, { recursive: true, force: true });
  if (estacao === "a") {
    cpSync(CEN_A, pasta, { recursive: true });
    writeFileSync(`${pasta}/src/validador.mjs`, code ?? "// vazio\n");
    const out = tentaGrade("grade-a.mjs", pasta);
    return { pasta, ...out, total: 14 };
  } else {
    mkdirSync(`${pasta}/src`, { recursive: true });
    writeFileSync(`${pasta}/src/ratear.mjs`, code ?? "// vazio\n");
    const out = tentaGrade("grade-b.mjs", pasta);
    return { pasta, ...out, total: 18 };
  }
}

function tentaGrade(grader, pasta) {
  let saida = "";
  try {
    saida = execFileSync("node", [`${R3}/${grader}`, pasta], { encoding: "utf8" });
  } catch (e) {
    saida = (e.stdout || "") + (e.stderr || "");
  }
  const mm = saida.match(/Estação [AB]:\s*(\d+)\/(\d+)/);
  const nota = mm ? Number(mm[1]) : 0;
  return { nota, graderOut: saida };
}

(async () => {
  const meta = { lane, estacao, rodada };
  try {
    const { texto, usage, dur } = await chamar();
    // salva saída crua
    writeFileSync(`${SAIDAS}/${lane}-${estacao}-${rodada}.md`, texto);
    const { code, n } = extrairBloco(texto);
    const { nota, total, pasta, graderOut } = corrigir(code);
    const tokens = usage?.completion_tokens ?? "-";
    const notaStr = code === null ? `${nota}/${total} (sem bloco de código)` : `${nota}/${total}`;
    const linha = `${lane}\t${estacao}\t${rodada}\t${notaStr}\t${dur.toFixed(0)}\t${tokens}`;
    console.log("RESULT\t" + linha);
    console.log("USAGE\t" + JSON.stringify(usage ?? null));
    console.log("META\tblocos=" + n + " pasta=" + pasta);
    console.log("GRADER_TAIL\t" + (graderOut.trim().split("\n").slice(-1)[0] || ""));
  } catch (e) {
    const msg = String(e.message || e).replace(/\s+/g, " ").slice(0, 200);
    console.log(`RESULT\t${lane}\t${estacao}\t${rodada}\tERRO\t-\t-`);
    console.log("ERRMSG\t" + msg);
  }
})();
