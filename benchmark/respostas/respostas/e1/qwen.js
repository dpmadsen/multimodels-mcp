function parseValor(texto) {
  if (typeof texto !== 'string') return null;
  let s = texto.trim();
  if (s.toUpperCase().startsWith('R$')) {
    s = s.slice(2).trimStart();
  }
  if (!s) return null;
  const match = s.match(/^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/);
  if (!match) return null;
  let intPart = match[1];
  let decPart = match[2] || '';
  intPart = intPart.replace(/\./g, '');
  const intVal = parseInt(intPart, 10);
  const decVal = parseInt(decPart || '0', 10) * (decPart.length === 1 ? 10 : 1);
  if (isNaN(intVal)) return null;
  return intVal * 100 + decVal;
}
module.exports = { parseValor };
