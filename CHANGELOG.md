# Diário do projeto — multimodels-mcp

## 2026-07-20 — Benchmark de delegação (198 execuções) e correção do endpoint da z.ai
- Nova pasta `benchmark/` com o estudo completo de quais modelos podem receber tarefas delegadas: 6 provas × 11 modelos × 3 rodadas, tudo corrigido por testes automáticos que os modelos nunca viram. Inclui os enunciados, os corretores, todas as respostas, os relatórios e o kit pronto pra compartilhar no Reddit (imagens + texto em inglês).
- Descobertas principais: a família do Codex (Sol, Terra e Luna) acertou 100% de tudo; o Luna custa 5 vezes menos que o Sol e empatou com ele; extração de dados em JSON funcionou perfeitamente em todos os modelos; e repetir cada prova 3 vezes mudou várias conclusões que uma rodada única tinha dado.
- Consertado o endereço da z.ai: a chave de assinatura de coding só funciona no balcão de coding (`/api/coding/paas/v4`). No endereço antigo, dava um erro enganoso de "saldo insuficiente".

## 2026-07-20 — Segunda instância do LM Studio (outra máquina da rede)
- Novo provedor "LM Studio (rede)": modelos rodando de graça em outra máquina da rede do Daniel (192.168.0.42), pelo LM Studio dela.
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
