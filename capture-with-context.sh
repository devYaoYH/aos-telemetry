#!/bin/bash
# capture-with-context.sh - Capture session history WITH context snapshots
# This links tool calls to the actual context that influenced them

set -euo pipefail

SESSION_KEY="${1:-main}"
OUTPUT_DIR="${2:-/tmp/aos-context-capture}"

mkdir -p "$OUTPUT_DIR"

echo "🎯 Capturing session with context provenance..."
echo ""

# Step 1: Capture workspace state
echo "📸 Snapshot 1: Capturing workspace state..."
WORKSPACE_HASH=$(cd /root/.openclaw/workspace && git rev-parse HEAD 2>/dev/null || echo "no-git")
echo "Workspace git hash: $WORKSPACE_HASH"

# Snapshot key context files
for file in MEMORY.md SOUL.md AGENTS.md TOOLS.md HEARTBEAT.md; do
    if [ -f "/root/.openclaw/workspace/$file" ]; then
        cp "/root/.openclaw/workspace/$file" "$OUTPUT_DIR/${file%.md}-snapshot.md"
        wc -l "/root/.openclaw/workspace/$file" | awk '{print "  " $2 ": " $1 " lines"}'
    fi
done

# Step 2: Get session history (via OpenClaw sessions_history tool)
echo ""
echo "📊 Step 2: Querying session history..."
echo "(In production, use sessions_history tool call)"
echo ""

# Step 3: Link context to tool calls
echo "🔗 Step 3: Creating context-linked telemetry..."

cat > "$OUTPUT_DIR/context-manifest.json" << EOF
{
  "captureTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "workspaceHash": "$WORKSPACE_HASH",
  "contextFiles": {
    "MEMORY.md": {
      "path": "$OUTPUT_DIR/MEMORY-snapshot.md",
      "lines": $(wc -l < /root/.openclaw/workspace/MEMORY.md 2>/dev/null || echo 0),
      "hash": "$(sha256sum /root/.openclaw/workspace/MEMORY.md 2>/dev/null | awk '{print $1}' || echo 'none')"
    },
    "SOUL.md": {
      "path": "$OUTPUT_DIR/SOUL-snapshot.md",
      "lines": $(wc -l < /root/.openclaw/workspace/SOUL.md 2>/dev/null || echo 0),
      "hash": "$(sha256sum /root/.openclaw/workspace/SOUL.md 2>/dev/null | awk '{print $1}' || echo 'none')"
    }
  },
  "note": "Tool calls in this session were influenced by this exact context"
}
EOF

echo "✅ Context snapshot saved to $OUTPUT_DIR"
echo ""
echo "To view context that influenced tool calls:"
echo "  cat $OUTPUT_DIR/context-manifest.json"
echo "  cat $OUTPUT_DIR/MEMORY-snapshot.md"
echo ""
echo "Next: Run sessions_history and link to this context snapshot"
