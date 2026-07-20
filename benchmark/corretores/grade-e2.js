const casos = [
  [[101, 2], [51, 50]], [[200, 3], [67, 67, 66]], [[100, 3], [34, 33, 33]],
  [[100, 1], [100]], [[0, 3], [0, 0, 0]], [[10, 4], [3, 3, 2, 2]],
  [[100, 0], null], [[-5, 2], null], [[7, 5], [2, 2, 1, 1, 1]],
];
const arq = process.argv[2];
let dividirConta;
try { ({ dividirConta } = require(arq)); }
catch (e) { console.log(`0/${casos.length} NEM_CARREGA ${e.constructor.name}: ${e.message.split("\n")[0]}`); process.exit(0); }
let ok = 0; const falhas = [];
for (const [args, esp] of casos) {
  let r, erro = false;
  try { r = dividirConta(...args); } catch (e) { erro = true; r = `THROW:${e.constructor.name}`; }
  const igual = !erro && JSON.stringify(r) === JSON.stringify(esp);
  if (igual) ok++; else falhas.push(`(${args})=>esperado ${JSON.stringify(esp)}, veio ${JSON.stringify(r)}`);
}
console.log(`${ok}/${casos.length}${falhas.length ? " | " + falhas.join(" ; ") : ""}`);
