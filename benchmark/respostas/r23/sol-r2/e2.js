function dividirConta(totalCentavos, pessoas) {
  if (
    !Number.isInteger(totalCentavos) ||
    totalCentavos < 0 ||
    !Number.isInteger(pessoas) ||
    pessoas < 1
  ) {
    return null;
  }

  const base = Math.floor(totalCentavos / pessoas);
  const extras = totalCentavos % pessoas;

  return Array.from(
    { length: pessoas },
    (_, indice) => base + (indice < extras ? 1 : 0)
  );
}

module.exports = { dividirConta };
