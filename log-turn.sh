#!/bin/bash
# AOS Turn Logger - Capture context composition with git provenance

WORKSPACE="/root/.openclaw/workspace"
LOG_FILE="$HOME/aos-telemetry/context-log.jsonl"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TURN_ID="$1"  # Optional turn identifier

cd "$WORKSPACE" || exit 1

# Auto-commit any changes to tracked files before logging
git add -u 2>/dev/null
if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "Auto-commit before turn $TIMESTAMP" >/dev/null 2>&1
fi

# Get current git hash
GIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# Function to estimate tokens (rough: 4 chars = 1 token)
estimate_tokens() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local chars=$(wc -c < "$file" 2>/dev/null || echo 0)
        echo $((chars / 4))
    else
        echo 0
    fi
}

# Function to count lines
count_lines() {
    local file="$1"
    if [[ -f "$file" ]]; then
        wc -l < "$file" 2>/dev/null || echo 0
    else
        echo 0
    fi
}

# Build context composition JSON
cat > /tmp/aos-turn.json <<EOF
{
  "turn_id": "${TURN_ID:-$TIMESTAMP}",
  "timestamp": "$TIMESTAMP",
  "workspace_hash": "$GIT_HASH",
  "context_composition": {
    "MEMORY.md": {
      "git_hash": "$GIT_HASH",
      "tokens": $(estimate_tokens "MEMORY.md"),
      "lines": $(count_lines "MEMORY.md")
    },
    "SOUL.md": {
      "git_hash": "$GIT_HASH",
      "tokens": $(estimate_tokens "SOUL.md"),
      "lines": $(count_lines "SOUL.md")
    },
    "AGENTS.md": {
      "git_hash": "$GIT_HASH",
      "tokens": $(estimate_tokens "AGENTS.md"),
      "lines": $(count_lines "AGENTS.md")
    },
    "TOOLS.md": {
      "git_hash": "$GIT_HASH",
      "tokens": $(estimate_tokens "TOOLS.md"),
      "lines": $(count_lines "TOOLS.md")
    },
    "HEARTBEAT.md": {
      "git_hash": "$GIT_HASH",
      "tokens": $(estimate_tokens "HEARTBEAT.md"),
      "lines": $(count_lines "HEARTBEAT.md")
    },
    "USER.md": {
      "git_hash": "$GIT_HASH",
      "tokens": $(estimate_tokens "USER.md"),
      "lines": $(count_lines "USER.md")
    },
    "IDENTITY.md": {
      "git_hash": "$GIT_HASH",
      "tokens": $(estimate_tokens "IDENTITY.md"),
      "lines": $(count_lines "IDENTITY.md")
    },
    "memory/today": {
      "file": "memory/$(date -u +%Y-%m-%d).md",
      "git_hash": "$GIT_HASH",
      "tokens": $(estimate_tokens "memory/$(date -u +%Y-%m-%d).md"),
      "lines": $(count_lines "memory/$(date -u +%Y-%m-%d).md")
    }
  }
}
EOF

# Append to JSONL log (compact JSON on single line)
jq -c '.' /tmp/aos-turn.json >> "$LOG_FILE"
echo "✅ Turn logged: $TIMESTAMP (workspace@$GIT_HASH)"
rm /tmp/aos-turn.json
