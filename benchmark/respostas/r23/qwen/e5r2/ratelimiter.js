class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadas = new Map();
  }
  permitir(chave) {
    const now = this.agora();
    const limiteInferior = now - this.janelaMs;
    let timestamps = this.chamadas.get(chave) || [];
    timestamps = timestamps.filter(ts => ts > limiteInferior);
    if (timestamps.length < this.limite) {
      timestamps.push(now);
      this.chamadas.set(chave, timestamps);
      return true;
    }
    this.chamadas.set(chave, timestamps);
    return false;
  }
}
module.exports = { RateLimiter };
