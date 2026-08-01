// Leitor do stream do programa `claude`.
//
// Analogia: o motor antigo era uma carta que só chegava no fim — a gente ficava
// sem notícia nenhuma até o carteiro bater na porta. Agora o trabalho vem por
// rádio: uma sequência de recadinhos, um por linha, enquanto o modelo trabalha.
// Este arquivo é só o rádio-escuta: ouve os recadinhos e diz o que dá pra saber
// (quantas idas ao modelo, quais ferramentas, quantos tokens, que texto saiu).
// Ele NÃO liga processo nenhum e não sabe o que é uma "tarefa" — quem faz isso
// é o claude-cli.ts (liga o processo) e a camada de cima (guarda o progresso).
//
// Tudo aqui é FUNÇÃO PURA: recebe estado + linha, devolve estado novo. É o que
// permite testar o leitor inteiro com um trecho de stream de verdade gravado em
// arquivo, sem gastar cota rodando o `claude` a cada `npm test`.
//
// O formato foi MEDIDO nesta máquina em 2026-08-01 (três execuções do CLI de
// verdade), não deduzido da documentação. O que aparece de fato:
//   • system/init, system/status, system/hook_started, system/hook_response,
//     system/thinking_tokens, system/post_turn_summary — avisos de bastidor;
//   • stream_event — o evento cru da API embrulhado: message_start,
//     content_block_start, content_block_delta (text_delta, thinking_delta,
//     input_json_delta, signature_delta), content_block_stop, message_delta,
//     message_stop;
//   • assistant — o bloco JÁ FECHADO que o modelo produziu (um evento por
//     bloco: raciocínio, chamada de ferramenta ou texto);
//   • user — o resultado de uma ferramenta voltando pro modelo;
//   • rate_limit_event — aviso de cota;
//   • result — o desfecho, sempre por último.

// Cada bloco de texto que o modelo escreveu, na ordem. Guardamos separado (e
// não um texto só) porque é assim que o próprio CLI monta a resposta final:
// medido nas duas capturas, juntar os blocos com uma linha em branco entre eles
// reproduz o campo "result" caractere por caractere.
export interface EstadoDoStream {
  // Uma entrada por ida ao modelo. Guardamos as CHAVES (o request_id) em vez de
  // um contador porque o CLI manda vários eventos "assistant" para a mesma ida
  // — um por bloco —, e contar eventos daria um número inflado.
  readonly idasAoModelo: readonly string[];
  // Quantas vezes cada ferramenta foi chamada, na ordem em que apareceram.
  readonly ferramentas: Readonly<Record<string, number>>;
  // Tokens de saída somados. Vem do "message_delta", que fecha cada ida ao
  // modelo com a conta daquela ida — a soma bate exatamente com o total do
  // evento final (medido: 231 + 24 = 255, e 695 na captura maior).
  readonly tokensSaida: number;
  // Texto vindo dos pedacinhos ao vivo (text_delta). É a única fonte que
  // existe DURANTE o trabalho — por isso é ela que salva o parcial quando a
  // tarefa morre no meio.
  readonly textoAoVivo: string;
  // Texto vindo dos blocos já fechados (evento "assistant"). Rede de segurança:
  // se uma atualização do CLI parar de mandar os pedacinhos ao vivo, ainda
  // sobra isto pro parcial, em vez de o parcial virar vazio calado.
  readonly blocosFechados: readonly string[];
  // O evento de desfecho, quando chegar.
  readonly resultado?: EventoDeResultado;
}

// Os sinais de progresso que interessam a quem está esperando. Este é o
// contrato que o motor entrega pra fora — de propósito sem nada de "tarefa"
// dentro, pra o motor continuar sem saber que tarefas existem.
export interface ProgressoDoStream {
  passos: number;
  ferramentas: Record<string, number>;
  tokensSaida: number;
}

// O evento "result": MESMO formato do documento único que o `--output-format
// json` devolvia antes (conferido campo a campo nas capturas de 2026-08-01 —
// o conjunto de chaves é idêntico). É por isso que trocar o formato de leitura
// não muda uma vírgula do texto final entregue.
export interface EventoDeResultado {
  result?: string;
  is_error?: boolean;
  subtype?: string;
  error?: string;
}

export const ESTADO_INICIAL: EstadoDoStream = {
  idasAoModelo: [],
  ferramentas: {},
  tokensSaida: 0,
  textoAoVivo: "",
  blocosFechados: [],
};

