# AOS - Agent Observability System

**Goal:** Context Window Provenance System - Track what goes into context, where it originated, and downstream effects.

## Architecture

**Reference-Based Provenance:** Instead of storing full content, we use git hashes + references.

Every turn captures:
- Which files are in context
- Git hash of each file (time-travel to exact content)
- Token estimates
- Line counts

## Components

### 1. Turn Logger (`log-turn.sh`)
Captures context composition per turn with git provenance.

**Usage:**
```bash
~/aos-telemetry/log-turn.sh [turn-id]
```

**Auto-commits workspace changes before logging** to ensure git hash accuracy.

### 2. Query Tool (`query-context.sh`)
Analyze context composition over time.

**Commands:**
```bash
~/aos-telemetry/query-context.sh summary          # Latest stats
~/aos-telemetry/query-context.sh latest           # Full JSON of latest turn
~/aos-telemetry/query-context.sh history [N]      # Last N turns
~/aos-telemetry/query-context.sh tokens           # Token usage over time
~/aos-telemetry/query-context.sh file MEMORY.md   # Specific file trends
```

### 3. Tool Call Logger (`log-tool-call.sh`)
Link tool executions to turns.

**Usage:**
```bash
~/aos-telemetry/log-tool-call.sh <turn-id> <tool> <duration-ms> <cost> [status] [model] [tokens_in] [tokens_out]
```

**Example:**
```bash
~/aos-telemetry/log-tool-call.sh turn-1 exec 1234 0.01 success sonnet 5000 1500
```

### 4. Provenance Query Tool (`query-provenance.sh`)
Full context → tools → costs analysis.

**Commands:**
```bash
~/aos-telemetry/query-provenance.sh turn <turn-id>        # Full provenance for specific turn
~/aos-telemetry/query-provenance.sh expensive [threshold] # High-cost turns
~/aos-telemetry/query-provenance.sh tools-by-cost        # Tool usage ranked by cost
~/aos-telemetry/query-provenance.sh context-correlation  # Context size vs tool usage
~/aos-telemetry/query-provenance.sh timeline             # Chronological view
```

### 3. Data Storage

**`context-log.jsonl`** - JSONL format, one turn per line.

Example entry:
```json
{
  "turn_id": "2026-03-16T17:10:06Z",
  "timestamp": "2026-03-16T17:10:06Z",
  "workspace_hash": "5be56b0230e92873d6f38bae780a303750124f53",
  "context_composition": {
    "MEMORY.md": {"git_hash": "5be56b0", "tokens": 3416, "lines": 268},
    "SOUL.md": {"git_hash": "5be56b0", "tokens": 418, "lines": 36},
    ...
  }
}
```

## Baseline (Turn 1)

**Total context:** 11,478 tokens
- MEMORY.md: 3,416 tokens (268 lines)
- TOOLS.md: 2,740 tokens (304 lines)
- AGENTS.md: 1,967 tokens (212 lines)
- HEARTBEAT.md: 1,483 tokens (118 lines)
- memory/today: 1,197 tokens (117 lines)
- SOUL.md: 418 tokens (36 lines)
- USER.md: 155 tokens (18 lines)
- IDENTITY.md: 102 tokens (11 lines)

## Workflow Integration

**Manual logging (for now):**
```bash
# At start/end of significant work
~/aos-telemetry/log-turn.sh "task-description"
```

**Future: Auto-logging**
- Pre-turn hook to auto-commit + log
- Post-turn hook to capture tool calls + output
- Link turn logs to tool telemetry

## Next Steps (Phase 1)

1. ✅ Turn-granularity context logging
2. ✅ Git-based provenance
3. ✅ Integrate with tool telemetry (link turns → tool calls → costs)
4. ✅ Provenance query tool (context → tools → costs)
5. 🔄 Auto-logging hooks
6. 🔄 Downstream effects tracking (which context led to which decisions)
7. 🔄 Correlation analysis: "Does larger MEMORY.md → more tool calls?"

## Design Principles

**Lightweight:** References not content (git hash >> full file)
**Time-travel:** Reconstruct exact context from any historical turn
**Correlation:** Track which file changes correlate with behavior changes
**Empirical:** Replace "I think" with "here's the data"
