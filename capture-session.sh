#!/bin/bash
# capture-session.sh - Capture tool calls from current OpenClaw session
# Part of AOS Phase 2: Auto-Logging Hooks
#
# Usage: ./capture-session.sh [--limit N] [--dry-run]

set -euo pipefail

AOS_DIR="${AOS_DIR:-$HOME/aos-telemetry}"
cd "$AOS_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[AOS Capture]${NC} $*" >&2; }
warn() { echo -e "${YELLOW}[AOS Capture]${NC} $*" >&2; }

# Parse args
LIMIT=100
DRY_RUN=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --limit) LIMIT="$2"; shift 2 ;;
        --dry-run) DRY_RUN="--dry-run"; shift ;;
        *) warn "Unknown option: $1"; shift ;;
    esac
done

log "Fetching session history (limit: $LIMIT)..."

# Create temp file for session history
TEMP_HISTORY=$(mktemp)
trap "rm -f $TEMP_HISTORY" EXIT

# Use OpenClaw's sessions_history to get message history
# Format: JSON with messages array
# This is a placeholder - in real integration, would call sessions_history properly
# For now, create mock data structure

cat > "$TEMP_HISTORY" << 'EOF'
{
  "messages": []
}
EOF

# TODO: Replace above with actual sessions_history call when integrated
# Example: openclaw sessions history --session main --limit $LIMIT --format json > "$TEMP_HISTORY"

log "Extracting tool calls..."
node ./auto-capture-v2.js $DRY_RUN < "$TEMP_HISTORY"

log "Done!"
