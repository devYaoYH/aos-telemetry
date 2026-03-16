#!/bin/bash
# Log tool call and link to turn

TURN_ID="$1"
TOOL="$2"
DURATION_MS="$3"
COST="$4"
STATUS="${5:-success}"
MODEL="${6:-unknown}"
TOKENS_IN="${7:-0}"
TOKENS_OUT="${8:-0}"

if [[ -z "$TURN_ID" || -z "$TOOL" ]]; then
    echo "Usage: $0 <turn-id> <tool> <duration-ms> <cost> [status] [model] [tokens_in] [tokens_out]"
    echo "Example: $0 turn-1 exec 1234 0.01 success sonnet 5000 1500"
    exit 1
fi

LOG_FILE="$HOME/aos-telemetry/context-log.jsonl"
TEMP_FILE="/tmp/aos-tool-append-$$.jsonl"

if [[ ! -f "$LOG_FILE" ]]; then
    echo "❌ Context log not found: $LOG_FILE"
    exit 1
fi

# Find the turn entry and append tool call
# Note: This is a simplified implementation - for production, use proper JSON manipulation
# For now, we'll create a separate tool-calls log

TOOL_LOG="$HOME/aos-telemetry/tool-calls.jsonl"

cat > /tmp/aos-tool.json <<EOF
{
  "turn_id": "$TURN_ID",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "tool": "$TOOL",
  "duration_ms": $DURATION_MS,
  "cost": $COST,
  "status": "$STATUS",
  "model": "$MODEL",
  "tokens_input": $TOKENS_IN,
  "tokens_output": $TOKENS_OUT
}
EOF

jq -c '.' /tmp/aos-tool.json >> "$TOOL_LOG"
echo "✅ Tool call logged: $TOOL (${DURATION_MS}ms, \$$COST, $STATUS) → turn $TURN_ID"
rm /tmp/aos-tool.json
