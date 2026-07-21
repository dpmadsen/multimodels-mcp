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
  const extras = totalCentavos % pessoas;
  const partes = [];

  for (let i = 0; i < pessoas; i++) {
    partes.push(base + (i < extras ? 1 : 0));
  }

  return partes;
}

module.exports = { dividirConta };
