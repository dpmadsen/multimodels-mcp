class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.tentativas = new Map();
  }

  permitir(chave) {
    const tempoAtual = this.agora();
    const tentativas = this.tentativas.get(chave) || [];

    const ativas = tentativas.filter(
      (timestamp) => tempoAtual - timestamp <= this.janelaMs
    );

    if (ativas.length >= this.limite) {
      this.tentativas.set(chave, ativas);
      return false;
    }

    ativas.push(tempoAtual);
    this.tentativas.set(chave, ativas);
    return true;
  }
}

module.exports = { RateLimiter };
