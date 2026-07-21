function parseValor(texto) {
  if (typeof texto !== 'string') return null;
  const str = texto.trim();
  if (str.length === 0) return null;
  const regex = /^(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/;
  const match = str.match(regex);
  if (!match) return null;
  const inteiroStr = match[1].replace(/\./g, '');
  const decimalStr = match[2];
  const inteiro = parseInt(inteiroStr, 10);
  let centavos = inteiro * 100;
  if (decimalStr !== undefined) {
    if (decimalStr.length === 1) {
      centavos += parseInt(decimalStr, 10) * 10;
    } else {
      centavos += parseInt(decimalStr, 10);
    }
  }
  return centavos;
}
module.exports = { parseValor };
