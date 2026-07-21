'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (!Number.isFinite(limite) || limite < 0) {
      throw new TypeError('limite deve ser um número >= 0');
    }
    if (!Number.isFinite(janelaMs) || janelaMs < 0) {
      throw new TypeError('janelaMs deve ser um número >= 0');
    }
    if (typeof agora !== 'function') {
      throw new TypeError('agora deve ser uma função');
    }
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.tentativas = new Map();
  }
  permitir(chave) {
    if (arguments.length === 0) {
      throw new TypeError('permitir requer uma chave');
    }
    const t = this.agora();
    const limiteInferior = t - this.janelaMs;
    let arr = this.tentativas.get(chave);
    if (!arr) {
      arr = [];
      this.tentativas.set(chave, arr);
    }
    while (arr.length > 0 && arr[0] <= limiteInferior) {
      arr.shift();
    }
    if (arr.length < this.limite) {
      arr.push(t);
      return true;
    }
    return false;
  }
  estado(chave) {
    const arr = this.tentativas.get(chave);
    return arr ? arr.slice() : [];
  }
}
module.exports = { RateLimiter };
