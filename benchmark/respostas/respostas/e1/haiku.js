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
  if (texto === '') {
    return null;
  }
  if (!/^[\d.,]+$/.test(texto) || texto.includes('-')) {
    return null;
  }
  const pontos = (texto.match(/\./g) || []).length;
  const virgulas = (texto.match(/,/g) || []).length;
  if (virgulas > 1) {
    return null;
  }
  let parteInteira = '';
  let parteDecimal = '';
  if (virgulas === 1) {
    const partes = texto.split(',');
    parteInteira = partes[0];
    parteDecimal = partes[1];
    if (!/^\d{1,2}$/.test(parteDecimal)) {
      return null;
    }
  } else {
    parteInteira = texto;
  }
  if (parteInteira === '') {
    return null;
  }
  if (pontos > 0) {
    const grupos = parteInteira.split('.');
    if (!/^\d{1,3}$/.test(grupos[0])) {
      return null;
    }
    for (let i = 1; i < grupos.length; i++) {
      if (!/^\d{3}$/.test(grupos[i])) {
        return null;
      }
    }
  } else {
    if (!/^\d+$/.test(parteInteira)) {
      return null;
    }
  }
  const inteiraSemPontos = parteInteira.replace(/\./g, '');
  const inteira = parseInt(inteiraSemPontos, 10);
  let centavos = inteira * 100;
  if (parteDecimal) {
    if (parteDecimal.length === 1) {
      centavos += parseInt(parteDecimal, 10) * 10;
    } else {
      centavos += parseInt(parteDecimal, 10);
    }
  }
  return centavos;
}
module.exports = { parseValor };
