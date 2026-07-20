'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (typeof limite !== 'number' || !Number.isFinite(limite) || limite <= 0) {
      throw new Error('limite deve ser um número maior que zero');
    }
    if (typeof janelaMs !== 'number' || !Number.isFinite(janelaMs) || janelaMs <= 0) {
      throw new Error('janelaMs deve ser um número maior que zero');
    }
    if (typeof agora !== 'function') {
      throw new Error('agora deve ser uma função que retorna o tempo atual em ms');
    }
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.registros = new Map();
  }
  permitir(chave) {
    const tempoAtual = this.agora();
    let timestamps = this.registros.get(chave);
    if (!timestamps) {
      timestamps = [];
      this.registros.set(chave, timestamps);
    }
    const limiteAntigo = tempoAtual - this.janelaMs;
    let inicio = 0;
    while (inicio < timestamps.length && timestamps[inicio] < limiteAntigo) {
      inicio++;
    }
    if (inicio > 0) {
      timestamps.splice(0, inicio);
    }
    if (timestamps.length < this.limite) {
      timestamps.push(tempoAtual);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
