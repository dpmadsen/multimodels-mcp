// Regra de validade dos arquivos da interface no navegador.
//
// Por que existe: sem instrução nenhuma, o navegador decide sozinho por quanto
// tempo guardar a página — e chegou a servir a interface antiga mesmo depois de
// recompilada, escondendo funcionalidade nova até um recarregamento forçado.
//
// A regra: o index.html NUNCA pode ser guardado (é ele quem diz qual arquivo de
// código carregar). Os arquivos de código e estilo, sim: o nome deles carrega um
// código embaralhado que muda a cada compilação, então versão nova = nome novo,
// e guardar a antiga não atrapalha ninguém.
const UM_ANO_EM_SEGUNDOS = 31536000;

export function cacheHeaderFor(finalPath: string): string {
  return finalPath.endsWith("index.html")
    ? "no-store, must-revalidate"
    : `public, max-age=${UM_ANO_EM_SEGUNDOS}, immutable`;
}