// Um evento qualquer do stream, ainda sem confiança nenhuma no formato: tudo é
// opcional porque o CLI pode ganhar campos novos numa atualização e isso NÃO
// pode derrubar a delegação do Daniel.
interface EventoCru {
  type?: unknown;
  request_id?: unknown;
  uuid?: unknown;
  message?: { content?: unknown };
  event?: {
    type?: unknown;
    delta?: { type?: unknown; text?: unknown };
    usage?: { output_tokens?: unknown };
  };
  [outros: string]: unknown;
}

function ehTextoCheio(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0;
}

// Consome UMA linha do stream e devolve o estado novo. Nunca lança exceção:
// linha que não é JSON válido (ruído no stdout) e evento de tipo desconhecido
// são ignorados em silêncio, de propósito — o preço de engasgar com uma linha
// estranha seria perder a delegação inteira, e não vale.
export function consumirLinha(estado: EstadoDoStream, linha: string): EstadoDoStream {
  const limpa = linha.trim();
  if (!limpa) return estado;
  let evento: EventoCru;
  try {
    const analisado: unknown = JSON.parse(limpa);
    // JSON válido mas que não é um objeto (um número solto, por exemplo)
    // também é ruído: não tem "type" pra interpretar.
    if (typeof analisado !== "object" || analisado === null || Array.isArray(analisado)) {
      return estado;
    }
    evento = analisado as EventoCru;
  } catch {
    return estado;
  }

  switch (evento.type) {
    case "assistant":
      return lerAssistant(estado, evento);
    case "stream_event":
      return lerStreamEvent(estado, evento);
    case "result":
      // O primeiro desfecho manda: se por algum motivo vier outro depois,
      // ignoramos, pra não trocar uma resposta boa por uma repetição estranha.
      return estado.resultado ? estado : { ...estado, resultado: evento as EventoDeResultado };
    default:
      // system, user, rate_limit_event e qualquer tipo que ainda nem existe.
      return estado;
  }
}

// Evento "assistant": um bloco já fechado do modelo. Daqui saem duas coisas —
// quantas idas ao modelo já houve e quais ferramentas foram chamadas.
function lerAssistant(estado: EstadoDoStream, evento: EventoCru): EstadoDoStream {
  // A chave da ida ao modelo. Sem request_id (formato futuro?), o uuid do
  // evento serve: no pior caso conta um passo a mais, nunca quebra.
  const chave = ehTextoCheio(evento.request_id)
    ? evento.request_id
    : ehTextoCheio(evento.uuid)
      ? evento.uuid
      : undefined;
  const idasAoModelo =
    chave && !estado.idasAoModelo.includes(chave)
      ? [...estado.idasAoModelo, chave]
      : estado.idasAoModelo;

  const blocos = evento.message?.content;
  if (!Array.isArray(blocos)) return { ...estado, idasAoModelo };

  let ferramentas = estado.ferramentas;
  const blocosFechados = [...estado.blocosFechados];
  for (const bloco of blocos) {
    if (typeof bloco !== "object" || bloco === null) continue;
    const b = bloco as { type?: unknown; name?: unknown; text?: unknown };
    if (b.type === "tool_use" && ehTextoCheio(b.name)) {
      ferramentas = { ...ferramentas, [b.name]: (ferramentas[b.name] ?? 0) + 1 };
    }
    if (b.type === "text" && ehTextoCheio(b.text)) {
      blocosFechados.push(b.text);
    }
  }
  return { ...estado, idasAoModelo, ferramentas, blocosFechados };
}

// Evento "stream_event": o evento cru da API. Só duas coisas nos interessam —
// os pedacinhos de texto ao vivo e a conta de tokens que fecha cada ida.
function lerStreamEvent(estado: EstadoDoStream, evento: EventoCru): EstadoDoStream {
  const interno = evento.event;
  if (!interno) return estado;
  if (interno.type === "content_block_delta") {
    // Só text_delta. thinking_delta é o raciocínio (que o Daniel decidiu NÃO
    // expor), input_json_delta são os argumentos da ferramenta e
    // signature_delta é assinatura criptográfica — nada disso é resposta.
    if (interno.delta?.type === "text_delta" && typeof interno.delta.text === "string") {
      return { ...estado, textoAoVivo: estado.textoAoVivo + interno.delta.text };
    }
    return estado;
  }
  if (interno.type === "message_delta") {
    const tokens = interno.usage?.output_tokens;
    if (typeof tokens === "number" && Number.isFinite(tokens)) {
      return { ...estado, tokensSaida: estado.tokensSaida + tokens };
    }
  }
  return estado;
}

