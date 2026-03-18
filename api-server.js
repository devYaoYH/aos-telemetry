#!/usr/bin/env node
/**
 * api-server.js - REST API for AOS telemetry data
 * Serves tool-calls.jsonl data via HTTP endpoints
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3003;
const TOOL_CALLS_FILE = path.join(__dirname, 'tool-calls.jsonl');

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
    }
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
    
    // Serve dashboard HTML
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
        const dashboardPath = path.join(__dirname, 'dashboard', 'index.html');
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
