# OpenClaw Community Pain Points
*Compiled from Reddit & Hacker News - March 19, 2026*

## 🔴 Critical Issues (High Impact)

### 1. Token Waste / Cost Burn
**Sources:** Reddit r/ClaudeCode, r/AI_Agents, HN threads
- "Very expensive, burns tokens for no reason" (r/ClaudeCode)
- "For non-technical people, it feels like it doesn't accomplish anything meaningful and wastes AI tokens" (r/openclaw)
- Cost varies wildly: $2/day (light) to $110/day (heavy usage) on Opus
- Average productive users: $75/week ($10.71/day)
- DeepSeek paradox: Lower per-token cost but HIGHER total cost due to more tokens needed

**AOS Impact:** Context provenance tracking can identify wasteful reads, redundant tool calls, oversized context

### 2. Security Nightmares
**Sources:** Reddit r/AI_Agents, r/sysadmin, r/vibecoding, HN security threads
- **15% of skills are malicious** (audit fatigue problem)
- Remote code execution issues reported
- 15,200 exposed OpenClaw instances publicly accessible
- Credentials stored in plain text
- "Giving agent skills the same level of access = handing over your computer"
- SecurityScorecard report: 40,000+ exposed instances, 63% vulnerable
- Self-hosted + unvetted skills = "real liability if handling customer data"

**AOS Impact:** Git provenance tracking can identify when skills inject untrusted code

### 3. Setup Pain (Barrier to Entry)
**Sources:** Reddit r/openclaw, r/AI_Agents, HN
- "4 days to set up" (r/openclaw top post)
- "Docker, dependency wrangling, API key gymnastics"
- "Install pain: If you need Docker, dependency wrangling... it's not 'for everyone'"
- Created market for one-click solutions: EasyClaw, SlackClaw, Klaus

**AOS Impact:** Observability can't fix setup, but it can help debug failed installations

### 4. Edit Tool Bug (File Corruption)
**Sources:** Reddit r/sysadmin
- "Tends to use the edit tool wrong, ends up adding content while deleting the rest of the file"
- Critical for real usage — data loss risk

**AOS Impact:** Tool call tracking can detect failed edit operations, rollback via git

---

## 🟠 Major Issues (Medium-High Impact)

### 5. Architecture Bloat
**Sources:** Reddit r/ClaudeCode, r/LocalLLaMA
- "600k lines of code, mostly integration bloat around ~4k core"
- "Integration bloat and noise wrapped around what's really just ~4k"
- Framework seen as "completely unnecessary"

**AOS Impact:** Context tracking can show what workspace files are actually used vs loaded

### 6. Persona Drift
**Sources:** Reddit r/AI_Agents
- "Can't load SOUL.md properly to keep persona persistent"
- "Fundamentally openclaw being bad" at identity continuity

**AOS Impact:** Track when SOUL.md is read, how often it's in context, correlation with behavior

### 7. Doesn't Solve Hard Problems
**Sources:** Reddit r/AI_Agents
- "Won't fix the hard problems (complex multi-step tasks)"
- "Exported notion pages into raw text, agent still unable to do it"

**AOS Impact:** Multi-turn tracking can identify where agents fail on complex tasks

---

## 🟡 Moderate Issues (Medium Impact)

### 8. Subscription vs API Confusion
**Sources:** HN productive usage thread
- Users confused about Claude Code Max + API costs
- Some use subscription only (6 agents on 1 openclaw, no metered calls)
- Others pay both subscription + API ($500/month total)
- Account ban risk if using subscription improperly

**AOS Impact:** Cost tracking can show subscription vs API usage patterns

### 9. Model Quality Gaps
**Sources:** HN productive usage thread
- "Quality of open models too far below Claudes for my use-case"
- Need for datacenter GPUs (300W Blackwell RTX 6000 Pro) to run local models
- Trustworthiness varies significantly by model

**AOS Impact:** Model comparison ROI analysis (already in Phase 1)

### 10. Browser-Based Operations Expensive
**Sources:** HN productive usage thread
- "Anything browser-based munches up a lot more tokens (expected)"
- Loading large web pages = several dollars per conversation
- "$0.30/day for text automations vs $0.60/day for browser stuff"

