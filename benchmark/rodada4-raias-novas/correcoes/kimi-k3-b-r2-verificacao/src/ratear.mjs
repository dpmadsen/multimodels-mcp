// src/ratear.mjs
// Rateio proporcional inteiro (método do maior resto, em rodadas) com tetos.

export function ratear(totalCentavos, participantes) {
  // 1. Validação
  if (!Number.isInteger(totalCentavos)) return null;
  if (!Array.isArray(participantes) || participantes.length === 0) return null;

  const n = participantes.length;
  const pesos = new Array(n);
  const tetos = new Array(n);

  for (let i = 0; i < n; i++) {
    const p = participantes[i];
    if (p === null || p === undefined) return null;

    const peso = p.peso;
    if (!Number.isFinite(peso) || peso < 0) return null;
    pesos[i] = peso;

    const teto = p.tetoCentavos;
    if (teto === undefined) {
      tetos[i] = Infinity;
    } else {
      if (!Number.isInteger(teto) || teto <= 0) return null;
      tetos[i] = teto;
    }
  }

  // 3. Estorno: rateia o valor absoluto e inverte o sinal de cada parcela.
  const estorno = totalCentavos < 0;
  const total = estorno ? -totalCentavos : totalCentavos;

  const parcelas = distribuir(total, pesos, tetos);
  if (parcelas === null) return null;

  if (estorno) {
    for (let i = 0; i < n; i++) {
      parcelas[i] = parcelas[i] === 0 ? 0 : -parcelas[i]; // evita -0
    }
  }
  return parcelas;
}

function distribuir(total, pesos, tetos) {
  const n = pesos.length;
  const resultado = new Array(n).fill(0);

  // 2. Pesos: se TODOS forem 0, divide em partes iguais (peso 1 para cada).
  let somaPesos = 0;
  for (let i = 0; i < n; i++) somaPesos += pesos[i];
  const efetivos = somaPesos === 0 ? new Array(n).fill(1) : pesos;

  // 4. Distribuição inteira (maior resto), em rodadas.
  let sobra = total;
  while (sobra > 0) {
    // Ativos: peso efetivo > 0 e ainda com espaço até o teto.
    const ativos = [];
    let somaAtivos = 0;
    for (let i = 0; i < n; i++) {
      if (efetivos[i] > 0 && resultado[i] < tetos[i]) {
        ativos.push(i);
        somaAtivos += efetivos[i];
      }
    }
    if (ativos.length === 0) return null; // tetos insuficientes

    // Piso da cota exata de cada ativo, limitado ao espaço até o teto.
    const fracoes = new Array(n).fill(0);
    let distribuido = 0;
    for (let k = 0; k < ativos.length; k++) {
      const i = ativos[k];
      const cota = (sobra * efetivos[i]) / somaAtivos;
      const piso = Math.floor(cota);
      fracoes[i] = cota - piso;
      const espaco = tetos[i] - resultado[i];
      const recebe = piso < espaco ? piso : espaco;
      resultado[i] += recebe;
      distribuido += recebe;
    }

    // Centavos restantes: 1 a 1, fração decrescente (empate: menor índice),
    // pulando quem não tem mais espaço até o teto.
    let restante = sobra - distribuido;
    if (restante > 0) {
      const ordenados = ativos.slice().sort((a, b) => {
        if (fracoes[b] !== fracoes[a]) return fracoes[b] - fracoes[a];
        return a - b;
      });
      for (let k = 0; k < ordenados.length && restante > 0; k++) {
        const i = ordenados[k];
        if (resultado[i] < tetos[i]) {
          resultado[i] += 1;
          restante -= 1;
        }
      }
    }

    sobra = restante; // recalcula e repete se necessário
  }

  return resultado;
}
