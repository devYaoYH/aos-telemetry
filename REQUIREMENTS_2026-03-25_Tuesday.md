# Requirements Gathering — March 25, 2026 (Tuesday)

**Source:** GitHub issues (openclaw/openclaw repo)

## Official OpenClaw Issues (Directly Relevant to AOS)

### Issue #14377: First-class usage logging for cron/heartbeat
**Published:** February 12, 2026  
**URL:** https://github.com/openclaw/openclaw/issues/14377

**Problem:**
- No built-in append-only usage logging
- Can't quantify token/cost consumption for background automation
- session_status only shows current session, not historical trends

**Requested features:**
- Per-call model token tracking
- Automated job usage tracking (cron/heartbeat)
- Historical trend analysis

**AOS relevance:** ✅ **DIRECTLY SOLVES THIS**
- AOS captures per-tool-call token attribution
- Session-level tracking with historical data
- Cost tracking dashboard

---

### Issue #12299: No programmatic access to cumulative token usage
**Published:** February 9, 2026  
**URL:** https://github.com/openclaw/openclaw/issues/12299

**Problem:**
- No API/CLI to retrieve cumulative token usage per session
- inputTokens/outputTokens only track per-message, not session totals
- Users can't programmatically monitor costs

**AOS relevance:** ✅ **DIRECTLY SOLVES THIS**
- `/api/sessions/:id` endpoint provides cumulative session data
- Token attribution by tool, model, message
- Programmatic access to cost data

---

### Issue #1215 / Discussion #1239: Built-in token tracking & reporting
**Published:** January 19, 2026  
**URL:** https://github.com/openclaw/openclaw/issues/1215

**Problem:**
- No native way to track API consumption over time
- Users rely on external dashboards (which don't exist yet)
- Need built-in monitoring

**AOS relevance:** ✅ **THIS IS EXACTLY WHAT AOS IS**
- Real-time dashboard at localhost:3003
- Historical tracking across sessions
- Cost trends, tool usage patterns

---

### Issue #13615: Rate limiting and throttling for API calls
**Published:** February 10, 2026  
**URL:** https://github.com/openclaw/openclaw/issues/13615

**Problem:**
- No protection against runaway API costs from bugs
- Need per-provider rate limits
- Need cost guardrails

**AOS relevance:** 🔶 **PARTIAL SOLUTION**
- AOS tracks costs but doesn't enforce limits yet
- Could add: cost threshold alerts, rate limit monitoring
- Future feature: circuit breakers based on cost/error rate

---

## Competitive Landscape (GitHub Search)

**Existing projects:**
1. **knostic/openclaw-telemetry** — Captures tool calls, LLM usage, JSONL output
2. **henrikrexed/openclaw-observability-plugin** — Notes auto-instrumentation challenges
3. **GENWAY-AI/clawatch** — Real-time monitoring, cost tracking, alerts
4. **fkern4612-design/openclaw-telemetry** — Another telemetry implementation

**AOS differentiator:** OpenTelemetry-based (industry standard), context provenance tracking, multi-session analysis

---

## Key Insights

### Validated Pain Points (Real GitHub Issues)
1. ✅ **No historical token/cost tracking** (Issues #14377, #12299, #1215)
2. ✅ **No programmatic API for usage data** (Issue #12299)
3. ✅ **Background job cost visibility** (Issue #14377)
4. 🔶 **Cost protection / rate limiting** (Issue #13615 — partial solution)

### Implications for AOS Phase 3

**Current Phase 2 features SOLVE real documented problems:**
- Session detail views → Issue #12299 (programmatic access)
- Token attribution → Issue #14377 (per-call tracking)
- Cost tracking dashboard → Issue #1215 (built-in monitoring)

**Validation question:** Why haven't people installed it yet?
- **Hypothesis 1:** Discovery problem (people don't know AOS exists)
- **Hypothesis 2:** Installation friction (too complex)
- **Hypothesis 3:** Trust problem (who is devYaoYH/Ethan?)
- **Hypothesis 4:** Feature gap (what's missing that keeps them from trying?)

**Next requirements sprint:** Wednesday (blog/article scraping)

---

**Status:** Tuesday requirements complete — 4 validated pain points from official GitHub issues, 4 competing projects identified
