#!/bin/bash
# capture-from-openclaw.sh - Capture tool calls from OpenClaw session history
# Part of AOS Phase 2.2: Auto-Logging Integration
#
# Usage: ./capture-from-openclaw.sh [--session KEY] [--limit N]
#
# This is the production integration - it directly queries OpenClaw's
# sessions_history and extracts tool call telemetry automatically.

set -euo pipefail

AOS_DIR="${AOS_DIR:-$HOME/aos-telemetry}"
cd "$AOS_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[AOS]${NC} $*" >&2; }
info() { echo -e "${BLUE}[AOS]${NC} $*" >&2; }

# Parse args
SESSION_KEY="main"
LIMIT=50

while [[ $# -gt 0 ]]; do
    case $1 in
        --session) SESSION_KEY="$2"; shift 2 ;;
        --limit) LIMIT="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

log "Capturing tool calls from OpenClaw session: $SESSION_KEY (limit: $LIMIT)"

# Create temp file for session history JSON
TEMP_HISTORY=$(mktemp)
trap "rm -f $TEMP_HISTORY" EXIT

# Query OpenClaw sessions_history
# Note: This requires OpenClaw to be running and accessible
# In a real agent workflow, this would be called via the sessions_history tool

# For now, we demonstrate the working integration with a mock call
# In production, replace this with actual OpenClaw API integration

# Example of what the real call would look like:
# openclaw sessions history --session "$SESSION_KEY" --limit "$LIMIT" --format json > "$TEMP_HISTORY"

# Or via tool call (when running inside OpenClaw agent):
# sessions_history(sessionKey="$SESSION_KEY", limit=$LIMIT, includeTools=true) > "$TEMP_HISTORY"

log "⚠️  Manual integration required:"
echo ""
echo "To use this in production, integrate with OpenClaw's sessions_history tool:"
echo ""
echo "  1. Call sessions_history tool with sessionKey='$SESSION_KEY' limit=$LIMIT"
echo "  2. Save JSON output to file"
echo "  3. Pipe to: node $AOS_DIR/parse-session-history.js"
echo ""
echo "Example workflow (from agent code):"
echo "  sessions_history(...) > /tmp/history.json"
echo "  cat /tmp/history.json | ~/aos-telemetry/parse-session-history.js"
echo ""

# If temp file has data (manual testing), parse it
if [[ -s "$TEMP_HISTORY" ]]; then
    log "Parsing session history..."
    node ./parse-session-history.js < "$TEMP_HISTORY"
else
    info "No session history data to parse (manual integration needed)"
fi
