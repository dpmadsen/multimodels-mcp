// Erro que não vem de mãos vazias.
//
// Analogia: o prato queimou no forno, mas metade já estava empratada. Antes, a
// gente jogava tudo fora e só avisava "queimou". Agora o garçom leva o que
// tinha ficado pronto JUNTO com o aviso — deixando bem claro que aquilo não é
// o prato, é o que sobrou dele.
//
// Por que um erro próprio e não um campo solto: quem trata o erro lá em cima
// (a camada das tarefas) precisa PERGUNTAR se sobrou alguma coisa, sem
// precisar saber qual motor falhou nem como ele funciona por dentro.
import type { ProgressoDoStream } from "./claude-stream.js";

export class ErroComParcial extends Error {
  // O texto que o modelo já tinha produzido quando morreu. Nunca é a resposta
  // final — quem mostrar isso é OBRIGADO a avisar que está incompleto.
  readonly parcial: string;
  readonly progresso: ProgressoDoStream;

  constructor(mensagem: string, parcial: string, progresso: ProgressoDoStream) {
    super(mensagem);
    this.name = "ErroComParcial";
    this.parcial = parcial;
    this.progresso = progresso;
  }
}

// Pergunta segura: "esse erro trouxe alguma coisa junto?". Não usamos
// `instanceof` sozinho porque o mesmo módulo pode ser carregado duas vezes em
// cenários de teste e aí o `instanceof` mente; conferir o formato é honesto.
export function erroComParcial(err: unknown): ErroComParcial | undefined {
  if (!(err instanceof Error)) return undefined;
  const candidato = err as Partial<ErroComParcial>;
  if (typeof candidato.parcial !== "string" || !candidato.parcial.trim()) return undefined;
  return err as ErroComParcial;
}
