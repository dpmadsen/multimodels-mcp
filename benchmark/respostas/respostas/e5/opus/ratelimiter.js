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
    this._registros = new Map();
  }
  permitir(chave) {
    const t = this.agora();
    const corte = t - this.janelaMs;
    let timestamps = this._registros.get(chave);
    if (timestamps === undefined) {
      timestamps = [];
      this._registros.set(chave, timestamps);
    }
    let inicio = 0;
    while (inicio < timestamps.length && timestamps[inicio] <= corte) {
      inicio++;
    }
    if (inicio > 0) {
      timestamps.splice(0, inicio);
    }
    if (timestamps.length < this.limite) {
      timestamps.push(t);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
