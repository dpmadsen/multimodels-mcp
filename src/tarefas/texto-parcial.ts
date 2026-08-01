// Como se mostra um texto PARCIAL sem que ninguém o confunda com uma resposta.
//
// Analogia: é o rascunho amassado que sobrou do cozinheiro quando o fogão
// apagou. Ele pode valer muito — mas se for servido num prato bonito, alguém
// come achando que é o jantar. Então ele vai pra mesa embrulhado num aviso, e
// o aviso aparece antes e depois, pra não ter como não ver.
//
// Um arquivo só pra isto porque o mesmo aviso é usado em dois lugares (na
// consulta da tarefa e na delegação síncrona) e as duas TÊM que falar igual.

export const AVISO_DE_PARCIAL =
  "⚠️ ATENÇÃO: o texto abaixo está INCOMPLETO. É só o que o modelo tinha escrito até " +
  "a tarefa ser interrompida — NÃO é a resposta final, não foi revisado por ele e pode " +
  "terminar no meio de uma frase ou de um raciocínio. Use como rascunho ou para não " +
  "perder o caminho já andado; para uma resposta de verdade, delegue a tarefa de novo.";

// Envolve o rascunho no aviso, com marcas claras de onde ele começa e termina.
// O `rotulo` diz de quem é o rascunho (ex.: "tarefa-3" ou o nome da raia).
export function blocoDeParcial(parcial: string, rotulo: string): string {
  return (
    `${AVISO_DE_PARCIAL}\n\n` +
    `--- rascunho incompleto (${rotulo}), início ---\n` +
    `${parcial}\n` +
    `--- rascunho incompleto (${rotulo}), fim ---\n\n` +
    `${AVISO_DE_PARCIAL}`
  );
}
