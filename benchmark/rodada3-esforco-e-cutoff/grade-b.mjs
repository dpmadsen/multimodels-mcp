// Corretor oculto da Estação B. Uso: node grade-b.mjs /pasta/da/execucao
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
if (!root) { console.error("Uso: node grade-b.mjs /pasta/da/execucao"); process.exit(2); }

const results = [];
const check = (name, fn) => { try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, err: String(e.message).slice(0, 110) }); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let mod = null, importErr = null;
try { mod = await import(pathToFileURL(join(root, "src", "ratear.mjs")).href); }
catch (e) { importErr = String(e.message).slice(0, 140); }

check("B1 módulo importa e exporta ratear", () => {
  assert(mod, `import falhou: ${importErr}`);
  assert(typeof mod.ratear === "function", "export ratear ausente");
});

if (mod && typeof mod.ratear === "function") {
  const r = mod.ratear;
  const P = (...specs) => specs.map(([peso, teto], k) => teto === undefined ? { id: String(k), peso } : { id: String(k), peso, tetoCentavos: teto });

  const casos = [
    ["B2 pesos iguais, resto no início: 10/[1,1,1,1] → [3,3,2,2]", 10, P([1],[1],[1],[1]), [3,3,2,2]],
    ["B3 proporcional com maior resto: 1003/[2,1] → [669,334]", 1003, P([2],[1]), [669,334]],
    ["B4 empate de resto → menor índice: 5/[1,1] → [3,2]", 5, P([1],[1]), [3,2]],
    ["B5 peso 0 recebe 0: 10/[0,1] → [0,10]", 10, P([0],[1]), [0,10]],
    ["B6 todos peso 0 → partes iguais: 7/[0,0,0] → [3,2,2]", 7, P([0],[0],[0]), [3,2,2]],
    ["B7 teto simples redistribui: 100/[1(teto10),1] → [10,90]", 100, P([1,10],[1]), [10,90]],
    ["B8 cascata de tetos: 100/[1(t10),1(t20),1] → [10,20,70]", 100, P([1,10],[1,20],[1]), [10,20,70]],
    ["B9 tetos insuficientes → null", 100, P([1,30],[1,30]), null],
    ["B10 estorno simétrico: -1003/[2,1] → [-669,-334]", -1003, P([2],[1]), [-669,-334]],
    ["B11 estorno com teto: -100/[1(t10),1] → [-10,-90]", -100, P([1,10],[1]), [-10,-90]],
    ["B12 pesos 5/3/2: 777 → [389,233,155]", 777, P([5],[3],[2]), [389,233,155]],
    ["B13 participante único: 7/[3] → [7]; com teto 5 → null", 7, P([3]), [7]],
    ["B14 pesos decimais: 10/[0.5,0.5] → [5,5]", 10, P([0.5],[0.5]), [5,5]],
    ["B15 teto apertando o maior peso: 200/[1(t50),3(t60),1] → [50,60,90]", 200, P([1,50],[3,60],[1]), [50,60,90]],
  ];
  for (const [nome, total, ps, esperado] of casos) {
    check(nome, () => {
      const got = r(total, ps.map((p) => ({ ...p })));
      assert(eq(got, esperado), `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(got)}`);
    });
  }
  check("B13b participante único com teto insuficiente → null", () => {
    assert(r(7, [{ id: "a", peso: 3, tetoCentavos: 5 }]) === null, "deveria ser null");
  });
  check("B16 entradas inválidas → null (10.5; []; peso -1; teto 0; teto 5.5)", () => {
    assert(r(10.5, [{ id: "a", peso: 1 }]) === null, "10.5");
    assert(r(10, []) === null, "lista vazia");
    assert(r(10, [{ id: "a", peso: -1 }]) === null, "peso negativo");
    assert(r(10, [{ id: "a", peso: 1, tetoCentavos: 0 }]) === null, "teto 0");
    assert(r(10, [{ id: "a", peso: 1, tetoCentavos: 5.5 }]) === null, "teto 5.5");
  });
  check("B17 soma exata e ordem preservada em caso grande", () => {
    const ps = P([7],[13],[1],[29],[3],[11]);
    const got = r(999983, ps);
    assert(Array.isArray(got) && got.length === 6, "forma errada");
    assert(got.reduce((s, v) => s + v, 0) === 999983, "soma não bate");
    assert(got.every((v) => Number.isInteger(v)), "valores não inteiros");
  });
} else {
  for (let i = 2; i <= 17; i++) results.push({ name: `B${i} (não avaliado)`, ok: false, err: "import falhou" });
}

let pass = 0;
for (const x of results) { if (x.ok) { pass++; console.log(`PASS  ${x.name}`); } else console.log(`FAIL  ${x.name} — ${x.err}`); }
console.log(`\nEstação B: ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
