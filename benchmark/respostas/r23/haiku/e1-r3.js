function parseValor(texto) {
  if (texto === null || texto === undefined || typeof texto !== 'string') {
    return null;
  }
  texto = texto.trim();
  if (texto === '') {
    return null;
  }
  let str = texto;
  if (str.startsWith('R$')) {
    str = str.substring(2).trim();
  }
  if (str.startsWith('-') || str.startsWith('+')) {
    return null;
  }
  if (str === '') {
    return null;
  }
  const parts = str.split(',');
  if (parts.length > 2) {
    return null;
  }
  let integerPart = parts[0];
  let decimalPart = parts.length === 2 ? parts[1] : '';
  if (parts.length === 2 && (decimalPart.length === 0 || decimalPart.length > 2)) {
    return null;
  }
  if (decimalPart && !/^\d+$/.test(decimalPart)) {
    return null;
  }
  if (!/^[\d.]+$/.test(integerPart)) {
    return null;
  }
  const groups = integerPart.split('.');
  if (groups.length > 1) {
    if (groups[0].length === 0 || groups[0].length > 3) {
      return null;
    }
    for (let i = 1; i < groups.length; i++) {
      if (groups[i].length !== 3) {
        return null;
      }
    }
  }
  const processedInteger = groups.join('');
  if (!/^\d+$/.test(processedInteger) || processedInteger === '') {
    return null;
  }
  const intValue = parseInt(processedInteger, 10);
  let decValue = 0;
  if (decimalPart) {
    if (decimalPart.length === 1) {
      decValue = parseInt(decimalPart, 10) * 10;
    } else {
      decValue = parseInt(decimalPart, 10);
    }
  }
  return intValue * 100 + decValue;
}
module.exports = { parseValor };
