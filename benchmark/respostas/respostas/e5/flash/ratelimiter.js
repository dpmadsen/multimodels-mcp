class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chaves = new Map();
  }
  permitir(chave) {
    const agora = this.agora();
    const timestamps = this.chaves.get(chave) || [];
    const ativos = timestamps.filter(ts => ts >= agora - this.janelaMs);
    if (ativos.length < this.limite) {
      ativos.push(agora);
      this.chaves.set(chave, ativos);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
