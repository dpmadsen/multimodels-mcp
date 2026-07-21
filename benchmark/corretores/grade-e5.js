const arq = process.argv[2];
let RateLimiter;
try {
  const mod = require(arq);
  RateLimiter = mod.RateLimiter || mod;
  if (typeof RateLimiter !== "function") throw new Error("RateLimiter nao exportado");
} catch (e) { console.log(`SMOKE 0/5 NEM_CARREGA: ${e.message.split("\n")[0]}`); process.exit(0); }
let t = 0; const clock = () => t;
let ok = 0; const falhas = [];
try {
  const rl = new RateLimiter(3, 1000, clock);
  const a = [rl.permitir("x"), rl.permitir("x"), rl.permitir("x"), rl.permitir("x")];
  if (JSON.stringify(a) === JSON.stringify([true, true, true, false])) ok++; else falhas.push(`basico:${JSON.stringify(a)}`);
  if (rl.permitir("y") === true) ok++; else falhas.push("chaves");
  t = 1001;
  if (rl.permitir("x") === true) ok++; else falhas.push("expira");
  const rl2 = new RateLimiter(2, 1000, clock);
  t = 0; rl2.permitir("z"); t = 400; rl2.permitir("z"); t = 800;
  const b1 = rl2.permitir("z"); t = 1100; const b2 = rl2.permitir("z"); t = 1500; const b3 = rl2.permitir("z");
  if (b1 === false) ok++; else falhas.push(`nega no limite:${b1}`);
  if (b2 === true && b3 === true) ok++; else falhas.push(`desliza/negada nao conta:${b2},${b3}`);
} catch (e) { falhas.push(`THROW ${e.message.split("\n")[0]}`); }
console.log(`SMOKE ${ok}/5${falhas.length ? " | " + falhas.join(" ; ") : ""}`);
