function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    const trimmed = texto.trim();
    if (trimmed === '') return null;
    const regex = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*)(?:,(\d{1,2}))?$/;
    const match = regex.exec(trimmed);
    if (!match) return null;
    const inteiroStr = match[1].replace(/\./g, '');
    const centavosStr = match[2] || '';
    const inteiro = parseInt(inteiroStr, 10);
    if (Number.isNaN(inteiro)) return null;
    let centavos;
    if (centavosStr.length === 0) {
      centavos = 0;
    } else if (centavosStr.length === 1) {
      centavos = parseInt(centavosStr, 10) * 10;
    } else {
      centavos = parseInt(centavosStr, 10);
    }
    return inteiro * 100 + centavos;
  } catch (e) {
    return null;
  }
}
module.exports = { parseValor };
