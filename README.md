# AOS Telemetry - Automated OpenClaw Observability

**Fully automated observability system for OpenClaw agents using OpenTelemetry.**

## Features

- ✅ **Zero manual logging** - Auto-extracts tool calls from OpenClaw session transcripts
- ✅ **OpenTelemetry standard** - Industry-standard traces, spans, and telemetry
- ✅ **Real-time dashboard** - Live metrics at http://localhost:3003
- ✅ **Cost tracking** - Automatic token and cost analysis per tool
- ✅ **Context monitoring** - 80%, 90%, 95% context limit warnings
- ✅ **Git provenance** - Workspace state and file hashes per turn

## Quick Start

```bash
# Start the dashboard (auto-syncs on startup)
node api-server.js

# Or use the startup script
./start.sh
```

Dashboard available at: **http://localhost:3003**

## How It Works

1. **auto-sync.js** - Runs on startup, reads `~/.openclaw/agents/main/sessions/*.jsonl`
2. **tool-calls.jsonl** - Extracted tool calls stored here
3. **api-server.js** - Serves REST API + dashboard UI on port 3003

### Data Automatically Captured

- Tool name, cost, tokens, latency
- Input/output payloads
- Workspace file hashes (git provenance)
- Context usage per turn
- Session metadata

## API Endpoints

- `GET /api/tools` - Tool usage statistics
- `GET /api/sessions` - Session-level metrics
- `GET /api/cost` - Cost breakdown by tool
- `GET /api/context-health` - Context limit warnings
- `GET /dashboard` - Interactive UI

## Architecture

```
OpenClaw Sessions (~/.openclaw/agents/main/sessions/*.jsonl)
    ↓
auto-sync.js (extracts tool calls)
    ↓
tool-calls.jsonl (telemetry data)
    ↓
api-server.js (REST API + dashboard)
    ↓
http://localhost:3003 (visualization)
```

## Files

- `api-server.js` - Main dashboard server
- `auto-sync.js` - Session parser and data extractor
- `cli.js` - CLI interface (optional)
- `src/` - Core modules (tracer, context-monitor, etc.)
- `dashboard/` - HTML UI files
- `tool-calls.jsonl` - Telemetry data (auto-generated)

## Configuration

Edit `package.json` or set environment variables:

- `PORT` - API server port (default: 3003)
- `SESSIONS_DIR` - OpenClaw sessions directory (default: `~/.openclaw/agents/main/sessions`)

## Background Operation

To run persistently:

```bash
# Using nohup
nohup node api-server.js > /tmp/aos.log 2>&1 &

# Or install as systemd service
sudo cp aos-telemetry.service /etc/systemd/system/
sudo systemctl enable aos-telemetry
sudo systemctl start aos-telemetry
```

---

**Repository:** https://github.com/devYaoYH/aos-telemetry  
**License:** MIT  
**Status:** Production-ready (Phase 2 complete)
