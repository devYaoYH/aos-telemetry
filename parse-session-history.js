#!/usr/bin/env node
/**
 * parse-session-history.js - Parse OpenClaw sessions_history JSON
 * Extracts tool calls and writes to tool-calls.jsonl
 * 
 * Usage: 
 *   node parse-session-history.js < session-history.json
 *   Or programmatically: parseSessionHistory(historyData)
 */

const fs = require('fs');
const path = require('path');

const AOS_DIR = process.env.AOS_DIR || path.join(process.env.HOME, 'aos-telemetry');
const TOOL_CALLS_FILE = path.join(AOS_DIR, 'tool-calls.jsonl');

function parseSessionHistory(historyData) {
    const toolCalls = [];
    
    if (!historyData.messages || !Array.isArray(historyData.messages)) {
        console.error('Invalid history data: missing messages array');
        return toolCalls;
    }
    
    for (const msg of historyData.messages) {
        // Skip non-assistant messages
        if (msg.role !== 'assistant') continue;
        
        // Handle content array
        if (!Array.isArray(msg.content)) continue;
        
        for (const item of msg.content) {
            // Look for toolCall type
            if (item.type === 'toolCall') {
                const toolCall = {
                    timestamp: new Date(msg.timestamp).toISOString(),
                    tool: item.name,
                    toolCallId: item.id,
                    params: item.arguments,
                    source: 'sessions_history',
                    extracted_at: new Date().toISOString()
                };
                
                // Add usage data if available
                if (msg.usage) {
                    toolCall.tokens = {
                        input: msg.usage.input || 0,
                        output: msg.usage.output || 0,
                        total: msg.usage.totalTokens || 0
                    };
                    if (msg.usage.cost) {
                        toolCall.cost = msg.usage.cost.total || 0;
                    }
                }
                
                // Add model info if available
                if (msg.model) {
                    toolCall.model = msg.model;
                }
                
                toolCalls.push(toolCall);
            }
        }
    }
    
    return toolCalls;
}

function appendToolCalls(toolCalls) {
    if (toolCalls.length === 0) {
        console.log('No tool calls found');
        return;
    }
    
    const lines = toolCalls.map(tc => JSON.stringify(tc)).join('\n') + '\n';
    fs.appendFileSync(TOOL_CALLS_FILE, lines);
    console.log(`✅ Appended ${toolCalls.length} tool calls to ${TOOL_CALLS_FILE}`);
}

function showSummary(toolCalls) {
    if (toolCalls.length === 0) return;
    
    console.log('\n📊 Extracted tool calls:');
    
    // Count by tool
    const counts = {};
    let totalCost = 0;
    let totalTokens = 0;
    
    for (const tc of toolCalls) {
        counts[tc.tool] = (counts[tc.tool] || 0) + 1;
        if (tc.cost) totalCost += tc.cost;
        if (tc.tokens) totalTokens += tc.tokens.total;
    }
    
    Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([tool, count]) => {
            console.log(`  ${count}× ${tool}`);
        });
    
    if (totalCost > 0) {
        console.log(`\n💰 Total cost: $${totalCost.toFixed(4)}`);
    }
    if (totalTokens > 0) {
        console.log(`🔢 Total tokens: ${totalTokens.toLocaleString()}`);
    }
}

// CLI usage
async function main() {
    console.log('🔍 AOS Session History Parser\n');
    
    // Read from stdin
    let inputData = '';
    
    if (process.stdin.isTTY) {
        console.error('❌ No input provided. Usage:');
        console.error('  node parse-session-history.js < session-history.json');
        process.exit(1);
    }
    
    process.stdin.setEncoding('utf8');
    
    for await (const chunk of process.stdin) {
        inputData += chunk;
    }
    
    let historyData;
    try {
        historyData = JSON.parse(inputData);
    } catch (e) {
        console.error(`❌ Failed to parse JSON: ${e.message}`);
        process.exit(1);
    }
    
    const toolCalls = parseSessionHistory(historyData);
    
    showSummary(toolCalls);
    appendToolCalls(toolCalls);
    
    console.log('\n✨ Done!');
}

if (require.main === module) {
    main().catch(err => {
        console.error(`❌ Error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { parseSessionHistory, appendToolCalls };
