# Projeto: multimodels-mcp

## O que é
Servidor MCP que funciona como um "garçom" entre o Codex e outros modelos de IA: o Codex delega uma tarefa, o servidor processa com o modelo escolhido e devolve o resultado pro Codex avaliar. Modelos disponíveis: Codex (via assinatura do ChatGPT, pelo CLI `codex` já instalado no Mac), DeepSeek, z.ai e OpenRouter (via chaves de API) e modelos locais via LM Studio. Inclui um painel de controle local pra gerenciar chaves e habilitar/desabilitar modelos.

## Pra quem é
Pro Daniel, uso pessoal, rodando só no Mac dele dentro do Codex.

## Stack e comandos
- Servidor: TypeScript + SDK oficial de MCP da Anthropic (transporte stdio, roda local)
- Conector universal: padrão OpenAI-compatible (atende DeepSeek, z.ai, OpenRouter e LM Studio — provedor novo = 1 linha de configuração + chave no .env)
- Codex: integração via CLI `codex` (usa a assinatura, sem custo de API)
- Painel de configuração: shadcn/ui + Tailwind (Vite, pasta `ui/`), página local no navegador — abrir com `npm run panel` (http://127.0.0.1:4747); depois de mudar código da interface, `npm run build:ui`
- Configuração de modelos: arquivo local `config/models.json` (sem banco de dados)
- Chaves: SEMPRE no `.env` (nunca no models.json, nunca no código)
- Rodar os testes: `npm test` (compila e testa; os testes vivem em `src/*.test.ts`)
- Compilar depois de mudar código: `npm run build` (o Codex executa o resultado em `dist/`)
- O servidor está registrado no Codex com o nome `multimodels` (escopo user, vale pra todos os projetos); conferir com `Codex mcp list`
- Ferramentas expostas: `list_models` (cardápio) e `delegate_task` (delegação)

## Como trabalhar comigo

### Sobre mim
- Eu NÃO sei programar. Já fiz projetos de vibecoding, mas preciso de direcionamento.
- Explique tudo em português, com analogias do dia a dia. NUNCA assuma que sei termos técnicos.
- Respostas objetivas. Se eu quiser mais detalhes, eu peço.

### Como se comunicar comigo
- Ao fazer algo, mostre: (1) o que fez, (2) como eu vejo/testo, (3) o que fazer se der erro.
- Se der erro, explique primeiro em linguagem simples, DEPOIS sugira a correção.
- Pedido vago? Faça perguntas até entender. Decisões importantes: apresente opções e explique as diferenças em termos simples.
- A menos que eu diga "faça isso agora", trate meu pedido como conversa: pense comigo, proponha uma abordagem e só modifique arquivos depois que eu confirmar.

### Como construir
- Comece com o mínimo que funciona; adicionamos complexidade aos poucos.
- ANTES de criar qualquer coisa nova (componente de interface ou funcionalidade), você DEVE: (1) procurar no projeto se já existe algo similar, (2) se existir, COPIAR e ADAPTAR o existente — mesmas convenções de design, nomenclatura e navegação — nunca criar do zero, (3) se não existir, me mostrar o padrão pretendido e esperar minha confirmação. Cada componente de interface deve ficar em seu próprio arquivo. Inconsistência é inaceitável neste projeto.
- Cada arquivo deve ter uma única responsabilidade clara — uma funcionalidade ou seção da aplicação. Se um arquivo começar a misturar funcionalidades diferentes, divida em arquivos separados antes de continuar. Teste: se você não consegue descrever o que o arquivo faz numa frase, ele está grande demais.
- Toda interface deve funcionar em celular e desktop. Mostre como fica em tela pequena.
- Trate erros sempre: se algo falhar, mostre mensagem amigável em português; nunca deixe a tela quebrar.

### Como verificar seu trabalho
- Para toda funcionalidade nova, escreva testes automatizados e RODE-OS antes de me dizer que terminou.
- Me mostre EVIDÊNCIA de que funciona (saída dos testes, comando executado, screenshot) — não apenas afirme que funciona.
- Se um teste falhar, corrija a CAUSA do problema; nunca apague ou desative o teste pra ele "passar".

### Segurança
- NUNCA coloque chaves de API, senhas ou segredos no código. Use arquivo .env, e garanta .env no .gitignore (crie se não existir).
- Se o projeto for público (multiusuário), NUNCA construa autenticação do zero — use os recursos nativos do Supabase ou Firebase.
- Valide todo input do usuário; nunca confie em dados do frontend. CORS só para o domínio do app, nunca *.
- Pagamentos, dados pessoais ou criptografia: PARE e me avise antes de qualquer coisa.
- Específico deste projeto: o painel local NUNCA deve exibir chaves salvas por inteiro (só os 4 últimos caracteres) e só pode aceitar conexões do próprio Mac (localhost).

### Permissões e ações sensíveis
- Nunca faça deploy, instale dependências ou delete arquivos/funções sem me explicar o quê e por quê, e esperar minha confirmação explícita.

### Versionamento
- Feature concluída e testada = commit com mensagem descritiva. Não acumule mudanças sem commit.
- A cada feature concluída, atualize o CHANGELOG.md na raiz, em português simples, sem termos técnicos.
