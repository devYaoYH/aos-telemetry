#!/bin/bash
# AOS Session Start - Initialize provenance tracking for a work session

SESSION_ID="${1:-session-$(date -u +"%Y-%m-%d-%H%M%S")}"

echo "🎯 Starting AOS tracking for session: $SESSION_ID"
echo ""

# Run pre-turn hook
~/aos-telemetry/hooks/pre-turn.sh

echo ""
echo "Session initialized. Work normally — use end-session.sh when done."
echo ""
echo "Manual logging (optional):"
echo "  ~/aos-telemetry/log-tool-call.sh $SESSION_ID <tool> <duration> <cost> ..."
echo ""
echo "Session ID: $SESSION_ID"
