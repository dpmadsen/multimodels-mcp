// Ferramenta delegate_task: o coração do garçom. Recebe uma tarefa,
// leva pra "cozinha" escolhida (Codex, API ou modelo local) e — por padrão —
// devolve na hora uma SENHA, deixando o prato ser feito em segundo plano.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  resolveEffort,
  resolveModel,
  resolveTimeoutMs,
  type ModelRef,
  type ModelsConfig,
} from "../config.js";
import { mensagemDeRecusa, raiaEhDoAnfitriao } from "../anfitriao.js";
import { fabricanteDaSessao } from "../anfitriao-sessao.js";
import { chatCompletion } from "../providers/openai-compat.js";
import { runCodex } from "../providers/codex.js";
import { runGemini } from "../providers/gemini.js";
import { runClaudeCli } from "../providers/claude-cli.js";
import { PASTA_DE_TAREFAS } from "../tarefas/deposito.js";
import { dispararEmSegundoPlano, mensagemDeSenha } from "../tarefas/execucao.js";
import { NOME_DA_FERRAMENTA_DE_TAREFAS } from "./check-task.js";

// Monta a delegação de verdade. Tudo que é motivo de RECUSA acontece aqui,
// na hora da montagem — nunca dentro da promessa —, porque em segundo plano
// uma recusa que só aparecesse depois viraria uma tarefa que falha lá na
// frente, em vez de um "não" imediato na cara de quem pediu.
function montarDelegacao(
  config: ModelsConfig,
  ref: ModelRef,
  task: string,
  workdir: string | undefined,
  effort: string | undefined
): () => Promise<string> {
  if (ref.provider.type === "claude-cli") {
    const provider = ref.provider;
    // Quem manda é a declaração no cardápio, não o nome da raia. A raia que
    // declara effortOptions aceita esforço (o programa `claude` tem --effort, e
    // medimos em 2026-08-01 que ele muda o resultado de verdade). A que NÃO
    // declara continua recusando: nas raias de outro fabricante foi medido em
    // 2026-07-31 que o motor do outro lado descarta o ajuste, e aceitar calado
    // faria o Daniel achar que funcionou.
    const niveis = provider.effortOptions ?? [];
    if (effort !== undefined && niveis.length === 0) {
      throw new Error(
        `A raia "${provider.label}" não aceita o campo "effort": nas raias "com mãos" quem decide o quanto o modelo pensa é o motor do próprio fabricante, e esse ajuste não trafega na conversa. Se quiser mais capricho, escolha um modelo mais forte da lista dessa raia.`
      );
    }
    if (effort !== undefined && !niveis.includes(effort)) {
      throw new Error(
        `O esforço "${effort}" não existe na raia "${provider.label}". Escolha um destes: ${niveis.join(", ")}.`
      );
    }
    // Mesma cascata dos outros motores: pedido → padrão do modelo → padrão da
    // raia. Sem nada escolhido, não mandamos --effort e vale o padrão do CLI.
    const esforcoEfetivo = resolveEffort(provider, ref.model!, effort);
    return async () => {
      const text = await runClaudeCli(config, provider, task, workdir, ref.model, esforcoEfetivo);
      const detalhes = [ref.model, "com mãos", esforcoEfetivo ? `esforço: ${esforcoEfetivo}` : undefined].filter(
        Boolean
      );
      return `${text}\n\n[resposta de: ${provider.label} · ${detalhes.join(" · ")}]`;
    };
  }
  if (ref.provider.type === "codex-cli" || ref.provider.type === "gemini-cli") {
    const provider = ref.provider;
    return async () => {
      const text =
        provider.type === "codex-cli"
          ? await runCodex(config, provider, task, workdir, ref.model, effort)
          : await runGemini(config, provider, task, workdir, ref.model, effort);
      const detalhes = [ref.model, effort ? `esforço: ${effort}` : undefined].filter(Boolean);
      const footer =
        detalhes.length > 0
          ? `[resposta de: ${provider.label} · ${detalhes.join(" · ")}]`
          : `[resposta de: ${provider.label}]`;
      return `${text}\n\n${footer}`;
    };
  }
  const provider = ref.provider;
  const model = ref.model!;
  return async () => {
    const result = await chatCompletion(config, provider, model, task, { effort });
    const text = result.truncated
      ? `${result.text}\n\n⚠️ Atenção: a resposta acima foi CORTADA no meio por atingir o limite de tamanho. ` +
        `Peça uma tarefa mais curta (ou em partes), ou aumente o "maxTokens" desse provedor no config/models.json.`
      : result.text;
    const tokens = result.usage
      ? ` · tokens: ${result.usage.prompt_tokens ?? "?"} entrada / ${result.usage.completion_tokens ?? "?"} saída`
      : "";
    // Esforço efetivo: a mesma cascata que o chatCompletion usou
    // (pedido da delegação → padrão do modelo → padrão do provedor).
    const esforcoEfetivo = resolveEffort(provider, model, effort);
    const extras = [
      esforcoEfetivo ? `esforço: ${esforcoEfetivo}` : undefined,
      result.retried ? "repescada 1×" : undefined,
    ].filter(Boolean);
    const sufixoExtras = extras.length > 0 ? ` · ${extras.join(" · ")}` : "";
    return `${text}\n\n[resposta de: ${provider.label} · ${model}${tokens}${sufixoExtras}]`;
  };
}

