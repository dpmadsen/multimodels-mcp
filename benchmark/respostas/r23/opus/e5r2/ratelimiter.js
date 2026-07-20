'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (!Number.isFinite(limite) || limite < 0) {
      throw new Error('limite deve ser um número >= 0');
    }
    if (!Number.isFinite(janelaMs) || janelaMs <= 0) {
      throw new Error('janelaMs deve ser um número > 0');
    }
    if (typeof agora !== 'function') {
      throw new Error('agora deve ser uma função que retorna o tempo em ms');
    }
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.registros = new Map();
  }
  permitir(chave) {
    const t = this.agora();
    let timestamps = this.registros.get(chave);
    if (!timestamps) {
      timestamps = [];
      this.registros.set(chave, timestamps);
    }
    const inicioValido = t - this.janelaMs;
    let i = 0;
    while (i < timestamps.length && timestamps[i] <= inicioValido) {
      i++;
    }
    if (i > 0) {
      timestamps.splice(0, i);
    }
    if (timestamps.length < this.limite) {
      timestamps.push(t);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
