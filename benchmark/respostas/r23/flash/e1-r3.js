function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    let str = texto.trim();
    if (str === '') return null;
    if (str.startsWith('R$')) {
      str = str.substring(2).trim();
      if (str === '') return null;
    }
    const regex = /^(\d{1,3}(?:\.\d{3})*)(?:,(\d{1,2}))?$/;
    const match = str.match(regex);
    if (!match) return null;
    const inteiraStr = match[1];
    const decimalStr = match[2];
    const inteira = parseInt(inteiraStr.replace(/\./g, ''), 10);
    if (isNaN(inteira)) return null;
    let centavos = 0;
    if (decimalStr !== undefined) {
      centavos = decimalStr.length === 1
        ? parseInt(decimalStr, 10) * 10
        : parseInt(decimalStr, 10);
    }
    return inteira * 100 + centavos;
  } catch (_) {
    return null;
  }
}
module.exports = { parseValor };
