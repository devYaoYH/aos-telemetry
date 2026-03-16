#!/bin/bash
# AOS Context Query Tool - Analyze context composition over time

LOG_FILE="$HOME/aos-telemetry/context-log.jsonl"

if [[ ! -f "$LOG_FILE" ]]; then
    echo "❌ No context log found at $LOG_FILE"
    exit 1
fi

ACTION="${1:-summary}"

case "$ACTION" in
    summary)
        echo "📊 AOS Context Log Summary"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Total turns logged: $(wc -l < "$LOG_FILE")"
        echo ""
        echo "Latest turn:"
        tail -1 "$LOG_FILE" | jq -r '"  Timestamp: \(.timestamp)\n  Workspace: \(.workspace_hash)\n  Total tokens: \([.context_composition[] | .tokens] | add)"'
        echo ""
        echo "Context composition (latest turn):"
        tail -1 "$LOG_FILE" | jq -r '.context_composition | to_entries[] | "  \(.key): \(.value.tokens) tokens (\(.value.lines) lines)"'
        ;;
    
    latest)
        echo "📍 Latest Turn"
        tail -1 "$LOG_FILE" | jq '.'
        ;;
    
    history)
        COUNT="${2:-10}"
        echo "📜 Last $COUNT Turns"
        tail -"$COUNT" "$LOG_FILE" | jq -r '"[\(.timestamp)] \(.workspace_hash) - \([.context_composition[] | .tokens] | add) total tokens"'
        ;;
    
    tokens)
        echo "📈 Token Usage Over Time"
        jq -r '"[\(.timestamp)] \([.context_composition[] | .tokens] | add) tokens"' "$LOG_FILE"
        ;;
    
    file)
        FILE="${2:-MEMORY.md}"
        echo "📄 $FILE Token Usage Over Time"
        jq -r --arg file "$FILE" '"[\(.timestamp)] \(.context_composition[$file].tokens // 0) tokens"' "$LOG_FILE"
        ;;
    
    diff)
        TURN1="${2}"
        TURN2="${3:-latest}"
        echo "🔄 Context Diff Between Turns"
        echo "Not yet implemented - use git diff between workspace hashes"
        ;;
    
    *)
        echo "Usage: $0 {summary|latest|history|tokens|file <name>|diff <turn1> <turn2>}"
        echo ""
        echo "Commands:"
        echo "  summary       - Show overall statistics and latest turn"
        echo "  latest        - Show full JSON of latest turn"
        echo "  history [N]   - Show last N turns (default 10)"
        echo "  tokens        - Show total token usage over time"
        echo "  file <name>   - Show specific file's token usage over time"
        echo "  diff <t1> <t2> - Compare context between two turns"
        ;;
esac
