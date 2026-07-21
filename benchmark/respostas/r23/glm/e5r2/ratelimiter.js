'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (typeof limite !== 'number' || !Number.isFinite(limite) || limite <= 0) {
      throw new Error('limite deve ser um número positivo finito');
    }
    if (typeof janelaMs !== 'number' || !Number.isFinite(janelaMs) || janelaMs <= 0) {
      throw new Error('janelaMs deve ser um número positivo finito');
    }
    if (typeof agora !== 'function') {
      throw new Error('agora deve ser uma função');
    }
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadas = new Map();
  }
  permitir(chave) {
    const t = this.agora();
    const inicioJanela = t - this.janelaMs;
    const timestamps = this.chamadas.get(chave) || [];
    const validos = timestamps.filter((ts) => ts > inicioJanela);
    if (validos.length < this.limite) {
      validos.push(t);
      this.chamadas.set(chave, validos);
      return true;
    }
    this.chamadas.set(chave, validos);
    return false;
  }
}
module.exports = { RateLimiter };
