# Tarefa: escolha de modelo e esforço de raciocínio no provedor Codex

## Contexto

Você está trabalhando no projeto **multimodels-mcp**, um servidor MCP em TypeScript que permite ao Claude Code delegar tarefas a outros modelos de IA. O provedor "codex" chama o CLI `codex` (assinatura do ChatGPT) sempre com o modelo padrão configurado na máquina. Queremos poder escolher, por delegação, qual modelo da família GPT-5.6 usar (sol, terra ou luna) e com qual esforço de raciocínio — porque o luna custa 1/5 do sol com a mesma qualidade em tarefas técnicas.

Siga as convenções do projeto (arquivo CLAUDE.md): comentários e mensagens de erro em português simples e amigável, um arquivo por responsabilidade, tratar erros sempre, testes automatizados para funcionalidade nova.

## O que implementar

### 1. Configuração (`src/config.ts` e `config/models.json`)

- A interface `CodexProvider` ganha um campo opcional `models?: string[]` — a lista de modelos do Codex habilitados para escolha explícita (ex.: `["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]`).
- No `config/models.json`, adicione ao provedor `codex` o campo `"models": ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]`.
- `resolveModel` passa a aceitar ids no formato `codex:<modelo>` (ex.: `codex:gpt-5.6-luna`), além do formato antigo `codex` (que continua funcionando exatamente como hoje — usa o modelo padrão do CLI):
  - `codex` → ok, `model` fica `undefined` (compatibilidade total com o comportamento atual).
  - `codex:<modelo>` com `<modelo>` presente na lista `models` → ok, `model` preenchido.
  - `codex:<modelo>` com `<modelo>` fora da lista → erro amigável em português informando quais modelos estão habilitados.
  - `codex:<modelo>` quando o provedor não tem lista `models` (ou ela está vazia) → erro amigável explicando que nenhum modelo explícito está habilitado.

### 2. Provedor Codex (`src/providers/codex.ts`)

- Extraia a montagem dos argumentos do CLI para uma função **exportada e pura**, com exatamente esta assinatura:

```ts
export function buildCodexArgs(
  task: string,
  opts: { outFile: string; model?: string; effort?: string }
): string[]
```

  Ela devolve o array de argumentos passado ao `spawn("codex", args)` (sem incluir o próprio executável `codex`). Regras:
  - Sempre inclui, como hoje: `exec`, `--skip-git-repo-check`, `--sandbox read-only`, `--output-last-message <outFile>` e a tarefa como último argumento.
  - Com `model`: inclui `-m <model>`.
  - Com `effort`: inclui `-c model_reasoning_effort=<effort>`. Valores válidos: `low`, `medium`, `high`, `xhigh`. Qualquer outro valor → lançar erro amigável em português listando os válidos.
  - As opções (`-m`, `-c`, etc.) vêm ANTES da tarefa (o CLI espera a instrução como argumento posicional final).
- `runCodex` ganha os parâmetros opcionais `model` e `effort` e passa a usar `buildCodexArgs`. Nada mais do comportamento atual muda (timeout, stdin fechado, mensagens de erro, limpeza do diretório temporário).

### 3. Ferramenta delegate_task (`src/tools/delegate.ts`)

- O schema de entrada ganha o campo opcional `effort` (string), descrito como: somente para o codex; esforço de raciocínio `low`/`medium`/`high`/`xhigh`.
- Quando o destino é o codex, repasse `ref.model` e `effort` para `runCodex`.
- O rodapé da resposta (`[resposta de: ...]`) deve incluir o modelo e o esforço quando informados, ex.: `[resposta de: Codex (assinatura ChatGPT) · gpt-5.6-luna · esforço: high]`.

### 4. Ferramenta list_models (`src/tools/list-models.ts`)

- Para o provedor codex, além da linha atual do id `codex` (modelo padrão do CLI), liste uma linha por modelo habilitado, ex.:
  - `- id: codex — Codex (assinatura ChatGPT) [CLI local, sem chave]`
  - `- id: codex:gpt-5.6-luna — Codex (assinatura ChatGPT) [CLI local, sem chave]`

### 5. Testes e registro

- Escreva testes automatizados (no padrão do projeto, arquivos `src/*.test.ts` ou junto dos existentes) cobrindo a resolução de ids `codex:<modelo>` e a montagem de argumentos (`buildCodexArgs`), incluindo os casos de erro.
- `npm test` (que compila e roda tudo) deve passar por completo — os testes existentes não podem quebrar.
- Adicione uma entrada no `CHANGELOG.md` na raiz, em português simples, sem termos técnicos.

## Fora do escopo (NÃO fazer)

- Não mexa no painel de controle (`src/panel/`, `ui/`).
- Não mude o provedor openai-compat nem outros provedores.
- Não renomeie nem mova arquivos existentes.
