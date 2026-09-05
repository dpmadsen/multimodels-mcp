// Conta bytes UTF-8 de um stream de texto sem depender do tamanho em caracteres.
export class ErroLimiteDeSaida extends Error {
  constructor(readonly observedBytes: number, readonly limitBytes: number, message?: string) {
    super(message ?? `Resposta excedeu o limite local de ${limitBytes} bytes.`);
  }
}

export function somarBytesDeSaida(
  total: number,
  chunk: string,
  limite: number
): { total: number; excedeu: boolean } {
  const proximo = total + Buffer.byteLength(chunk, "utf8");
  return { total: proximo, excedeu: proximo > limite };
}
