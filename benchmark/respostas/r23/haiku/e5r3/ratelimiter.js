class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadas = new Map();
  }
  permitir(chave) {
    const tempoAtual = this.agora();
    if (!this.chamadas.has(chave)) {
      this.chamadas.set(chave, []);
    }
    const timestamps = this.chamadas.get(chave);
    const limiteInferior = tempoAtual - this.janelaMs;
    while (timestamps.length > 0 && timestamps[0] <= limiteInferior) {
      timestamps.shift();
    }
    if (timestamps.length < this.limite) {
      timestamps.push(tempoAtual);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
