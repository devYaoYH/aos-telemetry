#!/bin/bash
# AOS API Server Startup Script
# Ensures server runs in background with proper logging

set -e

API_DIR="$HOME/aos-telemetry"
LOG_FILE="/tmp/aos-api.log"
PID_FILE="/tmp/aos-api.pid"

cd "$API_DIR"

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "⚠️  API server already running (PID $OLD_PID)"
        exit 0
    else
        echo "🧹 Cleaning up stale PID file"
        rm "$PID_FILE"
    fi
fi

# Start server
echo "🚀 Starting AOS API server..."
nohup node api-server.js > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Save PID
echo "$SERVER_PID" > "$PID_FILE"

# Wait a moment and verify
sleep 2

if ps -p "$SERVER_PID" > /dev/null 2>&1; then
    echo "✅ Server started successfully (PID $SERVER_PID)"
    echo "📊 Dashboard: http://localhost:3003/dashboard"
    echo "📋 Logs: $LOG_FILE"
else
    echo "❌ Server failed to start. Check logs: $LOG_FILE"
    rm "$PID_FILE"
    exit 1
fi
