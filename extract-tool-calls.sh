#!/bin/bash
# extract-tool-calls.sh - Auto-extract tool calls from OpenClaw session logs
# Part of Phase 2: Auto-Logging Hooks

set -euo pipefail

TOOL_CALLS_FILE="${AOS_TOOL_CALLS_FILE:-$HOME/aos-telemetry/tool-calls.jsonl}"
SESSION_LOG_DIR="${OPENCLAW_LOG_DIR:-$HOME/.openclaw/logs}"
STATE_FILE="$HOME/aos-telemetry/.extract-state.json"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[AOS Extract]${NC} $*" >&2
}

warn() {
    echo -e "${YELLOW}[AOS Extract]${NC} $*" >&2
}

error() {
    echo -e "${RED}[AOS Extract]${NC} $*" >&2
}

# Load last processed position
if [[ -f "$STATE_FILE" ]]; then
    LAST_LOG_FILE=$(jq -r '.lastLogFile // ""' "$STATE_FILE")
    LAST_LINE_NUM=$(jq -r '.lastLineNum // 0' "$STATE_FILE")
else
    LAST_LOG_FILE=""
    LAST_LINE_NUM=0
fi

# Find most recent session log
LATEST_LOG=$(find "$SESSION_LOG_DIR" -name "session-*.log" -type f 2>/dev/null | sort -r | head -1)

if [[ -z "$LATEST_LOG" ]]; then
    warn "No session logs found in $SESSION_LOG_DIR"
    exit 0
fi

log "Processing log: $(basename "$LATEST_LOG")"

# If it's a new log file, start from beginning
if [[ "$LATEST_LOG" != "$LAST_LOG_FILE" ]]; then
    LAST_LINE_NUM=0
    log "New log file detected, starting from beginning"
fi

# Extract tool calls from log (simple pattern matching)
# Look for patterns like:
#   [timestamp] Tool call: exec "command"
#   [timestamp] Tool result: success (1.2s)

CURRENT_LINE=0
TOOLS_EXTRACTED=0

# Read log file line by line (skip already processed lines)
while IFS= read -r line; do
    ((CURRENT_LINE++))
    
    # Skip already processed lines
    if [[ $CURRENT_LINE -le $LAST_LINE_NUM ]]; then
        continue
    fi
    
    # Pattern 1: Tool invocation
    if echo "$line" | grep -q "<invoke name="; then
        TOOL_NAME=$(echo "$line" | sed -n 's/.*<invoke name="\([^"]*\)".*/\1/p')
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        
        # Extract parameters (very basic - just presence)
        PARAMS_PRESENT=$(echo "$line" | grep -o "<parameter" | wc -l)
        
        # Record to JSONL (simplified - no cost/tokens yet)
        ENTRY=$(jq -n \
            --arg ts "$TIMESTAMP" \
            --arg tool "$TOOL_NAME" \
            --arg params "$PARAMS_PRESENT" \
            '{
                timestamp: $ts,
                tool: $tool,
                params_count: ($params | tonumber),
                source: "auto-extract",
                line_num: '"$CURRENT_LINE"'
            }')
        
        echo "$ENTRY" >> "$TOOL_CALLS_FILE"
        ((TOOLS_EXTRACTED++))
    fi
    
done < "$LATEST_LOG"

# Save state
jq -n \
    --arg log "$LATEST_LOG" \
    --arg line "$CURRENT_LINE" \
    '{
        lastLogFile: $log,
        lastLineNum: ($line | tonumber),
        lastExtractTime: (now | todate)
    }' > "$STATE_FILE"

if [[ $TOOLS_EXTRACTED -gt 0 ]]; then
    log "✅ Extracted $TOOLS_EXTRACTED tool calls"
else
    log "No new tool calls found"
fi

# Show summary of recent tool usage
log "Recent tool usage:"
tail -10 "$TOOL_CALLS_FILE" 2>/dev/null | jq -r '.tool' | sort | uniq -c | sort -rn || true
