'use strict';
class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadasPorChave = new Map();
  }
  permitir(chave) {
    const instanteAtual = this.agora();
    const inicioDaJanela = instanteAtual - this.janelaMs;
    const chamadas = this.chamadasPorChave.get(chave) || [];
    let expiradas = 0;
    while (expiradas < chamadas.length && chamadas[expiradas] < inicioDaJanela) {
      expiradas += 1;
    }
    if (expiradas > 0) {
      chamadas.splice(0, expiradas);
    }
    if (chamadas.length >= this.limite) {
      return false;
    }
    chamadas.push(instanteAtual);
    this.chamadasPorChave.set(chave, chamadas);
    return true;
  }
}
module.exports = { RateLimiter };
