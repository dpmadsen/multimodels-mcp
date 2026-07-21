function dividirConta(totalCentavos, pessoas) {
  if (!Number.isInteger(totalCentavos) || !Number.isInteger(pessoas) || 
      totalCentavos < 0 || pessoas < 1) {
    return null;
  }
  const base = Math.floor(totalCentavos / pessoas);
  const sobra = totalCentavos % pessoas;
  const partes = [];
  for (let i = 0; i < pessoas; i++) {
    if (i < sobra) {
      partes.push(base + 1);
    } else {
      partes.push(base);
    }
  }
  return partes;
}
module.exports = { dividirConta };
