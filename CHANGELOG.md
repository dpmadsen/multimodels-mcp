# Diário do projeto — multimodels-mcp

> English version: [CHANGELOG.en.md](CHANGELOG.en.md)

## 0.12.1 (2026-08-01) — O controle de esforço do Claude aparece no painel
- A escolha de quanto o Claude pensa, criada na 0.11.0, existia no servidor, nos testes e no arquivo de configuração — mas não aparecia na tela. Agora aparece.
- O que tinha acontecido: o painel desenha dois formatos de cartão, um para os motores que usam chave de API e outro para os que entram por assinatura. O seletor de esforço tinha sido ligado só no primeiro. Resultado: a funcionalidade estava pronta e invisível justamente na raia para a qual foi feita.
- Nada mudou por baixo — o servidor já mandava os cinco níveis certos o tempo todo. Era só a tela que não estava perguntando.
- Se você tem o painel aberto, recarregue a página para ver.

## 0.12.0 (2026-08-01) — Dá pra ver o prato sendo feito (e o que sobra se ele queimar)

- Até agora, tarefa delegada em segundo plano era uma caixa fechada: você perguntava e só ouvia "ainda está rodando". Vinte minutos assim, sem saber se o modelo estava trabalhando ou travado.
- **Agora a consulta mostra o andamento.** A `check_task` de uma tarefa que ainda roda diz há quanto tempo ela começou, quantos passos já deu, quais ferramentas usou (`Read 2×, Grep`) e quantos tokens já escreveu. Dá pra saber se está andando sem ter que esperar o fim.
- **E tarefa que morre não perde mais tudo.** Se o prazo estoura, se a resposta passa do limite de tamanho ou se a coisa é interrompida, o que o modelo já tinha escrito é guardado junto com o erro. Antes, vinte minutos de trabalho viravam zero.
- **Esse texto salvo vem sempre marcado como rascunho INCOMPLETO**, com o aviso antes e depois dele, e com marcas de onde começa e onde termina. Ele não é resposta: pode parar no meio de uma frase, e o modelo não chegou a revisar. Serve pra você não perder o caminho já andado — para uma resposta de verdade, é só delegar de novo. Na lista de tarefas, esse caso aparece como "erro (com rascunho incompleto)".
- **Uma coisa que a gente decidiu NÃO fazer, de propósito:** mostrar o texto do modelo ao vivo enquanto ele trabalha normalmente. Modelo que raciocina passa por conclusões no meio do caminho que ele mesmo descarta depois — quem lesse aquilo poderia sair agindo sobre uma ideia que o próprio modelo já tinha abandonado. O rascunho só aparece quando a tarefa morre, que é quando ele é a única coisa que sobrou.
- Isso tudo vale **só nas raias "com mãos"** (as que rodam o Claude Code por baixo). Codex, Gemini e as raias de API não sabem dar essa notícia; nelas a consulta responde exatamente como antes, e a tarefa que roda avisa honestamente que aquela raia não manda sinal de andamento.
- Por baixo, o jeito de ler a resposta do programa `claude` mudou: em vez de esperar um documento único no fim, o servidor agora acompanha os avisos que o programa vai dando durante o trabalho. **O texto final que chega até você é exatamente o mesmo de antes** — isso está provado por um teste que compara os dois jeitos de ler lado a lado, usando uma execução de verdade gravada em arquivo.
- Cuidado com o disco: um trabalho desses gera centenas de avisos por minuto. O andamento é anotado no máximo uma vez a cada 3 segundos (e sempre uma última vez no fim, pra nada se perder), em vez de a cada avisinho.
- Cuidado com o futuro: se uma atualização do Claude Code passar a mandar um tipo de aviso que a gente não conhece, ou cuspir uma linha estranha no meio, o servidor ignora em silêncio e segue trabalhando. Um formato novo não pode derrubar a sua delegação.
- 57 testes novos (273 no total, todos passando).

## 0.11.0 (2026-08-01) — Dá pra escolher o quanto o Claude pensa

