// Ferramenta check_task: o balcão de retirada. Com a senha (o id), devolve o
// resultado da tarefa delegada em segundo plano; sem senha, mostra a lista de
// tarefas pra achar a que se quer.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PASTA_DE_TAREFAS,
  lerTarefa,
  listarTarefas,
  type TarefaApresentada,
} from "../tarefas/deposito.js";
import { blocoDeParcial } from "../tarefas/texto-parcial.js";

export const NOME_DA_FERRAMENTA_DE_TAREFAS = "check_task";

const AVISO_DE_ORFA =
  "provavelmente interrompida — a sessão que iniciou essa tarefa foi fechada";

// Duração em português, em segundos quando for menos de um minuto — dizer
// "0 minutos" numa tarefa que levou 3 segundos parece defeito.
export function duracaoEmTexto(ms: number): string {
  const segundos = Math.max(0, Math.round(ms / 1000));
  if (segundos < 60) return `${segundos} segundo${segundos === 1 ? "" : "s"}`;
  const minutos = Math.round(segundos / 60);
  return `${minutos} minuto${minutos === 1 ? "" : "s"}`;
}

function decorrido(inicio: string, ate: Date): string {
  return duracaoEmTexto(ate.getTime() - new Date(inicio).getTime());
}

function plural(minutos: number): string {
  return `${minutos} minuto${minutos === 1 ? "" : "s"}`;
}

// "Read 2×, Grep 1×" — em português e sem jargão. Função pura.
export function ferramentasEmTexto(ferramentas: Record<string, number>): string {
  const nomes = Object.keys(ferramentas);
  if (nomes.length === 0) return "nenhuma ainda";
  return nomes.map((nome) => (ferramentas[nome] > 1 ? `${nome} ${ferramentas[nome]}×` : nome)).join(", ");
}

// Linha de andamento de uma tarefa que está rodando. Função pura.
export function textoDoProgresso(tarefa: TarefaApresentada): string {
  const progresso = tarefa.progresso;
  if (!progresso) {
    // A maioria das raias não sabe dar notícia: melhor dizer isso do que deixar
    // um silêncio que parece defeito.
    return "Ainda não chegou notícia do andamento (só as raias \"com mãos\" mandam esse sinal).";
  }
  const passos = `${progresso.passos} passo${progresso.passos === 1 ? "" : "s"}`;
  return (
    `Andamento até agora: ${passos} · ferramentas usadas: ${ferramentasEmTexto(progresso.ferramentas)} · ` +
    `${progresso.tokensSaida} tokens escritos.`
  );
}

// Texto de UMA tarefa consultada pela senha. Função pura.
export function textoDaTarefa(tarefa: TarefaApresentada, agora: Date = new Date()): string {
  if (tarefa.estado === "pronta") {
    const tempo = tarefa.fim ? ` · levou ${decorrido(tarefa.inicio, new Date(tarefa.fim))}` : "";
    return (
      `Resultado da ${tarefa.id} (modelo: ${tarefa.modelo}${tempo}):\n\n` +
      `${tarefa.resultado ?? "(a tarefa terminou sem texto de resposta)"}`
    );
  }
  if (tarefa.estado === "erro") {
    const cabecalho =
      `A ${tarefa.id} (modelo: ${tarefa.modelo}) terminou com erro:\n\n${tarefa.erro ?? "(sem detalhe)"}\n\n` +
      `Se o motivo for passageiro (rede, provedor fora do ar), é só delegar de novo.`;
    if (!tarefa.parcial) return cabecalho;
    // Tarefa que morreu MAS deixou trabalho feito. O aviso cerca o texto dos
    // dois lados de propósito.
    return (
      `${cabecalho}\n\n` +
      `Mas o trabalho não foi todo perdido: sobrou um rascunho.\n\n` +
      `${blocoDeParcial(tarefa.parcial, tarefa.id)}`
    );
  }
  const rodandoHa = decorrido(tarefa.inicio, agora);
  const prazo = plural(Math.round(tarefa.prazoMs / 60000));
  if (tarefa.provavelmenteInterrompida) {
    return (
      `A ${tarefa.id} (modelo: ${tarefa.modelo}) está marcada como rodando há ${rodandoHa}, ` +
      `mas já passou do prazo dela (${prazo}): ${AVISO_DE_ORFA}. ` +
      `Nesse caso o resultado não vem mais — delegue a tarefa de novo.\n\n` +
      `${textoDoProgresso(tarefa)}`
    );
  }
  return (
    `A ${tarefa.id} (modelo: ${tarefa.modelo}) ainda está rodando — começou faz ${rodandoHa}, ` +
    `e o prazo dessa raia é de até ${prazo}.\n\n` +
    `${textoDoProgresso(tarefa)}\n\n` +
    `Siga trabalhando em outra coisa e volte a consultar ` +
    `mais tarde; não fique consultando em looping.`
  );
}

