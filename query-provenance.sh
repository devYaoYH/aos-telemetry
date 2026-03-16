#!/bin/bash
# AOS Provenance Query - Link context → tools → costs

CONTEXT_LOG="$HOME/aos-telemetry/context-log.jsonl"
TOOL_LOG="$HOME/aos-telemetry/tool-calls.jsonl"

ACTION="${1:-help}"

case "$ACTION" in
    turn)
        TURN_ID="$2"
        if [[ -z "$TURN_ID" ]]; then
            echo "Usage: $0 turn <turn-id>"
            exit 1
        fi
        echo "🔍 Full Provenance for Turn: $TURN_ID"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "📊 Context Composition:"
        grep "\"turn_id\":\"$TURN_ID\"" "$CONTEXT_LOG" | jq -r '.context_composition | to_entries[] | "  \(.key): \(.value.tokens) tokens"'
        echo ""
        echo "🔧 Tool Calls:"
        grep "\"turn_id\":\"$TURN_ID\"" "$TOOL_LOG" | jq -r '"  \(.tool): \(.duration_ms)ms, $\(.cost), \(.status)"'
        echo ""
        echo "💰 Total Cost:"
        grep "\"turn_id\":\"$TURN_ID\"" "$TOOL_LOG" | jq -s '[.[].cost] | add'
        ;;
    
    expensive)
        THRESHOLD="${2:-0.05}"
        echo "💸 Expensive Turns (cost > \$$THRESHOLD)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        if [[ -f "$TOOL_LOG" ]]; then
            jq -r --arg thresh "$THRESHOLD" 'select(.cost > ($thresh | tonumber)) | "[\(.turn_id)] \(.tool): $\(.cost)"' "$TOOL_LOG"
        else
            echo "No tool calls logged yet"
        fi
        ;;
    
    tools-by-cost)
        echo "🔧 Tool Usage by Total Cost"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        if [[ -f "$TOOL_LOG" ]]; then
            jq -r '[.tool, .cost] | @tsv' "$TOOL_LOG" | awk '{cost[$1]+=$2; count[$1]++} END {for (t in cost) print t, count[t], cost[t]}' | sort -k3 -rn | awk '{printf "  %-15s %3d calls  $%.4f total\n", $1, $2, $3}'
        else
            echo "No tool calls logged yet"
        fi
        ;;
    
    context-correlation)
        FILE="${2:-MEMORY.md}"
        echo "📈 $FILE Size vs Tool Usage Correlation"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # For each turn, get MEMORY.md tokens and count tool calls
        while IFS= read -r turn_entry; do
            turn_id=$(echo "$turn_entry" | jq -r '.turn_id')
            tokens=$(echo "$turn_entry" | jq -r --arg file "$FILE" '.context_composition[$file].tokens // 0')
            tool_count=$(grep -c "\"turn_id\":\"$turn_id\"" "$TOOL_LOG" 2>/dev/null || echo 0)
            total_cost=$(grep "\"turn_id\":\"$turn_id\"" "$TOOL_LOG" 2>/dev/null | jq -s '[.[].cost] | add // 0')
            echo "  [$turn_id] $tokens tokens → $tool_count tools, \$$total_cost cost"
        done < "$CONTEXT_LOG"
        ;;
    
    timeline)
        echo "📅 Provenance Timeline"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        while IFS= read -r turn_entry; do
            turn_id=$(echo "$turn_entry" | jq -r '.turn_id')
            total_tokens=$(echo "$turn_entry" | jq '[.context_composition[] | .tokens] | add')
            tool_count=$(grep -c "\"turn_id\":\"$turn_id\"" "$TOOL_LOG" 2>/dev/null || echo 0)
            total_cost=$(grep "\"turn_id\":\"$turn_id\"" "$TOOL_LOG" 2>/dev/null | jq -s '[.[].cost] | add // 0')
            echo "[$turn_id]"
            echo "  Context: $total_tokens tokens"
            echo "  Tools: $tool_count calls, \$$total_cost cost"
            echo ""
        done < "$CONTEXT_LOG"
        ;;
    
    *)
        echo "AOS Provenance Query Tool"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Commands:"
        echo "  turn <turn-id>              - Full provenance for specific turn"
        echo "  expensive [threshold]       - Turns with high costs (default: \$0.05)"
        echo "  tools-by-cost              - Tool usage ranked by total cost"
        echo "  context-correlation [file]  - How file size correlates with tool usage"
        echo "  timeline                    - Chronological provenance view"
        echo ""
        echo "Example:"
        echo "  $0 turn turn-1-baseline"
        echo "  $0 expensive 0.10"
        echo "  $0 context-correlation MEMORY.md"
        ;;
esac
