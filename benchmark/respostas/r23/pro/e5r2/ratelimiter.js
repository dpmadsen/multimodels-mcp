class RateLimiter {
    constructor(limite, janelaMs, agora = Date.now) {
        this._limite = limite;
        this._janelaMs = janelaMs;
        this._agora = agora;
        this._mapa = new Map();
    }
    permitir(chave) {
        const agora = this._agora();
        const timestamps = this._mapa.get(chave) || [];
        const corte = agora - this._janelaMs;
        const validos = timestamps.filter(t => t >= corte);
        if (validos.length < this._limite) {
            validos.push(agora);
            this._mapa.set(chave, validos);
            return true;
        }
        return false;
    }
}
module.exports = { RateLimiter };
