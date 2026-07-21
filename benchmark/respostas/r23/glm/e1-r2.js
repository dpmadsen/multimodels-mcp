function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    let s = texto.trim();
    if (s === '') return null;
    if (s.startsWith('R$')) {
      s = s.slice(2).replace(/^\s+/, '');
    }
    if (s === '') return null;
    const re = /^(\d{1,3}(\.\d{3})+|\d+)(,(\d{1,2}))?$/;
    const m = s.match(re);
    if (!m) return null;
    const intPart = m[1];
    const decPart = m[4] || '';
    const intStr = intPart.replace(/\./g, '');
    const intVal = parseInt(intStr, 10);
    if (!Number.isFinite(intVal)) return null;
    let cents = intVal * 100;
    if (decPart.length === 1) {
      cents += parseInt(decPart, 10) * 10;
    } else if (decPart.length === 2) {
      cents += parseInt(decPart, 10);
    }
    if (!Number.isFinite(cents)) return null;
    return cents;
  } catch (e) {
    return null;
  }
}
module.exports = { parseValor };
