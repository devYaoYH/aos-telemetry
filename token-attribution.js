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
                    
                    // Cache write breakdown: proportional to output composition
                    const totalCacheWrite = usage.cacheWrite || 0;
                    const cacheWriteThinking = totalOutputTokens > 0 ? (thinkingTokens / totalOutputTokens) * totalCacheWrite : 0;
                    const cacheWriteToolCall = totalOutputTokens > 0 ? (toolCallTokens / totalOutputTokens) * totalCacheWrite : 0;
                    const cacheWriteText = totalOutputTokens > 0 ? (textTokens / totalOutputTokens) * totalCacheWrite : 0;
                    
                    const cacheWriteThinkingCost = cacheWriteThinking * CACHE_WRITE_COST_PER_TOKEN;
                    const cacheWriteToolCallCost = cacheWriteToolCall * CACHE_WRITE_COST_PER_TOKEN;
                    const cacheWriteTextCost = cacheWriteText * CACHE_WRITE_COST_PER_TOKEN;
                    
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
                    
                    // Calculate full tool call cost (preparation + cache overhead + result reading)
                    const fullToolCallCost = toolCallCost + cacheWriteToolCallCost + toolResultCost;
                    const fullThinkingCost = thinkingCost + cacheWriteThinkingCost;
                    
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
                            cache_write_total: usage.cacheWrite || 0,
                            cache_write_thinking: Math.round(cacheWriteThinking),
                            cache_write_toolcall: Math.round(cacheWriteToolCall),
                            cache_write_text: Math.round(cacheWriteText),
                            tool_result: toolResultTokens
                        },
                        
                        // Cost breakdown
                        costs: {
                            input: cost.input || 0,
                            output_thinking: thinkingCost,
                            output_toolcall: toolCallCost,
                            output_text: textCost,
                            cache_write_thinking: cacheWriteThinkingCost,
                            cache_write_toolcall: cacheWriteToolCallCost,
                            cache_write_text: cacheWriteTextCost,
                            cache_read: cacheReadCost,
                            tool_result_read: toolResultCost,
                            full_toolcall: fullToolCallCost,
                            full_thinking: fullThinkingCost,
                            total: cost.total || 0
                        },
                        
                        // Percentages
                        percentages: {
                            thinking_total: (fullThinkingCost / (cost.total || 1)) * 100,
                            toolcall_total: (fullToolCallCost / (cost.total || 1)) * 100,
                            text: ((textCost + cacheWriteTextCost) / (cost.total || 1)) * 100,
                            cache_ops: (cacheReadCost / (cost.total || 1)) * 100,
                            toolcall_breakdown: {
                                output: (toolCallCost / (cost.total || 1)) * 100,
                                cache_write: (cacheWriteToolCallCost / (cost.total || 1)) * 100,
                                result_read: (toolResultCost / (cost.total || 1)) * 100
                            }
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
        thinking_output: 0,
        thinking_cache_write: 0,
        thinking_total: 0,
        toolcall_output: 0,
        toolcall_cache_write: 0,
        toolcall_result_read: 0,
        toolcall_total: 0,
        text_output: 0,
        text_cache_write: 0,
        cache_read_cost: 0,
        total_cost: 0
    };
    
    for (const attr of attributions) {
        totals.thinking_output += attr.costs.output_thinking;
        totals.thinking_cache_write += attr.costs.cache_write_thinking;
        totals.thinking_total += attr.costs.full_thinking;
        
        totals.toolcall_output += attr.costs.output_toolcall;
        totals.toolcall_cache_write += attr.costs.cache_write_toolcall;
        totals.toolcall_result_read += attr.costs.tool_result_read;
        totals.toolcall_total += attr.costs.full_toolcall;
        
        totals.text_output += attr.costs.output_text;
        totals.text_cache_write += attr.costs.cache_write_text;
        
        totals.cache_read_cost += attr.costs.cache_read;
        totals.total_cost += attr.costs.total;
    }
    
    console.log('AGGREGATED COST BREAKDOWN:');
    console.log('==========================\n');
    
    console.log(`Total turn cost:          $${totals.total_cost.toFixed(4)}`);
    console.log(`\nFull lifecycle costs (output + cache write + result read):`);
    console.log(`  Tool calls (FULL):      $${totals.toolcall_total.toFixed(4)} (${(totals.toolcall_total/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`    ↳ Output (JSON):      $${totals.toolcall_output.toFixed(4)} (${(totals.toolcall_output/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`    ↳ Cache write:        $${totals.toolcall_cache_write.toFixed(4)} (${(totals.toolcall_cache_write/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`    ↳ Result read:        $${totals.toolcall_result_read.toFixed(4)} (${(totals.toolcall_result_read/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`  Thinking (FULL):        $${totals.thinking_total.toFixed(4)} (${(totals.thinking_total/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`    ↳ Output:             $${totals.thinking_output.toFixed(4)} (${(totals.thinking_output/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`    ↳ Cache write:        $${totals.thinking_cache_write.toFixed(4)} (${(totals.thinking_cache_write/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`  Text (output+cache):    $${(totals.text_output + totals.text_cache_write).toFixed(4)} (${((totals.text_output + totals.text_cache_write)/totals.total_cost*100).toFixed(1)}%)`);
    console.log(`  Cache read (context):   $${totals.cache_read_cost.toFixed(4)} (${(totals.cache_read_cost/totals.total_cost*100).toFixed(1)}%)\n`);
    
    // Show a few examples
    console.log('EXAMPLE TURNS:');
    console.log('==============\n');
    
    for (const attr of attributions.slice(0, 5)) {
        console.log(`${attr.timestamp} - ${attr.tools.join(', ')}`);
        console.log(`  Total: $${attr.costs.total.toFixed(4)}`);
        console.log(`    Tool call FULL: $${attr.costs.full_toolcall.toFixed(4)} (${attr.percentages.toolcall_total.toFixed(1)}%)`);
        console.log(`      ↳ Output: ${attr.tokens.output_toolcall}t ($${attr.costs.output_toolcall.toFixed(4)})`);
        console.log(`      ↳ Cache write: ${attr.tokens.cache_write_toolcall}t ($${attr.costs.cache_write_toolcall.toFixed(4)})`);
        console.log(`      ↳ Result read: ${attr.tokens.tool_result}t ($${attr.costs.tool_result_read.toFixed(4)})`);
        console.log(`    Thinking: ${attr.tokens.output_thinking}t ($${attr.costs.full_thinking.toFixed(4)}, ${attr.percentages.thinking_total.toFixed(1)}%)`);
        console.log(`    Cache read: ${attr.tokens.cache_read}t ($${attr.costs.cache_read.toFixed(4)}, ${attr.percentages.cache_ops.toFixed(1)}%)\n`);
    }
    
    console.log('KEY INSIGHTS:');
    console.log('=============\n');
    console.log('1. Tool call FULL cost = output (JSON) + cache write (storing it) + result read (next turn)');
    console.log('2. Cache write happens in CURRENT turn (proportional to output composition)');
    console.log('3. Tool result stored with NO usage tracking, then READ in next turn\n');
    
    const avgToolCallPct = attributions.reduce((sum, a) => sum + a.percentages.toolcall_total, 0) / attributions.length;
    const avgThinkingPct = attributions.reduce((sum, a) => sum + a.percentages.thinking_total, 0) / attributions.length;
    const avgCachePct = attributions.reduce((sum, a) => sum + a.percentages.cache_ops, 0) / attributions.length;
    
    console.log(`Average breakdown per tool call turn:`);
    console.log(`  Tool call (FULL lifecycle): ~${avgToolCallPct.toFixed(1)}%`);
    console.log(`  Thinking (output + cache):   ~${avgThinkingPct.toFixed(1)}%`);
    console.log(`  Cache read (context):        ~${avgCachePct.toFixed(1)}%`);
    console.log(`  Other:                       ~${(100 - avgToolCallPct - avgThinkingPct - avgCachePct).toFixed(1)}%`);
}

module.exports = { analyzeTokenAttribution, estimateTokens };
