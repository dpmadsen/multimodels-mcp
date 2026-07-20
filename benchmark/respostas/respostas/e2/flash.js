function dividirConta(totalCentavos, pessoas) {
  if (
    typeof totalCentavos !== 'number' || !Number.isInteger(totalCentavos) ||
    typeof pessoas !== 'number' || !Number.isInteger(pessoas) ||
    totalCentavos < 0 || pessoas < 1
  ) {
    return null;
  }
  const base = Math.floor(totalCentavos / pessoas);
  const sobra = totalCentavos % pessoas;
  const partes = [];
  for (let i = 0; i < pessoas; i++) {
    partes.push(i < sobra ? base + 1 : base);
  }
  return partes;
}
module.exports = { dividirConta };
