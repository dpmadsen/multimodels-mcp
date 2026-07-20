'use strict';

class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadasPorChave = new Map();
  }

  permitir(chave) {
    const tempoAtual = this.agora();
    const inicioDaJanela = tempoAtual - this.janelaMs;
    const chamadas = this.chamadasPorChave.get(chave) || [];

    const chamadasVigentes = chamadas.filter(
      (timestamp) => timestamp > inicioDaJanela
    );

    if (chamadasVigentes.length >= this.limite) {
      this.chamadasPorChave.set(chave, chamadasVigentes);
      return false;
    }

    chamadasVigentes.push(tempoAtual);
    this.chamadasPorChave.set(chave, chamadasVigentes);
    return true;
  }
}

module.exports = { RateLimiter };