- A raia "Claude com mãos (assinatura)" ganhou o mesmo controle de esforço que a z.ai e a OpenRouter já tinham: agora dá pra dizer o quanto o modelo deve pensar antes de responder.
- São cinco níveis: `low`, `medium`, `high`, `xhigh` e `max`. Escolhe-se no painel, no cartão dessa raia, um nível para cada modelo — igualzinho aos outros motores. Também dá pra pedir na hora, na própria delegação.
- **A gente mediu, e desta vez funciona de verdade.** Mesma perguntinha de raciocínio, mesmo modelo (`claude-sonnet-5`), só mudando o nível: no `low` a resposta saiu com 168 tokens em 6 segundos e custou US$ 0,2629; no `max`, 1321 tokens em 16 segundos e US$ 0,2803. Ou seja: quase 8 vezes mais raciocínio e quase 3 vezes mais tempo, por 6,6% a mais de custo. As duas respostas estavam certas; a do `max` veio mais bem organizada.
- Por que o custo quase não muda: nessa raia cada delegação já começa carregando cerca de 43 mil tokens da sua configuração global. Perto dessa bagagem, o que o modelo pensa a mais pesa pouco no bolso — mas pesa no relógio.
- Nenhum nível vem escolhido de fábrica. Sem escolha sua, a gente não manda nada e vale o padrão do próprio Claude Code — a regra da casa é não inventar padrão sem medir.
- **Correção de um erro nosso na documentação.** O README afirmava que o protocolo da Anthropic "não tem conceito de esforço". Era falso: tem, e o programa `claude` sempre ofereceu essa opção. O que a medição de 31/07 mostrou é outra coisa — que mandar esforço para as raias do DeepSeek não muda nada, porque o motor do outro lado joga fora. A conclusão estava certa, a explicação estava errada, e era justamente a explicação errada que faria a gente nunca testar do lado da Anthropic.
- As outras raias "com mãos" (GLM, DeepSeek, Kimi) continuam recusando o pedido de esforço, com o mesmo recado de sempre. E agora isso é declarado no cardápio, não escrito no código: a raia que lista os níveis dela aceita; a que não lista, recusa.
- 18 testes novos (216 no total, todos passando).

## 0.10.0 (2026-08-01) — A senha em vez do prato: sua sessão não trava mais
- Antes, delegar uma tarefa era ficar de pé na frente da cozinha: enquanto o outro modelo trabalhava (nas raias "com mãos" e no Celta isso pode levar 20, 30 minutos), a sua sessão ficava pendurada e você não conseguia fazer mais nada.
- Agora o garçom entrega uma **senha**. Você pede, ele responde na hora com o número da tarefa (`tarefa-1`, `tarefa-2`...) e a sessão continua sua. O prato vai sendo feito por trás.
- Para pegar o resultado depois existe uma ferramenta nova, a `check_task`: com o número, ela devolve a resposta pronta (ou diz que ainda está rodando, ou mostra o erro); sem número, ela lista as tarefas, da mais recente pra mais antiga, com o comecinho de cada pedido pra você reconhecer qual é qual.
- A orientação foi escrita na própria ferramenta: depois de delegar, siga trabalhando em outra coisa e volte a consultar mais tarde. Ficar perguntando de novo e de novo em looping só gasta contexto à toa.
- **O resultado fica guardado em arquivo**, não só na lembrança da sessão. Fechou o Claude Code, foi dormir, voltou amanhã: a resposta ainda está lá. Ficam guardadas as 50 tarefas mais recentes; a mais antiga sai quando entra uma nova, pra pasta não crescer pra sempre. Tudo mora em `.multimodels/tarefas/`, dentro do projeto, e não vai pro repositório.
- Padrão é padrão, não camisa de força: para uma tarefa de vinte segundos, é só pedir `"wait": true` na delegação que o garçom espera ali mesmo e traz o prato na hora, do jeito que era antes.
- Ressalva honesta: se você fechar a sessão no meio de uma tarefa, ninguém mais vai anotar o desfecho dela — o papelzinho fica preso em "rodando" pra sempre. Não dá pra saber isso com certeza, então, passado o prazo daquela raia mais dois minutos de folga, a tarefa passa a aparecer como **"provavelmente interrompida — a sessão que iniciou essa tarefa foi fechada"**. É só um aviso na hora de mostrar; o arquivo não é alterado, e se por acaso a resposta chegar, o aviso some sozinho.
- Nada mudou no jeito de falar com cada modelo: a tarefa em segundo plano passa exatamente pelos mesmos caminhos de antes, inclusive pela fila de cada provedor. Cinco pedidos ao Celta continuam entrando na fila, um de cada vez — não viram cinco chamadas atropelando a máquina.
- Recusa continua imediata: pedir esforço numa raia "com mãos", ou pedir uma raia do mesmo fabricante do programa que está chamando, dá o "não" na cara na hora — não vira uma tarefa que só falha meia hora depois.
- Cuidado especial embaixo do capô: um erro solto numa tarefa de segundo plano derrubaria o servidor inteiro no meio do seu trabalho. Todo caminho de erro é capturado e vira o estado "erro" da tarefa, com o motivo escrito ali.
- 32 testes novos (198 no total, todos passando).

