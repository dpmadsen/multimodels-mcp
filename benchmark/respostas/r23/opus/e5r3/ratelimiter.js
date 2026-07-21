'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (!Number.isFinite(limite) || limite < 0) {
      throw new Error('limite deve ser um numero >= 0');
    }
    if (!Number.isFinite(janelaMs) || janelaMs <= 0) {
      throw new Error('janelaMs deve ser um numero > 0');
    }
    if (typeof agora !== 'function') {
      throw new Error('agora deve ser uma funcao que retorna o tempo em ms');
    }
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.registros = new Map();
  }
  permitir(chave) {
    const t = this.agora();
    const corte = t - this.janelaMs;
    let historico = this.registros.get(chave);
    if (!historico) {
      historico = [];
      this.registros.set(chave, historico);
    }
    while (historico.length > 0 && historico[0] <= corte) {
      historico.shift();
    }
    if (historico.length < this.limite) {
      historico.push(t);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
