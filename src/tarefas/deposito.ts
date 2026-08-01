// Depósito de tarefas: guarda no disco o que foi delegado em segundo plano.
//
// Analogia: é o balcão de senhas da lanchonete. Quando o pedido vai pra
// cozinha, o balcão anota num papelzinho o número da senha, o que foi pedido
// e a hora; quando o prato fica pronto, o mesmo papelzinho recebe o resultado.
// Quem pediu volta quando quiser e mostra a senha.
//
// Por que em ARQUIVO e não só na memória: se ficasse na memória, fechar a
// sessão do Claude Code apagaria tudo. Em arquivo, o resultado da tarefa de
// hoje continua lá amanhã.
//
// Este arquivo só sabe guardar e ler tarefas — não sabe delegar nada. Quem
// dispara a delegação e acompanha o fim dela é o execucao.ts.
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "../config.js";

export type EstadoTarefa = "rodando" | "pronta" | "erro";

export interface Tarefa {
  // Id legível pra gente ("tarefa-1"), não um código embaralhado: o Daniel
  // precisa conseguir digitar isso de volta sem copiar e colar.
  id: string;
  estado: EstadoTarefa;
  // Id do modelo como foi pedido na delegação (ex.: "deepseek:deepseek-chat").
  modelo: string;
  // Começo da tarefa, pra ele reconhecer qual é qual na lista.
  resumo: string;
  // Instantes em texto ISO (o JSON não guarda data de verdade).
  inicio: string;
  fim?: string;
  // Prazo daquela raia, em milissegundos. Guardado junto porque o prazo pode
  // mudar no painel depois — o que vale pra esta tarefa é o de quando começou.
  prazoMs: number;
  resultado?: string;
  erro?: string;
}

// Pasta de trabalho, na raiz do projeto. Não vai pro repositório (.gitignore).
export const PASTA_DE_TAREFAS = join(projectRoot, ".multimodels", "tarefas");

// Quantas tarefas ficam guardadas. Sem esse teto, a pasta cresceria pra
// sempre: cada delegação deixaria um arquivo lá até o fim dos tempos.
export const MAXIMO_DE_TAREFAS = 50;

// Folga antes de considerar uma tarefa "provavelmente interrompida". O prazo
// é o tempo máximo do modelo; a folga cobre o tempinho de o servidor perceber
// e gravar o resultado.
export const FOLGA_DE_ORFA_MS = 2 * 60 * 1000;

const TAMANHO_DO_RESUMO = 200;

// Primeiros caracteres da tarefa, em uma linha só. Função pura.
export function resumirTarefa(task: string, tamanho = TAMANHO_DO_RESUMO): string {
  const limpo = task.replace(/\s+/g, " ").trim();
  return limpo.length <= tamanho ? limpo : `${limpo.slice(0, tamanho)}…`;
}

function nomeDoArquivo(id: string): string {
  return `${id}.json`;
}

function numeroDoId(id: string): number | undefined {
  const casou = id.match(/^tarefa-(\d+)$/);
  return casou ? Number(casou[1]) : undefined;
}

