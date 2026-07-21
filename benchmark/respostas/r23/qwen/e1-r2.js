function parseValor(texto) {
  if (typeof texto !== 'string') return null;
  const str = texto.trim();
  if (!str) return null;
  const regex = /^(?:R\$)?\s?(\d{1,3}(?:\.\d{3})*|\d+)(,\d{1,2})?$/;
  const match = str.match(regex);
  if (!match) return null;
  let intPart = match[1].replace(/\./g, '');
  let decPart = match[2] ? match[2].slice(1) : '';
  if (decPart.length === 1) decPart += '0';
  else if (decPart.length === 0) decPart = '00';
  return Number(intPart + decPart);
}
module.exports = { parseValor };
