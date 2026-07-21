function dividirConta(totalCentavos, pessoas) {
  if (!Number.isInteger(totalCentavos) || totalCentavos < 0 || 
      !Number.isInteger(pessoas) || pessoas < 1) {
    return null;
  }
  const base = Math.floor(totalCentavos / pessoas);
  const resto = totalCentavos % pessoas;
  const partes = [];
  for (let i = 0; i < pessoas; i++) {
    if (i < resto) {
      partes.push(base + 1);
    } else {
      partes.push(base);
    }
  }
  return partes;
}
module.exports = { dividirConta };
