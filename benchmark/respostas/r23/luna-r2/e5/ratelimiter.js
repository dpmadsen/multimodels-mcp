'use strict';

class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadas = new Map();
  }

  permitir(chave) {
    const tempoAtual = this.agora();
    const chamadas = this.chamadas.get(chave) ?? [];
    const inicioDaJanela = tempoAtual - this.janelaMs;

    while (chamadas.length > 0 && chamadas[0] < inicioDaJanela) {
      chamadas.shift();
    }

    if (chamadas.length >= this.limite) {
      return false;
    }

    chamadas.push(tempoAtual);
    this.chamadas.set(chave, chamadas);
    return true;
  }
}

module.exports = { RateLimiter };
