# AOS Phase 2: Auto-Logging Hooks

## Goal
Eliminate manual logging — auto-capture context + tools on every turn.

## Current State (Phase 1.5)
**Manual workflow:**
```bash
# Before significant work
~/aos-telemetry/log-turn.sh "task-description"

# After each tool call
~/aos-telemetry/log-tool-call.sh "task-id" exec 1234 0.01 success sonnet 5000 1500
```

**Problem:** Requires discipline, easy to forget, incomplete data.

## Target State (Phase 2)
**Automatic workflow:**
```bash
# Agent starts turn → auto-log context snapshot
# Agent calls tool → auto-log tool execution
# Agent completes turn → auto-log total cost
```

**Result:** Complete provenance without manual intervention.

## Architecture Options

### Option 1: OpenClaw Integration (Ideal but Complex)
Hook into OpenClaw's tool execution layer:
- Intercept all tool calls at framework level
- Auto-capture input/output tokens
- Link to session context
- **Pros:** Complete automation, accurate data
- **Cons:** Requires OpenClaw source modifications, framework coupling

### Option 2: Wrapper Scripts (Pragmatic)
Create wrapper scripts for common tools:
- `aos-exec` → wraps `exec`, logs automatically
- `aos-read` → wraps file reads
- `aos-web-search` → wraps web searches
- **Pros:** Easy to implement, no framework changes needed
- **Cons:** Requires using wrappers instead of direct tools, partial coverage

### Option 3: Post-Turn Analysis (Quick Win)
Analyze OpenClaw session logs after each turn:
- Parse tool calls from session history
- Extract token counts from API responses
- Reconstruct provenance from logs
- **Pros:** No code changes to workflow, complete data
- **Cons:** Post-hoc (not real-time), depends on log format

### Option 4: Hybrid Approach (Recommended)
Combine multiple strategies:
1. **Turn start:** Auto-commit workspace + log context (pre-turn hook)
2. **During turn:** Manual logging for critical decisions (opt-in)
3. **Turn end:** Parse session logs to capture tool calls (post-turn hook)

**Pros:** Best of all worlds — automatic + selective manual + complete coverage
**Cons:** More complex implementation

## Recommended Implementation (Hybrid)

### Step 1: Pre-Turn Hook
Create `~/.openclaw/hooks/pre-turn.sh`:
```bash
#!/bin/bash
cd /root/.openclaw/workspace
git add -u 2>/dev/null
git diff --cached --quiet || git commit -m "Auto-commit: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
~/aos-telemetry/log-turn.sh "auto-$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
```

**Trigger:** Run at session start or every N messages

### Step 2: Post-Turn Hook
Create `~/aos-telemetry/extract-from-logs.sh`:
```bash
#!/bin/bash
# Parse OpenClaw session logs to extract tool calls
# Look for patterns like:
#   <invoke name="exec">...
#   </invoke>
# Extract: tool name, parameters, duration, result
# Auto-populate tool-calls.jsonl
```

**Trigger:** Run after each turn or every 5 minutes

### Step 3: Token Capture
Modify tool logging to extract from OpenClaw's internal tracking:
- OpenClaw tracks token usage per request
- Parse from session metadata or API responses
- Link to turn via timestamp correlation

### Step 4: Manual Override
Keep manual logging for important annotations:
```bash
# When making a critical decision
~/aos-telemetry/log-turn.sh "deciding-to-refactor-X" --annotate "High-risk decision"
```

## Implementation Timeline

**Phase 2.1: Pre-Turn Hooks (2h)**
- Create git auto-commit hook
- Create turn auto-logger
- Test with heartbeat workflow

**Phase 2.2: Log Parser (4h)**
- Build OpenClaw log parser
- Extract tool calls from session history
- Auto-populate tool-calls.jsonl

**Phase 2.3: Token Extraction (3h)**
- Parse token counts from API responses
- Link to tool calls via timestamp
- Accurate cost attribution

**Phase 2.4: Integration Testing (2h)**
- End-to-end workflow test
- Verify complete provenance capture
- Fix gaps and edge cases

**Total: ~11 hours** (1-2 coding sessions)

## Success Criteria

**After Phase 2, I should be able to:**
1. Run normal workflow without thinking about logging
2. Query full provenance for any past turn
3. Get accurate cost/token data for all operations
4. Identify which context drove which decisions

**Zero manual logging required.**

## Next After Phase 2

**Phase 3: Analytics & Correlation**
- Statistical analysis of context → behavior patterns
- "Does larger MEMORY.md correlate with more tool calls?"
- "Which files drive the most expensive turns?"
- Regression models for cost prediction

**Phase 4: Dashboard Visualization**
- Real-time provenance view
- Interactive timeline
- Cost breakdown charts
- Context composition trends

## Quick Start (Minimal Viable Auto-Logging)

**Build in next 30 min:**
1. Pre-turn hook that auto-commits + logs context
2. Simple cron job to run every heartbeat
3. Test with one complete cycle

**This gets 80% of automation with 20% of effort.**
