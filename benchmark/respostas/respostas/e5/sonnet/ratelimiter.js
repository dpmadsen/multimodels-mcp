'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    if (!Number.isFinite(limite) || limite < 0) {
      throw new TypeError('limite deve ser um número não negativo');
    }
    if (!Number.isFinite(janelaMs) || janelaMs <= 0) {
      throw new TypeError('janelaMs deve ser um número positivo');
    }
    if (typeof agora !== 'function') {
      throw new TypeError('agora deve ser uma função');
    }
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this._registros = new Map();
  }
  permitir(chave) {
    const agora = this.agora();
    const limiteInferior = agora - this.janelaMs;
    let timestamps = this._registros.get(chave);
    if (!timestamps) {
      timestamps = [];
      this._registros.set(chave, timestamps);
    }
    let inicio = 0;
    while (inicio < timestamps.length && timestamps[inicio] < limiteInferior) {
      inicio += 1;
    }
    if (inicio > 0) {
      timestamps.splice(0, inicio);
    }
    if (timestamps.length < this.limite) {
      timestamps.push(agora);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
