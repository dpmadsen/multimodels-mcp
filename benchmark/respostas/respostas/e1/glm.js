function parseValor(texto) {
  if (typeof texto !== 'string') return null;
  const regex = /^\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*$/;
  const match = texto.match(regex);
  if (!match) return null;
  const intPart = match[1].replace(/\./g, '');
  let decPart = match[2] ? match[2] : '';
  while (decPart.length < 2) decPart += '0';
  const cents = parseInt(intPart + decPart, 10);
  return Number.isFinite(cents) ? cents : null;
}
module.exports = { parseValor };