## 0.9.0 (2026-08-01) — O garçom reconhece quem está pedindo
- O servidor agora repara em qual programa está falando com ele (o Claude Code, o Codex, o Gemini...) e esconde do cardápio a raia do mesmo fabricante desse programa.
- Por quê: dentro do Claude Code, pedir pra raia `claude-maos` é dar uma volta cara — sai da sua sessão, abre um Claude Code novo por fora, recarrega cerca de 31 mil tokens de configuração global sua e ainda gasta da mesma assinatura que você já está usando. O mesmo vale pra pedir `codex` de dentro do Codex. Nesses casos o certo é o subagente do próprio programa, que já está ali, sem nenhum desses custos.
- O propósito deste projeto é justamente o contrário: atravessar a fronteira. Chamar o GPT, o Gemini ou o GLM de dentro do Claude Code, e chamar o Claude de dentro do Codex. Isso continua todo mundo liberado.
- Agora é regra da máquina, não disciplina de quem usa: além de sumir do cardápio, a raia também é recusada se o id for digitado na mão, com um recado explicando o porquê e apontando o subagente nativo.
- Nunca esconde caladinho: quando alguma raia sai do cardápio, aparece um aviso no rodapé dizendo qual saiu e por quê. Raia que some sem explicação parece raia quebrada.
- Na dúvida, não esconde nada. Se o programa que está chamando não se identificar, ou for um que a gente não conhece, o cardápio vem inteiro. A regra é uma economia, não uma tranca.
- Tem como forçar: a variável de ambiente `MULTIMODELS_ANFITRIAO` manda mais que o palpite do servidor. Colocando `nenhum`, a regra inteira desliga e tudo volta a aparecer; colocando o nome de um fabricante (`openai`, `anthropic`, `google`), ele passa a valer como se fosse o programa que está chamando. Serve pra testar e pra consertar um palpite errado sem precisar recompilar nada.
- Só três raias entraram na regra: `codex` (openai), `gemini` (google) e `claude-maos` (anthropic). As raias "com mãos" dos outros motores (GLM, DeepSeek, Kimi) usam o Claude Code só como carroceria — quem responde é outro fabricante — então elas nunca somem.
- O servidor também passou a anotar, uma vez por sessão, o nome do programa que se conectou. É assim que a gente confere na prática se ele acertou quem estava chamando.
- 25 testes novos (166 no total, todos passando).

## 0.8.0 (2026-08-01) — Claude com mãos, pela assinatura
- Nasceu a raia "Claude com mãos (assinatura)": agora dá pra delegar tarefas pros próprios modelos da Anthropic, e eles chegam com as mesmas mãos das outras raias — leem os arquivos do projeto, procuram no código e rodam os testes, mas não podem editar nada.
- Ids novos: `claude-maos:claude-fable-5`, `claude-maos:claude-opus-5`, `claude-maos:claude-opus-4-8` e `claude-maos:claude-sonnet-5`.
- Ela entra pela sua assinatura do Claude Code, com o login que você já usa. Não tem chave pra preencher, e por isso o cartão dela no painel não mostra campo de chave — só o liga/desliga, a lista de modelos e o prazo.
- Custo, sem letra miúda: "sem chave" não quer dizer "de graça". Essa raia gasta da mesma cota da assinatura que a sua conversa está gastando. E como ela usa a sua configuração de verdade do Claude Code, cada delegação já começa carregando cerca de 31 mil tokens de bagagem (as instruções globais que você tem configuradas) antes mesmo de olhar a tarefa. É a raia mais cara em cota do cardápio — use quando a qualidade compensar.
- Por dentro, é o mesmo motor que já servia GLM, DeepSeek e Kimi com mãos: a diferença é só a ausência de endereço e de chave no cardápio, que é o combinado pra dizer "essa aqui entra pela assinatura".
- Trava de segurança: antes de abrir a delegação, o servidor limpa do ambiente qualquer chave da Anthropic que esteja pendurada por ali. Sem isso, uma chave esquecida no seu computador faria a delegação ser cobrada por fora, caladinha, em vez de usar a assinatura.
- 21 testes novos (141 no total, todos passando).

## 0.7.1 (2026-07-31) — O painel para de mostrar tela velha depois de atualizado
- Antes, o navegador decidia sozinho por quanto tempo guardar a página do painel — e chegava a mostrar a versão antiga mesmo depois de a nova estar pronta, escondendo funcionalidade recém-adicionada até você fazer um recarregamento forçado.
- Agora o painel avisa o navegador: a página em si nunca fica guardada, e os arquivos internos (que ganham nome novo a cada versão) podem ficar. Resultado: abriu o painel, viu a versão atual.
- 2 testes novos (120 no total, todos passando).

