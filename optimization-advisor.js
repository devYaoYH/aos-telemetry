#!/usr/bin/env node
/**
 * optimization-advisor.js - Suggest cost optimization opportunities
 * Analyzes telemetry patterns and recommends specific optimizations
 */

const fs = require('fs');
const path = require('path');

const TOOL_CALLS_FILE = path.join(__dirname, 'tool-calls.jsonl');

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

function analyzeOptimizationOpportunities() {
    const toolCalls = loadToolCalls();
    
    if (toolCalls.length === 0) {
        return { suggestions: [], summary: 'No telemetry data available' };
    }
    
    // Get recent data (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recentCalls = toolCalls.filter(tc => {
        const timestamp = new Date(tc.timestamp).getTime();
        return timestamp > sevenDaysAgo;
    });
    
    const suggestions = [];
    
    // Analyze by tool
    const toolStats = {};
    recentCalls.forEach(tc => {
        if (!toolStats[tc.tool]) {
            toolStats[tc.tool] = {
                count: 0,
                totalCost: 0,
                totalTokens: 0,
                errors: 0,
                samples: []
            };
        }
        
        toolStats[tc.tool].count++;
        toolStats[tc.tool].totalCost += tc.cost || 0;
        toolStats[tc.tool].totalTokens += tc.tokens?.total || 0;
        if (tc.status === 'error') toolStats[tc.tool].errors++;
        
        // Keep sample of high-cost calls
        if ((tc.cost || 0) > 0.1 && toolStats[tc.tool].samples.length < 3) {
            toolStats[tc.tool].samples.push({
                cost: tc.cost,
                tokens: tc.tokens?.total,
                params: tc.params
            });
        }
    });
    
    // Sort tools by cost
    const toolsByCost = Object.entries(toolStats)
        .map(([tool, stats]) => ({ tool, ...stats }))
        .sort((a, b) => b.totalCost - a.totalCost);
    
    // Suggestion 1: High-cost exec commands
    const execStats = toolStats['exec'];
    if (execStats && execStats.totalCost > 50) {
        const avgTokens = Math.round(execStats.totalTokens / execStats.count);
        suggestions.push({
            priority: 'high',
            tool: 'exec',
            issue: 'High exec command costs',
            impact: `$${execStats.totalCost.toFixed(2)} (${execStats.count} calls)`,
            recommendation: avgTokens > 100000 
                ? 'Exec commands generating large outputs. Consider: (1) Use head/tail to limit output, (2) Filter with grep/awk, (3) Write to files instead of capturing stdout'
                : 'High exec usage. Consider: (1) Cache repeated commands, (2) Batch operations, (3) Use background processes for long-running tasks',
            examples: execStats.samples.slice(0, 2)
        });
    }
    
    // Suggestion 2: Repeated reads
    const readStats = toolStats['read'];
    if (readStats && readStats.totalCost > 30) {
        suggestions.push({
            priority: 'medium',
            tool: 'read',
            issue: 'High read costs',
            impact: `$${readStats.totalCost.toFixed(2)} (${readStats.count} calls)`,
            recommendation: 'Reading same files multiple times? Consider: (1) Cache file contents in session, (2) Use offset/limit for large files, (3) Combine related reads',
            examples: []
        });
    }
    
    // Suggestion 3: Edit operations
    const editStats = toolStats['edit'];
    if (editStats && editStats.count > 100) {
        const avgCost = editStats.totalCost / editStats.count;
        suggestions.push({
            priority: 'medium',
            tool: 'edit',
            issue: 'High edit frequency',
            impact: `$${editStats.totalCost.toFixed(2)} (${editStats.count} calls, avg $${avgCost.toFixed(3)}/edit)`,
            recommendation: 'Many small edits detected. Consider: (1) Batch edits together, (2) Use write for full rewrites, (3) Plan changes before editing',
            examples: []
        });
    }
    
    // Suggestion 4: Web search optimization
    const searchStats = toolStats['web_search'];
    if (searchStats && searchStats.count > 50) {
        suggestions.push({
            priority: 'low',
            tool: 'web_search',
            issue: 'High search volume',
            impact: `$${searchStats.totalCost.toFixed(2)} (${searchStats.count} searches)`,
            recommendation: 'Consider: (1) Cache search results for common queries, (2) Reduce search count parameter, (3) Use web_fetch for known URLs instead of searching',
            examples: []
        });
    }
    
    // Suggestion 5: Tool diversity
    const toolCount = Object.keys(toolStats).length;
    const totalCost = recentCalls.reduce((sum, tc) => sum + (tc.cost || 0), 0);
    const top3Cost = toolsByCost.slice(0, 3).reduce((sum, t) => sum + t.totalCost, 0);
    const top3Percentage = (top3Cost / totalCost) * 100;
    
    if (top3Percentage > 80) {
        suggestions.push({
            priority: 'info',
            tool: 'general',
            issue: `Top 3 tools account for ${top3Percentage.toFixed(1)}% of costs`,
            impact: `$${top3Cost.toFixed(2)} of $${totalCost.toFixed(2)}`,
            recommendation: `Focus optimization efforts on: ${toolsByCost.slice(0, 3).map(t => t.tool).join(', ')}`,
            examples: []
        });
    }
    
    // Calculate potential savings
    let potentialSavings = 0;
    if (execStats && execStats.totalCost > 50) {
        potentialSavings += execStats.totalCost * 0.3; // 30% savings possible
    }
    if (readStats && readStats.totalCost > 30) {
        potentialSavings += readStats.totalCost * 0.2; // 20% savings
    }
    if (editStats && editStats.count > 100) {
        potentialSavings += editStats.totalCost * 0.15; // 15% savings
    }
    
    return {
        suggestions: suggestions.sort((a, b) => {
            const priority = { high: 0, medium: 1, low: 2, info: 3 };
            return priority[a.priority] - priority[b.priority];
        }),
        summary: {
            totalCost: totalCost.toFixed(2),
            daysAnalyzed: 7,
            potentialSavings: potentialSavings.toFixed(2),
            savingsPercentage: ((potentialSavings / totalCost) * 100).toFixed(1),
            topTools: toolsByCost.slice(0, 5).map(t => ({
                tool: t.tool,
                cost: parseFloat(t.totalCost.toFixed(2)),
                percentage: parseFloat(((t.totalCost / totalCost) * 100).toFixed(1))
            }))
        }
    };
}

// CLI mode
if (require.main === module) {
    const result = analyzeOptimizationOpportunities();
    console.log(JSON.stringify(result, null, 2));
}

module.exports = { analyzeOptimizationOpportunities };
