```javascript
/**
 * Rateia `totalCentavos` (inteiro, em centavos) entre `participantes`
 * proporcionalmente aos pesos, respeitando tetos individuais, usando o
 * método do maior resto em rodadas.
 *
 * Devolve um array de inteiros na mesma ordem dos participantes, somando
 * exatamente `totalCentavos`, ou `null` nos casos de entrada inválida ou
 * tetos insuficientes.
 */
export function ratear(totalCentavos, participantes) {
  // 1. Validação
  if (!Number.isInteger(totalCentavos)) return null;
  if (!Array.isArray(participantes) || participantes.length === 0) return null;

  for (const p of participantes) {
    if (p === null || typeof p !== "object") return null;
    const peso = p.peso;
    if (typeof peso !== "number" || !Number.isFinite(peso) || peso < 0) {
      return null;
    }
    if (p.tetoCentavos !== undefined) {
      if (!Number.isInteger(p.tetoCentavos) || p.tetoCentavos <= 0) {
        return null;
      }
    }
  }

  // 3. Estorno: calcula com o valor absoluto e inverte o sinal no final.
  const negativo = totalCentavos < 0;
  let sobra = negativo ? -totalCentavos : totalCentavos;

  const n = participantes.length;

  // 2. Se todos os pesos forem 0, trata como peso 1 para todos.
  const todosZero = participantes.every((p) => p.peso === 0);
  const pesos = participantes.map((p) => (todosZero ? 1 : p.peso));
  const tetos = participantes.map((p) =>
    p.tetoCentavos === undefined ? Infinity : p.tetoCentavos
  );

  const resultado = new Array(n).fill(0);

  // 4. Distribuição inteira (maior resto), em rodadas.
  while (sobra > 0) {
    const ativos = [];
    let somaPesos = 0;
    for (let i = 0; i < n; i++) {
      if (pesos[i] > 0 && resultado[i] < tetos[i]) {
        ativos.push(i);
        somaPesos += pesos[i];
      }
    }

    // Tetos insuficientes.
    if (ativos.length === 0) return null;

    const fracoes = [];
    let distribuido = 0;
    for (const i of ativos) {
      const cota = (sobra * pesos[i]) / somaPesos;
      const piso = Math.floor(cota);
      const espaco = tetos[i] - resultado[i];
      const parcela = piso > espaco ? espaco : piso;
      resultado[i] += parcela;
      distribuido += parcela;
      fracoes.push({ i, fracao: cota - piso });
    }

    sobra -= distribuido;

    // Centavos restantes: 1 a 1, por parte fracionária decrescente
    // (empate: menor índice), pulando quem não tem mais espaço.
    fracoes.sort((a, b) => b.fracao - a.fracao || a.i - b.i);
    for (const { i } of fracoes) {
      if (sobra === 0) break;
      if (resultado[i] < tetos[i]) {
        resultado[i] += 1;
        sobra -= 1;
      }
    }
  }

  if (negativo) {
    for (let i = 0; i < n; i++) resultado[i] = -resultado[i];
  }

  return resultado;
}
```