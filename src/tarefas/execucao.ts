// Disparo e acompanhamento das tarefas em segundo plano.
//
// Analogia: é o garçom que leva o pedido pra cozinha, entrega a senha na hora
// e, quando o prato fica pronto (ou queima), volta ao balcão e anota o
// desfecho no papelzinho da senha. Quem pediu não fica parado esperando.
//
// Este arquivo não sabe COMO se fala com cada modelo — ele recebe pronta a
// função que faz a delegação (a mesma que o delegate.ts já usava), justamente
// pra que as tarefas em segundo plano passem pelos MESMOS caminhos de sempre,
// incluindo a fila por provedor (maxConcurrent).
import { criarTarefa, marcarErro, marcarPronta, type Tarefa } from "./deposito.js";

export interface PedidoEmSegundoPlano {
  pasta: string;
  // Id do modelo como foi pedido (só pra registrar no papelzinho).
  modelo: string;
  task: string;
  prazoMs: number;
  // A delegação em si, já montada: devolve o texto final (com rodapé).
  executar: () => Promise<string>;
}

export interface Disparo {
  tarefa: Tarefa;
  // Promessa que termina quando o desfecho já foi gravado no disco. NUNCA
  // rejeita (ver acompanhar). Existe pros testes conseguirem esperar o fim
  // sem adivinhar tempo; em produção ninguém precisa dela.
  concluida: Promise<void>;
}

function mensagemDeErro(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// O ponto mais perigoso desta funcionalidade: uma promessa que der erro sem
// ninguém pegando (unhandled rejection) DERRUBA o processo inteiro do Node —
// ou seja, mataria o servidor MCP do Daniel no meio do trabalho, levando junto
// todas as outras tarefas. Por isso aqui TODO caminho de erro é capturado:
// o erro da delegação vira estado "erro" no arquivo, e até uma falha ao
// GRAVAR esse erro é capturada e só vira uma linha no diário (stderr).
function acompanhar(pedido: PedidoEmSegundoPlano, id: string): Promise<void> {
  return (async () => {
    try {
      const texto = await pedido.executar();
      await marcarPronta(pedido.pasta, id, texto);
    } catch (err) {
      try {
        await marcarErro(pedido.pasta, id, mensagemDeErro(err));
      } catch (falhaAoGravar) {
        // Última barreira: nem gravar deu certo. Não dá pra fazer mais nada
        // além de registrar — e, principalmente, não deixar o erro escapar.
        // Nada de console.log: em servidor stdio, a saída padrão é do protocolo.
        console.error(
          `[multimodels] não consegui gravar o erro da ${id}: ${mensagemDeErro(falhaAoGravar)}`
        );
      }
    }
  })();
}

// Cria o papelzinho, larga a delegação rodando e devolve na hora.
export async function dispararEmSegundoPlano(pedido: PedidoEmSegundoPlano): Promise<Disparo> {
  const tarefa = await criarTarefa(pedido.pasta, {
    modelo: pedido.modelo,
    task: pedido.task,
    prazoMs: pedido.prazoMs,
  });
  // Sem await de propósito: é isso que devolve a sessão pro Daniel na hora.
  const concluida = acompanhar(pedido, tarefa.id);
  return { tarefa, concluida };
}

// A "senha" que a delegação devolve na hora, em português simples.
export function mensagemDeSenha(tarefa: Tarefa, nomeDaFerramenta: string): string {
  const minutos = Math.round(tarefa.prazoMs / 60000);
  return (
    `Tarefa ${tarefa.id} criada e rodando em segundo plano no modelo ${tarefa.modelo}. ` +
    `Esta sessão continua livre — nada ficou pendurado esperando.\n\n` +
    `Para pegar o resultado depois, use a ferramenta ${nomeDaFerramenta} com id "${tarefa.id}". ` +
    `O prazo desta raia é de até ${minutos} minuto${minutos === 1 ? "" : "s"}: siga trabalhando em ` +
    `outra coisa e só volte a consultar mais tarde. NÃO fique consultando em looping — ` +
    `cada consulta gasta contexto à toa.`
  );
}
