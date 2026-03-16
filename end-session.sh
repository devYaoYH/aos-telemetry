#!/bin/bash
# AOS Session End - Finalize OpenTelemetry-based provenance tracking

TOTAL_COST="$1"

echo "🏁 Ending AOS tracking session"
echo ""

# End turn with OpenTelemetry
if [ -n "$TOTAL_COST" ]; then
    node ~/aos-telemetry/cli.js end-turn --cost "$TOTAL_COST"
else
    node ~/aos-telemetry/cli.js end-turn
fi

echo ""
echo "📊 Session Summary:"
echo ""

# Query recent traces
node ~/aos-telemetry/cli.js query traces --limit 1

echo ""
echo "Query more traces: ~/aos-telemetry/query-traces.sh [limit]"
echo "Session complete: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
