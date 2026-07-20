function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    const trimmed = texto.trim();
    if (trimmed === '') return null;
    const regex = /^(?:R\$\s*)?(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
    const match = regex.exec(trimmed);
    if (!match) return null;
    const integerPart = match[1].replace(/\./g, '');
    let decimalPart = match[2] !== undefined ? match[2] : '0';
    if (decimalPart.length === 1) decimalPart += '0';
    const inteiro = parseInt(integerPart, 10);
    const centavos = parseInt(decimalPart, 10);
    if (Number.isNaN(inteiro) || Number.isNaN(centavos)) return null;
    return inteiro * 100 + centavos;
  } catch (e) {
    return null;
  }
}
module.exports = { parseValor };