export function registerDelegate(server: McpServer, getConfig: () => ModelsConfig): void {
  server.registerTool(
    "delegate_task",
    {
      title: "Delegar tarefa a outro modelo",
      description:
        "Envia uma tarefa para outro modelo de IA processar. " +
        "POR PADRÃO a tarefa roda em SEGUNDO PLANO: a resposta é imediata e traz só o número da tarefa " +
        `(a "senha") — o resultado se busca depois com a ferramenta ${NOME_DA_FERRAMENTA_DE_TAREFAS}. ` +
        "Depois de disparar, SIGA TRABALHANDO em outra coisa e só volte a consultar mais tarde; " +
        "NÃO fique consultando em looping, isso queima contexto à toa. " +
        'Use "wait": true só para tarefas curtas, quando fizer sentido esperar a resposta aqui mesmo. ' +
        "Use list_models para ver os ids válidos (ex.: 'codex', 'deepseek:deepseek-chat', 'lmstudio:qwen/qwen3.6-35b-a3b'). " +
        "A resposta vem do modelo delegado — avalie criticamente antes de usar.",
      inputSchema: {
        model: z
          .string()
          .describe("Id do modelo destino, no formato retornado por list_models (ex.: 'codex' ou 'deepseek:deepseek-chat')"),
        task: z
          .string()
          .describe("Instruções completas e autocontidas da tarefa, incluindo todo o contexto necessário — o modelo destino não vê esta conversa"),
        workdir: z
          .string()
          .optional()
          .describe(
            "Vale para codex, gemini e glm-maos: pasta do projeto que o modelo pode LER (caminho absoluto). " +
              "Para o gemini, requer o arquivo de permissões do agy configurado (senão, mande o contexto no texto)"
          ),
        effort: z
          .string()
          .optional()
          .describe(
            "Esforço de raciocínio: para o codex aceita 'low', 'medium', 'high' ou 'xhigh'; " +
              "para a raia claude-maos aceita 'low', 'medium', 'high', 'xhigh' ou 'max'; " +
              "para provedores de API (z.ai, OpenRouter etc.) só funciona se o provedor tiver " +
              "'effortStyle' configurado no config/models.json — nesse caso, use o valor que aquele provedor aceitar"
          ),
        wait: z
          .boolean()
          .optional()
          .describe(
            "true = espera aqui e devolve o resultado agora, prendendo a sessão até o modelo terminar. " +
              "Use só em tarefas curtas. Ausente (o padrão) = a tarefa roda em segundo plano e a resposta " +
              `traz o número dela, para buscar depois com ${NOME_DA_FERRAMENTA_DE_TAREFAS}`
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ model, task, workdir, effort, wait }) => {
      try {
        // Relê o cardápio a cada chamada: mudanças feitas no painel (inclusive
        // no prazo de execução) valem na hora.
        const config = getConfig();
        const ref = resolveModel(config, model);
        // Porta trancada da regra do fabricante, além do cardápio filtrado:
        // o id pode ser escrito na mão, sem passar pelo list_models.
        const fabricanteAnfitriao = fabricanteDaSessao(server);
        if (fabricanteAnfitriao && raiaEhDoAnfitriao(ref.provider, fabricanteAnfitriao)) {
          throw new Error(mensagemDeRecusa(ref.providerId, ref.provider.label, fabricanteAnfitriao));
        }
        const executar = montarDelegacao(config, ref, task, workdir, effort);
        if (wait) {
          return { content: [{ type: "text", text: await executar() }] };
        }
        // Segundo plano (o padrão). A delegação passa exatamente pelos mesmos
        // caminhos de provedor — inclusive a fila por provedor —, só que sem
        // ninguém esperando do lado de cá.
        const { tarefa } = await dispararEmSegundoPlano({
          pasta: PASTA_DE_TAREFAS,
          modelo: model,
          task,
          prazoMs: resolveTimeoutMs(config, ref.provider),
          executar,
        });
        return {
          content: [{ type: "text", text: mensagemDeSenha(tarefa, NOME_DA_FERRAMENTA_DE_TAREFAS) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Erro ao delegar: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
