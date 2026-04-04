#!/usr/bin/env node
/**
 * auto-sync.js - Automatic OpenClaw session sync to AOS telemetry
 * 
 * Reads OpenClaw session transcripts directly and extracts telemetry data
 * No manual logging required - fully automated observability
 */

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(process.env.HOME, '.openclaw', 'agents', 'main', 'sessions');
const AOS_DIR = path.join(process.env.HOME, 'aos-telemetry');
const TOOL_CALLS_FILE = path.join(AOS_DIR, 'tool-calls.jsonl');
const STATE_FILE = path.join(AOS_DIR, '.auto-sync-state.json');

function log(msg) { console.log(`\x1b[32m[AOS Auto-Sync]\x1b[0m ${msg}`); }
function warn(msg) { console.log(`\x1b[33m[AOS Auto-Sync]\x1b[0m ${msg}`); }
function error(msg) { console.log(`\x1b[31m[AOS Auto-Sync]\x1b[0m ${msg}`); }

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return {
        processedFiles: {},
        lastSync: null,
        totalToolCalls: 0
    };
}

function saveState(state) {
    if (!fs.existsSync(AOS_DIR)) {
        fs.mkdirSync(AOS_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getSessionFiles() {
    if (!fs.existsSync(SESSION_DIR)) {
        error(`Session directory not found: ${SESSION_DIR}`);
        return [];
    }
    
    return fs.readdirSync(SESSION_DIR)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
            name: f,
            path: path.join(SESSION_DIR, f),
            mtime: fs.statSync(path.join(SESSION_DIR, f)).mtime.getTime()
        }));
}

function parseSessionFile(filePath, lastProcessedLine = 0) {
    const toolCalls = [];
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(line => line.trim());
    
    // Extract session ID from filename (e.g., "abc123.jsonl" -> "abc123")
    const sessionId = path.basename(filePath, '.jsonl');
    
    for (let i = lastProcessedLine; i < lines.length; i++) {
        try {
            const line = JSON.parse(lines[i]);
            
            // OpenClaw format: { type: "message", message: { role, content, usage } }
            if (line.type === 'message' && line.message && line.message.role === 'assistant') {
                const msg = line.message;
                const content = Array.isArray(msg.content) ? msg.content : [msg.content];
                
                for (const item of content) {
                    if (item.type === 'toolCall' || item.type === 'tool_use') {
                        const toolName = item.name || item.tool_name;
                        const toolId = item.id || item.tool_call_id;
                        
                        toolCalls.push({
                            timestamp: line.timestamp || msg.timestamp || new Date().toISOString(),
                            tool: toolName,
                            id: toolId,
                            params: item.arguments || item.input || item.parameters || null, // Extract tool parameters (session files use 'arguments')
                            sessionId: sessionId, // ADD SESSION ID
                            model: msg.model || 'unknown',
                            status: 'success', // Assume success unless we see error
                            // Extract usage/cost from message if available
                            cost: msg.usage?.cost?.total || 0,
                            tokens: {
                                input: msg.usage?.input || 0,
                                output: msg.usage?.output || 0,
                                cacheRead: msg.usage?.cacheRead || 0,
                                cacheWrite: msg.usage?.cacheWrite || 0,
                                total: msg.usage?.totalTokens || ((msg.usage?.input || 0) + (msg.usage?.output || 0))
                            },
                            source: 'auto-sync',
                            session_file: path.basename(filePath),
                            line_number: i + 1
                        });
                    }
                }
            }
        } catch (e) {
            // Skip malformed lines
            warn(`Skipping malformed line ${i + 1} in ${path.basename(filePath)}: ${e.message}`);
        }
    }
    
    return { toolCalls, lastLine: lines.length };
}

function appendToolCalls(toolCalls) {
    if (toolCalls.length === 0) {
        return;
    }
    
    if (!fs.existsSync(AOS_DIR)) {
        fs.mkdirSync(AOS_DIR, { recursive: true });
    }
    
    const lines = toolCalls.map(tc => JSON.stringify(tc)).join('\n') + '\n';
    fs.appendFileSync(TOOL_CALLS_FILE, lines);
    log(`💾 Logged ${toolCalls.length} tool calls`);
}

function sync() {
    log('Starting sync...');
    
    const state = loadState();
    const sessionFiles = getSessionFiles();
    
    if (sessionFiles.length === 0) {
        warn('No session files found');
        return;
    }
    
    let totalNewToolCalls = 0;
    
    for (const file of sessionFiles) {
        const fileState = state.processedFiles[file.name] || { lastLine: 0, lastMtime: 0 };
        
        // Skip if file hasn't changed
        if (fileState.lastMtime === file.mtime && fileState.lastLine > 0) {
            continue;
        }
        
        log(`Processing ${file.name}...`);
        const { toolCalls, lastLine } = parseSessionFile(file.path, fileState.lastLine);
        
        if (toolCalls.length > 0) {
            appendToolCalls(toolCalls);
            totalNewToolCalls += toolCalls.length;
        }
        
        // Update state
        state.processedFiles[file.name] = {
            lastLine,
            lastMtime: file.mtime,
            lastSync: new Date().toISOString()
        };
    }
    
    state.lastSync = new Date().toISOString();
    state.totalToolCalls = (state.totalToolCalls || 0) + totalNewToolCalls;
    saveState(state);
    
    if (totalNewToolCalls > 0) {
        log(`✅ Sync complete: ${totalNewToolCalls} new tool calls extracted`);
    } else {
        log('✅ Sync complete: No new tool calls');
    }
    
    return { newToolCalls: totalNewToolCalls, totalFiles: sessionFiles.length };
}

// Run sync
if (require.main === module) {
    try {
        const result = sync();
        process.exit(0);
    } catch (err) {
        error(`Sync failed: ${err.message}`);
        if (process.env.DEBUG) {
            console.error(err.stack);
        }
        process.exit(1);
    }
}

module.exports = { sync };
