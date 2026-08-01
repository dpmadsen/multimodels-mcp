// Limitador de gravação: deixa passar no máximo uma gravação a cada N
// milissegundos, e garante que a ÚLTIMA sempre seja gravada no fim.
//
// Analogia: o cozinheiro grita o andamento do prato o tempo todo. Se o
// atendente do balcão fosse anotar cada grito no papelzinho, ele passaria o dia
// escrevendo e não faria mais nada. Então ele anota de tempo em tempo — e, no
// fim, anota o último grito que ouviu, pra nada se perder.
//
// Por que isto existe: o stream do `claude` manda centenas de eventos numa
// tarefa longa. Gravar em disco a cada evento seria martelar o disco à toa,
// além de multiplicar o risco de alguém ler um arquivo pela metade.

export interface Limitador<T> {
  // Registra um valor novo. Pode gravar agora ou deixar pra depois.
  registrar(valor: T): void;
  // Grava o que ficou pendente. Chamar sempre no fim da tarefa.
  finalizar(): Promise<void>;
}

export function criarLimitador<T>(
  intervaloMs: number,
  gravar: (valor: T) => Promise<void>,
  relogio: () => number = () => Date.now()
): Limitador<T> {
  let ultimaGravacao = Number.NEGATIVE_INFINITY;
  let pendente: { valor: T } | undefined;
  // Fila de uma posição só: enquanto uma gravação está no ar, a próxima espera
  // ela terminar. Sem isso, duas gravações do mesmo arquivo poderiam se
  // atropelar.
  let emAndamento: Promise<void> = Promise.resolve();

  // Uma gravação NUNCA pode derrubar o processo: uma promessa rejeitada sem
  // ninguém pegando mataria o servidor MCP inteiro no meio do trabalho. É a
  // mesma preocupação do execucao.ts, e aqui vale igual.
  function gravarComSeguranca(valor: T): void {
    emAndamento = emAndamento.then(() => gravar(valor)).catch((err: unknown) => {
      console.error(
        `[multimodels] não consegui gravar o progresso: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }

  return {
    registrar(valor: T): void {
      const agora = relogio();
      if (agora - ultimaGravacao >= intervaloMs) {
        ultimaGravacao = agora;
        pendente = undefined;
        gravarComSeguranca(valor);
        return;
      }
      // Dentro da janela: guarda só o mais recente (o anterior já está velho).
      pendente = { valor };
    },
    async finalizar(): Promise<void> {
      if (pendente) {
        const { valor } = pendente;
        pendente = undefined;
        ultimaGravacao = relogio();
        gravarComSeguranca(valor);
      }
      await emAndamento;
    },
  };
}
