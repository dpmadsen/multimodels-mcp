class RateLimiter {
  constructor(limite, janelaMs, agora) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora || Date.now;
    this.chamadas = new Map();
  }
  permitir(chave) {
    const agora = this.agora();
    let timestamps = this.chamadas.get(chave);
    if (!timestamps) {
      timestamps = [];
      this.chamadas.set(chave, timestamps);
    } else {
      const limiteInferior = agora - this.janelaMs;
      while (timestamps.length > 0 && timestamps[0] <= limiteInferior) {
        timestamps.shift();
      }
    }
    if (timestamps.length < this.limite) {
      timestamps.push(agora);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
