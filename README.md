# AOS - Agent Observability System (v2.0)

**OpenTelemetry-based Context Window Provenance System**

## What's New in v2.0

**Complete rebuild with OpenTelemetry:**
- ✅ Industry-standard traces, spans, and metrics
- ✅ OTLP exporters for Jaeger, Tempo, Prometheus
- ✅ Structured telemetry with trace context
- ✅ Rich ecosystem tooling
- ✅ Proper span hierarchy and baggage propagation

**Replaced:** Custom JSONL logs → OpenTelemetry traces

## Architecture

```
Agent Turn (root span)
├── Context Composition (attributes)
│   ├── MEMORY.md: tokens, lines, git_hash
│   ├── SOUL.md: tokens, lines, git_hash
│   └── ... (all context files)
├── Tool Call 1 (child span)
│   ├── duration, cost, status
│   └── tokens (input/output)
└── Tool Call 2 (child span)
    └── ...
```

**Benefits:**
- **Standard format**: Works with Jaeger, Grafana, Tempo
- **Trace propagation**: Link related operations
- **Hierarchical spans**: Parent-child relationships
- **Rich attributes**: Git provenance, token counts, costs

## Installation

```bash
# Install dependencies
cd ~/aos-telemetry
npm install

# Initialize workspace git tracking
cd /root/.openclaw/workspace
git init
git add AGENTS.md HEARTBEAT.md MEMORY.md SOUL.md TOOLS.md USER.md memory/
git commit -m "AOS baseline"

# Configure (optional)
# Edit config.json to set agentName, exporterType, etc.
```

## Quick Start

### Session Workflow

```bash
# Start session
~/aos-telemetry/start-session.sh "my-work-session"

# Track tool calls during work
~/aos-telemetry/track-tool.sh exec --duration 1234 --cost 0.0123 --model sonnet

# End session
~/aos-telemetry/end-session.sh 0.05  # optional: total cost
```

### Manual CLI Usage

```bash
# Start turn
node ~/aos-telemetry/cli.js start-turn turn-1

# Track tools
node ~/aos-telemetry/cli.js track-tool exec --duration 1234 --cost 0.0123 --status success --model sonnet --tokens-in 5000 --tokens-out 1500

# End turn
node ~/aos-telemetry/cli.js end-turn --cost 0.05

# Query traces
node ~/aos-telemetry/cli.js query traces --limit 10
```

## Exporter Configuration

### File Export (Default)

Traces stored as JSONL in `~/aos-telemetry/traces/`

```json
{
  "exporterType": "file",
  "exportPath": "/root/aos-telemetry/traces"
}
```

### OTLP Export (Jaeger/Tempo)

Send traces to OpenTelemetry Collector:

```json
{
  "exporterType": "otlp",
  "otlpEndpoint": "http://localhost:4318/v1/traces"
}
```

**Run Jaeger locally:**
```bash
docker run -d --name jaeger \
  -p 4318:4318 \
  -p 16686:16686 \
  jaegertracing/all-in-one:latest

# View traces: http://localhost:16686
```

### Console Export (Debug)

Print traces to console:

```json
{
  "exporterType": "console"
}
```

## Programmatic Usage

```javascript
const { AOS } = require('./src/index');

const aos = new AOS({
  agentName: 'my-agent',
  exporterType: 'otlp',
  otlpEndpoint: 'http://localhost:4318/v1/traces'
});

// Start turn
const turnSpan = aos.startTurn('turn-1');

// Track tool
const toolSpan = aos.trackTool('web_search', {
  durationMs: 1500,
  cost: 0.023,
  status: 'success',
  model: 'sonnet',
  tokensInput: 3000,
  tokensOutput: 800
});

// End turn
aos.endTurn({ totalCost: 0.05 });

// Shutdown
await aos.shutdown();
```

## Context Tracking

**Automatically captured per turn:**
- Workspace git hash
- File-level token counts
- File-level line counts
- Git hash per file (provenance)
- Total context size

