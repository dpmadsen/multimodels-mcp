const fs = require("fs");
const raw = fs.readFileSync(process.argv[2], "utf8").trim();
const esperado = {
  clientes: [
    { nome: "Marina Souza", email: "marina.souza@gmail.com", valor_centavos: 124050, vencimento: "2026-08-05" },
    { nome: "Joaquim", email: null, valor_centavos: 120000, vencimento: "2026-08-15" },
    { nome: "Vertex Ltda", email: "contato@vertex.com.br", valor_centavos: 399999, vencimento: "2026-09-01" },
  ],
  total_centavos: 644049,
};
let obj = null, estrito = false;
try { obj = JSON.parse(raw); estrito = true; }
catch {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { obj = JSON.parse(m[1].trim()); } catch {} }
  if (!obj) { const i = raw.indexOf("{"), f = raw.lastIndexOf("}"); if (i >= 0 && f > i) { try { obj = JSON.parse(raw.slice(i, f + 1)); } catch {} } }
}
if (!obj) { console.log("FALHOU: nao e JSON de jeito nenhum"); process.exit(0); }
const norm = (s) => (s || "").toLowerCase();
let pontos = 0, detalhes = [];
if (typeof obj.total_centavos === "number" && obj.total_centavos === esperado.total_centavos) pontos++; else detalhes.push(`total: ${obj.total_centavos}`);
const cls = obj.clientes || [];
for (const e of esperado.clientes) {
  const c = cls.find((x) => norm(x.nome).includes(norm(e.nome).split(" ")[0]));
  if (!c) { detalhes.push(`faltou ${e.nome}`); continue; }
  let sub = [];
  if ((c.email ?? null) !== e.email) sub.push(`email=${c.email}`);
  if (c.valor_centavos !== e.valor_centavos) sub.push(`valor=${c.valor_centavos}`);
  if (c.vencimento !== e.vencimento) sub.push(`venc=${c.vencimento}`);
  if (sub.length === 0) pontos++; else detalhes.push(`${e.nome}: ${sub.join(",")}`);
}
console.log(`${pontos}/4 pontos | JSON ${estrito ? "PURO (obedeceu)" : "SUJO (precisou limpar - desobedeceu formato)"}${detalhes.length ? " | " + detalhes.join(" ; ") : ""}`);
