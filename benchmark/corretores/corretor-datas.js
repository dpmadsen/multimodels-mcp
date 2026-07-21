const casos = [
  [["01/01/2024","01/03/2024"], 60,   "ano bissexto 2024"],
  [["01/01/2023","01/03/2023"], 59,   "ano nao bissexto"],
  [["28/02/2024","01/03/2024"], 2,    "cruza 29 de fevereiro"],
  [["15/07/2026","20/07/2026"], 5,    "mesma semana"],
  [["20/07/2026","15/07/2026"], 5,    "ordem invertida (absoluto)"],
  [["29/02/2024","29/02/2024"], 0,    "datas iguais"],
  [["01/01/1900","01/01/2000"], 36524,"seculo: 1900 nao e bissexto"],
  [["29/02/2023","01/03/2023"], null, "29/02 em ano nao bissexto"],
  [["31/04/2024","01/05/2024"], null, "31 de abril nao existe"],
  [["2024-01-01","01/03/2024"], null, "formato errado"],
  [[null,"01/03/2024"],         null, "null"],
  [["abc","def"],               null, "lixo"],
];
const modelos = { "DeepSeek Flash": "./flash-datas.js", "Qwen 3.6 (Celta)": "./qwen-datas.js" };
for (const [nome, arq] of Object.entries(modelos)) {
  const { diasEntre } = require(arq);
  let ok = 0; const falhas = [];
  for (const [args, esperado, rotulo] of casos) {
    let r, erro = false;
    try { r = diasEntre(...args); } catch (e) { erro = true; r = "LANCOU ERRO"; }
    if (!erro && r === esperado) ok++;
    else falhas.push(`    ✗ ${rotulo}: esperado ${esperado}, veio ${r}`);
  }
  console.log(`${nome}: ${ok}/${casos.length}`);
  falhas.forEach(f => console.log(f));
}
