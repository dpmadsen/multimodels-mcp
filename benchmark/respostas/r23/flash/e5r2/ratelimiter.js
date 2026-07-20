class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chaves = new Map();
  }
  permitir(chave) {
    const agora = this.agora();
    if (!this.chaves.has(chave)) {
      this.chaves.set(chave, []);
    }
    const timestamps = this.chaves.get(chave);
    const inicioJanela = agora - this.janelaMs;
    const ativos = timestamps.filter(ts => ts >= inicioJanela);
    this.chaves.set(chave, ativos);
    if (ativos.length < this.limite) {
      ativos.push(agora);
      return true;
    }
    return false;
  }
}
module.exports = { RateLimiter };
