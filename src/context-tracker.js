/**
 * AOS Context Tracker - Workspace context composition instrumentation
 */

const { SpanKind, SpanStatusCode } = require('@opentelemetry/api');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ContextTracker {
  constructor(tracer, workspaceDir = '/root/.openclaw/workspace') {
    this.tracer = tracer;
    this.workspaceDir = workspaceDir;
  }

  /**
   * Estimate token count (rough: 4 chars = 1 token)
   */
  estimateTokens(filepath) {
    try {
      const fullPath = path.join(this.workspaceDir, filepath);
      if (!fs.existsSync(fullPath)) return 0;
      const chars = fs.statSync(fullPath).size;
      return Math.ceil(chars / 4);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Count lines in file
   */
  countLines(filepath) {
    try {
      const fullPath = path.join(this.workspaceDir, filepath);
      if (!fs.existsSync(fullPath)) return 0;
      const content = fs.readFileSync(fullPath, 'utf8');
      return content.split('\n').length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get git hash for file
   */
  getGitHash(filepath) {
    try {
      const cmd = `cd ${this.workspaceDir} && git log -1 --format=%H -- ${filepath}`;
      return execSync(cmd, { encoding: 'utf8' }).trim() || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get workspace git hash
   */
  getWorkspaceHash() {
    try {
      const cmd = `cd ${this.workspaceDir} && git rev-parse HEAD`;
      return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Track context composition for a turn (auto-closing span)
   */
  trackTurn(turnId, contextFiles = null) {
    // Default context files
    if (!contextFiles) {
      contextFiles = [
        'MEMORY.md',
        'SOUL.md', 
        'AGENTS.md',
        'TOOLS.md',
        'HEARTBEAT.md',
        'USER.md',
        'IDENTITY.md',
        `memory/${new Date().toISOString().split('T')[0]}.md`
      ];
    }

    const span = this.tracer.startSpan('agent.turn', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'turn.id': turnId,
        'workspace.hash': this.getWorkspaceHash(),
        'workspace.dir': this.workspaceDir,
      }
    });

    let totalTokens = 0;
    let totalLines = 0;

    // Track each file in context
    contextFiles.forEach(file => {
      const tokens = this.estimateTokens(file);
      const lines = this.countLines(file);
      const gitHash = this.getGitHash(file);

      totalTokens += tokens;
      totalLines += lines;

      span.setAttributes({
        [`context.file.${file.replace(/[\/\.]/g, '_')}.tokens`]: tokens,
        [`context.file.${file.replace(/[\/\.]/g, '_')}.lines`]: lines,
        [`context.file.${file.replace(/[\/\.]/g, '_')}.git_hash`]: gitHash,
      });
    });

    span.setAttributes({
      'context.total_tokens': totalTokens,
      'context.total_lines': totalLines,
      'context.file_count': contextFiles.length,
    });

    // Auto-end span immediately (context is captured at turn start)
    span.setStatus({ code: 1 });
    span.end();

    return { turnId, totalTokens, totalLines, fileCount: contextFiles.length };
  }

  /**
   * Track tool execution as standalone span
   */
  trackTool(turnId, toolName, options = {}) {
    const span = this.tracer.startSpan(`tool.${toolName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'turn.id': turnId,
        'tool.name': toolName,
        'tool.status': options.status || 'success',
        'tool.model': options.model || 'unknown',
        'tool.cost': options.cost || 0,
        'tool.tokens.input': options.tokensInput || 0,
        'tool.tokens.output': options.tokensOutput || 0,
        'tool.tokens.total': (options.tokensInput || 0) + (options.tokensOutput || 0),
      }
    });

    // Set span duration if provided
    if (options.durationMs) {
      // For now, end immediately - OpenTelemetry will record accurate timestamps
      // In real usage, the span would be kept open and ended when tool completes
    }

    if (options.error) {
      span.setStatus({ code: 2, message: options.error });
    } else {
      span.setStatus({ code: 1 });
    }
    
    span.end();

    return { turnId, toolName, ...options };
  }
}

module.exports = { ContextTracker };
