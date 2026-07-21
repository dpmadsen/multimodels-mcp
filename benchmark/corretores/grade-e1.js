const casos = [
  ["R$ 1.234,56", 123456], ["1.234,56", 123456], ["1234,56", 123456],
  ["R$ 12", 1200], ["12,5", 1250], ["R$ 0,01", 1], ["0", 0],
  ["R$1.000", 100000], ["12.345.678,90", 1234567890], [" 25,00 ", 2500],
  ["1.234", 123400],
  ["1,234.56", null], ["12,345", null], ["12.34,56", null], ["1.23", null],
  ["", null], [null, null], ["-10,00", null],
];
const arq = process.argv[2];
let parseValor;
try { ({ parseValor } = require(arq)); }
catch (e) { console.log(`0/${casos.length} NEM_CARREGA ${e.constructor.name}: ${e.message.split("\n")[0]}`); process.exit(0); }
let ok = 0; const falhas = [];
for (const [inp, esp] of casos) {
  let r, erro = false;
  try { r = parseValor(inp); } catch (e) { erro = true; r = `THROW:${e.constructor.name}`; }
  if (!erro && r === esp) ok++; else falhas.push(`${JSON.stringify(inp)}=>esperado ${esp}, veio ${r}`);
}
console.log(`${ok}/${casos.length}${falhas.length ? " | " + falhas.join(" ; ") : ""}`);
