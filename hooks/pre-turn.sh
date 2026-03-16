#!/bin/bash
# AOS Pre-Turn Hook - Auto-commit workspace and log context

WORKSPACE="/root/.openclaw/workspace"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cd "$WORKSPACE" || exit 1

# Auto-commit any changes to tracked files
git add -u 2>/dev/null
if ! git diff --cached --quiet 2>/dev/null; then
    CHANGES=$(git diff --cached --stat)
    git commit -m "Auto-commit: $TIMESTAMP" -m "$CHANGES" >/dev/null 2>&1
    echo "📝 Workspace changes committed: $TIMESTAMP"
fi

# Log context composition for this turn
~/aos-telemetry/log-turn.sh "auto-$TIMESTAMP"

echo "✅ Pre-turn hook complete: context logged"
