class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadas = {};
  }
  permitir(chave) {
    const agora = this.agora();
    if (!this.chamadas[chave]) {
      this.chamadas[chave] = [];
    }
    const limiteInferior = agora - this.janelaMs;
    this.chamadas[chave] = this.chamadas[chave].filter(t => t >= limiteInferior);
    if (this.chamadas[chave].length < this.limite) {
      this.chamadas[chave].push(agora);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