## 0.7.0 (2026-07-31) — Esforço de raciocínio por modelo
- Agora dá pra escolher, no painel, quanto cada modelo deve "pensar" antes de responder: um pode ficar caprichando na resposta e outro respondendo rápido, cada um do seu jeito.
- A escolha aparece ao lado do nome do modelo, na lista de modelos habilitados do cartão. É uma listinha: você escolhe o nível e pronto, já fica valendo.
- Os níveis aparecem com o nome que cada fabricante usa, sem tradução, porque é exatamente esse nome que a máquina dele entende. A z.ai oferece `high` e `max`; a OpenRouter oferece `low`, `medium` e `high`; a DeepSeek oferece `low`, `high` e `max`.
- A primeira opção da lista é sempre "padrão do fabricante": escolhendo ela, a gente não pede nada e vale o que o fabricante já faz por conta própria.
- Esse controle só existe nos motores que aceitam o ajuste. Codex, Gemini, as raias "com mãos" e o LM Studio continuam exatamente como estavam — nem seletor aparece.
- Se uma delegação pedir um esforço específico na hora, o pedido dela vale mais que o padrão escolhido no painel. Sem pedido, vale o padrão do modelo; sem padrão, vale o do fabricante.
- Ao remover um modelo da lista, a escolha de esforço dele some junto, pra não ficar sobra guardada no arquivo.
- Ressalva de fabricante: no `deepseek-v4-pro` a DeepSeek ainda trata o `low` como se fosse `high` — escolher `low` ali muda a conta, não o tanto de raciocínio. Eles preveem corrigir em agosto/2026. No `deepseek-v4-flash` os três níveis funcionam.
- 18 testes novos (118 no total, todos passando).

## 0.6.0 (2026-07-31) — DeepSeek e Kimi com mãos
- A raia "com mãos" (aquela em que o modelo lê os arquivos do projeto e roda os testes, mas não pode editar nada) deixou de ser exclusividade do GLM: agora o DeepSeek e o Kimi também têm a delas.
- Ids novos: `deepseek-maos:deepseek-v4-pro`, `deepseek-maos:deepseek-v4-flash` e `kimi-maos:kimi-k3`.
- As duas nascem desligadas no painel, porque ainda falta criar as chaves. É só ligar o interruptor do cartão quando a chave estiver pronta.
- A do DeepSeek usa a mesma chave da DeepSeek que já está no .env (é paga por uso, cobrada por chamada).
- A do Kimi usa uma chave nova, a oficial da Moonshot (platform.kimi.ai) — não é a mesma chave da OpenRouter que já usamos pro Kimi sem mãos. Ela vai no .env com o nome `MOONSHOT_API_KEY`.
- Os cartões das raias com mãos ganharam campo de chave no painel: dá pra colar a chave ali mesmo, sem abrir arquivo nenhum. Como sempre, o painel só mostra os 4 últimos caracteres.
- Testado de verdade com a chave da DeepSeek: ele leu o README do projeto e respondeu certo. A ressalva que a documentação deles levantava (pedir o modelo grande e receber o barato sem aviso) **não se confirmou**: nome de modelo errado dá erro claro dizendo quais nomes existem, e cada um dos dois nomes entrega o modelo certo — confirmado pelo relatório de consumo da própria API, não pela palavra do modelo.
- 15 testes novos (100 no total, todos passando).

## 0.5.0 (2026-07-31) — Prazo de execução ajustável no painel
- Agora dá pra escolher, direto no painel, quanto tempo esperar antes de desistir de uma delegação — sem abrir arquivo nenhum.
- No topo do painel apareceu o cartão "Prazo de execução": o número ali vale para todos os motores.
- Cada motor também ganhou seu próprio campo de prazo. Deixando vazio, ele segue o padrão do topo; digitando um número, só aquele motor muda.
- O prazo é em minutos, de 1 a 120. Se você digitar algo fora disso (ou uma letra), o painel avisa em português e não salva nada.
- Antes, dois motores ignoravam a configuração e tinham 10 minutos fixos por dentro (o Codex e o Gemini). Agora os quatro obedecem ao que está no painel.
- Os prazos que já existiam foram mantidos, só passaram a ser escritos em minutos: GLM, z.ai e OpenRouter com 15 minutos, as duas máquinas com LM Studio com 30, e 10 minutos como padrão geral.
- 12 testes novos (85 no total, todos passando).

