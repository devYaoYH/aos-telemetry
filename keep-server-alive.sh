#!/bin/bash
# Keep AOS API server running in the background

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="/tmp/aos-api.pid"
LOG_FILE="/tmp/aos-api.log"

# Check if server is running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Server already running (PID: $PID)"
        exit 0
    fi
fi

# Start server
cd "$SCRIPT_DIR"
nohup node api-server.js > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo $NEW_PID > "$PID_FILE"

# Wait and verify
sleep 2
if ps -p $NEW_PID > /dev/null 2>&1; then
    echo "✅ Server started successfully (PID: $NEW_PID)"
    echo "📊 Dashboard: http://localhost:3003/dashboard"
    echo "📝 Logs: $LOG_FILE"
else
    echo "❌ Server failed to start. Check logs: $LOG_FILE"
    exit 1
fi
