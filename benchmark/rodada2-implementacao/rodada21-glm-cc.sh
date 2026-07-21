#!/bin/bash
# Rodada 2.1 — GLM-5.2 "com mãos": roda o Claude Code em modo silencioso
# apontado pro plano de coding da z.ai, dentro da branch isolada raia-glm-cc.
# A chave NUNCA aparece na tela: é lida do .env e vai direto pro processo.
#
# Como usar: abra o Terminal e rode
#   bash "/Users/user/Documents/Claude Code/Multimodels/benchmark/rodada2-implementacao/rodada21-glm-cc.sh"

set -euo pipefail

PROJ="/Users/user/Documents/Claude Code/Multimodels"
R2="/private/tmp/claude-501/-Users-user-Documents-Claude-Code-Multimodels/fb168cc1-674f-45aa-9536-ad05c72c1f42/scratchpad/rodada2"
WT="$R2/wt/raia-glm-cc"

if [ ! -d "$WT" ]; then
  echo "ERRO: a pasta da branch ($WT) não existe. Peça pro Claude recriar a raia."
  exit 1
fi

KEY=$(grep '^ZAI_API_KEY=' "$PROJ/.env" | cut -d= -f2-)
if [ -z "$KEY" ]; then
  echo "ERRO: não achei ZAI_API_KEY no .env do projeto."
  exit 1
fi

echo "Iniciando o GLM-5.2 via Claude Code (pode levar alguns minutos)..."
cd "$WT"
date +%s > "$R2/glmcc-start.ts"

# Identidade limpa: uma pasta de configuração descartável impede o Claude Code
# de usar o login salvo do Daniel e o obriga a usar a chave da z.ai do ambiente.
CONFIG_TMP=$(mktemp -d "$R2/glmcc-config.XXXX")

set +e
env CLAUDE_CONFIG_DIR="$CONFIG_TMP" \
    ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic" \
    ANTHROPIC_AUTH_TOKEN="$KEY" \
    ANTHROPIC_API_KEY="$KEY" \
    API_TIMEOUT_MS=3000000 \
  claude -p "$(cat "$R2/prompt-implementador.txt")" \
    --model glm-5.2 \
    --permission-mode acceptEdits \
    --allowedTools "Read" "Glob" "Grep" "Edit" "Write" "Bash(npm test:*)" "Bash(npm run build:*)" \
    --mcp-config '{"mcpServers":{}}' --strict-mcp-config \
    --output-format json > "$R2/glmcc-out.json" 2> "$R2/glmcc-err.txt"
STATUS=$?
set -e

date +%s > "$R2/glmcc-end.ts"
echo "exit=$STATUS"
if [ $STATUS -eq 0 ]; then
  echo "✅ Terminou. Volte pro Claude e diga: 'terminou, avalia'."
else
  echo "❌ Deu erro (código $STATUS). Volte pro Claude e diga: 'deu erro, olha o log'."
fi