## 0.4.1 (2026-07-23) — Prazo maior no OpenRouter e placar consolidado do Kimi
- O prazo do OpenRouter subiu para 15 minutos: modelos que raciocinam muito precisavam de mais espaço para terminar antes de o sistema desistir.
- Com isso o Kimi K3 fechou a rodada 4 em 5 de 6 gabaritado, pensando de 6 a 12 minutos por tarefa (o mais lento do estudo).
- Permanece 1 falha própria do modelo: numa das provas ele termina o raciocínio mas não emite a resposta final.
- Custo: por pensar tanto, sai em ~US$ 0,20 por tarefa entregue, umas 5 vezes o Grok. Detalhes em `benchmark/rodada4-raias-novas/`.

## 2026-07-22 — Rodada 4 do benchmark (parcial): Kimi K3 estreia; Gemini aguarda a cota
- Testamos duas raias novas nas mesmas duas provas da rodada 3 (o validador com o zod v4 de verdade instalado e o rateio de centavos), com os mesmos corretores ocultos. Só o Kimi K3 conseguiu rodar; os dois Gemini ficaram pra depois.
- O achado do Kimi K3 (que só recebe texto, sem olhar os arquivos): ele passou na "pegadinha da biblioteca nova" — escreveu a API atual do zod de cabeça e gabaritou (14/14). É só o segundo modelo só-texto a conseguir isso; o outro foi o Grok, na rodada anterior. O "clube da memória fresca" agora tem dois.
- O Kimi fechou a rodada em 5 de 6 gabaritado, com uma única falha própria do modelo (numa das provas ele termina o raciocínio e não emite a resposta). É lento e caro: o que mais pensa do estudo (6 a 12 minutos por tarefa) e ~US$ 0,20 por tarefa entregue, umas 5 vezes o Grok.
- Os dois Gemini (3.1 Pro e 3.6 Flash) não rodaram: a cota da assinatura Google esgotou no dia. Ela reabre por volta de 29/07, e aí eles serão testados. Enquanto isso ficam marcados como "adiado", nunca como nota zero.
- Tudo (placar, respostas cruas e o relatório da rodada) está em `benchmark/rodada4-raias-novas/`.

## 0.4.0 (2026-07-22) — O Gemini ganhou olhos: leitura de arquivos nas delegações
- A raia Gemini deixou de ser só-texto: passando a pasta da tarefa (workdir), o Gemini agora LÊ os arquivos do projeto de verdade — mesmo esquema somente-leitura do Codex (ler pode, mexer não).
- O que destravou: descobrimos que o agy ignora o arquivo de configuração antigo e só respeita permissões em `~/.gemini/antigravity-cli/settings.json` (o Daniel criou o arquivo com regras só de leitura), e que a pasta da tarefa precisa ser anexada com `--add-dir` (sem isso o agy nem enxerga a pasta).
- As mensagens de erro foram atualizadas: se as permissões não estiverem configuradas, a mensagem agora ensina o caminho do arquivo certo em vez de só mandar colar o contexto no texto.
- 2 testes novos (73 no total, todos passando). Testado de verdade 4 vezes: o Gemini leu um arquivo secreto e respondeu o conteúdo exato em todas.

## 0.3.1 (2026-07-22) — Painel: cartões de assinatura agora mostram seus modelos
- Os cartões do Codex, do Gemini e do GLM-com-mãos apareciam "vazios" no painel: os modelos habilitados não eram mostrados (falha herdada desde o cartão do Codex). Agora todos os cartões mostram a lista "Modelos habilitados" e deixam adicionar/remover, igual aos cartões de API.
- 3 testes novos no servidor do painel (71 no total, todos passando).

## 0.3.0 (2026-07-22) — Raia GLM com mãos: o GLM agora lê o projeto e roda os testes
- O truque que brilhou no benchmark virou provedor oficial: o id novo `glm-maos:glm-5.2` roda o GLM pilotando um Claude Code descartável apontado pra z.ai — ele LÊ os arquivos do projeto, procura no código e roda `npm test`/`npm run build` de verdade, mas NÃO pode editar nada (as ferramentas de escrita ficam bloqueadas).
- Na rodada 2.1 do benchmark, essa receita transformou o GLM só-texto (que entregava teste quebrado sem saber) no autor da maior suíte de testes de todas as raias. Agora ela está a uma delegação de distância, sem script manual.
- Usa a chave da z.ai que já está no .env (assinatura, sem custo extra); identidade descartável a cada chamada (não toca no login do Claude do Daniel); fila de 1 chamada por vez e prazo de 15 minutos, porque a z.ai é lenta e engasga com paralelo.
- Todas as proteções da raia Gemini vieram juntas: teto de memória, prazos que não empatam, acentos intactos e erros explicados em português.
- 8 testes automatizados novos (69 no total, todos passando). Testado de verdade: o GLM leu um arquivo secreto numa pasta de teste e respondeu o conteúdo correto na primeira tentativa.

