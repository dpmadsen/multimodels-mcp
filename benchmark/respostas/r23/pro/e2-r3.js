function dividirConta(totalCentavos, pessoas) {
  if (
    typeof totalCentavos !== 'number' ||
    typeof pessoas !== 'number' ||
    !Number.isInteger(totalCentavos) ||
    !Number.isInteger(pessoas) ||
    totalCentavos < 0 ||
    pessoas < 1
  ) {
    return null;
  }
  const base = Math.floor(totalCentavos / pessoas);
  const partes = new Array(pessoas).fill(base);
  const sobra = totalCentavos - base * pessoas;
  for (let i = 0; i < sobra; i++) {
    partes[i] += 1;
  }
  return partes;
}
module.exports = { dividirConta };
