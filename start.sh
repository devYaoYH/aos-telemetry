#!/bin/bash
# Simple startup script for AOS Telemetry Dashboard

cd "$(dirname "$0")"

# Kill any existing api-server processes
pkill -f "node.*api-server.js" 2>/dev/null

# Start in background
nohup node api-server.js > /tmp/aos-telemetry.log 2>&1 &

PID=$!
echo "✅ AOS Telemetry Dashboard started"
echo "📊 Dashboard: http://localhost:3003"
echo "📋 Process ID: $PID"
echo "📝 Logs: /tmp/aos-telemetry.log"
echo ""
echo "To stop: pkill -f 'node.*api-server.js'"