## 0.2.0 (2026-07-22) — Raia nova: Gemini pela assinatura Google AI Pro (via Antigravity)
- Agora dá pra delegar tarefas pro Gemini do Google usando os créditos da assinatura Google AI Pro (a que vem no Google One) — sem custo de API, mesmo esquema do Codex.
- Ids novos no cardápio: `gemini` (modelo padrão), `gemini:gemini-3.1-pro-high`, `gemini:gemini-3.1-pro-low`, `gemini:gemini-3.6-flash-high` e `gemini:gemini-3.6-flash-low`. O esforço de raciocínio se escolhe pelo final do nome (high pensa mais, low responde mais rápido).
- Por baixo dos panos usa o programa `agy` (Antigravity CLI) — o Google aposentou o antigo `gemini-cli` pra contas pessoais em junho/2026, e o `agy` é o substituto oficial. Roda em modo somente-leitura: analisa e responde, não altera arquivos.
- Limitação conhecida: no modo automático o Gemini não consegue LER arquivos do projeto (a permissão é negada em silêncio) — então a tarefa delegada precisa levar todo o contexto no próprio texto, igual às raias DeepSeek e GLM. Se acontecer, a mensagem de erro explica o que fazer.
- O painel mostra o cartão do Gemini com o selo "assinatura", igual ao do Codex.
- 4 testes automatizados novos, todos os 59 passando. Testado de verdade: pergunta simples e tarefa com contexto no texto, respostas corretas do Flash e do Pro.
- Revisão cruzada por dois modelos de fora (GPT-5.6 no esforço máximo e GLM) endureceu a raia no mesmo dia: prazos que não empatam mais (a mensagem de erro certa sempre fala), acentos que não quebram no meio, teto de memória na resposta e diagnósticos de erro mais honestos. 61 testes no total.

## 2026-07-22 — Primeiras contribuições da comunidade: painel multiplataforma e aviso de Node antigo
- Duas melhorias enviadas pelo Sean Campbell (@rudi193-cmd), que conheceu o projeto pelo Reddit — as primeiras contribuições de fora aceitas no projeto:
- O painel agora abre o navegador sozinho também no Windows e no Linux (antes só funcionava no Mac), e a mensagem de erro do Codex não fala mais "no Mac" pra quem usa outro sistema.
- Quem tentar instalar com uma versão antiga do Node (abaixo da 21) agora recebe um aviso claro na instalação — antes, o `npm test` fingia que tinha rodado os testes sem rodar nenhum, sem avisar nada.
- Por cima da contribuição, adicionamos uma proteção: se o computador não tiver navegador (ex.: servidor sem tela), o painel segue funcionando em vez de fechar sozinho.

## 2026-07-21 — Fila com repescagem por provedor e esforço de raciocínio nas APIs
- Duas melhorias que vieram direto dos aprendizados do benchmark: a z.ai e o LM Studio engasgavam com chamadas ao mesmo tempo (a sessão travava em silêncio ou a conexão caía), e o esforço de raciocínio muda o resultado do GLM (o esforço máximo acerta onde o alto errava).
- Fila por provedor: agora dá pra limitar quantas chamadas simultâneas cada provedor aguenta (a z.ai e os dois LM Studio agora ficam limitados a 1 de cada vez); as demais chamadas esperam a vez, em vez de derrubar a conexão.
- Repescagem automática: se uma chamada falhar por problema de conexão ou por erro passageiro do provedor (limite de pedidos ou instabilidade do servidor dele), o sistema espera 2 segundos e tenta mais uma vez sozinho, sem precisar pedir de novo na mão. Erro de pedido malformado não repesca (repetir não resolveria).
- Prazo por chamada agora é ajustável por provedor (a z.ai ganhou 15 minutos e os LM Studio 30 minutos, porque modelos locais são mais lentos).
- Esforço de raciocínio (o quanto o modelo "pensa" antes de responder) agora também funciona nos provedores de API, não só no Codex: a z.ai já sai configurada com o formato dela, e o OpenRouter com o dele. Quem delegar pode pedir o esforço na hora, ou deixar o padrão configurado pra cada provedor.
- O rodapé da resposta agora mostra o esforço usado (quando houver) e avisa quando a resposta só veio depois de uma repescagem.
- 12 testes automatizados novos (4 da fila + 8 do esforço/repescagem), todos os 55 passando.

