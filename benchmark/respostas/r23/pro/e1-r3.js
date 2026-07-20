function parseValor(texto) {
  if (texto == null || typeof texto !== 'string') return null;
  const trimmed = texto.trim();
  if (trimmed === '') return null;
  if (trimmed.includes('-')) return null;
  const padrao = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/;
  const match = trimmed.match(padrao);
  if (!match) return null;
  const inteiroStr = match[1].replace(/\./g, '');
  const centavosStr = match[2] !== undefined ? match[2] : '0';
  const centavosFinal = centavosStr.length === 1 ? centavosStr + '0' : centavosStr;
  const reais = parseInt(inteiroStr, 10);
  const centavos = parseInt(centavosFinal, 10);
  return reais * 100 + centavos;
}
module.exports = { parseValor };
