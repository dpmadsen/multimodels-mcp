class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.timestamps = new Map();
  }
  permitir(chave) {
    const now = this.agora();
    let timestamps = this.timestamps.get(chave);
    if (!timestamps) {
      timestamps = [];
      this.timestamps.set(chave, timestamps);
    }
    const cutoff = now - this.janelaMs;
    const valid = timestamps.filter(t => t > cutoff);
    this.timestamps.set(chave, valid);
    if (valid.length < this.limite) {
      valid.push(now);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
