// Regra do fabricante: descobre de qual fabricante é o programa que está
// chamando o servidor (o "anfitrião") e decide quais raias ele NÃO precisa ver.
//
// O porquê: o Multimodels existe pra atravessar fronteira — chamar GPT/Gemini/GLM
// de dentro do Claude Code, ou chamar Claude de dentro do Codex. Delegar pra uma
// raia do MESMO fabricante do programa anfitrião é um rodeio caro: abre um
// processo novo, recarrega toda a configuração global (medido: ~31 mil tokens
// por delegação na raia de assinatura) e ainda come a cota da mesma assinatura
// que a sessão já está gastando. Nesses casos o certo é o subagente nativo.
//
// Este arquivo só tem funções puras (nenhum efeito colateral, nenhuma leitura de
// process.env por conta própria) pra ficar fácil de testar. A parte "suja" —
// perguntar ao SDK quem está chamando e anotar no diário — mora em
// anfitriao-sessao.ts.

// Nome que o cliente MCP se dá no aperto de mão → fabricante dele.
// Casamento por PEDAÇO do nome, de propósito: o nome exato varia entre versões
// e entre integrações ("claude-code", "Claude Code", "codex-mcp-client"...),
// então comparar por igualdade quebraria na próxima atualização deles.
const PEDACOS_CONHECIDOS: Array<[pedaco: string, fabricante: string]> = [
  ["claude", "anthropic"],
  ["codex", "openai"],
  ["gemini", "google"],
];

// Valor da variável de ambiente que desliga a regra inteira.
const DESLIGA_A_REGRA = ["nenhum", "none"];

export function fabricanteDoAnfitriao(nomeCliente: string | undefined): string | undefined {
  if (!nomeCliente) return undefined;
  const nome = nomeCliente.toLowerCase();
  for (const [pedaco, fabricante] of PEDACOS_CONHECIDOS) {
    if (nome.includes(pedaco)) return fabricante;
  }
  // Programa desconhecido: na dúvida, ninguém é bloqueado.
  return undefined;
}

// Escape hatch: a regra é uma economia, não uma trava de segurança, então nunca
// pode impedir trabalho por causa de um palpite errado sobre quem está chamando.
// MULTIMODELS_ANFITRIAO=nenhum (ou none) desliga tudo; qualquer outro valor vira
// o fabricante à força — serve pra testar e pra consertar detecção errada sem
// recompilar nada. O ambiente entra por parâmetro pra ser testável sem mexer no
// process.env global.
export function fabricanteEfetivo(
  nomeCliente: string | undefined,
  env: Record<string, string | undefined>
): string | undefined {
  const forcado = env.MULTIMODELS_ANFITRIAO?.trim();
  if (forcado) {
    if (DESLIGA_A_REGRA.includes(forcado.toLowerCase())) return undefined;
    return forcado.toLowerCase();
  }
  return fabricanteDoAnfitriao(nomeCliente);
}

// Raia sem o campo "fabricante" NUNCA é bloqueada, e anfitrião desconhecido
// nunca bloqueia nada: só casa quando os dois lados existem e são iguais.
export function raiaEhDoAnfitriao(
  provider: { fabricante?: string },
  fabricanteAnfitriao: string | undefined
): boolean {
  if (!provider.fabricante || !fabricanteAnfitriao) return false;
  return provider.fabricante === fabricanteAnfitriao;
}

// Separa o cardápio em duas pilhas: o que o anfitrião vê e o que foi escondido.
// Genérico porque quem chama passa as entradas do config já com o tipo delas.
export function filtrarRaiasDoAnfitriao<T extends { fabricante?: string }>(
  raias: Array<[string, T]>,
  fabricanteAnfitriao: string | undefined
): { visiveis: Array<[string, T]>; escondidas: string[] } {
  const visiveis: Array<[string, T]> = [];
  const escondidas: string[] = [];
  for (const entrada of raias) {
    if (raiaEhDoAnfitriao(entrada[1], fabricanteAnfitriao)) {
      escondidas.push(entrada[0]);
    } else {
      visiveis.push(entrada);
    }
  }
  return { visiveis, escondidas };
}

// Aviso no fim do cardápio. Esconder em silêncio seria pior que não esconder:
// quem lê o cardápio precisa saber que existe algo omitido, senão parece que a
// raia sumiu ou quebrou. Nada escondido = nenhuma linha.
export function linhaDeOmissao(escondidas: string[]): string | undefined {
  if (escondidas.length === 0) return undefined;
  return (
    `Obs.: ${escondidas.join(", ")} ${escondidas.length === 1 ? "foi omitida" : "foram omitidas"} ` +
    `por ser do mesmo fabricante do programa que está chamando agora. ` +
    `Pra isso, use um subagente nativo do próprio programa — sai mais barato. ` +
    `(Pra mostrar assim mesmo: variável MULTIMODELS_ANFITRIAO=nenhum.)`
  );
}

// Recusa da delegação, em português simples: explica o motivo e aponta o
// caminho certo, em vez de só dizer "não".
export function mensagemDeRecusa(providerId: string, label: string, fabricante: string): string {
  return (
    `A raia "${providerId}" (${label}) é do mesmo fabricante (${fabricante}) do programa que você ` +
    `está usando agora. Delegar pra ela é um rodeio caro: abre um processo novo por fora e ` +
    `recarrega toda a configuração global antes de olhar a tarefa, gastando da mesma cota que ` +
    `esta sessão já gasta. Use um subagente nativo do próprio programa. ` +
    `Se for engano meu sobre quem está chamando, ligue a raia de volta com a variável de ambiente ` +
    `MULTIMODELS_ANFITRIAO=nenhum.`
  );
}
