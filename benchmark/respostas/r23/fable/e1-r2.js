function parseValor(texto) {
  if (typeof texto !== 'string') return null;
  let s = texto.trim();
  if (s === '') return null;
  if (s.startsWith('R$')) {
    s = s.slice(2).trimStart();
  }
  if (s === '') return null;
  const regex = /^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
  const match = regex.exec(s);
  if (!match) return null;
  const parteInteira = match[1].replace(/\./g, '');
  let parteDecimal = match[2] || '0';
  if (parteDecimal.length === 1) parteDecimal += '0';
  const reais = parseInt(parteInteira, 10);
  const centavos = parseInt(parteDecimal, 10);
  if (!Number.isFinite(reais) || !Number.isFinite(centavos)) return null;
  return reais * 100 + centavos;
}
module.exports = { parseValor };
