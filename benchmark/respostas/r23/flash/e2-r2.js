function dividirConta(totalCentavos, pessoas) {
  if (
    !Number.isInteger(totalCentavos) || totalCentavos < 0 ||
    !Number.isInteger(pessoas) || pessoas < 1
  ) {
    return null;
  }
  const base = Math.floor(totalCentavos / pessoas);
  const sobra = totalCentavos % pessoas;
  const partes = new Array(pessoas).fill(base);
  for (let i = 0; i < sobra; i++) {
    partes[i] += 1;
  }
  return partes;
}
module.exports = { dividirConta };
