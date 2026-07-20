function dividirConta(totalCentavos, pessoas) {
  if (!Number.isInteger(totalCentavos) || !Number.isInteger(pessoas)) return null;
  if (totalCentavos < 0 || pessoas < 1) return null;
  const base = Math.floor(totalCentavos / pessoas);
  const partes = [];
  for (let i = 0; i < pessoas; i++) partes.push(base);
  let sobra = totalCentavos - base * pessoas;
  for (let i = 0; sobra > 0; i++, sobra--) partes[i] += 1;
  return partes;
}
module.exports = { dividirConta };
