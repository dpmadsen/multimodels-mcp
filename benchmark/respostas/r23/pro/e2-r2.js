function dividirConta(totalCentavos, pessoas) {
  if (
    !Number.isInteger(totalCentavos) ||
    !Number.isInteger(pessoas) ||
    totalCentavos < 0 ||
    pessoas < 1
  ) {
    return null;
  }
  const base = Math.floor(totalCentavos / pessoas);
  const sobra = totalCentavos - base * pessoas;
  const partes = Array(pessoas).fill(base);
  for (let i = 0; i < sobra; i++) {
    partes[i] += 1;
  }
  return partes;
}
module.exports = { dividirConta };
