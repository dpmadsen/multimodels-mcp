// Corretor oculto da Estação A. Uso: node grade-a.mjs /pasta/da/execucao
// Importa src/validador.mjs da pasta avaliada e roda 14 verificações.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
if (!root) { console.error("Uso: node grade-a.mjs /pasta/da/execucao"); process.exit(2); }

const results = [];
const check = (name, fn) => { try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, err: String(e.message).slice(0, 120) }); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

let mod = null, importErr = null;
try {
  mod = await import(pathToFileURL(join(root, "src", "validador.mjs")).href);
} catch (e) { importErr = String(e.message).slice(0, 160); }

check("A1 módulo importa sem explodir (APIs da versão instalada do zod)", () => {
  assert(mod, `import falhou: ${importErr}`);
  assert(typeof mod.validarConfiguracao === "function", "validarConfiguracao ausente");
});

const V = (over = {}) => mod.validarConfiguracao({
  nome: "Agência Central", email: "contato@agencia.com", servidorIp: "192.168.0.10",
  faixaLiberada: "10.0.0.0/8", porta: 8080, precosPorServico: { ensaio: 150000 }, ...over,
});
const msgDe = (r, campo) => (r.erros || []).find((e) => e.campo === campo)?.mensagem;

if (mod && typeof mod.validarConfiguracao === "function") {
  check("A2 config válida passa e devolve dados", () => {
    const r = V(); assert(r.ok === true, "ok!==true"); assert(r.dados?.porta === 8080, "dados errados");
  });
  check("A3 campo desconhecido é descartado do resultado", () => {
    const r = V({ campoFantasma: 1 }); assert(r.ok === true, "deveria passar");
    assert(!("campoFantasma" in r.dados), "campo desconhecido sobrou");
  });
  check("A4 IPv4 inválido (10.0.0.256) → mensagem exata", () => {
    const r = V({ servidorIp: "10.0.0.256" }); assert(r.ok === false, "deveria falhar");
    assert(msgDe(r, "servidorIp") === "endereço IPv4 inválido", `msg: ${msgDe(r, "servidorIp")}`);
  });
  check("A5 CIDR inválido (/33) → mensagem exata", () => {
    const r = V({ faixaLiberada: "10.0.0.0/33" }); assert(r.ok === false, "deveria falhar");
    assert(msgDe(r, "faixaLiberada") === "faixa CIDR inválida", `msg: ${msgDe(r, "faixaLiberada")}`);
  });
  check("A6 CIDR lixo (abc) → mensagem exata", () => {
    const r = V({ faixaLiberada: "abc" });
    assert(r.ok === false && msgDe(r, "faixaLiberada") === "faixa CIDR inválida", `msg: ${msgDe(r, "faixaLiberada")}`);
  });
  check("A7 porta com tipo errado → 'porta deve ser um número'", () => {
    const r = V({ porta: "8080" });
    assert(r.ok === false && msgDe(r, "porta") === "porta deve ser um número", `msg: ${msgDe(r, "porta")}`);
  });
  check("A8 porta 0 e 65536 → 'porta fora da faixa'", () => {
    for (const p of [0, 65536]) {
      const r = V({ porta: p });
      assert(r.ok === false && msgDe(r, "porta") === "porta fora da faixa", `porta ${p}: ${msgDe(r, "porta")}`);
    }
  });
  check("A9 porta 3.5 (não inteira) → 'porta fora da faixa'", () => {
    const r = V({ porta: 3.5 });
    assert(r.ok === false && msgDe(r, "porta") === "porta fora da faixa", `msg: ${msgDe(r, "porta")}`);
  });
  check("A10 email inválido → mensagem exata", () => {
    const r = V({ email: "nao-e-email" });
    assert(r.ok === false && msgDe(r, "email") === "email inválido", `msg: ${msgDe(r, "email")}`);
  });
  check("A11 nome curto → mensagem exata", () => {
    const r = V({ nome: "ab" });
    assert(r.ok === false && msgDe(r, "nome") === "nome muito curto", `msg: ${msgDe(r, "nome")}`);
  });
  check("A12 preço negativo → falha com campo 'precosPorServico.<chave>'", () => {
    const r = V({ precosPorServico: { edicao: -5 } });
    assert(r.ok === false, "deveria falhar");
    assert((r.erros || []).some((e) => e.campo === "precosPorServico.edicao"), "campo com caminho pontilhado ausente");
  });
  check("A13 preço quebrado (1.5) falha; dicionário vazio passa", () => {
    assert(V({ precosPorServico: { x: 1.5 } }).ok === false, "1.5 deveria falhar");
    assert(V({ precosPorServico: {} }).ok === true, "vazio deveria passar");
  });
  check("A14 contato: opcional passa; telefone curto → campo 'contato.telefone'", () => {
    assert(V().ok === true, "sem contato deveria passar");
    const r = V({ contato: { telefone: "123" } });
    assert(r.ok === false && (r.erros || []).some((e) => e.campo === "contato.telefone"), "caminho contato.telefone ausente");
  });
} else {
  for (let i = 2; i <= 14; i++) results.push({ name: `A${i} (não avaliado: módulo não importou)`, ok: false, err: "import falhou" });
}

let pass = 0;
for (const r of results) { if (r.ok) { pass++; console.log(`PASS  ${r.name}`); } else console.log(`FAIL  ${r.name} — ${r.err}`); }
console.log(`\nEstação A: ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
