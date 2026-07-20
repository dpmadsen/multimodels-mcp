class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadasPorChave = new Map();
  }

  permitir(chave) {
    const tempoAtual = this.agora();
    const chamadas = this.chamadasPorChave.get(chave) || [];

    const chamadasNaJanela = chamadas.filter(
      (tempo) => tempoAtual - tempo <= this.janelaMs
    );

    if (chamadasNaJanela.length >= this.limite) {
      this.chamadasPorChave.set(chave, chamadasNaJanela);
      return false;
    }

    chamadasNaJanela.push(tempoAtual);
    this.chamadasPorChave.set(chave, chamadasNaJanela);
    return true;
  }
}

module.exports = { RateLimiter };
