function parseValor(texto) {
  if (typeof texto !== 'string') return null;
  let s = texto.trim();
  if (s === '') return null;
  if (/^R\$/i.test(s)) {
    s = s.replace(/^R\$/i, '').trim();
  }
  const regex = /^(\d{1,3}(?:\.\d{3})*)(?:,(\d{1,2}))?$/;
  const match = s.match(regex);
  if (!match) return null;
  const reais = parseInt(match[1].replace(/\./g, ''), 10);
  let centavos = 0;
  if (match[2] !== undefined) {
    const dec = match[2];
    centavos = dec.length === 1 ? parseInt(dec, 10) * 10 : parseInt(dec, 10);
  }
  return reais * 100 + centavos;
}
module.exports = { parseValor };
