function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    let s = texto.trim();
    if (s === '') return null;
    if (s.startsWith('R$')) {
      s = s.slice(2).replace(/^\s+/, '');
    }
    if (s === '') return null;
    if (/[\s-]/.test(s)) return null;
    const m = s.match(/^([0-9.]+)(?:,([0-9]{1,2}))?$/);
    if (!m) return null;
    const inteiraStr = m[1];
    const decimalStr = m[2];
    let inteiraDigitos;
    if (inteiraStr.indexOf('.') === -1) {
      if (!/^[0-9]+$/.test(inteiraStr)) return null;
      inteiraDigitos = inteiraStr;
    } else {
      if (!/^[0-9]{1,3}(\.[0-9]{3})+$/.test(inteiraStr)) return null;
      inteiraDigitos = inteiraStr.replace(/\./g, '');
    }
    let centavosDecimais = 0;
    if (decimalStr !== undefined) {
      centavosDecimais = decimalStr.length === 1
        ? parseInt(decimalStr, 10) * 10
        : parseInt(decimalStr, 10);
    }
    const reais = parseInt(inteiraDigitos, 10);
    if (!Number.isFinite(reais)) return null;
    return reais * 100 + centavosDecimais;
  } catch (e) {
    return null;
  }
}
module.exports = { parseValor };
