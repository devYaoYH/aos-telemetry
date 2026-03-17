#!/bin/bash
# demo-capture.sh - Working demonstration of AOS auto-capture
# Shows how to integrate with OpenClaw sessions_history tool
#
# This script demonstrates the complete Phase 2.2 workflow:
# 1. Query sessions_history (would be via tool call in real agent)
# 2. Parse tool calls from history
# 3. Extract telemetry (tool names, costs, tokens, timing)
# 4. Store in tool-calls.jsonl

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEMO]${NC} $*"; }
info() { echo -e "${BLUE}[DEMO]${NC} $*"; }
warn() { echo -e "${YELLOW}[DEMO]${NC} $*"; }

echo ""
log "🎯 AOS Phase 2.2: Auto-Capture Demonstration"
echo ""

# Step 1: Simulate sessions_history query
info "Step 1: Query OpenClaw sessions_history"
echo "  (In real agent: sessions_history(sessionKey='main', limit=50))"
echo ""

# For demo, we'll use the test data from earlier
# In production, this would be replaced with actual tool call

DEMO_DATA=$(cat <<'EOF'
{
  "sessionKey": "main",
  "messages": [
    {
      "role": "assistant",
      "content": [
        {
          "type": "toolCall",
          "id": "toolu_demo1",
          "name": "read",
          "arguments": {"path": "MEMORY.md"}
        }
      ],
      "model": "claude-sonnet-4-5",
      "usage": {
        "input": 100,
        "output": 50,
        "totalTokens": 150,
        "cost": {"total": 0.005}
      },
      "timestamp": 1773775700000
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "toolCall",
          "id": "toolu_demo2",
          "name": "exec",
          "arguments": {"command": "git log -1"}
        }
      ],
      "model": "claude-sonnet-4-5",
      "usage": {
        "input": 120,
        "output": 80,
        "totalTokens": 200,
        "cost": {"total": 0.008}
      },
      "timestamp": 1773775710000
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "toolCall",
          "id": "toolu_demo3",
          "name": "web_search",
          "arguments": {"query": "OpenTelemetry agents"}
        }
      ],
      "model": "claude-sonnet-4-5",
      "usage": {
        "input": 150,
        "output": 120,
        "totalTokens": 270,
        "cost": {"total": 0.012}
      },
      "timestamp": 1773775720000
    }
  ]
}
EOF
)

log "✅ Received session history (3 tool calls)"
echo ""

# Step 2: Parse tool calls
info "Step 2: Extract tool call telemetry"
echo "$DEMO_DATA" | node ~/aos-telemetry/parse-session-history.js
echo ""

# Step 3: Show what was captured
log "Step 3: Verify captured data"
echo ""
echo "Last 3 tool calls in database:"
tail -3 ~/aos-telemetry/tool-calls.jsonl | jq -r '. | "\(.timestamp | split("T")[1] | split(".")[0]) UTC - \(.tool) - $\(.cost) (\(.tokens.total) tokens)"'
echo ""

log "🎉 Phase 2.2 Demo Complete!"
echo ""
info "This workflow automatically:"
echo "  ✓ Queries session history"
echo "  ✓ Extracts tool calls with timing"
echo "  ✓ Captures cost + token data"
echo "  ✓ Stores in queryable JSONL format"
echo ""
warn "Next steps for production:"
echo "  1. Integrate with OpenClaw's sessions_history tool"
echo "  2. Run periodically (heartbeat or cron)"
echo "  3. Query analytics via REST API endpoints"
echo "  4. Visualize in dashboard"
echo ""
