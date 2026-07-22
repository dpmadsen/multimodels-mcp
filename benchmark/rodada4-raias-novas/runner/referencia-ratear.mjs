export function ratear(totalCentavos, participantes) {
  if (!Number.isInteger(totalCentavos)) return null;
  if (!Array.isArray(participantes) || participantes.length === 0) return null;
  for (const p of participantes) {
    if (typeof p.peso !== "number" || !Number.isFinite(p.peso) || p.peso < 0) return null;
    if (p.tetoCentavos !== undefined && (!Number.isInteger(p.tetoCentavos) || p.tetoCentavos <= 0)) return null;
  }
  const n = participantes.length;
  const sinal = totalCentavos < 0 ? -1 : 1;
  let restante = Math.abs(totalCentavos);
  const todosZero = participantes.every((p) => p.peso === 0);
  const pesos = participantes.map((p) => (todosZero ? 1 : p.peso));
  const tetos = participantes.map((p) => (p.tetoCentavos !== undefined ? p.tetoCentavos : Infinity));
  const elegivel = participantes.map((p) => todosZero || p.peso > 0);
  const aloc = new Array(n).fill(0);

  while (restante > 0) {
    const ativos = [];
    for (let i = 0; i < n; i++) if (elegivel[i] && aloc[i] < tetos[i]) ativos.push(i);
    if (ativos.length === 0) return null;
    const somaPesos = ativos.reduce((s, i) => s + pesos[i], 0);
    const fracInfo = [];
    let dados = 0;
    for (const i of ativos) {
      const cota = (restante * pesos[i]) / somaPesos;
      let piso = Math.floor(cota);
      const espaco = tetos[i] - aloc[i];
      if (piso > espaco) piso = espaco;
      aloc[i] += piso;
      dados += piso;
      fracInfo.push({ i, frac: cota - Math.floor(cota) });
    }
    let sobraRodada = restante - dados;
    fracInfo.sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
    for (const { i } of fracInfo) {
      if (sobraRodada <= 0) break;
      if (aloc[i] < tetos[i]) { aloc[i] += 1; sobraRodada -= 1; dados += 1; }
    }
    if (dados === 0) return null;
    restante -= dados;
  }
  return aloc.map((v) => v * sinal);
}
