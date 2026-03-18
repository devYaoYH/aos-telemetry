# AOS Telemetry - Quick Start Guide

## Real Integration Example (What We Just Built!)

This guide shows you exactly how to use AOS with real OpenClaw sessions.

### Step 1: Capture Your Session

Use OpenClaw's `sessions_history` tool to get your tool calls:

```javascript
// In your agent code or via tool call
const history = sessions_history({ sessionKey: 'main', limit: 50 });
```

Save the output to a file and parse it:

```bash
# Save session history
cat > /tmp/my-session.json << EOF
{
  "sessionKey": "main",
  "messages": [...]  # From sessions_history
}
EOF

# Parse tool calls
node ~/aos-telemetry/parse-session-history.js < /tmp/my-session.json
```

**Result**: Tool calls automatically extracted to `tool-calls.jsonl`

### Step 2: Start the API Server

```bash
cd ~/aos-telemetry
node api-server.js
```

Output:
```
🚀 AOS API Server running at http://localhost:3003
📊 Dashboard: http://localhost:3003/dashboard/index.html
```

### Step 3: View Your Dashboard

Open in browser: `http://localhost:3003/dashboard/index.html`

**You'll see:**
- Total calls, costs, tokens
- Tool usage breakdown
- Recent activity timeline
- Auto-refreshes every 30 seconds

### API Endpoints

- `GET /api/summary` - Overall stats
- `GET /api/tools` - Tool usage breakdown
- `GET /api/costs` - Cost analysis
- `GET /api/timeline` - Recent 50 tool calls

**Example Response** (`/api/summary`):
```json
{
  "totalCalls": 15,
  "uniqueTools": 5,
  "totalCost": 0.572,
  "totalTokens": 332944,
  "avgCostPerCall": 0.0381,
  "avgTokensPerCall": 22196
}
```

## Real Data Example (From Our Session)

**Actual captured data:**
- **Total Calls**: 15
- **Total Cost**: $0.572
- **Total Tokens**: 332,944
- **Tools Used**: read, write, exec, sessions_history, process

**Top 3 Most Expensive Tools:**
1. `read` - $0.407 (4 calls, avg 27,356 tokens)
2. `exec` - $0.070 (5 calls, avg 22,322 tokens)
3. `write` - $0.049 (3 calls, avg 17,760 tokens)

## Heartbeat Integration

Add to your `HEARTBEAT.md`:

```bash
# Capture session periodically (every 6 hours)
if [ $((HOURS_SINCE_LAST % 6)) -eq 0 ]; then
    # Use sessions_history tool to get data
    # Pipe to parser
    # Data auto-appends to tool-calls.jsonl
fi
```

## Production Deployment

```bash
# Run API server in background
nohup node ~/aos-telemetry/api-server.js > /tmp/aos-api.log 2>&1 &

# Or use systemd (recommended)
sudo systemctl start aos-telemetry
```

## Next Steps

1. **Automate Capture**: Add to your heartbeat or cron
2. **Cost Alerts**: Build alerts when costs spike
3. **Trend Analysis**: Track costs over time
4. **Context Correlation**: Link tool calls to context snapshots (Phase 3)

---

**Built with real session data on 2026-03-18** 🎯
