# AOS Integration Plan: Context → Tools → Costs

## Current State

**Two separate systems:**
1. **Context logging** (~/aos-telemetry/) - Tracks what's in context per turn
2. **Tool telemetry** (Phase 0) - Tracks tool calls, latency, costs

**Gap:** No link between context composition and tool execution.

## Goal: Full Provenance Chain

```
Context Snapshot (turn N)
  ├─> Tool Call 1 (exec, 1234ms, $0.01)
  ├─> Tool Call 2 (web_search, 567ms, $0.03)
  └─> Output (450 tokens, $0.02)
      └─> Total turn cost: $0.06
```

## Integration Architecture

### Schema Extension

**Turn log entry (enhanced):**
```json
{
  "turn_id": "2026-03-16T17:10:06Z",
  "workspace_hash": "5be56b0",
  "context_composition": {...},
  "tool_calls": [
    {
      "tool": "exec",
      "duration_ms": 1234,
      "success": true,
      "tokens_input": 5000,
      "tokens_output": 1500,
      "cost": 0.0375,
      "model": "sonnet"
    }
  ],
  "output_tokens": 450,
  "total_cost": 0.06,
  "message_id": "838e5fc6-0145-43f1-8b7c-5e8860c7670c"
}
```

### Implementation Steps

**Phase 1.5: Manual Linking**
1. After each turn, manually log tool calls
2. Script: `~/aos-telemetry/log-tool-call.sh <turn-id> <tool> <duration> <cost>`
3. Appends to turn entry in JSONL

**Phase 2: Auto-Capture**
1. Hook into OpenClaw tool execution layer
2. Auto-capture all tool calls per turn
3. Link via message_id (from Discord/session context)

**Phase 3: Downstream Analysis**
1. Query: "Which context files drove web_search calls?"
2. Correlation: "Does larger MEMORY.md → more tool calls?"
3. Attribution: "What % of cost came from TOOLS.md being in context?"

## Quick Win: Manual Turn Logging Template

Create turn log template for manual use:

```bash
#!/bin/bash
# Manual turn log with tools
TURN_ID="$1"
~/aos-telemetry/log-turn.sh "$TURN_ID"

# After turn completes, add tool calls:
# ~/aos-telemetry/log-tool-call.sh "$TURN_ID" exec 1234 0.01 success
# ~/aos-telemetry/log-tool-call.sh "$TURN_ID" web_search 567 0.03 success
```

## Timeline

- ✅ **Phase 1:** Context logging (DONE)
- 🔄 **Phase 1.5:** Manual tool linking (2h)
- 🔲 **Phase 2:** Auto-capture hooks (4h)
- 🔲 **Phase 3:** Downstream analysis queries (6h)

## Success Metrics

**Can answer:**
- "What was in my context when I made expensive tool call X?"
- "How does MEMORY.md size correlate with turn cost?"
- "Which context files drive the most tool usage?"
- "What's my cost per token of context?"

## Next Immediate Action

Build `log-tool-call.sh` to manually append tool data to turn logs.
