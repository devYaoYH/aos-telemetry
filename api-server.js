#!/usr/bin/env node
/**
 * api-server.js - REST API for AOS telemetry data
 * Serves tool-calls.jsonl data via HTTP endpoints
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const sessionTracker = require('./session-tracker.js');

const PORT = process.env.PORT || 3003;
const TOOL_CALLS_FILE = path.join(__dirname, 'tool-calls.jsonl');

// Auto-sync OpenClaw sessions on startup
console.log('🔄 Running auto-sync to load latest OpenClaw session data...');
const autoSync = spawn('node', [path.join(__dirname, 'auto-sync.js')], { cwd: __dirname });
autoSync.on('close', (code) => {
    if (code === 0) {
        console.log('✅ Auto-sync complete - dashboard will show live data');
    } else {
        console.warn(`⚠️  Auto-sync exited with code ${code}`);
    }
});

// Read and parse tool calls
function loadToolCalls() {
    if (!fs.existsSync(TOOL_CALLS_FILE)) {
        return [];
    }
    
    const lines = fs.readFileSync(TOOL_CALLS_FILE, 'utf8')
        .split('\n')
        .filter(line => line.trim());
    
    return lines.map(line => {
        try {
            return JSON.parse(line);
        } catch (e) {
            return null;
        }
    }).filter(Boolean);
}

// API Endpoints
const routes = {
    '/api/tools': (req, res) => {
        const toolCalls = loadToolCalls();
        const stats = {};
        
        toolCalls.forEach(tc => {
            if (!stats[tc.tool]) {
                stats[tc.tool] = {
                    tool: tc.tool,
                    count: 0,
                    totalCost: 0,
                    totalTokens: 0,
                    avgCost: 0,
                    avgTokens: 0
                };
            }
            
            stats[tc.tool].count++;
            stats[tc.tool].totalCost += tc.cost || 0;
            stats[tc.tool].totalTokens += tc.tokens?.total || 0;
        });
        
        // Calculate averages
        Object.values(stats).forEach(s => {
            s.avgCost = s.totalCost / s.count;
            s.avgTokens = Math.round(s.totalTokens / s.count);
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(Object.values(stats)));
    },
    
    '/api/costs': (req, res) => {
        const toolCalls = loadToolCalls();
        const totalCost = toolCalls.reduce((sum, tc) => sum + (tc.cost || 0), 0);
        const totalTokens = toolCalls.reduce((sum, tc) => sum + (tc.tokens?.total || 0), 0);
        
        const byTool = {};
        toolCalls.forEach(tc => {
            if (!byTool[tc.tool]) {
                byTool[tc.tool] = { tool: tc.tool, cost: 0, tokens: 0, count: 0 };
            }
            byTool[tc.tool].cost += tc.cost || 0;
            byTool[tc.tool].tokens += tc.tokens?.total || 0;
            byTool[tc.tool].count++;
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            total: totalCost.toFixed(4),
            totalTokens,
            byTool: Object.values(byTool).sort((a, b) => b.cost - a.cost)
        }));
    },
    
    '/api/timeline': (req, res) => {
        const toolCalls = loadToolCalls()
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .slice(-50); // Last 50 calls
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(toolCalls));
    },
    
    '/api/summary': (req, res) => {
        const toolCalls = loadToolCalls();
        const totalCost = toolCalls.reduce((sum, tc) => sum + (tc.cost || 0), 0);
        const totalTokens = toolCalls.reduce((sum, tc) => sum + (tc.tokens?.total || 0), 0);
        
        const toolCount = new Set(toolCalls.map(tc => tc.tool)).size;
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            totalCalls: toolCalls.length,
            uniqueTools: toolCount,
            totalCost: parseFloat(totalCost.toFixed(4)),
            totalTokens,
            avgCostPerCall: parseFloat((totalCost / toolCalls.length).toFixed(4)),
            avgTokensPerCall: Math.round(toolCalls.length > 0 ? totalTokens / toolCalls.length : 0)
        }));
    },
    
    '/api/tool-detail': (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const toolName = parsedUrl.query.tool;
        
        if (!toolName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing tool parameter' }));
            return;
        }
        
        const toolCalls = loadToolCalls().filter(tc => tc.tool === toolName);
        
        // Analyze parameter patterns
        const paramPatterns = {};
        toolCalls.forEach(tc => {
            const key = JSON.stringify(tc.params).substring(0, 100);
            if (!paramPatterns[key]) {
                paramPatterns[key] = { count: 0, totalCost: 0, totalTokens: 0, example: tc };
            }
            paramPatterns[key].count++;
            paramPatterns[key].totalCost += tc.cost || 0;
            paramPatterns[key].totalTokens += tc.tokens?.total || 0;
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            tool: toolName,
            totalCalls: toolCalls.length,
            patterns: Object.values(paramPatterns),
            calls: toolCalls
        }));
    },
    
    '/api/insights': (req, res) => {
        const toolCalls = loadToolCalls();
        const insights = [];
        
        if (toolCalls.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ insights: [], message: 'No data yet - start logging tool calls!' }));
            return;
        }
        
        // Analyze by tool
        const byTool = {};
        toolCalls.forEach(tc => {
            if (!byTool[tc.tool]) {
                byTool[tc.tool] = { count: 0, cost: 0, tokens: 0 };
            }
            byTool[tc.tool].count++;
            byTool[tc.tool].cost += tc.cost || 0;
            byTool[tc.tool].tokens += tc.tokens?.total || 0;
        });
        
        const totalCost = toolCalls.reduce((sum, tc) => sum + (tc.cost || 0), 0);
        const toolStats = Object.entries(byTool).map(([tool, stats]) => ({
            tool,
            ...stats,
            avgCost: stats.cost / stats.count,
            costShare: (stats.cost / totalCost) * 100
        })).sort((a, b) => b.cost - a.cost);
        
        // Insight 1: Expensive tools
        const expensiveTools = toolStats.filter(t => t.avgCost > 0.05);
        if (expensiveTools.length > 0) {
            expensiveTools.forEach(t => {
                insights.push({
                    type: 'cost',
                    severity: t.avgCost > 0.1 ? 'high' : 'medium',
                    tool: t.tool,
                    message: `${t.tool} averages $${t.avgCost.toFixed(4)} per call (${t.count} calls, $${t.cost.toFixed(4)} total)`,
                    recommendation: `Consider batching ${t.tool} calls or caching results to reduce costs.`,
                    impact: `Potential savings: ~$${(t.cost * 0.5).toFixed(4)} if usage reduced by 50%`
                });
            });
        }
        
        // Insight 2: High-frequency tools
        const highFreqTools = toolStats.filter(t => t.count > 5 && t.costShare > 20);
        if (highFreqTools.length > 0) {
            highFreqTools.forEach(t => {
                insights.push({
                    type: 'usage',
                    severity: 'medium',
                    tool: t.tool,
                    message: `${t.tool} accounts for ${t.costShare.toFixed(1)}% of total cost (${t.count} calls)`,
                    recommendation: `This is your primary cost driver. Audit whether all ${t.count} calls are necessary.`,
                    impact: `Eliminating 25% of calls would save $${(t.cost * 0.25).toFixed(4)}`
                });
            });
        }
        
        // Insight 3: Token efficiency
        const avgTokensPerCall = toolCalls.reduce((sum, tc) => sum + (tc.tokens?.total || 0), 0) / toolCalls.length;
        if (avgTokensPerCall > 30000) {
            insights.push({
                type: 'tokens',
                severity: 'high',
                message: `Average ${Math.round(avgTokensPerCall).toLocaleString()} tokens per tool call`,
                recommendation: 'High context size. Review MEMORY.md and loaded files - are all context files necessary?',
                impact: 'Reducing context by 30% could cut costs by ~30%'
            });
        }
        
        // Insight 3a: Context limit warnings (based on GitHub #45794, #48252)
        // Typical model limits: 200K (Sonnet 4), 128K (older), 32K (fallback)
        const CONTEXT_LIMITS = {
            'claude-sonnet-4-5': 200000,
            'claude-sonnet-4': 200000,
            'claude-sonnet-3-5': 200000,
            'claude-opus-4': 200000,
            'claude-haiku': 200000,
            'default': 128000  // Conservative fallback
        };
        
        // Detect model from tool calls (use most common)
        const modelCounts = {};
        toolCalls.forEach(tc => {
            const model = tc.model || 'default';
            modelCounts[model] = (modelCounts[model] || 0) + 1;
        });
        const primaryModel = Object.keys(modelCounts).sort((a, b) => modelCounts[b] - modelCounts[a])[0] || 'default';
        const contextLimit = CONTEXT_LIMITS[primaryModel] || CONTEXT_LIMITS['default'];
        
        const contextUsagePercent = (avgTokensPerCall / contextLimit) * 100;
        
        if (contextUsagePercent >= 95) {
            insights.push({
                type: 'context-limit',
                severity: 'high',
                message: `Context usage at ${contextUsagePercent.toFixed(1)}% of ${contextLimit.toLocaleString()} token limit`,
                recommendation: 'CRITICAL: Approaching context limit. UI may break at 100%. Archive old memory files, reduce MEMORY.md size, or clear session state.',
                impact: 'Prevents UI breakage and context overflow errors. Reduces risk of lost work.'
            });
        } else if (contextUsagePercent >= 90) {
            insights.push({
                type: 'context-limit',
                severity: 'high',
                message: `Context usage at ${contextUsagePercent.toFixed(1)}% of ${contextLimit.toLocaleString()} token limit`,
                recommendation: 'WARNING: High context usage. Review MEMORY.md and daily logs. Consider archiving old entries.',
                impact: 'Prevents hitting 100% limit where UI breaks and tool calls fail.'
            });
        } else if (contextUsagePercent >= 80) {
            insights.push({
                type: 'context-limit',
                severity: 'medium',
                message: `Context usage at ${contextUsagePercent.toFixed(1)}% of ${contextLimit.toLocaleString()} token limit`,
                recommendation: 'Context growing. Plan cleanup: archive low-signal memory entries, compress long files.',
                impact: 'Proactive management prevents emergency cleanup at 95%+'
            });
        }
        
        // Insight 4: Read-heavy patterns
        const readCalls = byTool['read'] || { count: 0, cost: 0 };
        const writeCalls = byTool['write'] || { count: 0, cost: 0 };
        if (readCalls.count > writeCalls.count * 3) {
            insights.push({
                type: 'pattern',
                severity: 'low',
                message: `Read/write ratio: ${readCalls.count}:${writeCalls.count} (read-heavy)`,
                recommendation: 'Frequent re-reading of files suggests missing state. Consider caching or memory consolidation.',
                impact: 'Could reduce redundant reads by storing state between turns'
            });
        }
        
        // Insight 5: Overall health
        if (totalCost < 1.0 && toolCalls.length > 10) {
            insights.push({
                type: 'health',
                severity: 'good',
                message: `Cost efficiency looks good: $${totalCost.toFixed(4)} across ${toolCalls.length} calls`,
                recommendation: 'Current usage patterns are sustainable. Keep monitoring for trends.',
                impact: null
            });
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            insights,
            summary: {
                totalCalls: toolCalls.length,
                totalCost: parseFloat(totalCost.toFixed(4)),
                avgCostPerCall: parseFloat((totalCost / toolCalls.length).toFixed(4)),
                topCostDrivers: toolStats.slice(0, 3).map(t => ({
                    tool: t.tool,
                    cost: parseFloat(t.cost.toFixed(4)),
                    share: parseFloat(t.costShare.toFixed(1))
                }))
            }
        }));
    },
    
    '/api/context-health': (req, res) => {
        // Load context monitor state
        const contextStateFile = path.join(process.env.HOME, 'aos-telemetry', '.context-state.json');
        const { ContextMonitor } = require('./src/context-monitor');
        const monitor = new ContextMonitor();
        
        if (fs.existsSync(contextStateFile)) {
            try {
                const state = JSON.parse(fs.readFileSync(contextStateFile, 'utf8'));
                monitor.currentTurnTokens = state.currentTurnTokens || 0;
                monitor.lifetimeTokens = state.lifetimeTokens || 0;
                monitor.contextSources = state.contextSources || monitor.contextSources;
                monitor.sessionStartTime = state.sessionStartTime || Date.now();
                monitor.turnStartTime = state.turnStartTime || Date.now();
            } catch (e) {
                // Ignore parsing errors
            }
        }
        
        const health = monitor.getHealthStatus();
        
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
            status: 'ok',
            health: health.health,
            current: {
                tokens: health.current.tokens,
                percentage: parseFloat((health.current.percentage * 100).toFixed(2)),
                remaining: health.current.remaining,
                limit: health.current.limit
            },
            lifetime: {
                tokens: health.lifetime.tokens,
                turns: health.lifetime.turns
            },
            sources: health.sources,
            topSources: health.topSources.map(s => ({
                name: s.name,
                tokens: s.tokens,
                percentage: parseFloat(((s.tokens / health.current.tokens) * 100).toFixed(2))
            })),
            warnings: health.warnings.map(threshold => ({
                threshold: threshold,
                percentage: parseFloat((threshold * 100).toFixed(0)),
                crossed: true
            })),
            sessionDuration: health.sessionDuration,
            turnDuration: health.turnDuration
        }));
    },

    '/api/context-health': (req, res) => {
        try {
            const health = sessionTracker.getContextHealth();
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify(health));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    },
    
    '/api/sessions': (req, res) => {
        try {
            const sessions = sessionTracker.getAllSessions();
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify(sessions));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    },
    
    '/api/session-detail': (req, res) => {
        try {
            const parsedUrl = url.parse(req.url, true);
            const sessionId = parsedUrl.query.id;
            
            if (!sessionId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing session id parameter' }));
                return;
            }
            
            const sessions = sessionTracker.getAllSessions();
            const session = sessions.find(s => s.id === sessionId);
            
            if (!session) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Session not found' }));
                return;
            }
            
            const sessionPath = path.join(require('os').homedir(), '.openclaw/agents/main/sessions', session.file);
            const events = sessionTracker.parseSession(sessionPath);
            const breakdown = sessionTracker.getContextBreakdown(events);
            
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({
                ...session,
                breakdown,
                messageCount: events.filter(e => e.type === 'message').length,
                eventCount: events.length
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    },
};

// HTTP Server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // Serve dashboard HTML (unified version)
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
        const dashboardPath = path.join(__dirname, 'dashboard', 'unified.html');
        fs.readFile(dashboardPath, 'utf8', (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Dashboard not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }
    
    // Serve test page
    if (pathname === '/test' || pathname === '/test/') {
        const testPath = path.join(__dirname, 'dashboard', 'test.html');
        fs.readFile(testPath, 'utf8', (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Test page not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }
    
    // Route handling
    if (routes[pathname]) {
        routes[pathname](req, res);
    } else if (pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
        res.end(`
            <html>
                <head><title>AOS API Server</title></head>
                <body style="font-family: monospace; padding: 20px; background: #0a0a0a; color: #e0e0e0;">
                    <h1>AOS Telemetry API</h1>
                    <p>Available endpoints:</p>
                    <ul>
                        <li><a href="/api/summary" style="color: #667eea;">/api/summary</a> - Overall stats</li>
                        <li><a href="/api/tools" style="color: #667eea;">/api/tools</a> - Tool usage breakdown</li>
                        <li><a href="/api/costs" style="color: #667eea;">/api/costs</a> - Cost analysis</li>
                        <li><a href="/api/timeline" style="color: #667eea;">/api/timeline</a> - Recent tool calls</li>
                        <li><a href="/api/tool-detail?tool=exec" style="color: #667eea;">/api/tool-detail?tool=X</a> - Detailed analysis per tool</li>
                    </ul>
                    <p style="color: #888; margin-top: 40px;">
                        Dashboard: <a href="/dashboard" style="color: #667eea;">Open Dashboard</a>
                    </p>
                </body>
            </html>
        `);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 AOS API Server running at http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard/index.html`);
    console.log(`🔌 API endpoints:`);
    console.log(`   /api/summary  - Overall stats`);
    console.log(`   /api/tools    - Tool usage breakdown`);
    console.log(`   /api/costs    - Cost analysis`);
    console.log(`   /api/timeline - Recent tool calls`);
});
