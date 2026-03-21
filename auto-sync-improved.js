#!/usr/bin/env node
/**
 * auto-sync-improved.js - Enhanced OpenClaw session sync with error tracking
 * 
 * Improvements over auto-sync.js:
 * - Correlates tool_use with tool_result to determine success/error
 * - Captures error messages and failure reasons
 * - Calculates actual success rates per tool
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

function extractErrorMessage(content) {
    // Extract error message from OpenClaw result content array
    if (!content) return 'Unknown error';
    
    if (Array.isArray(content)) {
        for (const item of content) {
            if (item.type === 'text' && item.text) {
                // Truncate long error messages
                return item.text.length > 200 
                    ? item.text.substring(0, 200) + '...'
                    : item.text;
            }
        }
    }
    
    if (typeof content === 'string') {
        return content.length > 200 ? content.substring(0, 200) + '...' : content;
    }
    
    return 'Unknown error';
}

function detectError(result) {
    // Multiple ways a tool result can indicate error:
    // 1. result.error exists
    // 2. result.status === 'error'
    // 3. result has { tool: string, error: string } structure (OpenClaw format)
    
    if (!result) return null;
    
    // Direct error field
    if (result.error) {
        return typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
    }
    
    // Status error
    if (result.status === 'error') {
        return result.message || result.error || 'Unknown error';
    }
    
    // OpenClaw tool error format
    if (result.tool && result.error) {
        return result.error;
    }
    
    // Command exit codes (for exec tool)
    if (result.output && typeof result.output === 'string') {
        const exitMatch = result.output.match(/Command exited with code (\d+)/);
        if (exitMatch && exitMatch[1] !== '0') {
            return `Command exited with code ${exitMatch[1]}`;
        }
    }
    
    return null;
}

function parseSessionFileWithResults(filePath, lastProcessedLine = 0) {
    const toolCalls = [];
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(line => line.trim());
    
    // First pass: Build map of tool_use → tool_result
    const toolUseMap = new Map(); // tool_id → { toolUse, result, timestamp }
    
    for (let i = 0; i < lines.length; i++) {
        try {
            const line = JSON.parse(lines[i]);
            
            if (line.type !== 'message' || !line.message) continue;
            
            const msg = line.message;
            
            // OpenClaw format: role can be "assistant" or "toolResult"
            if (msg.role === 'assistant') {
                const content = Array.isArray(msg.content) ? msg.content : [msg.content];
                
                for (const item of content) {
                    // Tool use (call)
                    if (item.type === 'toolCall' || item.type === 'tool_use') {
                        const toolId = item.id || item.tool_call_id;
                        toolUseMap.set(toolId, {
                            toolUse: item,
                            timestamp: line.timestamp || msg.timestamp || new Date().toISOString(),
                            model: msg.model || 'unknown',
                            usage: msg.usage || {},
                            lineNumber: i + 1
                        });
                    }
                }
            } else if (msg.role === 'toolResult') {
                // Tool result message (OpenClaw format)
                const toolId = msg.toolCallId;
                const existing = toolUseMap.get(toolId);
                if (existing) {
                    existing.result = msg.content;
                    existing.isError = msg.isError || false;
                    existing.resultTimestamp = line.timestamp || msg.timestamp;
                }
            }
        } catch (e) {
            // Skip malformed lines
        }
    }
    
    // Second pass: Build tool calls with success/error status
    for (const [toolId, data] of toolUseMap.entries()) {
        if (data.lineNumber <= lastProcessedLine) continue;
        
        const toolName = data.toolUse.name || data.toolUse.tool_name;
        
        // Check both isError flag and result content for errors
        let errorMsg = null;
        let status = 'success';
        
        if (data.isError) {
            status = 'error';
            errorMsg = extractErrorMessage(data.result);
        } else if (data.result) {
            errorMsg = detectError(data.result);
            if (errorMsg) {
                status = 'error';
            }
        }
        
        toolCalls.push({
            timestamp: data.timestamp,
            tool: toolName,
            id: toolId,
            model: data.model,
            status: status,
            error: errorMsg || undefined,
            cost: data.usage?.cost?.total || 0,
            tokens: {
                input: data.usage?.input || 0,
                output: data.usage?.output || 0,
                cacheRead: data.usage?.cacheRead || 0,
                cacheWrite: data.usage?.cacheWrite || 0,
                total: data.usage?.totalTokens || ((data.usage?.input || 0) + (data.usage?.output || 0))
            },
            latencyMs: data.resultTimestamp && data.timestamp 
                ? new Date(data.resultTimestamp) - new Date(data.timestamp)
                : undefined,
            source: 'auto-sync-improved',
            session_file: path.basename(filePath),
            line_number: data.lineNumber
        });
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
    
    const errors = toolCalls.filter(tc => tc.status === 'error').length;
    log(`💾 Logged ${toolCalls.length} tool calls (${errors} errors)`);
}

function sync() {
    log('Starting sync with error tracking...');
    
    const state = loadState();
    const sessionFiles = getSessionFiles();
    
    if (sessionFiles.length === 0) {
        warn('No session files found');
        return;
    }
    
    let totalNewToolCalls = 0;
    let totalErrors = 0;
    
    for (const file of sessionFiles) {
        const fileState = state.processedFiles[file.name] || { lastLine: 0, lastMtime: 0 };
        
        // Skip if file hasn't changed
        if (fileState.lastMtime === file.mtime && fileState.lastLine > 0) {
            continue;
        }
        
        log(`Processing ${file.name}...`);
        const { toolCalls, lastLine } = parseSessionFileWithResults(file.path, fileState.lastLine);
        
        if (toolCalls.length > 0) {
            const errors = toolCalls.filter(tc => tc.status === 'error').length;
            appendToolCalls(toolCalls);
            totalNewToolCalls += toolCalls.length;
            totalErrors += errors;
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
        const errorRate = (totalErrors / totalNewToolCalls * 100).toFixed(1);
        log(`✅ Sync complete: ${totalNewToolCalls} new tool calls extracted`);
        log(`   ${totalErrors} errors detected (${errorRate}% error rate)`);
    } else {
        log('✅ Sync complete: No new tool calls');
    }
}

// Run if called directly
if (require.main === module) {
    sync();
}

module.exports = { sync, parseSessionFileWithResults, detectError };
