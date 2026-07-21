# Estação A — Validador de configuração de agência

Você está na pasta de um pequeno projeto Node.js (ESM). A dependência **zod** já está instalada — confira a versão em `package.json`/`node_modules` e use a API correta dessa versão.

## Entregável

Crie o arquivo `src/validador.mjs` exportando:

### 1. `EsquemaConfiguracao` (schema zod)

Valida um objeto de configuração com estes campos:

- `nome`: string, 3 a 80 caracteres. Mensagem quando curto: `"nome muito curto"`.
- `email`: string com e-mail válido. Mensagem quando inválido: `"email inválido"`.
- `servidorIp`: string com **endereço IPv4 válido** (ex.: `192.168.0.10`). Mensagem quando inválido: `"endereço IPv4 inválido"`.
- `faixaLiberada`: string com **faixa IPv4 em notação CIDR** válida (ex.: `10.0.0.0/8`). Mensagem quando inválida: `"faixa CIDR inválida"`.
- `porta`: número inteiro entre 1 e 65535 (inclusive). Quando o valor recebido **não for um número** (ex.: veio uma string), a mensagem deve ser exatamente `"porta deve ser um número"`. Quando for número fora da faixa ou não inteiro, mensagem: `"porta fora da faixa"`.
- `precosPorServico`: objeto/dicionário com chaves string livres e valores **inteiros positivos** (centavos). Ex.: `{ "ensaio": 150000, "edicao": 30000 }`. Pode ser vazio.
- `contato` (opcional): objeto `{ telefone: string de 8 a 20 caracteres }`.

Campos desconhecidos no objeto de entrada devem ser descartados no resultado validado (comportamento padrão do zod).

### 2. `validarConfiguracao(dados)`

Usa o schema acima com `safeParse` e devolve:
- Sucesso: `{ ok: true, dados: <objeto validado> }`
- Falha: `{ ok: false, erros: [{ campo, mensagem }] }` — `campo` é o caminho unido por pontos (ex.: `"contato.telefone"`, `"precosPorServico.ensaio"`), e `mensagem` é a mensagem do zod para aquele problema.

## Regras

- Use o zod instalado para TODAS as validações de formato (e-mail, IPv4, CIDR) — não escreva expressões regulares próprias para isso.
- Rode `npm test` (testes públicos em `testes/publicos.mjs`) e entregue somente com tudo passando. Há testes ocultos além dos públicos.
- Não altere `package.json` nem os testes públicos. Não instale nada.
