#!/usr/bin/env node
/**
 * session-tracker.js v2 - Improved message grouping
 * Groups thinking+text and toolCall+toolResult for better display
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSIONS_DIR = path.join(os.homedir(), '.openclaw/agents/main/sessions');

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

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

/**
 * Parse content parts from a message
 */
function parseMessageContent(msg) {
    const parts = {
        thinking: null,
        text: null,
        toolCalls: [],
        raw: []
    };
    
    if (!msg.content) return parts;
    
    if (Array.isArray(msg.content)) {
        msg.content.forEach(part => {
            parts.raw.push(part);
            
            if (part.type === 'thinking' && part.thinking) {
                parts.thinking = part.thinking;
            } else if (part.type === 'text' && part.text) {
                parts.text = (parts.text || '') + part.text;
            } else if ((part.type === 'toolCall' || part.type === 'tool_use') && part.name) {
                parts.toolCalls.push({
                    id: part.id,
                    name: part.name,
                    arguments: part.arguments || part.input || {}
                });
            }
        });
    } else if (typeof msg.content === 'string') {
        parts.text = msg.content;
    }
    
    return parts;
}

/**
 * Create display rows with proper grouping
 */
function createDisplayRows(events) {
    const rows = [];
    const messageEvents = events.filter(e => e.type === 'message' && e.message);
    
    let i = 0;
    while (i < messageEvents.length) {
        const event = messageEvents[i];
        const msg = event.message;
        const usage = msg.usage || {};
        
        // User messages: simple standalone row
        if (msg.role === 'user') {
            const parts = parseMessageContent(msg);
            rows.push({
                rowType: 'user',
                id: event.id,
                timestamp: event.timestamp,
                role: 'user',
                inputTokens: usage.input || 0,
                outputTokens: usage.output || 0,
                text: parts.text,
                rawEvent: event
            });
            i++;
            continue;
        }
        
        // System messages: standalone
        if (msg.role === 'system') {
            const parts = parseMessageContent(msg);
            rows.push({
                rowType: 'system',
                id: event.id,
                timestamp: event.timestamp,
                role: 'system',
                inputTokens: usage.input || 0,
                outputTokens: usage.output || 0,
                text: parts.text,
                rawEvent: event
            });
            i++;
            continue;
        }
        
        // Assistant messages: may have thinking+text and/or toolCalls
        if (msg.role === 'assistant') {
            const parts = parseMessageContent(msg);
            
            const hasThinking = parts.thinking && parts.thinking.trim().length > 0;
            const hasText = parts.text && parts.text.trim().length > 0;
            const hasTools = parts.toolCalls.length > 0;
            
            // Decide whether to create an assistant row
            // - If has tools AND (thinking OR text): create assistant row for thinking+text
            // - If no tools AND (thinking OR text): create assistant row
            // Exception: if ONLY has thinking+tools (no text), put thinking in toolCall row instead
            
            let createAssistantRow = false;
            if (!hasTools && (hasThinking || hasText)) {
                // No tools: always create assistant row
                createAssistantRow = true;
            } else if (hasTools && hasText) {
                // Has tools + text: create assistant row for thinking+text
                createAssistantRow = true;
            }
            // Note: if only thinking+tools (no text), skip assistant row, show thinking in toolCall
            
            if (createAssistantRow) {
                rows.push({
                    rowType: 'assistant',
                    id: event.id,
                    timestamp: event.timestamp,
                    role: 'assistant',
                    inputTokens: usage.input || 0,
                    outputTokens: usage.output || 0,
                    thinking: parts.thinking,
                    text: parts.text,
                    thinkingOnly: hasThinking && !hasText, // Flag for rendering
                    rawEvent: event
                });
            }
            
            // If there are toolCalls, create individual toolCall rows paired with results
            if (parts.toolCalls.length > 0) {
                let j = i + 1;
                
                // For each toolCall, find its corresponding toolResult
                parts.toolCalls.forEach((toolCall, toolIdx) => {
                    // Find the matching toolResult
                    let toolResult = null;
                    
                    // Look ahead for toolResults
                    for (let k = j; k < messageEvents.length && messageEvents[k].message.role === 'toolResult'; k++) {
                        const resultEvent = messageEvents[k];
                        const resultMsg = resultEvent.message;
                        
                        // Match by toolCallId
                        if (resultMsg.toolCallId === toolCall.id) {
                            const resultParts = parseMessageContent(resultMsg);
                            toolResult = {
                                id: resultEvent.id,
                                timestamp: resultEvent.timestamp,
                                toolName: resultMsg.toolName,
                                text: resultParts.text,
                                rawEvent: resultEvent
                            };
                            break;
                        }
                    }
                    
                    // Create a toolCall row
                    // If only thinking+tools (no text), include thinking here
                    const includeThinking = hasThinking && !hasText;
                    
                    rows.push({
                        rowType: 'toolCall',
                        id: `${event.id}_tool${toolIdx}`,
                        timestamp: event.timestamp, // Use assistant message timestamp
                        role: 'toolCall', // Changed from 'assistant'
                        inputTokens: 0, // Tokens tracked on parent assistant row
                        outputTokens: 0,
                        thinking: includeThinking ? parts.thinking : null,
                        toolCall: toolCall, // Single tool call
                        toolResult: toolResult, // Matched result (or null)
                        rawEvent: event
                    });
                });
                
                // Skip all toolResult messages we've processed
                while (j < messageEvents.length && messageEvents[j].message.role === 'toolResult') {
                    j++;
                }
                i = j;
            } else {
                i++;
            }
            continue;
        }
        
        // Skip standalone toolResult (shouldn't happen, but handle gracefully)
        if (msg.role === 'toolResult') {
            i++;
            continue;
        }
        
        i++;
    }
    
    return rows;
}

