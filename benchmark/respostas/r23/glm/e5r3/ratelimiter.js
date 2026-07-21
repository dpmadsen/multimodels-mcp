'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (!Number.isFinite(limite) || limite < 1) {
      throw new TypeError('limite deve ser um número inteiro positivo');
    }
    if (!Number.isFinite(janelaMs) || janelaMs < 0) {
      throw new TypeError('janelaMs deve ser um número finito não-negativo');
    }
    if (typeof agora !== 'function') {
      throw new TypeError('agora deve ser uma função');
    }
    this.limite = Math.floor(limite);
    this.janelaMs = janelaMs;
    this.agora = agora;
    this._historico = new Map();
  }
  permitir(chave) {
    const t = this.agora();
    const limiteInferior = t - this.janelaMs;
    let marcas = this._historico.get(chave);
    if (!marcas) {
      marcas = [];
      this._historico.set(chave, marcas);
    }
    while (marcas.length > 0 && marcas[0] <= limiteInferior) {
      marcas.shift();
    }
    if (marcas.length < this.limite) {
      marcas.push(t);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
