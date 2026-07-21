function parseValor(texto) {
    if (typeof texto !== 'string') {
        return null;
    }
    const trimmed = texto.trim();
    if (trimmed === '' || trimmed.includes('-')) {
        return null;
    }
    const regex = /^(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})*|\d+))(?:,(\d{1,2}))?$/;
    const match = trimmed.match(regex);
    if (!match) {
        return null;
    }
    const parteInteiraStr = match[1];
    const parteDecimalStr = match[2] || '';
    const inteiroStr = parteInteiraStr.replace(/\./g, '');
    const inteiro = parseInt(inteiroStr, 10);
    let decimalStr = parteDecimalStr;
    if (decimalStr.length === 0) {
        decimalStr = '00';
    } else if (decimalStr.length === 1) {
        decimalStr = decimalStr + '0';
    }
    const centavos = inteiro * 100 + parseInt(decimalStr, 10);
    return centavos;
}
module.exports = { parseValor };