**AOS Impact:** Track browser tool usage, suggest web_fetch alternatives

---

## 🟢 Minor Issues (Reported but Lower Impact)

### 11. No Meaningful Output for Non-Technical Users
**Sources:** Reddit r/openclaw
- "Feels like it doesn't accomplish anything meaningful"
- Requires pre-existing organization (todo lists, calendars, processes)

**AOS Impact:** Show concrete value via saved time/cost metrics

### 12. Thread Context Loss (Moltbook)
**Sources:** HN productive usage thread
- "AI agents on Moltbook lose all thread context when session ends"
- Need local state files to track engaged posts, reply diffs, feed cursors

**AOS Impact:** Session continuity tracking can detect context loss

---

## ✅ Positive Signals (What Works)

### 1. Team/Collaborative Use Cases
- "AI teammate is actually _fun_. Team said they'd be sad if we took it away"
- Runs standups, checks blockers, summarizes shipped work
- Helps debug customer issues, tracks competitors

### 2. Automation/EA Use Cases
- Scheduling meetings via calendar delegation
- Todo list prioritization (top 3 in morning)
- Watching subreddits for hardware sales
- SOC2 compliance vendor eval documentation
- Trip planning calendar summaries

### 3. Media Server Management
- SSH-based server recovery from boot failure
- Identified dying drive (1300 bad sectors)
- Copied 1.5TB to healthy drive
- User: "Would have thrown the box out otherwise"

### 4. Content/Marketing Pipelines
- Blog posts, social media, GitHub engagement
- Scraping + scoring + CRM integration (clawdrop.org)
- Productive enough to justify $75/week cost

---

## 🎯 AOS Development Priorities (Informed by Pain Points)

