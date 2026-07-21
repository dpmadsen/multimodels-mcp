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

    let primeiraChamadaValida = 0;

    while (
      primeiraChamadaValida < chamadas.length &&
      chamadas[primeiraChamadaValida] < inicioDaJanela
    ) {
      primeiraChamadaValida += 1;
    }

    if (primeiraChamadaValida > 0) {
      chamadas.splice(0, primeiraChamadaValida);
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