// Texto da LISTA (mais recentes primeiro). Função pura.
export function textoDaLista(tarefas: TarefaApresentada[]): string {
  if (tarefas.length === 0) {
    return (
      "Nenhuma tarefa registrada ainda. Assim que você delegar algo com delegate_task, " +
      "a tarefa aparece aqui."
    );
  }
  const linhas = tarefas.map((tarefa) => {
    const estado = tarefa.provavelmenteInterrompida ? AVISO_DE_ORFA : tarefa.estado;
    // Erro que deixou rascunho é diferente de erro seco: quem olha a lista
    // precisa saber que ali dentro ainda tem trabalho aproveitável.
    const rascunho = tarefa.parcial ? " (com rascunho incompleto)" : "";
    return `- ${tarefa.id} · ${estado}${rascunho} · ${tarefa.modelo} · ${tarefa.resumo}`;
  });
  return [
    "Tarefas delegadas (mais recentes primeiro):",
    "",
    ...linhas,
    "",
    `Para ver o resultado de uma delas, chame ${NOME_DA_FERRAMENTA_DE_TAREFAS} com o id (ex.: "${tarefas[0].id}").`,
  ].join("\n");
}

export function textoDeIdDesconhecido(id: string): string {
  return (
    `Não encontrei nenhuma tarefa com o id "${id}". Ou o número está trocado, ou ela já saiu da ` +
    `lista (ficam guardadas as 50 mais recentes). Chame ${NOME_DA_FERRAMENTA_DE_TAREFAS} sem id ` +
    `para ver as tarefas que existem.`
  );
}

export function registerCheckTask(server: McpServer, pasta: string = PASTA_DE_TAREFAS): void {
  server.registerTool(
    NOME_DA_FERRAMENTA_DE_TAREFAS,
    {
      title: "Ver tarefas delegadas em segundo plano",
      description:
        "Busca o resultado de uma tarefa que o delegate_task deixou rodando em segundo plano. " +
        "Com 'id', devolve o resultado (ou diz que ainda está rodando, ou mostra o erro). " +
        "Nas raias 'com mãos', a tarefa que ainda roda mostra o andamento (quantos passos, quais " +
        "ferramentas, quantos tokens), e a que morreu no meio pode trazer um rascunho INCOMPLETO — " +
        "quando vier, ele vem marcado como tal e não deve ser tratado como resposta final. " +
        "Sem 'id', lista as tarefas (mais recentes primeiro) para você achar a que quer. " +
        "Consulte de vez em quando, enquanto faz outra coisa — não em looping.",
      inputSchema: {
        id: z
          .string()
          .optional()
          .describe("Número da tarefa devolvido pelo delegate_task (ex.: 'tarefa-3'). Sem ele, vem a lista."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        if (!id) {
          return { content: [{ type: "text", text: textoDaLista(await listarTarefas(pasta)) }] };
        }
        const tarefa = await lerTarefa(pasta, id);
        if (!tarefa) {
          return { content: [{ type: "text", text: textoDeIdDesconhecido(id) }], isError: true };
        }
        return { content: [{ type: "text", text: textoDaTarefa(tarefa) }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Erro ao consultar as tarefas: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