**Default context files:**
- MEMORY.md, SOUL.md, AGENTS.md, TOOLS.md, HEARTBEAT.md, USER.md, IDENTITY.md
- memory/YYYY-MM-DD.md (today's daily file)

**Custom context files:**
```bash
node ~/aos-telemetry/cli.js start-turn turn-1 MEMORY.md TOOLS.md custom.md
```

## Tool Tracking

**Attributes captured:**
- Tool name
- Duration (ms)
- Cost (USD)
- Status (success/error)
- Model used
- Tokens (input/output/total)

**Example:**
```bash
~/aos-telemetry/track-tool.sh exec \
  --duration 2345 \
  --cost 0.0456 \
  --status success \
  --model sonnet \
  --tokens-in 12000 \
  --tokens-out 3000
```

## Querying Traces

### File-based Queries

```bash
# View recent traces
~/aos-telemetry/query-traces.sh 10

# Raw JSONL files
ls ~/aos-telemetry/traces/
cat ~/aos-telemetry/traces/traces-2026-03-16T17-30-00.jsonl
```

### OTLP/Jaeger Queries

Use Jaeger UI: `http://localhost:16686`

- Search by service name: `aos-agent`
- Filter by operation: `agent.turn`, `tool.exec`, etc.
- View trace timeline with spans
- Analyze costs, durations, errors

## Integration Patterns

### Heartbeat Integration

```bash
# Add to HEARTBEAT.md
~/aos-telemetry/start-turn.sh "heartbeat-$(date +%s)"

# ... heartbeat work ...
~/aos-telemetry/track-tool.sh web_search --duration 1500 --cost 0.02

~/aos-telemetry/end-turn.sh 0.03
```

### Node.js Integration

```javascript
const { AOS } = require('~/aos-telemetry/src/index');
const aos = new AOS();

// Start turn
aos.startTurn('my-task');

// Track operations
aos.trackTool('exec', { durationMs: 1000, cost: 0.01 });

// End turn
aos.endTurn({ totalCost: 0.05 });

await aos.shutdown();
```

## Migration from v1.0

**v1.0 (bash/JSONL):**
```bash
~/aos-telemetry/log-turn.sh "turn-1"
~/aos-telemetry/log-tool-call.sh "turn-1" exec 1234 0.01
```

**v2.0 (OpenTelemetry):**
```bash
~/aos-telemetry/start-turn.sh "turn-1"
~/aos-telemetry/track-tool.sh exec --duration 1234 --cost 0.01
~/aos-telemetry/end-turn.sh 0.05
```

**Key differences:**
- Session-based workflow (start → track → end)
- Rich span attributes (not flat JSONL)
- Standard tooling (Jaeger, Grafana)
- No custom query scripts needed

## Files

- `src/tracer.js` - OpenTelemetry tracer setup
- `src/context-tracker.js` - Context composition instrumentation
- `src/index.js` - Main AOS class
- `cli.js` - Command-line interface
- `start-turn.sh`, `track-tool.sh`, `end-turn.sh` - Convenience wrappers
- `start-session.sh`, `end-session.sh` - Session workflow
- `config.json` - Configuration
- `package.json` - Dependencies

## Why OpenTelemetry?

**vs Custom JSONL:**
- ✅ Industry standard (not proprietary format)
- ✅ Rich ecosystem (Jaeger, Tempo, Grafana, Prometheus)
- ✅ Structured telemetry (not flat logs)
- ✅ Trace propagation (link related operations)
- ✅ Active development (not abandoned)

**vs Other Observability Tools:**
- Vendor-neutral (works with any backend)
- Language support (Node.js, Python, Go, etc.)
- Open source (Apache 2.0)

## Use Cases

- **Cost attribution**: "This $0.50 turn came from 3 web searches"
- **Context optimization**: "MEMORY.md grew 1000 tokens, cost increased $0.10"
- **Behavioral debugging**: "What was in context when I made decision X?"
- **Time-travel debugging**: Git provenance enables exact context reconstruction
- **Performance analysis**: Span timings show bottlenecks

## Roadmap

- ✅ v2.0: OpenTelemetry foundation
- 🔄 Metrics (Prometheus): Track token usage over time
- 🔄 Auto-instrumentation: Hook into OpenClaw tool execution
- 🔄 Dashboard: Custom Grafana dashboards
- 🔄 Correlation analysis: Statistical analysis of context → behavior

## Related Skills

- `activity-dashboard` - Lightweight activity tracking

## License

MIT

---

**From "what can I do?" to "here's exactly what I did and why."** 📊

Powered by OpenTelemetry.
