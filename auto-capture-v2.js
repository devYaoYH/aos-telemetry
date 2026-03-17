#!/usr/bin/env node
/**
 * auto-capture-v2.js - Automatic tool call extraction using OpenClaw sessions_history
 * Part of AOS Phase 2: Auto-Logging Hooks
 * 
 * Usage: ./auto-capture-v2.js [--limit N] [--dry-run]
 * 
 * Queries OpenClaw session history, extracts tool calls, populates tool-calls.jsonl
 */

const fs = require('fs');
const path = require('path');

const AOS_DIR = process.env.AOS_DIR || path.join(process.env.HOME, 'aos-telemetry');
const TOOL_CALLS_FILE = path.join(AOS_DIR, 'tool-calls.jsonl');
const STATE_FILE = path.join(AOS_DIR, '.auto-capture-state.json');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(msg) { console.log(`${GREEN}[AOS]${RESET} ${msg}`); }
function info(msg) { console.log(`${BLUE}[AOS]${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}[AOS]${RESET} ${msg}`); }

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return { lastProcessedIndex: 0, lastCaptureTime: null, totalToolCallsExtracted: 0 };
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function extractToolCalls(messages, startIndex = 0) {
    const toolCalls = [];
    
    for (let i = startIndex; i < messages.length; i++) {
        const msg = messages[i];
        
        if (msg.role === 'assistant' && msg.content) {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            const invokePattern = /<invoke name="([^"]+)">/g;
            let match;
            
            while ((match = invokePattern.exec(content)) !== null) {
                toolCalls.push({
                    timestamp: msg.timestamp || new Date().toISOString(),
                    tool: match[1],
                    message_index: i,
                    source: 'auto-capture-v2',
                    extracted_at: new Date().toISOString()
                });
            }
        }
    }
    
    return toolCalls;
}

function appendToolCalls(toolCalls, dryRun = false) {
    if (toolCalls.length === 0) {
        info('No new tool calls to append');
        return;
    }
    
    const lines = toolCalls.map(tc => JSON.stringify(tc)).join('\n') + '\n';
    
    if (dryRun) {
        info('DRY RUN: Would append:');
        console.log(lines);
    } else {
        fs.appendFileSync(TOOL_CALLS_FILE, lines);
        log(`💾 Appended ${toolCalls.length} tool calls`);
    }
}

function showSummary() {
    if (!fs.existsSync(TOOL_CALLS_FILE)) {
        info('No tool call history yet');
        return;
    }
    
    const lines = fs.readFileSync(TOOL_CALLS_FILE, 'utf8').trim().split('\n');
    const recentTools = lines.slice(-50).map(line => {
        try {
            return JSON.parse(line).tool;
        } catch {
            return null;
        }
    }).filter(Boolean);
    
    const counts = {};
    recentTools.forEach(tool => counts[tool] = (counts[tool] || 0) + 1);
    
    console.log('\n📊 Recent tool usage (last 50 calls):');
    Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([tool, count]) => {
            const bar = '█'.repeat(Math.min(count, 20));
            console.log(`  ${count.toString().padStart(3)}× ${bar} ${tool}`);
        });
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    
    console.log('🔍 AOS Auto-Capture v2: Tool call extraction\n');
    
    const state = loadState();
    info(`Last capture: ${state.lastCaptureTime || 'never'}`);
    info(`Last processed: message ${state.lastProcessedIndex}`);
    info(`Total extracted: ${state.totalToolCallsExtracted}\n`);
    
    // Read from stdin (piped session history JSON)
    let inputData = '';
    
    if (process.stdin.isTTY) {
        warn('No input provided. Usage:');
        console.log('  echo \'{"messages":[...]}\' | ./auto-capture-v2.js');
        console.log('  Or integrate with sessions_history tool');
        process.exit(1);
    }
    
    process.stdin.setEncoding('utf8');
    
    for await (const chunk of process.stdin) {
        inputData += chunk;
    }
    
    let messages = [];
    try {
        const data = JSON.parse(inputData);
        messages = Array.isArray(data) ? data : (data.messages || data.history || []);
    } catch (e) {
        warn(`Failed to parse input: ${e.message}`);
        process.exit(1);
    }
    
    info(`Loaded ${messages.length} messages from session history`);
    
    const toolCalls = extractToolCalls(messages, state.lastProcessedIndex);
    log(`Found ${toolCalls.length} new tool calls`);
    
    appendToolCalls(toolCalls, dryRun);
    
    if (!dryRun && toolCalls.length > 0) {
        saveState({
            lastProcessedIndex: messages.length,
            lastCaptureTime: new Date().toISOString(),
            totalToolCallsExtracted: state.totalToolCallsExtracted + toolCalls.length
        });
    }
    
    showSummary();
    console.log('\n✨ Auto-capture complete!');
}

if (require.main === module) {
    main().catch(err => {
        console.error(`❌ Error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { extractToolCalls, loadState, saveState };
