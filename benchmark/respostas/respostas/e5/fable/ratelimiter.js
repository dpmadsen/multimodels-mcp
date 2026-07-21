'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (!Number.isFinite(limite) || limite < 0) {
      throw new TypeError('limite deve ser um número maior ou igual a zero');
    }
    if (!Number.isFinite(janelaMs) || janelaMs <= 0) {
      throw new TypeError('janelaMs deve ser um número maior que zero');
    }
    if (typeof agora !== 'function') {
      throw new TypeError('agora deve ser uma função que retorna o tempo em ms');
    }
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.registros = new Map();
  }
  permitir(chave) {
    const agora = this.agora();
    let historico = this.registros.get(chave);
    if (historico === undefined) {
      historico = [];
      this.registros.set(chave, historico);
    }
    while (historico.length > 0 && agora - historico[0] > this.janelaMs) {
      historico.shift();
    }
    if (historico.length < this.limite) {
      historico.push(agora);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
