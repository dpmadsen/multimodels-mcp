function parseValor(texto) {
  if (texto === null || texto === undefined || typeof texto !== 'string') {
    return null;
  }
  texto = texto.trim();
  if (texto === '') {
    return null;
  }
  if (texto.startsWith('R$')) {
    texto = texto.substring(2).trim();
  }
  if (!/\d/.test(texto)) {
    return null;
  }
  if (!/^[\d.,]*$/.test(texto)) {
    return null;
  }
  const pontoCount = (texto.match(/\./g) || []).length;
  const virgulaCount = (texto.match(/,/g) || []).length;
  if (virgulaCount > 1) {
    return null;
  }
  const lastPonto = texto.lastIndexOf('.');
  const lastVirgula = texto.lastIndexOf(',');
  if (lastPonto > -1 && lastVirgula > -1 && lastPonto > lastVirgula) {
    return null;
  }
  let parteInteira = '';
  let parteDecimal = '';
  if (virgulaCount === 1) {
    const idx = texto.indexOf(',');
    parteInteira = texto.substring(0, idx);
    parteDecimal = texto.substring(idx + 1);
  } else {
    parteInteira = texto;
    parteDecimal = '';
  }
  if (parteDecimal.length > 2) {
    return null;
  }
  if (parteDecimal.length > 0 && !/^\d+$/.test(parteDecimal)) {
    return null;
  }
  if (parteInteira === '') {
    return null;
  }
  const parteInteiraNumeros = parteInteira.replace(/\./g, '');
  if (!/^\d+$/.test(parteInteiraNumeros)) {
    return null;
  }
  if (pontoCount > 0) {
    const grupos = parteInteira.split('.');
    if (!/^\d{1,3}$/.test(grupos[0])) {
      return null;
    }
    for (let i = 1; i < grupos.length; i++) {
      if (!/^\d{3}$/.test(grupos[i])) {
        return null;
      }
    }
  }
  const valor = parseInt(parteInteiraNumeros, 10);
  let centavos = valor * 100;
  if (parteDecimal.length === 1) {
    centavos += parseInt(parteDecimal, 10) * 10;
  } else if (parteDecimal.length === 2) {
    centavos += parseInt(parteDecimal, 10);
  }
  return centavos;
}
module.exports = { parseValor };
