// Fila por provedor: limita quantas chamadas simultâneas cada provedor
// aguenta receber ao mesmo tempo.
//
// Analogia: pense numa lanchonete com um número fixo de balcões abertos
// (o "limite"). Cada provedor é identificado por uma "chave" (aqui, a
// baseUrl, que é única por provedor). Enquanto os balcões daquela chave
// estiverem todos ocupados, quem chega espera a vez, em ordem de chegada
// (o primeiro a chegar é o primeiro a ser atendido). Provedores diferentes
// (chaves diferentes) não interferem uns nos outros.
//
// Por que isso existe: alguns provedores (z.ai, LM Studio) engasgam ou
// derrubam a conexão quando recebem duas chamadas ao mesmo tempo. Sem fila
// (limite ausente), o comportamento é o de sempre: chama direto, sem
// nenhum controle.
//
// Implementação em memória, simples de propósito: um contador de quantos
// "balcões" estão em uso agora por chave, e uma fila de gente esperando
// (cada um representado por uma função que, quando chamada, libera a vez).

interface EstadoFila {
  emUso: number;
  espera: Array<() => void>;
}

const filasPorChave = new Map<string, EstadoFila>();

function pegarEstado(chave: string): EstadoFila {
  let estado = filasPorChave.get(chave);
  if (!estado) {
    estado = { emUso: 0, espera: [] };
    filasPorChave.set(chave, estado);
  }
  return estado;
}

// Executa `executar` respeitando o limite de chamadas simultâneas por
// `chave`. Sem `limite` (undefined), executa na hora, sem nenhuma fila.
export async function naFila<T>(
  chave: string,
  limite: number | undefined,
  executar: () => Promise<T>
): Promise<T> {
  if (limite === undefined) {
    return executar();
  }

  const estado = pegarEstado(chave);

  if (estado.emUso >= limite) {
    // Todos os balcões desta chave estão ocupados: entra na fila e espera
    // ser chamado. A promessa só resolve quando alguém "passar a vaga".
    await new Promise<void>((resolve) => estado.espera.push(resolve));
  } else {
    // Tem balcão livre: ocupa um agora mesmo.
    estado.emUso++;
  }

  try {
    return await executar();
  } finally {
    // Ao terminar, repassa a vaga direto pro próximo da fila (se houver)
    // em vez de soltar o contador e deixar um recém-chegado disputar a
    // vaga com quem já estava esperando — isso evita furar a fila.
    const proximo = estado.espera.shift();
    if (proximo) {
      proximo();
    } else {
      estado.emUso--;
    }
  }
}
