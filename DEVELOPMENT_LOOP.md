# AOS Development Loop

Product development framework per k0dl3 guidance (2026-03-24).

## Phase 1: Requirements Gathering

**Goal:** Systematically discover pain points and use cases

### Sources

**1. Moltbook (Direct interaction)**
- Agent conversations about observability
- Pain points mentioned in posts/comments
- Feature requests from community
- Success stories from other tools

**2. GitHub Issues (OpenClaw + related)**
- Context window issues (#48252, #45794, #45065)
- Memory problems
- Cost optimization requests
- Error handling gaps

**3. Blog Posts**
- AI agent cost optimization
- Observability best practices
- OpenClaw tutorials mentioning pain points
- Case studies

**4. X/Twitter**
- #OpenClaw hashtag
- Agent developers sharing problems
- Cost horror stories
- Feature wishlist threads

**5. Reddit**
- r/OpenClaw
- r/AI_Agents
- r/LocalLLaMA (cost discussions)

**6. Discord/Slack**
- OpenClaw community server
- Agent developer communities
- Feature discussions

### Collection Process

**Weekly requirements sprint:**
1. Monday: Moltbook search (2-3 high-engagement posts)
2. Tuesday: GitHub issues review (OpenClaw + competitors)
3. Wednesday: Blog/article scraping
4. Thursday: X/Twitter monitoring
5. Friday: Reddit/Discord check
6. Weekend: Consolidate findings

**Documentation:**
- `requirements/YYYY-MM-DD.md` - Weekly findings
- `requirements/PAIN_POINTS.md` - Ongoing list
- `requirements/USE_CASES.md` - Real user stories

---

## Phase 2: Feature Planning (80/20 Rule)

**Goal:** Identify high-leverage features that solve common pain points

### Prioritization Framework

**Impact Score (1-10):**
- How many users affected?
- Severity of pain point?
- Frequency of occurrence?

**Effort Score (1-10):**
- Implementation complexity?
- Testing requirements?
- Documentation needs?

**Leverage Score = Impact / Effort**
- High leverage: Score > 2.0 (prioritize)
- Medium leverage: Score 1.0-2.0 (consider)
- Low leverage: Score < 1.0 (defer)

### Current Pain Points (From Community)

**High Impact, High Frequency:**
1. **Token cost blindness** (Impact: 10, Effort: 2, Leverage: 5.0) ✅ SOLVED
   - Agents don't know what operations cost
   - Cited by Hazel_OC, multiple posts
   - AOS Phase 1-2 addresses this

2. **Context window crashes** (Impact: 9, Effort: 3, Leverage: 3.0) ✅ SOLVED
   - UI breaks at 100%, no warning
   - GitHub #48252, #45794, #45065
   - AOS context health monitoring addresses this

3. **Silent failures** (Impact: 8, Effort: 4, Leverage: 2.0) ✅ PARTIALLY SOLVED
   - Tool calls fail without visibility
   - "Capability decay is silent" (openclawkong)
   - AOS error tracking detects some, not all patterns

4. **Over-iteration detection** (Impact: 7, Effort: 5, Leverage: 1.4) ⚠️ PARTIAL
   - 73% worse than first draft (Hazel)
   - Agents iterate unnecessarily
   - AOS timeline shows patterns but no alerts

5. **Memory waste** (Impact: 7, Effort: 6, Leverage: 1.2) ❌ NOT SOLVED
   - 43% of memory never read (Hazel)
   - Write-only graveyard
   - AOS doesn't track memory file access yet

6. **Overnight changes** (Impact: 6, Effort: 7, Leverage: 0.86) ❌ NOT SOLVED
   - System state changes while agent sleeps
   - Hazel's "overnight changelog" concept
   - Would require system monitoring

### Feature Roadmap (Prioritized)

**Phase 3: High Leverage (Do Next)**
1. **Wasteful pattern detection** (Leverage: 2.5)
   - Detect repeated reads of same file
   - Flag over-iteration (same tool 5+ times)
   - Alert on redundant operations
   - **Why:** Common pain point, medium effort

2. **Cost optimization recommendations** (Leverage: 2.2)
   - "Your read tool is expensive, try batching"
   - Automated insights (already have foundation)
   - **Why:** High value, builds on existing

3. **Memory profiling** (Leverage: 1.8)
   - Track which memory files are read/never read
   - Identify write-only graveyard
   - **Why:** Hazel's audit finding, specific ask

**Phase 4: Medium Leverage (After Phase 3)**
4. **Workspace file attribution** (Leverage: 1.5)
   - Which files cost the most tokens?
   - SOUL.md vs MEMORY.md vs daily logs
   - **Why:** Useful but requires git integration

5. **Session comparison** (Leverage: 1.3)
   - Compare two sessions side-by-side
   - "Why did this session cost 2x more?"
   - **Why:** Diagnostic tool, medium effort

**Phase 5: Low Leverage (Later)**
6. **Overnight changelog** (Leverage: 0.86)
   - System state monitoring
   - Delta tracking between sessions
   - **Why:** Cool but high effort, niche use case

---

## Phase 3: User Validation

**Goal:** Validate features with users before building next thing

### For Each Feature

**1. Demo critical user journeys**
- Record screenshot/video walkthrough
- Show before/after workflow
- Highlight key benefits

**2. Define success metrics**
- **Awareness:** How many agents know about feature?
- **Adoption:** How many agents use it?
- **Value:** What pain point does it solve?
- **Impact:** Measurable improvement (cost reduction, time saved)?

**3. Get feedback**
- Post demo to moltbook
- Ask: "Does this solve your problem?"
- Iterate based on responses

### Example: Context Health Monitoring

**Demo:**
- Before: Agent hits 100% context, UI crashes
- After: Warnings at 80%/90%/95%, time to act
- Screenshot: Live dashboard showing warning

**Success metrics:**
- Awareness: 2 posts (m/general, m/agent-infra) = 500+ views
- Adoption: TBD (need to track installs)
- Value: Prevents UI crashes (GitHub #48252, #45794, #45065)
- Impact: TBD (need user testimonials)

**Feedback:**
- k0dl3: "Session detail issues fixed" ✅
- Community: Monitoring responses to posts

---

## Phase 4: Engineering Excellence

**Goal:** After features work, consolidate for maintainability

### Maintenance Tasks (Do After Phase 3)

**1. Code consolidation**
- Remove duplicate logic
- Refactor common patterns
- Reduce file count if possible

**2. Error handling**
- Add try/catch where missing
- Graceful degradation
- Better error messages

**3. Testing**
- Unit tests for core functions
- Integration tests for API endpoints
- Validate data quality

**4. Documentation**
- API endpoint documentation
- Installation guide improvements
- Troubleshooting guide

**5. Performance**
- Optimize auto-sync (currently processes all sessions)
- Cache frequently accessed data
- Reduce memory footprint

### Current Technical Debt

**Identified issues:**
1. ✅ API server stability (FIXED: systemd service)
2. ⚠️ Token aggregation bug (FIXED but needs verification)
3. ❌ No automated tests
4. ❌ Limited error handling in auto-sync
5. ❌ Dashboard doesn't cache data (recomputes every request)

**Priority fixes (after Phase 3):**
1. Add error handling to auto-sync
2. Cache dashboard data (expires every 5 min)
3. Write integration tests
4. Optimize session parsing

---

## Phase 5: Delightful Features

**Goal:** Polish and joy (the last 20%)

### Ideas

**1. Interactive cost breakdown**
- Hover over tool in dashboard → see example calls
- Click session → drill down to specific expensive operation
- Visual timeline of token usage

**2. Cost alerts**
- "You just spent $50 this week (2x normal)"
- Email/Discord notifications
- Budget tracking

**3. Comparison views**
- "This session cost 3x more than average - here's why"
- Best/worst sessions side-by-side

**4. Gamification**
- "Cost reduction streak: 7 days"
- "You saved $50 this week by batching reads"
- Leaderboard (if multiple installs)

**5. AI-powered insights**
- LLM analyzes tool call patterns
- Suggests optimizations
- "I noticed you read the same file 5 times - try caching"

### Selection Criteria

**Only build if:**
- Phase 3 features validated
- Technical debt addressed
- User requests it
- Adds genuine joy (not just complexity)

---

## Current Status (2026-03-24)

**Phase 1: Requirements Gathering**
- ✅ Initial sweep (Hazel audits, community posts)
- ❌ Need systematic weekly process
- ❌ No blog/X/Reddit monitoring yet

**Phase 2: Feature Planning**
- ✅ Phase 3 roadmap defined (3 high-leverage features)
- ✅ Prioritization framework established
- ⚠️ Need to validate leverage scores with users

**Phase 3: User Validation**
- ⚠️ Posts published (2) but no success metrics tracked
- ❌ No install count yet (goal: 1-2 from 6 leads)
- ❌ No user testimonials
- ❌ Need to demo Phase 3 features before building

**Phase 4: Engineering Excellence**
- ✅ API server stability fixed
- ⚠️ Some technical debt identified
- ❌ Most debt unaddressed (no tests, caching, etc.)

**Phase 5: Delightful Features**
- ❌ Too early (Phase 3 not validated)

---

## Next Actions

**Immediate (This Week):**
1. ✅ Document development loop (this file)
2. Track AOS install metrics (add to LEADS.md)
3. Define success criteria for Phase 3 features
4. Start weekly requirements gathering (Monday)

**Phase 3 Execution:**
1. Build wasteful pattern detection (highest leverage)
2. Demo with screenshots/video
3. Post to moltbook: "Does this solve over-iteration?"
4. Get 3-5 user responses before building next feature
5. Track: Did anyone install because of this feature?

**Engineering Excellence (After Phase 3):**
1. Add error handling to auto-sync
2. Cache dashboard data
3. Write integration tests
4. Document API endpoints

---

*Framework established: 2026-03-24*  
*Next review: After Phase 3 feature #1 ships*
