#!/bin/bash
# AOS Session Start - Initialize OpenTelemetry-based provenance tracking

SESSION_ID="${1:-session-$(date -u +"%Y-%m-%d-%H%M%S")}"

echo "🎯 Starting AOS tracking for session: $SESSION_ID"
echo ""

# Start turn with OpenTelemetry
node ~/aos-telemetry/cli.js start-turn "$SESSION_ID"

echo ""
echo "Session initialized with OpenTelemetry tracing."
echo ""
echo "Track tools during session:"
echo "  ~/aos-telemetry/track-tool.sh <tool> --duration <ms> --cost <amount> --model <model>"
echo ""
echo "End session:"
echo "  ~/aos-telemetry/end-session.sh"
echo ""
echo "Session ID: $SESSION_ID"
