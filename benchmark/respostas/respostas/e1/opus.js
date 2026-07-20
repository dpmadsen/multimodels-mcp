function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    let s = texto.trim();
    if (s === '') return null;
    if (s.startsWith('R$')) {
      s = s.slice(2).replace(/^\s+/, '');
    }
    if (s === '') return null;
    const m = s.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/);
    if (!m) return null;
    const inteiraStr = m[1].replace(/\./g, '');
    const decimalStr = m[2] || '';
    const reais = parseInt(inteiraStr, 10);
    if (!Number.isInteger(reais)) return null;
    let centavosDec;
    if (decimalStr.length === 0) {
      centavosDec = 0;
    } else if (decimalStr.length === 1) {
      centavosDec = parseInt(decimalStr, 10) * 10;
    } else {
      centavosDec = parseInt(decimalStr, 10);
    }
    return reais * 100 + centavosDec;
  } catch (e) {
    return null;
  }
}
module.exports = { parseValor };
