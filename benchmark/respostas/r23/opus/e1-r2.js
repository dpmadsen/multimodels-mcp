function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    let s = texto.trim();
    if (s === '') return null;
    const prefixo = /^R\$\s*/;
    if (prefixo.test(s)) {
      s = s.replace(prefixo, '');
    }
    if (s === '') return null;
    let parteInteira;
    let parteDecimal = '';
    const idxVirgula = s.indexOf(',');
    if (idxVirgula !== -1) {
      if (s.indexOf(',', idxVirgula + 1) !== -1) return null;
      parteInteira = s.slice(0, idxVirgula);
      parteDecimal = s.slice(idxVirgula + 1);
      if (!/^\d{1,2}$/.test(parteDecimal)) return null;
    } else {
      parteInteira = s;
    }
    if (parteInteira === '') return null;
    if (parteInteira.indexOf('.') !== -1) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(parteInteira)) return null;
    } else {
      if (!/^\d+$/.test(parteInteira)) return null;
    }
    const reais = parseInt(parteInteira.replace(/\./g, ''), 10);
    let centavos;
    if (parteDecimal === '') {
      centavos = 0;
    } else if (parteDecimal.length === 1) {
      centavos = parseInt(parteDecimal, 10) * 10;
    } else {
      centavos = parseInt(parteDecimal, 10);
    }
    const total = reais * 100 + centavos;
    if (!Number.isFinite(total)) return null;
    return total;
  } catch (e) {
    return null;
  }
}
module.exports = { parseValor };
