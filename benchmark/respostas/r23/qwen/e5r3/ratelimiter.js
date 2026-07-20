class RateLimiter {
  constructor(limite, janelaMs, agora = Date.now) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.chamadas = new Map();
  }
  permitir(chave) {
    const tempoAtual = this.agora();
    const janelaInicio = tempoAtual - this.janelaMs;
    let timestamps = this.chamadas.get(chave) || [];
    timestamps = timestamps.filter(ts => ts > janelaInicio);
    if (timestamps.length < this.limite) {
      timestamps.push(tempoAtual);
      this.chamadas.set(chave, timestamps);
      return true;
    }
    this.chamadas.set(chave, timestamps);
    return false;
  }
}
module.exports = { RateLimiter };
