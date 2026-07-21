class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadas = new Map();
  }
  permitir(chave) {
    const agora = this.agora();
    const timestamps = this.chamadas.get(chave) || [];
    const janelaInicio = agora - this.janelaMs;
    const validos = timestamps.filter(t => t > janelaInicio);
    if (validos.length < this.limite) {
      validos.push(agora);
      this.chamadas.set(chave, validos);
      return true;
    }
    this.chamadas.set(chave, validos);
    return false;
  }
}
module.exports = { RateLimiter };