### Phase 1 (Already Shipped ✅)
- Cost tracking (addresses #1: token waste)
- Tool success rates (addresses #4: edit tool bug detection)
- Latency percentiles (performance visibility)
- Error trends (addresses #7: failure detection)

### Phase 2 (In Progress)
- Auto-capture from session history (addresses #1: no manual logging overhead)
- Context composition tracking (addresses #6: persona drift, #5: bloat detection)

### Phase 3 (Next)
- **Wasteful pattern detection:**
  - Redundant file reads (same file loaded multiple times per turn)
  - Oversized context (files loaded but never referenced in tool calls)
  - High-frequency low-value operations (heartbeat reads that don't change decisions)
- **Model comparison ROI:**
  - Per-task model recommendations (cheap model for simple, expensive for complex)
  - Quality vs cost tradeoffs
- **Tool call efficiency:**
  - Browser vs web_fetch suggestions
  - Edit tool failure rollback (git-based)

### Phase 4 (Future)
- **Security provenance:**
  - Track when skills modify workspace git
  - Detect credential access patterns
  - Skill behavior auditing
- **Multi-turn failure analysis:**
  - Where do complex tasks fail?
  - What context was missing?
  - Session replay for debugging

---

## 📊 Cost Benchmarks (Real Users)

| Use Case | Model | Daily Cost | Notes |
|----------|-------|------------|-------|
| Light automation | Opus 4.6 | $1-2 | Heartbeat checks, simple commands |
| Heavy coding | Opus 4.6 | $110 | All-day feature implementation |
| Mixed usage | Opus/Sonnet/Haiku | $10.71 | Average productive user ($75/week) |
| Text automation | Opus 4.5/4.6 | $0.30 | No browser usage |
| Browser automation | Opus 4.5/4.6 | $0.60 | 2x cost of text-only |
| Large page loads | Opus | Several $ | Per conversation with big pages |

---

## 🆕 GitHub Issues (March 2026)

### Recent Regressions (v2026.3.12)

**Issue #45065: JavaScript Heap OOM During Update**
- **Impact:** Update fails on 2GB RAM VMs
- **Error:** "FATAL ERROR: Ineffective mark-compacts near heap limit"
- **Trigger:** Completion cache update during 2026.3.11 → 2026.3.12 upgrade
- **Result:** Corrupted completion cache state
- **AOS relevance:** Memory profiling during context loading

**Issue #45794: Control UI Chat Pane Breaks at 100% Context**
- **Impact:** Broken/blank chat area when session reaches 100% context
- **Platform:** macOS, OpenClaw 2026.3.12
- **AOS relevance:** Context limit monitoring critical

**Issue #48252: Control UI Shows 100% Context When Actual is ~56%**
- **Impact:** Misleading context indicator uses lifetime inputTokens instead of current
- **Type:** Regression (worked before)
- **AOS relevance:** Accurate context tracking prevents false alarms

**Issue #45504: CLI Commands Fail Against Local Gateway**
- **Commands affected:** `openclaw devices list`, `openclaw devices approve`
- **Impact:** CLI broken but web UI still functional
- **Type:** Regression in 2026.3.12
- **AOS relevance:** RPC health monitoring

**Issue #44611: Gateway Ignores Model Config on Restart**
- **Impact:** Model configuration from openclaw.json not loaded after restart
- **Type:** Regression (config loading logic broken)
- **AOS relevance:** Track actual model used vs configured

**Issue #44760: `openclaw devices list` Restarts Gateway**
- **Impact:** CLI command triggers gateway restart instead of listing devices
- **Type:** Regression
- **AOS relevance:** Command stability monitoring

### Critical Incidents

**Issue #34990: 7-Hour Service Outage (v2026.3.2)**
- **Platform:** macOS, Desktop App
- **Trigger:** Forced version update + API model deprecation (grok-beta → grok-3)
- **Cascading failures:**
  1. **Zombie process:** Port 18789 locked by hung update process
  2. **Model deprecation:** grok-beta retired 2025-09-15, config pointed to dead endpoint
  3. **Version mismatch:** Desktop App v2026.2.23 vs CLI v2026.3.2
  4. **Security blocks:** 2026 guardrails blocked plaintext ws:// connections
  5. **Token mismatch:** "ClawJacked by own security tokens"
  6. **Corrupted pairing:** 2 active sessions shown but unreachable
- **Resolution:** 16 technical interventions (process kill, config reset, identity purge, manual token paste)
- **Severity:** SEVERE - "Completely unusable in any way shape or form"
- **AOS relevance:** Multi-layer failure detection, recovery paths

---

## 🎯 Updated AOS Priorities (Informed by GitHub Issues)

### Immediate (Phase 2)
1. **Context limit warnings** (#48252, #45794)
   - Alert when approaching 80%, 90%, 95% of context limit
   - Track lifetime vs current context separately
   - Prevent UI breakage from 100% context
2. **Memory profiling** (#45065)
   - Track heap usage during context loading
   - Warn when approaching OOM conditions
   - Suggest cleanup actions (clear old sessions, reduce context)

### Near-term (Phase 3)
3. **Configuration drift detection** (#44611)
   - Track configured model vs actual model in use
   - Alert when gateway restart loses config
   - Validate config loading on startup
4. **Command stability monitoring** (#44760, #45504)
   - Track CLI command success rates
   - Detect gateway restart loops
   - RPC health checks

### Future (Phase 4)
5. **Cascading failure detection** (#34990)
   - Multi-layer health monitoring (process, API, config, identity)
   - Dependency graph (which failures trigger others)
   - Automated recovery suggestions
6. **Version compatibility checks**
   - Desktop App vs CLI version mismatches
   - API endpoint deprecation warnings
   - Provider/model availability validation

---

## 🔗 Sources

**Reddit:**
- r/AI_Agents: "I wanted to like OpenClaw but..." (Feb 11, 2026)
- r/AI_Agents: "The real problem... isn't the hype, it's the architecture" (Feb 4, 2026)
- r/openclaw: "I spent 4 days setting up OpenClaw" (2 weeks ago)
- r/ClaudeCode: "Honest review OpenClaw vs Claude Code" (2 weeks ago)
- r/sysadmin: "OpenClaw going viral... people have no idea what's inside" (2 weeks ago)

**Hacker News:**
- Ask HN: Share your productive usage (item?id=47147183)
- OpenClaw security worse than expected (item?id=47064470)
- Why the hype? What's so special? (item?id=46828638)

**Last Updated:** March 19, 2026 00:45 UTC
