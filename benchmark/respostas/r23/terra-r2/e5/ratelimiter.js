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

    while (chamadas.length > 0 && tempoAtual - chamadas[0] > this.janelaMs) {
      chamadas.shift();
    }

    if (chamadas.length >= this.limite) {
      return false;
    }

    chamadas.push(tempoAtual);
    this.chamadasPorChave.set(chave, chamadas);
    return true;
  }
}

module.exports = { RateLimiter };