// Quebra um pedaço do stdout em linhas inteiras. O stdout chega em pedaços que
// NÃO respeitam a linha: um evento pode vir partido no meio. A sobra (o começo
// da linha que ainda não terminou) volta pra ser completada no pedaço seguinte.
export function consumirPedaco(
  estado: EstadoDoStream,
  sobra: string,
  pedaco: string
): { estado: EstadoDoStream; sobra: string } {
  const partes = (sobra + pedaco).split("\n");
  // O último pedaço só está inteiro se o texto terminou em "\n" — e aí ele é
  // vazio. Em qualquer outro caso ele é a linha incompleta: guardamos.
  const novaSobra = partes.pop() ?? "";
  let atual = estado;
  for (const parte of partes) atual = consumirLinha(atual, parte);
  return { estado: atual, sobra: novaSobra };
}

// Fecha a leitura consumindo a última linha, que pode não ter vindo com "\n"
// no fim (acontece quando o processo é morto no meio).
export function finalizar(estado: EstadoDoStream, sobra: string): EstadoDoStream {
  return sobra ? consumirLinha(estado, sobra) : estado;
}

// Atalho pra ler um stream inteiro que já está em memória (é o que os testes
// fazem com o trecho gravado de verdade).
export function lerStreamInteiro(texto: string): EstadoDoStream {
  const { estado, sobra } = consumirPedaco(ESTADO_INICIAL, "", texto);
  return finalizar(estado, sobra);
}

export function progressoDoEstado(estado: EstadoDoStream): ProgressoDoStream {
  return {
    passos: estado.idasAoModelo.length,
    ferramentas: { ...estado.ferramentas },
    tokensSaida: estado.tokensSaida,
  };
}

// O texto do modelo até agora. Preferimos os pedacinhos ao vivo porque é o que
// existe durante o trabalho; os blocos fechados são a rede de segurança. As
// duas fontes foram conferidas nas capturas de 2026-08-01: cada uma sozinha
// reproduz o texto final caractere por caractere, então usar UMA (nunca as
// duas juntas) evita entregar a resposta duplicada.
export function textoAcumulado(estado: EstadoDoStream): string {
  if (estado.textoAoVivo) return estado.textoAoVivo;
  return estado.blocosFechados.join("\n\n");
}

// Tira do estado o texto final da delegação, ou lança a mensagem amigável em
// português. Esta função é a herdeira direta do antigo `extrairResultado`: as
// regras e as frases são as mesmas de antes, só que agora lendo o evento
// "result" do stream em vez do documento único — e, como esse evento tem
// exatamente o mesmo formato daquele documento, o texto entregue não muda.
export function extrairResultado(
  estado: EstadoDoStream,
  stdoutBruto: string,
  stderr: string,
  code: number | null,
  label: string
): string {
  if (!stdoutBruto.trim()) {
    throw new Error(
      `O ${label} terminou sem produzir saída (código ${code ?? "?"}). Detalhe: ${stderr.slice(-500) || "(sem detalhes)"}`
    );
  }
  const dados = estado.resultado;
  if (!dados) {
    // Veio saída, mas o evento de desfecho nunca chegou (processo cortado,
    // formato mudado, stdout só com ruído). Mesma frase de antes.
    throw new Error(
      `O ${label} terminou sem deixar uma resposta final. Detalhe: ${
        stderr.slice(-500) || stdoutBruto.trim().slice(-500) || "(sem detalhes)"
      }`
    );
  }
  if (dados.is_error || (dados.subtype && dados.subtype !== "success")) {
    const motivo = dados.error || dados.result || stderr.slice(-500) || "(sem detalhes)";
    throw new Error(`O ${label} terminou com erro. Detalhe: ${motivo}`);
  }
  const message = (dados.result ?? "").trim();
  if (!message) {
    throw new Error(`O ${label} terminou sem deixar uma resposta final. Detalhe: ${stderr.slice(-500) || "(sem detalhes)"}`);
  }
  return message;
}
