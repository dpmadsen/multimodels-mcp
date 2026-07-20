function parseValor(texto) {
  if (typeof texto !== 'string') return null;

  const match = texto
    .trim()
    .match(/^(?:R\$ ?)?(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/);

  if (!match) return null;

  const reais = Number(match[1].replace(/\./g, ''));
  const centavos = match[2]
    ? Number(match[2].padEnd(2, '0'))
    : 0;

  const total = reais * 100 + centavos;

  return Number.isSafeInteger(total) ? total : null;
}

module.exports = { parseValor };
