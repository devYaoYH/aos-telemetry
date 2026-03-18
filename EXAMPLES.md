# AOS Telemetry - Real-World Examples

## Example 1: Heartbeat Cost Optimization

**Scenario**: Your heartbeat runs every 2 hours. After a week, you want to see if it's cost-efficient.

### Capture Data

```bash
# Add to HEARTBEAT.md
cd ~/aos-telemetry
node parse-session-history.js < <(echo '{"messages": [...]}')  # From sessions_history tool
```

### Query Insights API

```bash
curl http://localhost:3003/api/insights | jq .
```

**Output:**

```json
{
  "insights": [
    {
      "type": "cost",
      "severity": "high",
      "tool": "read",
      "message": "read averages $0.1018 per call (4 calls, $0.4071 total)",
      "recommendation": "Consider batching read calls or caching results to reduce costs.",
      "impact": "Potential savings: ~$0.2035 if usage reduced by 50%"
    },
    {
      "type": "usage",
      "severity": "medium",
      "tool": "read",
      "message": "read accounts for 71.2% of total cost (4 calls)",
      "recommendation": "This is your primary cost driver. Audit whether all 4 calls are necessary.",
      "impact": "Eliminating 25% of calls would save $0.1018"
    },
    {
      "type": "health",
      "severity": "good",
      "message": "Cost efficiency looks good: $0.5720 across 15 calls",
      "recommendation": "Current usage patterns are sustainable. Keep monitoring for trends.",
      "impact": null
    }
  ],
  "summary": {
    "totalCalls": 15,
    "totalCost": 0.572,
    "avgCostPerCall": 0.0381,
    "topCostDrivers": [
      { "tool": "read", "cost": 0.4071, "share": 71.2 },
      { "tool": "exec", "cost": 0.0699, "share": 12.2 },
      { "tool": "write", "cost": 0.0487, "share": 8.5 }
    ]
  }
}
```

### Action Taken

Based on insights: **`read` is 71% of cost**. Investigation showed:
- 2 calls were re-reading MEMORY.md unnecessarily
- 1 call could be replaced with cached state

**Result**: Reduced from 4 → 2 read calls, saving ~$0.20 per heartbeat.

---

## Example 2: Debugging Expensive Tool Calls

**Scenario**: Your daily bill spiked from $2 to $8. What happened?

### Query Timeline

```bash
curl http://localhost:3003/api/timeline | jq 'sort_by(-.cost) | .[0:5]'
```

**Output (Top 5 Most Expensive):**

```json
[
  {
    "timestamp": "2026-03-18T14:03:45.123Z",
    "tool": "read",
    "toolCallId": "toolu_xyz",
    "params": { "path": "MEMORY.md" },
    "cost": 0.1798,
    "tokens": { "input": 10, "output": 864, "total": 52178 },
    "model": "claude-sonnet-4-5"
  },
  {
    "timestamp": "2026-03-18T14:05:12.456Z",
    "tool": "read",
    "toolCallId": "toolu_abc",
    "params": { "path": "memory/2026-03-18.md" },
    "cost": 0.1273,
    "tokens": { "input": 12, "output": 750, "total": 49320 },
    "model": "claude-sonnet-4-5"
  }
]
```

### Root Cause

**Finding**: Each `read` call had >50K total tokens. Context window is being passed on every tool call.

**Insight from dashboard**:
> ⚠️ **Average 22,196 tokens per tool call**  
> High context size. Review MEMORY.md and loaded files - are all context files necessary?

### Solution

1. Review MEMORY.md (was 30KB, reduced to 15KB by archiving old learnings)
2. Stop loading all daily files automatically (load only today/yesterday)
3. Result: Avg tokens dropped from 22K → 12K, costs cut in half

---

## Example 3: Tool Usage Patterns

**Scenario**: You suspect you're calling `exec` too often. Verify with data.

### Query Tool Breakdown

```bash
curl http://localhost:3003/api/tools | jq '.[] | select(.tool == "exec")'
```

**Output:**

```json
{
  "tool": "exec",
  "count": 47,
  "totalCost": 0.6571,
  "totalTokens": 1048932,
  "avgCost": 0.0140,
  "avgTokens": 22318
}
```

### Drill Down

```bash
curl 'http://localhost:3003/api/tool-detail?tool=exec' | jq '.patterns'
```

**Patterns Detected:**

```json
[
  {
    "count": 12,
    "totalCost": 0.1680,
    "totalTokens": 267840,
    "example": {
      "params": { "command": "git status" },
      "cost": 0.014
    }
  },
  {
    "count": 8,
    "totalCost": 0.1120,
    "totalTokens": 178544,
    "example": {
      "params": { "command": "cd ~/moltbook-tracker && python3 tracker.py sync" },
      "cost": 0.014
    }
  }
]
```

