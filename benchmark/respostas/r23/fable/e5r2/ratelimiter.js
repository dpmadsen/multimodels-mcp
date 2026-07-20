'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (!Number.isInteger(limite) || limite <= 0) {
      throw new TypeError('limite deve ser um inteiro maior que zero');
    }
    if (typeof janelaMs !== 'number' || !Number.isFinite(janelaMs) || janelaMs <= 0) {
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
    const t = this.agora();
    let lista = this.registros.get(chave);
    if (!lista) {
      lista = [];
      this.registros.set(chave, lista);
    }
    while (lista.length > 0 && t - lista[0] > this.janelaMs) {
      lista.shift();
    }
    if (lista.length < this.limite) {
      lista.push(t);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