async function idsGuardados(pasta: string): Promise<string[]> {
  try {
    const arquivos = await readdir(pasta);
    return arquivos
      .filter((nome) => /^tarefa-\d+\.json$/.test(nome))
      .map((nome) => nome.replace(/\.json$/, ""));
  } catch (err) {
    // Pasta que ainda não existe = nenhuma tarefa guardada, não é erro.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

// Grava por cima de um arquivo já existente sem risco de alguém ler pela
// metade: escreve num arquivo temporário e só então troca o nome (a troca de
// nome é instantânea pro sistema de arquivos).
async function gravarPorCima(pasta: string, id: string, tarefa: Tarefa): Promise<void> {
  const alvo = join(pasta, nomeDoArquivo(id));
  const temporario = `${alvo}.tmp-${process.pid}`;
  await writeFile(temporario, JSON.stringify(tarefa, null, 2), "utf8");
  await rename(temporario, alvo);
}

export interface DadosDaTarefa {
  modelo: string;
  task: string;
  prazoMs: number;
}

// Cria o arquivo em modo EXCLUSIVO: se o caminho já existir, dá erro EEXIST
// em vez de gravar por cima. Fica separado (e trocável) só pra dar pra
// simular a disputa por id nos testes, sem depender de sorte de cronômetro.
export type CriadorExclusivo = (caminho: string, conteudo: string) => Promise<void>;

const criarExclusivo: CriadorExclusivo = (caminho, conteudo) =>
  writeFile(caminho, conteudo, { encoding: "utf8", flag: "wx" });

// Cria a tarefa e devolve o registro já com o id. O id sai do maior número
// que já existe na pasta, mais um.
export async function criarTarefa(
  pasta: string,
  dados: DadosDaTarefa,
  agora: Date = new Date(),
  criar: CriadorExclusivo = criarExclusivo
): Promise<Tarefa> {
  await mkdir(pasta, { recursive: true });
  const numeros = (await idsGuardados(pasta))
    .map(numeroDoId)
    .filter((n): n is number => n !== undefined);
  let numero = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;

  // Duas sessões do Claude Code podem estar rodando ao mesmo tempo e olhar a
  // pasta no mesmo instante — as duas veriam o mesmo "próximo número" e uma
  // apagaria a tarefa da outra. Por isso o arquivo é criado em modo EXCLUSIVO
  // (flag "wx"): o sistema de arquivos só deixa criar se ainda não existir.
  // Se já existir (EEXIST), quem perdeu a disputa simplesmente tenta o número
  // seguinte. Assim nunca duas tarefas ocupam o mesmo id.
  for (;;) {
    const tarefa: Tarefa = {
      id: `tarefa-${numero}`,
      estado: "rodando",
      modelo: dados.modelo,
      resumo: resumirTarefa(dados.task),
      inicio: agora.toISOString(),
      prazoMs: dados.prazoMs,
    };
    try {
      await criar(join(pasta, nomeDoArquivo(tarefa.id)), JSON.stringify(tarefa, null, 2));
      // Faxina só na criação: é o único momento em que a pasta cresce.
      await faxina(pasta);
      return tarefa;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      numero++;
    }
  }
}

// Lê o registro cru do disco (sem a leitura de "provavelmente interrompida").
async function lerCru(pasta: string, id: string): Promise<Tarefa | undefined> {
  if (numeroDoId(id) === undefined) return undefined;
  try {
    const bruto = await readFile(join(pasta, nomeDoArquivo(id)), "utf8");
    return JSON.parse(bruto) as Tarefa;
  } catch {
    // Arquivo inexistente ou ilegível: pra quem pergunta, a tarefa não existe.
    return undefined;
  }
}

async function mudarEstado(
  pasta: string,
  id: string,
  mudanca: Partial<Tarefa>,
  agora: Date
): Promise<Tarefa | undefined> {
  const tarefa = await lerCru(pasta, id);
  // Tarefa que sumiu (apagada pela faxina, por exemplo) não pode ser
  // atualizada — e isso NÃO pode virar erro, senão derrubaria quem acompanha
  // a delegação lá no execucao.ts.
  if (!tarefa) return undefined;
  const atualizada: Tarefa = { ...tarefa, ...mudanca, fim: agora.toISOString() };
  await gravarPorCima(pasta, id, atualizada);
  return atualizada;
}

export function marcarPronta(
  pasta: string,
  id: string,
  resultado: string,
  agora: Date = new Date()
): Promise<Tarefa | undefined> {
  return mudarEstado(pasta, id, { estado: "pronta", resultado, erro: undefined }, agora);
}

export function marcarErro(
  pasta: string,
  id: string,
  erro: string,
  agora: Date = new Date()
): Promise<Tarefa | undefined> {
  return mudarEstado(pasta, id, { estado: "erro", erro, resultado: undefined }, agora);
}

// Como a tarefa é APRESENTADA (o arquivo no disco continua intocado).
export interface TarefaApresentada extends Tarefa {
  provavelmenteInterrompida: boolean;
}

// Tarefa órfã: se a sessão que iniciou a delegação for fechada, ninguém mais
// vai atualizar aquele arquivo — ele fica preso em "rodando" pra sempre. Não
// dá pra detectar isso com certeza, então a gente é honesto em vez de esperto:
// passou do prazo dela mais uma folga, a gente AVISA que provavelmente foi
// interrompida, sem mexer no arquivo (se ela estiver viva, o resultado chega
// e o aviso some sozinho). Função pura.
export function provavelmenteInterrompida(tarefa: Tarefa, agora: Date = new Date()): boolean {
  if (tarefa.estado !== "rodando") return false;
  const decorrido = agora.getTime() - new Date(tarefa.inicio).getTime();
  return decorrido > tarefa.prazoMs + FOLGA_DE_ORFA_MS;
}

export function apresentar(tarefa: Tarefa, agora: Date = new Date()): TarefaApresentada {
  return { ...tarefa, provavelmenteInterrompida: provavelmenteInterrompida(tarefa, agora) };
}

export async function lerTarefa(
  pasta: string,
  id: string,
  agora: Date = new Date()
): Promise<TarefaApresentada | undefined> {
  const tarefa = await lerCru(pasta, id);
  return tarefa ? apresentar(tarefa, agora) : undefined;
}

// Lista tudo, mais recentes primeiro. O número do id cresce sempre, então
// ordenar por ele é ordenar por chegada.
export async function listarTarefas(
  pasta: string,
  agora: Date = new Date()
): Promise<TarefaApresentada[]> {
  const ids = await idsGuardados(pasta);
  const tarefas: Tarefa[] = [];
  for (const id of ids) {
    const tarefa = await lerCru(pasta, id);
    if (tarefa) tarefas.push(tarefa);
  }
  return tarefas
    .sort((a, b) => (numeroDoId(b.id) ?? 0) - (numeroDoId(a.id) ?? 0))
    .map((tarefa) => apresentar(tarefa, agora));
}

// Apaga as tarefas mais antigas até sobrarem no máximo `maximo`. Sem isso a
// pasta cresceria pra sempre.
export async function faxina(
  pasta: string,
  maximo = MAXIMO_DE_TAREFAS,
  agora: Date = new Date()
): Promise<string[]> {
  const tarefas = await listarTarefas(pasta, agora);
  if (tarefas.length <= maximo) return [];
  // Da mais antiga pra mais nova.
  const daMaisAntiga = [...tarefas].reverse();
  // Tarefa ainda rodando dentro do prazo é poupada: alguém ainda vai gravar o
  // resultado nela, e apagar o papelzinho antes do prato chegar seria perder o
  // trabalho. Órfã estourada não tem mais ninguém pra atualizar, então pode ir.
  const descartaveis = daMaisAntiga.filter(
    (tarefa) => tarefa.estado !== "rodando" || tarefa.provavelmenteInterrompida
  );
  const quantasSobram = tarefas.length - maximo;
  const apagadas: string[] = [];
  for (const tarefa of descartaveis.slice(0, quantasSobram)) {
    try {
      await unlink(join(pasta, nomeDoArquivo(tarefa.id)));
      apagadas.push(tarefa.id);
    } catch {
      // Alguém já apagou (outra sessão fazendo faxina): tudo bem.
    }
  }
  return apagadas;
}
