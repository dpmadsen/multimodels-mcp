# Diário do projeto — multimodels-mcp

> English version: [CHANGELOG.en.md](CHANGELOG.en.md)

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
- Novo provedor "LM Studio (rede)": modelos rodando de graça em outra máquina da rede do Daniel (192.168.68.61), pelo LM Studio dela.
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
