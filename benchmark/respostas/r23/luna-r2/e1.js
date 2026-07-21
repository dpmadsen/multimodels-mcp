function parseValor(texto) {
  if (typeof texto !== 'string') return null;

  let valor = texto.trim();

  if (valor.startsWith('R$')) {
    valor = valor.slice(2).trimStart();
  }

  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(valor);

  if (!match) return null;

  const reais = Number(match[1].replace(/\./g, ''));
  const centavos = match[2] ? Number(match[2].padEnd(2, '0')) : 0;
  const total = reais * 100 + centavos;

  return Number.isSafeInteger(total) ? total : null;
}

module.exports = { parseValor };
