function dividirConta(totalCentavos, pessoas) {
  if (
    !Number.isSafeInteger(totalCentavos) ||
    totalCentavos < 0 ||
    !Number.isSafeInteger(pessoas) ||
    pessoas < 1
  ) {
    return null;
  }
  const base = Math.floor(totalCentavos / pessoas);
  const sobra = totalCentavos % pessoas;
  const partes = Array(pessoas).fill(base);
  for (let i = 0; i < sobra; i++) {
    partes[i]++;
  }
  return partes;
}
module.exports = { dividirConta };
