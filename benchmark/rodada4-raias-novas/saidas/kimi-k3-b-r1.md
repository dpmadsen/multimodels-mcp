```javascript
export function ratear(totalCentavos, participantes) {
  // 1. Validação
  if (!Number.isInteger(totalCentavos)) return null;
  if (!Array.isArray(participantes) || participantes.length === 0) return null;

  const n = participantes.length;
  const pesos = new Array(n);
  const tetos = new Array(n);

  for (let i = 0; i < n; i++) {
    const p = participantes[i];
    if (p == null) return null;

    const peso = p.peso;
    if (!Number.isFinite(peso) || peso < 0) return null;
    pesos[i] = peso;

    const teto = p.tetoCentavos;
    if (teto !== undefined) {
      if (!Number.isInteger(teto) || teto <= 0) return null;
      tetos[i] = teto;
    } else {
      tetos[i] = Infinity;
    }
  }

  // 2. Pesos: se TODOS forem 0, divide em partes iguais (peso 1 para todos)
  const todosZero = pesos.every((peso) => peso === 0);
  const pesosEfetivos = todosZero ? pesos.map(() => 1) : pesos;

  // 3. Estorno: rateia o valor absoluto e inverte o sinal no final
  const parcelas = distribuir(Math.abs(totalCentavos), pesosEfetivos, tetos);
  if (parcelas === null) return null;
  return totalCentavos < 0 ? parcelas.map((v) => -v) : parcelas;
}

function distribuir(total, pesos, tetos) {
  const n = pesos.length;
  const resultado = new Array(n).fill(0);
  let sobra = total;

  // 4. Maior resto, em rodadas
  while (sobra > 0) {
    // Ativos: peso > 0 e ainda com espaço até o teto
    const ativos = [];
    let somaPesos = 0;
    for (let i = 0; i < n; i++) {
      if (pesos[i] > 0 && resultado[i] < tetos[i]) {
        ativos.push(i);
        somaPesos += pesos[i];
      }
    }
    if (ativos.length === 0) return null; // tetos insuficientes

    // Piso da cota de cada ativo, limitado ao espaço que resta até o teto
    const fracoes = [];
    let distribuido = 0;
    for (const i of ativos) {
      const cota = (sobra * pesos[i]) / somaPesos;
      const piso = Math.floor(cota);
      const espaco = tetos[i] - resultado[i];
      const ganho = Math.min(piso, espaco);
      resultado[i] += ganho;
      distribuido += ganho;
      fracoes.push({ i, fracao: cota - piso });
    }

    // Resto da rodada: 1 a 1, fração decrescente, menor índice no empate,
    // pulando quem não tem mais espaço até o teto
    let restante = sobra - distribuido;
    fracoes.sort((a, b) => b.fracao - a.fracao || a.i - b.i);
    for (const { i } of fracoes) {
      if (restante === 0) break;
      if (resultado[i] < tetos[i]) {
        resultado[i] += 1;
        restante -= 1;
      }
    }

    sobra = restante;
  }

  return resultado;
}
```