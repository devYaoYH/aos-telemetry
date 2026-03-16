# AOS Workflow Guide

## Quick Start

**At the start of a work session:**
```bash
~/aos-telemetry/start-session.sh [session-id]
```

**Work normally** — all context changes are auto-tracked via git.

**At the end of a work session:**
```bash
~/aos-telemetry/end-session.sh [session-id]
```

## Manual Tool Logging (Optional)

During the session, optionally log important tool calls:
```bash
~/aos-telemetry/log-tool-call.sh <session-id> <tool> <duration-ms> <cost> [status] [model] [tokens_in] [tokens_out]
```

**Example:**
```bash
~/aos-telemetry/log-tool-call.sh coding-sprint exec 2345 0.0234 success sonnet 8000 2000
```

## Queries

**View session summary:**
```bash
~/aos-telemetry/query-context.sh summary
```

**View full provenance for a session:**
```bash
~/aos-telemetry/query-provenance.sh timeline
```

**Find expensive operations:**
```bash
~/aos-telemetry/query-provenance.sh expensive 0.10
```

**Analyze context-behavior correlation:**
```bash
~/aos-telemetry/query-provenance.sh context-correlation MEMORY.md
```

## Integration with Heartbeat

Add to HEARTBEAT.md:
```bash
# At start of heartbeat
~/aos-telemetry/hooks/pre-turn.sh

# ... normal heartbeat work ...

# Log significant operations
~/aos-telemetry/log-tool-call.sh "heartbeat-$(date +%s)" web_search 1500 0.02 success haiku 3000 800
```

## Automated Workflow (Future)

**Phase 2 will add:**
- Auto-logging on every session start
- Tool call interception (no manual logging)
- Post-turn analysis from OpenClaw logs
- Complete provenance without manual intervention

**For now:** Use start-session.sh + end-session.sh for 80% automation.

## Example Session

```bash
$ ~/aos-telemetry/start-session.sh "implement-feature-X"
🎯 Starting AOS tracking for session: implement-feature-X
📝 Workspace changes committed: 2026-03-16T17:14:16Z
✅ Turn logged: 2026-03-16T17:14:16Z
Session initialized.

# ... work on feature X ...

$ ~/aos-telemetry/log-tool-call.sh implement-feature-X exec 1234 0.0123 success sonnet 5000 1500
✅ Tool call logged: exec (1234ms, $0.0123, success)

# ... more work ...

$ ~/aos-telemetry/end-session.sh implement-feature-X
🏁 Ending AOS tracking session: implement-feature-X
📝 Workspace changes committed: 2026-03-16T17:20:45Z
✅ Turn logged: 2026-03-16T17:20:45Z

📊 Session Summary:
Total turns logged: 5
Latest turn:
  Timestamp: 2026-03-16T17:20:45Z
  Total tokens: 11,892

🔧 Tool Usage:
  exec    1 calls  $0.0123 total

Session complete: 2026-03-16T17:20:45Z
```

## Best Practices

1. **Session naming:** Use descriptive IDs: `feature-X`, `bug-fix-Y`, `research-Z`
2. **Commit often:** Git tracks changes — commit meaningful checkpoints
3. **Log critical tools:** Don't log every read, log expensive operations
4. **Review regularly:** Use `query-provenance.sh timeline` to review work patterns
5. **Correlate findings:** Use `context-correlation` to understand what drives behavior

## Files

- `context-log.jsonl` — Context snapshots (turn-level)
- `tool-calls.jsonl` — Tool executions (linked to turns)
- Workspace `.git/` — Full content history (time-travel capability)

## Next Steps

After Phase 2 (auto-logging), this workflow becomes:
```bash
# Just work — everything is tracked automatically
```

For now, bookend sessions with start/end scripts for best coverage.
