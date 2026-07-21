#!/bin/bash
# Rodada 3 — raia "GLM com mãos": roda o Claude Code em modo silencioso (GLM-5.2
# via z.ai) nas 4 pastas de execução (2 estações × 2 rodadas), uma após a outra.
# A chave é lida do .env e nunca aparece na tela.
#
# Como usar: abra o Terminal e rode
#   bash "/Users/user/Documents/Claude Code/Multimodels/benchmark/rodada2-implementacao/rodada3-glm-cc.sh"

set -u
PROJ="/Users/user/Documents/Claude Code/Multimodels"
R3="/private/tmp/claude-501/-Users-user-Documents-Claude-Code-Multimodels/fb168cc1-674f-45aa-9536-ad05c72c1f42/scratchpad/rodada3"

KEY=$(grep '^ZAI_API_KEY=' "$PROJ/.env" | cut -d= -f2-)
if [ -z "$KEY" ]; then echo "ERRO: ZAI_API_KEY não encontrada no .env"; exit 1; fi

CONFIG_TMP=$(mktemp -d "$R3/glmcc-config.XXXX")

for pasta in glmcc-a-r1 glmcc-a-r2 glmcc-b-r1 glmcc-b-r2; do
  d="$R3/runs/$pasta"
  if [ ! -d "$d" ]; then echo "AVISO: $d não existe, pulando"; continue; fi
  echo ">>> Rodando $pasta (alguns minutos)..."
  cd "$d"
  date +%s > "$d/start.ts"
  env CLAUDE_CONFIG_DIR="$CONFIG_TMP" \
      ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic" \
      ANTHROPIC_AUTH_TOKEN="$KEY" \
      ANTHROPIC_API_KEY="$KEY" \
      API_TIMEOUT_MS=3000000 \
    claude -p "$(cat "$R3/prompt-maos.txt")" \
      --model glm-5.2 \
      --permission-mode acceptEdits \
      --allowedTools "Read" "Glob" "Grep" "Edit" "Write" "Bash(npm test:*)" "Bash(npm run build:*)" \
      --mcp-config '{"mcpServers":{}}' --strict-mcp-config \
      --output-format json > "$d/claude-out.json" 2> "$d/claude-err.txt"
  echo "    exit=$?"
  date +%s > "$d/end.ts"
done

echo "✅ As 4 execuções do GLM-com-mãos terminaram. Volte pro Claude e diga: 'glm com mãos terminou, avalia'."