### Action

- **12 `git status` calls**: Unnecessary. Can check once per session.
- **8 moltbook syncs**: Reasonable (every 6 hours over 2 days).

**Result**: Eliminated redundant `git status` calls, saved $0.168.

---

## Example 4: Dashboard Alerts

**Scenario**: Set up cost alerts for your team.

### Monitor Insights Endpoint

```bash
#!/bin/bash
# check-aos-costs.sh

INSIGHTS=$(curl -s http://localhost:3003/api/insights)
HIGH_SEVERITY=$(echo "$INSIGHTS" | jq '.insights[] | select(.severity == "high")')

if [ -n "$HIGH_SEVERITY" ]; then
  echo "🚨 HIGH SEVERITY COST ALERT"
  echo "$HIGH_SEVERITY" | jq -r '.message'
  
  # Send to Discord/Slack/email
  # ...
fi
```

### Cron Integration

```bash
# Check every hour
0 * * * * /root/aos-telemetry/check-aos-costs.sh
```

---

## Example 5: Comparing Models

**Scenario**: You switched from Haiku to Sonnet. Was it worth it?

### Before Switching (Haiku)

```bash
curl http://localhost:3003/api/summary
```

```json
{
  "totalCalls": 120,
  "totalCost": 1.44,
  "avgCostPerCall": 0.012
}
```

### After Switching (Sonnet)

```json
{
  "totalCalls": 120,
  "totalCost": 4.56,
  "avgCostPerCall": 0.038
}
```

### Analysis

- **Cost increase**: 3.17x ($1.44 → $4.56)
- **Quality improvement**: Subjective, but fewer tool call retries (120 calls vs previous 145 calls for same work)
- **Net**: More expensive per call, but fewer calls needed

**Decision**: Worth it for complex tasks, not for simple heartbeats.

---

## Example 6: Session Cost Tracking

**Scenario**: Track cost for a specific project session.

### Workflow

```bash
# 1. Capture session before project work
node ~/aos-telemetry/parse-session-history.js < session-before.json

# 2. Do your work (write code, debug, etc.)

# 3. Capture session after
node ~/aos-telemetry/parse-session-history.js < session-after.json

# 4. Query delta
curl http://localhost:3003/api/timeline | jq '[.[] | select(.timestamp > "2026-03-18T14:00:00Z")] | map(.cost) | add'
```

**Result**: `0.87` — This feature cost $0.87 in agent token usage.

---

## Example 7: Automated Reporting

**Scenario**: Weekly cost report for your team.

### Script

```bash
#!/bin/bash
# weekly-report.sh

SUMMARY=$(curl -s http://localhost:3003/api/summary)
INSIGHTS=$(curl -s http://localhost:3003/api/insights)

cat << EOF
# AOS Weekly Report - $(date +%Y-%m-%d)

## Summary
- Total Calls: $(echo "$SUMMARY" | jq .totalCalls)
- Total Cost: \$$(echo "$SUMMARY" | jq .totalCost)
- Avg Cost/Call: \$$(echo "$SUMMARY" | jq .avgCostPerCall)

## Top Cost Drivers
$(echo "$SUMMARY" | jq -r '.topCostDrivers[] | "- \(.tool): $\(.cost) (\(.share)%)"')

## Insights
$(echo "$INSIGHTS" | jq -r '.insights[] | "### \(.severity | ascii_upcase)\n\(.message)\n💡 \(.recommendation)\n"')

EOF
```

### Output

```markdown
# AOS Weekly Report - 2026-03-18

## Summary
- Total Calls: 342
- Total Cost: $13.24
- Avg Cost/Call: $0.0387

## Top Cost Drivers
- read: $9.41 (71.1%)
- exec: $2.16 (16.3%)
- write: $1.03 (7.8%)

## Insights
### HIGH
read averages $0.1018 per call (92 calls, $9.37 total)
💡 Consider batching read calls or caching results to reduce costs.
```

---

## Tips for Production Use

1. **Archive old data**: `tool-calls.jsonl` grows unbounded. Rotate monthly.
2. **Filter by model**: Track Haiku vs Sonnet usage separately.
3. **Correlate with outcomes**: Did expensive calls lead to better results?
4. **Set budgets**: Alert when daily cost exceeds threshold.
5. **Review weekly**: Look for trends, not just totals.

---

**These examples use real data from AOS development on 2026-03-18** 🎯
