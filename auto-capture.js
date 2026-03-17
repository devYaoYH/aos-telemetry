#!/usr/bin/env node
/**
 * auto-capture.js - Automatic tool call extraction from OpenClaw session history
 * Part of AOS Phase 2: Auto-Logging Hooks
 * 
 * Usage: ./auto-capture.js [--session sessionKey] [--limit N]
 * 
 * Queries OpenClaw session history, extracts tool calls, and populates tool-calls.jsonl
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AOS_DIR = process.env.AOS_DIR || path.join(process.env.HOME, 'aos-telemetry');
const TOOL_CALLS_FILE = path.join(AOS_DIR, 'tool-calls.jsonl');
const STATE_FILE = path.join(AOS_DIR, '.auto-capture-state.json');

// Load state (last processed message ID)
function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return { lastProcessedMessageId: null, lastCaptureTime: null };
}

// Save state
function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Parse OpenClaw session history (mock for now - needs actual API integration)
function getSessionHistory(sessionKey = 'main', limit = 50) {
    // In real implementation, this would call OpenClaw's internal API
    // For now, simulate by checking recent command history
    
    console.log(`📚 Fetching session history (limit: ${limit})...`);
    
    // Placeholder: return empty for now until we integrate with OpenClaw API properly
    // In production, this would parse tool calls from session_history tool
    return [];
}

// Extract tool calls from messages
function extractToolCalls(messages, lastProcessedId) {
    const toolCalls = [];
    let processedMessages = 0;
    
    for (const msg of messages) {
        // Skip if already processed
        if (lastProcessedId && msg.id <= lastProcessedId) {
            continue;
        }
        
        // Look for tool calls in message content
        if (msg.role === 'assistant' && msg.tool_calls) {
            for (const tc of msg.tool_calls) {
                toolCalls.push({
                    timestamp: msg.timestamp || new Date().toISOString(),
                    tool: tc.name,
                    params: tc.parameters,
                    message_id: msg.id,
                    source: 'auto-capture'
                });
            }
        }
        
        processedMessages++;
    }
    
    console.log(`✅ Processed ${processedMessages} messages, found ${toolCalls.length} tool calls`);
    return toolCalls;
}

// Append tool calls to JSONL file
function appendToolCalls(toolCalls) {
    if (toolCalls.length === 0) return;
    
    const lines = toolCalls.map(tc => JSON.stringify(tc)).join('\n') + '\n';
    fs.appendFileSync(TOOL_CALLS_FILE, lines);
    console.log(`💾 Appended ${toolCalls.length} tool calls to ${TOOL_CALLS_FILE}`);
}

// Main execution
async function main() {
    console.log('🔍 AOS Auto-Capture: Extracting tool calls from session history...\n');
    
    const state = loadState();
    console.log(`Last capture: ${state.lastCaptureTime || 'never'}`);
    console.log(`Last processed message: ${state.lastProcessedMessageId || 'none'}\n`);
    
    // Get session history
    const messages = getSessionHistory('main', 100);
    
    // Extract tool calls
    const toolCalls = extractToolCalls(messages, state.lastProcessedMessageId);
    
    // Append to file
    appendToolCalls(toolCalls);
    
    // Update state
    const latestMessageId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) : state.lastProcessedMessageId;
    saveState({
        lastProcessedMessageId: latestMessageId,
        lastCaptureTime: new Date().toISOString()
    });
    
    console.log('\n✨ Auto-capture complete!');
    
    // Show recent tool usage summary
    if (fs.existsSync(TOOL_CALLS_FILE)) {
        console.log('\n📊 Recent tool usage:');
        try {
            const lines = fs.readFileSync(TOOL_CALLS_FILE, 'utf8').trim().split('\n');
            const recentTools = lines.slice(-20).map(line => {
                const data = JSON.parse(line);
                return data.tool;
            });
            
            const counts = {};
            recentTools.forEach(tool => {
                counts[tool] = (counts[tool] || 0) + 1;
            });
            
            Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([tool, count]) => {
                    console.log(`  ${count.toString().padStart(3)}× ${tool}`);
                });
        } catch (e) {
            console.log('  (No tool call data yet)');
        }
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(err => {
        console.error('❌ Error:', err.message);
        process.exit(1);
    });
}

module.exports = { extractToolCalls, loadState, saveState };
