function parseValor(texto) {
  if (typeof texto !== 'string') return null;
  const trimmed = texto.trim();
  if (trimmed === '') return null;
  const regex = /^R\$?\s*(\d+(?:\.\d{3})*)(?:,(\d{1,2}))?\s*$/;
  const match = trimmed.match(regex);
  if (!match) return null;
  const intPart = match[1].replace(/\./g, '');
  const decPart = match[2] || '0';
  return parseInt(intPart + decPart.padEnd(2, '0'), 10);
}
module.exports = { parseValor };
