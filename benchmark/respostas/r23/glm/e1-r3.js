function parseValor(texto) {
  try {
    if (typeof texto !== 'string') return null;
    const trimmed = texto.trim();
    if (trimmed === '') return null;
    const re = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
    const m = re.exec(trimmed);
    if (!m) return null;
    const intStr = m[1].replace(/\./g, '');
    const decStr = m[2] || '';
    const intPart = parseInt(intStr, 10);
    if (!Number.isFinite(intPart)) return null;
    let decPart = 0;
    if (decStr.length === 1) decPart = parseInt(decStr, 10) * 10;
    else if (decStr.length === 2) decPart = parseInt(decStr, 10);
    return intPart * 100 + decPart;
  } catch (e) {
    return null;
  }
}
module.exports = { parseValor };
