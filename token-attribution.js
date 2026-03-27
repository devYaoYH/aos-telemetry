#!/usr/bin/env node
/**
 * token-attribution.js - Token-level cost attribution for tool calls
 * 
 * Breaks down turn costs into:
 * 1. Input tokens (fresh context)
 * 2. Output tokens:
 *    - Thinking tokens
 *    - Tool call JSON tokens
 *    - Text response tokens
 * 3. Cache operations:
 *    - Cache read (previous conversation)
 *    - Cache write (current turn's output)
 * 
 * Question: When are tool results cached?
 * - Tool call turn: Caches thinking + tool call JSON
 * - Tool result turn: No usage tracking (result stored but not counted)
 * - Next turn: Tool result is READ via cacheRead increase
 */

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(process.env.HOME, '.openclaw/agents/main/sessions');

// Rough token estimation (Claude uses ~4 chars per token on average)
const CHARS_PER_TOKEN = 4;

function estimateTokens(charCount) {
    if (!charCount || typeof charCount !== 'number') return 0;
    return Math.round(charCount / CHARS_PER_TOKEN);
}

function analyzeTokenAttribution(sessionFile) {
    const sessionId = path.basename(sessionFile, '.jsonl');
    const lines = fs.readFileSync(sessionFile, 'utf8').split('\n').filter(l => l.trim());
    
    const attributions = [];
    
    for (let i = 0; i < lines.length; i++) {
        try {
            const msg = JSON.parse(lines[i]);
            
            if (msg.type === 'message' && msg.message?.role === 'assistant') {
                const content = Array.isArray(msg.message.content) ? msg.message.content : [msg.message.content];
                const usage = msg.message.usage || {};
                const cost = usage.cost || {};
                
                // Check if this turn has tool calls
                const toolCalls = content.filter(c => c?.type === 'toolCall');
                const thinking = content.filter(c => c?.type === 'thinking');
                const text = content.filter(c => c?.type === 'text');
                
                if (toolCalls.length > 0) {
                    // Calculate character counts
                    const thinkingChars = thinking.reduce((sum, t) => sum + (t.thinking?.length || 0), 0);
                    // For tool calls, count the JSON representation of the entire call
                    const toolCallChars = toolCalls.reduce((sum, t) => {
                        const jsonStr = JSON.stringify(t);
                        return sum + jsonStr.length;
                    }, 0);
                    const textChars = text.reduce((sum, t) => sum + (t.text?.length || 0), 0);
                    
                    // Estimate token breakdown
                    const totalOutputTokens = usage.output || 0;
                    const thinkingTokensEst = estimateTokens(thinkingChars);
                    const toolCallTokensEst = estimateTokens(toolCallChars);
                    const textTokensEst = estimateTokens(textChars);
                    
                    // Normalize to actual output tokens (proportional)
                    const totalEstimated = thinkingTokensEst + toolCallTokensEst + textTokensEst;
                    const normalizer = totalEstimated > 0 ? totalOutputTokens / totalEstimated : 0;
                    
                    const thinkingTokens = totalEstimated > 0 ? Math.round(thinkingTokensEst * normalizer) : 0;
                    const toolCallTokens = totalEstimated > 0 ? Math.round(toolCallTokensEst * normalizer) : 0;
                    const textTokens = totalEstimated > 0 ? Math.max(0, totalOutputTokens - thinkingTokens - toolCallTokens) : totalOutputTokens;
                    
                    // Cost per token (Claude pricing)
                    const OUTPUT_COST_PER_TOKEN = 0.000015; // $0.015 per 1K tokens
                    const CACHE_WRITE_COST_PER_TOKEN = 0.000003750; // $0.00375 per 1K tokens
                    const CACHE_READ_COST_PER_TOKEN = 0.0000003; // $0.0003 per 1K tokens
                    
                    // Attribute costs
                    const thinkingCost = thinkingTokens * OUTPUT_COST_PER_TOKEN;
                    const toolCallCost = toolCallTokens * OUTPUT_COST_PER_TOKEN;
                    const textCost = textTokens * OUTPUT_COST_PER_TOKEN;
                    
                    // Cache write is for the CURRENT turn's output (thinking + tool call + text)
                    const cacheWriteCost = (usage.cacheWrite || 0) * CACHE_WRITE_COST_PER_TOKEN;
                    
                    // Cache read is PREVIOUS turns (including previous tool results)
                    const cacheReadCost = (usage.cacheRead || 0) * CACHE_READ_COST_PER_TOKEN;
                    
                    // Find next turn to see cache read increase (= tool result size)
                    let toolResultTokens = 0;
                    let toolResultCost = 0;
                    
                    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                        try {
                            const nextMsg = JSON.parse(lines[j]);
                            if (nextMsg.type === 'message' && nextMsg.message?.role === 'assistant') {
                                const nextUsage = nextMsg.message.usage || {};
                                const cacheReadIncrease = (nextUsage.cacheRead || 0) - (usage.cacheRead || 0);
                                
                                if (cacheReadIncrease > 0) {
                                    toolResultTokens = cacheReadIncrease;
                                    toolResultCost = cacheReadIncrease * CACHE_READ_COST_PER_TOKEN;
                                    break;
                                }
                            }
                        } catch {}
                    }
                    
                    attributions.push({
                        session: sessionId.substring(0, 8),
                        timestamp: msg.timestamp,
                        tools: toolCalls.map(t => t.name),
                        
                        // Token breakdown
                        tokens: {
                            input: usage.input || 0,
                            output_total: totalOutputTokens,
                            output_thinking: thinkingTokens,
                            output_toolcall: toolCallTokens,
                            output_text: textTokens,
                            cache_read: usage.cacheRead || 0,
                            cache_write: usage.cacheWrite || 0,
                            tool_result: toolResultTokens
                        },
                        
                        // Cost breakdown
                        costs: {
                            input: cost.input || 0,
                            output_thinking: thinkingCost,
                            output_toolcall: toolCallCost,
                            output_text: textCost,
                            cache_read: cacheReadCost,
                            cache_write: cacheWriteCost,
                            tool_result_read: toolResultCost,
                            total: cost.total || 0
                        },
                        
                        // Percentages
                        percentages: {
                            thinking: (thinkingCost / (cost.total || 1)) * 100,
                            toolcall: (toolCallCost / (cost.total || 1)) * 100,
                            text: (textCost / (cost.total || 1)) * 100,
                            cache_ops: ((cacheReadCost + cacheWriteCost) / (cost.total || 1)) * 100,
                            tool_result: (toolResultCost / (cost.total || 1)) * 100
                        }
                    });
                }
            }
        } catch {}
    }
    
    return attributions;
}

