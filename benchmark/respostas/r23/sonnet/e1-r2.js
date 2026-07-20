function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    let s = texto.trim();
    if (s.length === 0) return null;
    if (s.startsWith('R$')) {
      s = s.slice(2).trimStart();
    }
    s = s.trim();
    if (s.length === 0) return null;
    const match = s.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/);
    if (!match) return null;
    const intPartRaw = match[1].replace(/\./g, '');
    let decPartRaw = match[2] || '';
    if (decPartRaw.length === 1) decPartRaw += '0';
    if (decPartRaw.length === 0) decPartRaw = '00';
    const reais = parseInt(intPartRaw, 10);
    const centavosDecimais = parseInt(decPartRaw, 10);
    if (Number.isNaN(reais) || Number.isNaN(centavosDecimais)) return null;
    return reais * 100 + centavosDecimais;
  } catch (e) {
    return null;
  }
}
module.exports = { parseValor };
