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

    while (chamadas.length > 0 && chamadas[0] < inicioDaJanela) {
      chamadas.shift();
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