// CLI usage
if (require.main === module) {
    const sessionFile = process.argv[2] || path.join(SESSION_DIR, 'f5c1382b-a48f-4562-a52b-a4766993a037.jsonl');
    
    console.log('================================================================================');
    console.log('TOKEN-LEVEL ATTRIBUTION ANALYSIS');
    console.log('================================================================================\n');
    
    const attributions = analyzeTokenAttribution(sessionFile);
    
    console.log(`Session: ${path.basename(sessionFile, '.jsonl')}`);
    console.log(`Tool calls analyzed: ${attributions.length}\n`);
    
    // Aggregate statistics
    const totals = {
        thinking_cost: 0,
        toolcall_cost: 0,
        text_cost: 0,
        cache_read_cost: 0,
        cache_write_cost: 0,
        tool_result_cost: 0,
        total_cost: 0
    };
    
    for (const attr of attributions) {
        totals.thinking_cost += attr.costs.output_thinking;
        totals.toolcall_cost += attr.costs.output_toolcall;
        totals.text_cost += attr.costs.output_text;
        totals.cache_read_cost += attr.costs.cache_read;
        totals.cache_write_cost += attr.costs.cache_write;
        totals.tool_result_cost += attr.costs.tool_result_read;
        totals.total_cost += attr.costs.total;
    }
    
    console.log('AGGREGATED COST BREAKDOWN:');
    console.log('==========================\n');
    
    console.log(`Total turn cost:          $${totals.total_cost.toFixed(4)}`);
    console.log(`\nBreakdown:`);
    console.log(`  Thinking:               $${totals.thinking_cost.toFixed(4)} (${(totals.thinking_cost/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`  Tool call JSON:         $${totals.toolcall_cost.toFixed(4)} (${(totals.toolcall_cost/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`  Text responses:         $${totals.text_cost.toFixed(4)} (${(totals.text_cost/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`  Cache read:             $${totals.cache_read_cost.toFixed(4)} (${(totals.cache_read_cost/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`  Cache write:            $${totals.cache_write_cost.toFixed(4)} (${(totals.cache_write_cost/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`  Tool result reading:    $${totals.tool_result_cost.toFixed(4)} (${(totals.tool_result_cost/totals.total_cost*100).toFixed(1)}%)\n`);
    
    // Show a few examples
    console.log('EXAMPLE TURNS:');
    console.log('==============\n');
    
    for (const attr of attributions.slice(0, 5)) {
        console.log(`${attr.timestamp} - ${attr.tools.join(', ')}`);
        console.log(`  Total: $${attr.costs.total.toFixed(4)}`);
        console.log(`    Thinking: ${attr.tokens.output_thinking}t ($${attr.costs.output_thinking.toFixed(4)}, ${attr.percentages.thinking.toFixed(1)}%)`);
        console.log(`    Tool call: ${attr.tokens.output_toolcall}t ($${attr.costs.output_toolcall.toFixed(4)}, ${attr.percentages.toolcall.toFixed(1)}%)`);
        console.log(`    Cache ops: ${attr.tokens.cache_read + attr.tokens.cache_write}t ($${(attr.costs.cache_read + attr.costs.cache_write).toFixed(4)}, ${attr.percentages.cache_ops.toFixed(1)}%)`);
        console.log(`    Tool result: ${attr.tokens.tool_result}t ($${attr.costs.tool_result_read.toFixed(4)}, ${attr.percentages.tool_result.toFixed(1)}%)\n`);
    }
    
    console.log('KEY INSIGHTS:');
    console.log('=============\n');
    console.log('1. Cache write happens in CURRENT turn (thinking + tool call JSON)');
    console.log('2. Tool result stored with NO usage tracking');
    console.log('3. Tool result READ in NEXT turn via cache read increase\n');
    
    const avgToolCallPct = attributions.reduce((sum, a) => sum + a.percentages.toolcall, 0) / attributions.length;
    const avgCachePct = attributions.reduce((sum, a) => sum + a.percentages.cache_ops, 0) / attributions.length;
    
    console.log(`Average breakdown per tool call turn:`);
    console.log(`  Tool call itself: ~${avgToolCallPct.toFixed(1)}%`);
    console.log(`  Cache operations: ~${avgCachePct.toFixed(1)}%`);
    console.log(`  Thinking + other: ~${(100 - avgToolCallPct - avgCachePct).toFixed(1)}%`);
}

module.exports = { analyzeTokenAttribution, estimateTokens };