## 2026-07-21 — Rodada 3 do benchmark: a prova do conhecimento atualizado
- Nova rodada com as ideias da comunidade do Reddit: 13 raias (incluindo os estreantes Grok 4.5, Qwen 27B e o GLM em dois esforços), 2 provas novas × 3 rodadas cada, com esforço de raciocínio controlado e verificação obrigatória.
- A prova estrela usou uma biblioteca atualizada instalada de verdade: modelos com conhecimento antigo (DeepSeek, GLM econômico, os dois Qwen) escreveram código da versão velha 9 vezes seguidas — código que nem liga. Quem tem "mãos" pra conferir (Codex, agentes Claude) ou memória recente (Grok) passou ileso.
- Outras descobertas: esforço demais atrapalha (o Codex no talento máximo hesitou e maratonou; no nível alto foi perfeito e rápido); a prova de matemática pura foi gabaritada por quase todos, do modelo de 1 centavo ao mais caro; e falhas de entrega (travar, não responder) são aleatórias enquanto falhas de conhecimento são certeiras.
- Relatório completo, placar das 78 execuções, provas e corretores na pasta `benchmark/rodada3-esforco-e-cutoff/`.

## 2026-07-20 — Rodada 2 do benchmark: 5 modelos implementaram a mesma feature de verdade
- A feature abaixo (escolher o modelo do Codex) virou um experimento: Sonnet, Opus, GPT-5.6 Terra, GPT-5.6 Luna e DS4 Pro implementaram a mesma tarefa, cada um na sua branch, corrigidos por 12 verificações ocultas escritas antes.
- Todos gabaritaram as verificações ocultas — mas a revisão fina separou: o Sonnet fez o melhor trabalho (mais testes, comentários no estilo do projeto, melhor diário) e a versão dele foi a escolhida. O DS4 Pro, que só recebe texto, apagou 7 testes antigos sem querer — prova de que anexar TODO o contexto não é frescura.
- Estudo completo, com custos e lições, na pasta `benchmark/rodada2-implementacao/`. As branches com o trabalho de cada modelo foram preservadas.

## 2026-07-20 — Escolher o modelo do Codex e o esforço de raciocínio na delegação
- Agora dá pra pedir um modelo específico da família do Codex na hora de delegar: além do id simples "codex" (que continua usando o modelo padrão do Mac), também funciona "codex:gpt-5.6-sol", "codex:gpt-5.6-terra" ou "codex:gpt-5.6-luna".
- Também dá pra escolher o esforço de raciocínio (o quanto o modelo "pensa" antes de responder): baixo, médio, alto ou extra-alto — útil porque o Luna custa um quinto do Sol e empata em qualidade nas tarefas técnicas (ver benchmark de hoje).
- A ferramenta "listar modelos" agora mostra uma linha pra cada modelo do Codex habilitado, não só a linha genérica de antes.
- Se você pedir um modelo ou esforço que não existe, a mensagem de erro explica direitinho quais são os válidos.
- 8 testes automatizados novos cobrindo esses casos, todos passando.

## 2026-07-20 — Benchmark de delegação (198 execuções) e correção do endpoint da z.ai
- Nova pasta `benchmark/` com o estudo completo de quais modelos podem receber tarefas delegadas: 6 provas × 11 modelos × 3 rodadas, tudo corrigido por testes automáticos que os modelos nunca viram. Inclui os enunciados, os corretores, todas as respostas, os relatórios e o kit pronto pra compartilhar no Reddit (imagens + texto em inglês).
- Descobertas principais: a família do Codex (Sol, Terra e Luna) acertou 100% de tudo; o Luna custa 5 vezes menos que o Sol e empatou com ele; extração de dados em JSON funcionou perfeitamente em todos os modelos; e repetir cada prova 3 vezes mudou várias conclusões que uma rodada única tinha dado.
- Consertado o endereço da z.ai: a chave de assinatura de coding só funciona no balcão de coding (`/api/coding/paas/v4`). No endereço antigo, dava um erro enganoso de "saldo insuficiente".

