#!/usr/bin/env node
/**
 * session-tracker.js - Real-time OpenClaw session monitoring
 * Reads session JSONL files directly for live context tracking
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSIONS_DIR = path.join(os.homedir(), '.openclaw/agents/main/sessions');

/**
 * Get the most recently active session
 */
function getActiveSession() {
    if (!fs.existsSync(SESSIONS_DIR)) {
        return null;
    }
    
    const files = fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
            name: f,
            path: path.join(SESSIONS_DIR, f),
            mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length === 0) return null;
    
    return files[0];
}

/**
 * Parse a session JSONL file
 */
function parseSession(sessionPath) {
    const lines = fs.readFileSync(sessionPath, 'utf8')
        .split('\n')
        .filter(line => line.trim());
    
    const events = lines.map(line => {
        try {
            return JSON.parse(line);
        } catch (e) {
            return null;
        }
    }).filter(Boolean);
    
    return events;
}

/**
 * Get context breakdown from session events
 */
function getContextBreakdown(events) {
    const breakdown = {
        messages: [],
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        byRole: {
            user: 0,
            assistant: 0,
            system: 0
        },
        byType: {
            conversation: 0,
            thinking: 0,
            tools: 0,
            system: 0
        },
        lastUpdate: null,
        sessionId: null,
        modelId: null
    };
    
    // Get session metadata
    const sessionEvent = events.find(e => e.type === 'session');
    if (sessionEvent) {
        breakdown.sessionId = sessionEvent.id;
        breakdown.lastUpdate = sessionEvent.timestamp;
    }
    
    // Get model info
    const modelEvent = events.find(e => e.type === 'model_change' || e.customType === 'model-snapshot');
    if (modelEvent) {
        breakdown.modelId = modelEvent.modelId || modelEvent.data?.modelId;
    }
    
    // Process messages
    events.filter(e => e.type === 'message' && e.message).forEach(event => {
        const msg = event.message;
        const usage = msg.usage || {};
        
        // Accumulate tokens (input + output = actual context usage)
        // Note: usage.totalTokens includes cacheRead/cacheWrite which inflates numbers
        if (usage.input) {
            breakdown.inputTokens += usage.input;
        }
        if (usage.output) {
            breakdown.outputTokens += usage.output;
        }
        if (usage.cacheRead) {
            breakdown.cacheReadTokens += usage.cacheRead;
        }
        if (usage.cacheWrite) {
            breakdown.cacheWriteTokens += usage.cacheWrite;
        }
        
        // totalTokens = actual context usage (input + output only)
        const contextTokens = (usage.input || 0) + (usage.output || 0);
        breakdown.totalTokens += contextTokens;
        
        // Track by role (using actual context tokens, not usage.totalTokens)
        if (msg.role && breakdown.byRole[msg.role] !== undefined) {
            breakdown.byRole[msg.role] += contextTokens;
        }
        
        // Track by type (content analysis)
        if (msg.content && Array.isArray(msg.content)) {
            msg.content.forEach(part => {
                if (part.type === 'thinking') {
                    breakdown.byType.thinking += estimateTokens(part.thinking || '');
                } else if (part.type === 'tool_use' || part.type === 'tool_result') {
                    breakdown.byType.tools += estimateTokens(JSON.stringify(part));
                } else if (part.type === 'text') {
                    breakdown.byType.conversation += estimateTokens(part.text || '');
                }
            });
        }
        
        // Extract meaningful content preview
        let preview = '';
        let contentType = 'unknown';
        
        if (msg.content && Array.isArray(msg.content)) {
            // Priority 1: Find first text content (most meaningful for timeline)
            const textContent = msg.content.find(p => p.type === 'text');
            if (textContent && textContent.text) {
                preview = textContent.text.split('\n')[0].substring(0, 120);
                contentType = 'text';
            } else {
                // Priority 2: Check for thinking
                const thinking = msg.content.find(p => p.type === 'thinking');
                if (thinking && thinking.thinking) {
                    preview = thinking.thinking.split('\n')[0].substring(0, 120);
                    contentType = 'thinking';
                } else {
                    // Priority 3: Check for tool calls (not results - those are noisy)
                    const toolCall = msg.content.find(p => p.type === 'toolCall' || p.type === 'tool_use');
                    if (toolCall) {
                        const args = toolCall.arguments || toolCall.input || {};
                        const argStr = Object.keys(args).length > 0 
                            ? ` (${Object.keys(args).slice(0, 2).join(', ')})` 
                            : '';
                        preview = `🔧 ${toolCall.name || 'unknown'}${argStr}`;
                        contentType = 'toolCall';
                    }
                    // Skip tool results - they're too noisy for timeline
                }
            }
        } else if (typeof msg.content === 'string') {
            preview = msg.content.split('\n')[0].substring(0, 120);
            contentType = 'text';
        }
        
        breakdown.messages.push({
            id: event.id,
            timestamp: event.timestamp,
            role: msg.role,
            tokens: (usage.input || 0) + (usage.output || 0), // Actual context tokens
            preview: preview,
            contentType: contentType
        });
    });
    
    // Get last update time
    if (events.length > 0) {
        breakdown.lastUpdate = events[events.length - 1].timestamp;
    }
    
    return breakdown;
}

/**
 * Rough token estimation (4 chars ≈ 1 token)
 */
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

/**
 * Get all sessions with metadata
 */
function getAllSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) {
        return [];
    }
    
    return fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => {
            const filePath = path.join(SESSIONS_DIR, f);
            const stat = fs.statSync(filePath);
            const sessionId = f.replace('.jsonl', '');
            
            // Quick parse to get metadata
            const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
            let metadata = {};
            try {
                metadata = JSON.parse(firstLine);
            } catch (e) {
                // Ignore parse errors
            }
            
            return {
                id: sessionId,
                file: f,
                size: stat.size,
                created: metadata.timestamp || stat.birthtime,
                modified: stat.mtime,
                cwd: metadata.cwd
            };
        })
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

/**
 * Get current context health for active session
 */
function getContextHealth() {
    const activeSession = getActiveSession();
    if (!activeSession) {
        return { error: 'No active session found' };
    }
    
    const events = parseSession(activeSession.path);
    const breakdown = getContextBreakdown(events);
    
    // Estimate context limit (default 1M for Claude Sonnet 4)
    const contextLimit = 1000000;
    const currentTokens = breakdown.inputTokens + breakdown.outputTokens;
    const percentage = (currentTokens / contextLimit * 100).toFixed(1);
    
    // Determine health level
    let health = 'healthy';
    if (percentage >= 95) health = 'critical';
    else if (percentage >= 90) health = 'warning';
    else if (percentage >= 80) health = 'caution';
    
    return {
        sessionId: breakdown.sessionId,
        modelId: breakdown.modelId,
        lastUpdate: breakdown.lastUpdate,
        tokens: {
            current: currentTokens,
            limit: contextLimit,
            percentage: parseFloat(percentage),
            remaining: contextLimit - currentTokens
        },
        breakdown: {
            input: breakdown.inputTokens,
            output: breakdown.outputTokens,
            cacheRead: breakdown.cacheReadTokens,
            cacheWrite: breakdown.cacheWriteTokens
        },
        byType: breakdown.byType,
        byRole: breakdown.byRole,
        health: health,
        totalWithCache: breakdown.totalTokens,
        messageCount: breakdown.messages.length
    };
}

module.exports = {
    getActiveSession,
    parseSession,
    getContextBreakdown,
    getAllSessions,
    getContextHealth
};

// CLI usage
if (require.main === module) {
    const health = getContextHealth();
    console.log(JSON.stringify(health, null, 2));
}
