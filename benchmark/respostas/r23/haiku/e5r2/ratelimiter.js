class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.contadores = {};
  }
  permitir(chave) {
    const tempoAtual = this.agora();
    if (!this.contadores[chave]) {
      this.contadores[chave] = [];
    }
    const fila = this.contadores[chave];
    const limiteInferior = tempoAtual - this.janelaMs;
    while (fila.length > 0 && fila[0] <= limiteInferior) {
      fila.shift();
    }
    if (fila.length < this.limite) {
      fila.push(tempoAtual);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