## 2026-07-20 — Segunda instância do LM Studio (outra máquina da rede)
- Novo provedor "LM Studio (rede)": modelos rodando de graça em outra máquina da rede local, pelo LM Studio dela.
- O botão "Detectar modelos baixados" do painel agora funciona pra qualquer instância do LM Studio — a do Mac e quantas forem adicionadas depois.
- Mensagens sob medida quando algo não responde: a instância local sugere ligar o servidor do LM Studio; a da rede lembra de conferir se a outra máquina está ligada e com "Serve on Local Network" ativado.
- Selo no painel diferencia "grátis · local" de "grátis · rede".
- Apelido editável: um lápis ao lado do nome das instâncias do LM Studio permite renomear direto no painel — testado de verdade: a instância da rede já foi batizada de "Celta".
- Endereço editável: o IP e a porta da máquina também podem ser trocados no painel (campo "Endereço da máquina"), com os detalhes técnicos (http:// e /v1) completados sozinhos. Endereços de provedores de nuvem (DeepSeek, OpenRouter etc.) continuam travados, por segurança.
- Tudo isso já está valendo no painel aberto em http://127.0.0.1:4747 (basta recarregar a página) — feito o merge pra linha principal do projeto.
- A porta do painel agora pode ser trocada (variável MULTIMODELS_PANEL_PORT), útil pra testes sem derrubar o painel aberto.
- Observação: no momento do teste a outra máquina estava desligada — a lista de modelos dela começa vazia e se preenche com um clique no botão de detecção quando ela estiver ligada.
- 34 testes automatizados passando; interface conferida no desktop e no celular. Testes antigos que dependiam das escolhas reais do painel foram trocados por testes com configuração fixa (não quebram mais quando os modelos habilitados mudam).

## 2026-07-20 — Conserto: modelos que "pensam" em tarefas longas
- Problema: ao delegar uma tarefa longa pra um modelo de raciocínio (que "pensa" antes de responder), a resposta às vezes vinha cortada no meio ou dava um erro confuso de "sem texto na resposta". O motivo: o pensamento do modelo gastava o espaço reservado pra resposta.
- Agora o pedido reserva um espaço bem maior pra resposta (32 mil tokens, ajustável por provedor no config/models.json pelo campo "maxTokens").
- Se mesmo assim o modelo gastar tudo só pensando, a mensagem de erro explica isso em bom português e sugere o que fazer.
- Se a resposta vier cortada por falta de espaço, um aviso claro aparece no final — nada de texto truncado em silêncio.
- Testado ao vivo com o mesmo modelo que falhou (Qwen 3.6 35B no LM Studio): o cenário do bug agora dá a mensagem clara, e a tarefa longa volta completa.
- 24 testes automatizados passando (7 novos nesta correção).

## 2026-07-20 — Painel de controle
- Nasceu o painel: uma página local (npm run panel) pra gerenciar as chaves de API e escolher os modelos, sem mexer em arquivo na mão.
- Busca no catálogo do OpenRouter (338 modelos, com preço e tamanho de contexto) e habilitação com um clique — testado adicionando o Gemini 3 Flash.
- Botão que detecta os modelos baixados no LM Studio.
- As chaves nunca aparecem inteiras na tela (só os 4 últimos caracteres) e o painel só aceita conexões do próprio Mac.
- Mudanças no painel valem na hora: o servidor relê a configuração a cada pedido do Claude.
- Regra nova: só modelos habilitados no painel aceitam delegação (o painel é o cardápio de verdade).
- Delegação testada com sucesso num modelo local do LM Studio (Qwen 4B): resposta correta, custo zero.
- Descoberta: modelos "preview" no OpenRouter exigem ajustar a política de privacidade na conta do Daniel (openrouter.ai/settings/privacy) — decisão dele, não automatizamos.
- 17 testes automatizados passando (11 novos nesta feature).

## 2026-07-20 — Servidor funcionando (prova de vida)
- O garçom nasceu: o Claude Code agora enxerga o servidor "multimodels" como conectado.
- Duas ferramentas prontas: listar os modelos disponíveis e delegar uma tarefa a outro modelo.
- Testado de verdade: uma tarefa foi delegada ao Codex (pela assinatura do ChatGPT) e a resposta voltou correta.
- Modelos já no cardápio: Codex, DeepSeek (2), z.ai (1) e os 3 modelos locais do LM Studio. OpenRouter entra quando escolhermos os modelos no futuro painel.
- 6 testes automatizados criados e passando.
- Corrigido no caminho: o Codex ficava esperando pra sempre um "pode ir" ao ser chamado pelo servidor — agora a porta fecha sozinha.

## 2026-07-20 — Fundação
- Projeto criado: definimos o que é, pra quem é e que problema resolve.
- Regras de trabalho registradas no CLAUDE.md.
- Segurança do dia 1: arquivo de chaves (.env) criado e protegido contra vazamento pro git.
