# Estação B — Rateio de cobrança com tetos

Pasta de um pequeno projeto Node.js (ESM), sem dependências externas.

## Entregável

Crie `src/ratear.mjs` exportando a função pura:

```js
export function ratear(totalCentavos, participantes)
```

- `totalCentavos`: inteiro (pode ser negativo — estorno).
- `participantes`: lista de objetos `{ id, peso, tetoCentavos? }`.

Devolve uma lista de inteiros (centavos), na MESMA ordem dos participantes, somando EXATAMENTE `totalCentavos` — ou `null` nos casos indicados.

## Regras (siga à risca; a ordem importa)

1. **Validação** — devolva `null` se: `totalCentavos` não for inteiro; a lista for vazia ou não for lista; algum `peso` não for número finito ≥ 0; algum `tetoCentavos` presente não for inteiro positivo.
2. **Pesos** — a divisão é proporcional aos pesos. Exceção: se TODOS os pesos forem 0, divida em partes iguais (como se todos tivessem peso 1). Participante com peso 0 (quando há pesos positivos) recebe exatamente 0 e não participa de nada.
3. **Estorno (total negativo)** — calcule o rateio para o valor absoluto e inverta o sinal de cada parcela no final. Simetria perfeita: `ratear(-t, ps)` = `ratear(t, ps)` com cada elemento negado.
4. **Distribuição inteira (método do maior resto), em rodadas:**
   - Enquanto houver centavos por distribuir: chame de "ativos" os participantes com peso > 0 (ou todos, no caso todos-zero) que ainda não bateram o teto.
   - Se não houver ativos e ainda sobrar valor → devolva `null` (tetos insuficientes).
   - Cota exata de cada ativo na rodada: `sobra × peso / somaDosPesosDosAtivos`.
   - Cada ativo recebe o PISO da sua cota, limitado ao espaço que resta até seu teto.
   - Os centavos que faltarem para fechar a rodada são dados 1 a 1, em ordem decrescente da parte fracionária da cota (empate: vence o MENOR índice), pulando quem não tem mais espaço até o teto.
   - Recalcule a sobra e repita se necessário (tetos atingidos redistribuem naturalmente na rodada seguinte).
5. **Teto** — `tetoCentavos` limita o valor ABSOLUTO da parcela do participante.

## Exemplos (também estão nos testes públicos)

- `ratear(10, [{id:"a",peso:1},{id:"b",peso:1},{id:"c",peso:1},{id:"d",peso:1}])` → `[3, 3, 2, 2]`
- `ratear(100, [{id:"a",peso:1,tetoCentavos:10},{id:"b",peso:1}])` → `[10, 90]`
- `ratear(10.5, [...])` → `null`

## Regras de entrega

- Rode `npm test` (testes públicos em `testes/publicos.mjs`) e entregue somente com tudo passando. Há testes ocultos além dos públicos.
- Não altere os testes públicos nem o `package.json`. Sem dependências externas.