/**
 * Get context breakdown with grouped display rows
 */
function getContextBreakdown(events) {
    const breakdown = {
        rows: [],
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
    
    // Accumulate token stats
    events.filter(e => e.type === 'message' && e.message).forEach(event => {
        const msg = event.message;
        const usage = msg.usage || {};
        
        if (usage.input) breakdown.inputTokens += usage.input;
        if (usage.output) breakdown.outputTokens += usage.output;
        if (usage.cacheRead) breakdown.cacheReadTokens += usage.cacheRead;
        if (usage.cacheWrite) breakdown.cacheWriteTokens += usage.cacheWrite;
        
        const contextTokens = (usage.input || 0) + (usage.output || 0);
        breakdown.totalTokens += (usage.totalTokens || contextTokens);
        
        if (msg.role && breakdown.byRole[msg.role] !== undefined) {
            breakdown.byRole[msg.role] += contextTokens;
        }
        
        // Track by type
        if (msg.content && Array.isArray(msg.content)) {
            msg.content.forEach(part => {
                if (part.type === 'thinking') {
                    breakdown.byType.thinking += estimateTokens(part.thinking || '');
                } else if (part.type === 'toolCall' || part.type === 'tool_use' || part.type === 'tool_result') {
                    breakdown.byType.tools += estimateTokens(JSON.stringify(part));
                } else if (part.type === 'text') {
                    breakdown.byType.conversation += estimateTokens(part.text || '');
                }
            });
        }
    });
    
    // Create grouped display rows
    breakdown.rows = createDisplayRows(events);
    
    // Get last update time
    if (events.length > 0) {
        breakdown.lastUpdate = events[events.length - 1].timestamp;
    }
    
    return breakdown;
}

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
            
            const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
            let metadata = {};
            try {
                metadata = JSON.parse(firstLine);
            } catch (e) {}
            
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

function getContextHealth() {
    const activeSession = getActiveSession();
    if (!activeSession) {
        return { error: 'No active session found' };
    }
    
    const events = parseSession(activeSession.path);
    const breakdown = getContextBreakdown(events);
    
    const contextLimit = 1000000;
    const currentTokens = breakdown.inputTokens + breakdown.outputTokens;
    const percentage = (currentTokens / contextLimit * 100).toFixed(1);
    
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
        messageCount: breakdown.rows.length
    };
}

module.exports = {
    getActiveSession,
    parseSession,
    getContextBreakdown,
    getAllSessions,
    getContextHealth
};

if (require.main === module) {
    const health = getContextHealth();
    console.log(JSON.stringify(health, null, 2));
}
