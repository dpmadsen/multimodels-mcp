function parseValor(texto) {
  if (typeof texto !== "string") return null;

  const valor = texto.trim();
  const correspondencia = valor.match(
    /^(?:R\$\s*)?(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/
  );

  if (!correspondencia) return null;

  const reais = Number(correspondencia[1].replace(/\./g, ""));
  const centavos = Number((correspondencia[2] || "").padEnd(2, "0"));

  const resultado = reais * 100 + centavos;
  return Number.isSafeInteger(resultado) ? resultado : null;
}

module.exports = { parseValor };
