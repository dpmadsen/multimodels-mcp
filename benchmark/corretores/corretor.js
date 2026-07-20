const casos = [
  ["529.982.247-25", true,  "CPF valido formatado"],
  ["52998224725",    true,  "CPF valido so digitos"],
  ["111.444.777-35", true,  "CPF valido formatado 2"],
  ["111.111.111-11", false, "todos digitos iguais"],
  ["00000000000",    false, "todos zeros"],
  ["529.982.247-24", false, "digito verificador errado"],
  ["1234567890",     false, "10 digitos"],
  ["123456789012",   false, "12 digitos"],
  ["abc.def.ghi-jk", false, "letras"],
  ["",               false, "string vazia"],
  [null,             false, "null"],
  [undefined,        false, "undefined"],
];

const modelos = {
  "Codex": "./respostas/codex.js",
  "DeepSeek v4 Flash": "./respostas/ds-flash.js",
  "DeepSeek v4 Pro": "./respostas/ds-pro.js",
  "GLM 5.2": "./respostas/glm.js",
  "Gemma 4 26B": "./respostas/gemma.js",
  "Qwen VL 4B": "./respostas/qwen-vl.js",
};

for (const [nome, arquivo] of Object.entries(modelos)) {
  const { validarCPF } = require(arquivo);
  let passou = 0;
  const falhas = [];
  for (const [entrada, esperado, rotulo] of casos) {
    let resultado, erro = false;
    try { resultado = validarCPF(entrada); } catch (e) { erro = true; resultado = `LANCOU ERRO: ${e.constructor.name}`; }
    if (!erro && resultado === esperado) passou++;
    else falhas.push(`    ✗ ${rotulo}: esperado ${esperado}, veio ${resultado}`);
  }
  console.log(`${nome}: ${passou}/${casos.length}`);
  for (const f of falhas) console.log(f);
}
