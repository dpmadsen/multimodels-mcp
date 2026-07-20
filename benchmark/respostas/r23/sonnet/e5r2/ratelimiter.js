'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (!Number.isFinite(limite) || limite < 0) {
      throw new TypeError('limite precisa ser um número >= 0');
    }
    if (!Number.isFinite(janelaMs) || janelaMs <= 0) {
      throw new TypeError('janelaMs precisa ser um número > 0');
    }
    if (typeof agora !== 'function') {
      throw new TypeError('agora precisa ser uma função que retorna ms');
    }
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.registros = new Map();
  }
  permitir(chave) {
    const instanteAtual = this.agora();
    const limiteInferior = instanteAtual - this.janelaMs;
    let timestamps = this.registros.get(chave);
    if (!timestamps) {
      timestamps = [];
      this.registros.set(chave, timestamps);
    }
    let inicio = 0;
    while (inicio < timestamps.length && timestamps[inicio] <= limiteInferior) {
      inicio++;
    }
    if (inicio > 0) {
      timestamps.splice(0, inicio);
    }
    if (timestamps.length < this.limite) {
      timestamps.push(instanteAtual);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
