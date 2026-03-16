#!/bin/bash
# AOS Session End - Finalize provenance tracking

SESSION_ID="${1:-latest}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🏁 Ending AOS tracking session: $SESSION_ID"
echo ""

# Final context snapshot
~/aos-telemetry/hooks/pre-turn.sh

echo ""
echo "📊 Session Summary:"
~/aos-telemetry/query-context.sh summary

echo ""
echo "🔧 Tool Usage:"
if [[ -f ~/aos-telemetry/tool-calls.jsonl ]]; then
    ~/aos-telemetry/query-provenance.sh tools-by-cost
else
    echo "  No tool calls logged yet"
fi

echo ""
echo "Session complete: $TIMESTAMP"
