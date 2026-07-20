function parseValor(texto) {
    if (typeof texto !== 'string') return null;
    texto = texto.trim();
    if (texto === '') return null;
    if (texto[0] === '-') return null;
    const normalized = texto.replace(/^R\$\s?/i, '');
    const re = /^((0|[1-9]\d*)|(0(\.\d{3})+|[1-9]\d{0,2}(\.\d{3})+))(,(\d{1,2}))?$/;
    const match = normalized.match(re);
    if (!match) return null;
    const intRaw = match[1];
    const decimals = match[7] || '';
    const intDigits = intRaw.replace(/\./g, '');
    let cents = parseInt(intDigits, 10) * 100;
    if (decimals.length === 1) {
        cents += parseInt(decimals, 10) * 10;
    } else if (decimals.length === 2) {
        cents += parseInt(decimals, 10);
    }
    return cents;
}
module.exports = { parseValor };
