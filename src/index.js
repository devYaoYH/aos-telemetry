/**
 * AOS Telemetry - Main Entry Point
 * OpenTelemetry-based context provenance tracking for AI agents
 */

const { AOSTracer } = require('./tracer');
const { ContextTracker } = require('./context-tracker');
const { ContextNarrator } = require('./context-narrator');
const { AutoCommit } = require('./auto-commit');
const fs = require('fs');
const path = require('path');

class AOS {
  constructor(options = {}) {
    // Load config if exists
    const configPath = path.join(__dirname, '..', 'config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    this.options = {
      agentName: options.agentName || config.agentName || 'openclaw-agent',
      workspaceDir: options.workspaceDir || config.workspaceDir || '/root/.openclaw/workspace',
      exporterType: options.exporterType || config.exporterType || 'file',
      exportPath: options.exportPath || config.exportPath || path.join(process.env.HOME, 'aos-telemetry', 'traces'),
      otlpEndpoint: options.otlpEndpoint || config.otlpEndpoint || 'http://localhost:4318/v1/traces',
      ...options
    };

    this.aosTracer = new AOSTracer({
      serviceName: 'aos-agent',
      agentName: this.options.agentName,
      exporterType: this.options.exporterType,
      otlpEndpoint: this.options.otlpEndpoint,
      exportPath: this.options.exportPath
    });

    this.tracer = this.aosTracer.initialize();
    this.contextTracker = new ContextTracker(this.tracer, this.options.workspaceDir);
    this.narrator = new ContextNarrator(this.options.workspaceDir);
    this.autoCommit = new AutoCommit(this.options.workspaceDir);
  }

  /**
   * Track context composition for a turn (creates and auto-closes span)
   */
  trackTurnContext(turnId, contextFiles = null, options = {}) {
    // Auto-commit workspace before tracking (if enabled)
    let commitResult = null;
    if (options.autoCommit !== false) {
      commitResult = this.autoCommit.commitBeforeTurn(turnId);
    }
    
    const result = this.contextTracker.trackTurn(turnId, contextFiles);
    
    // Generate human-readable narrative
    const contextComposition = this._buildContextComposition(contextFiles);
    const narrative = this.narrator.narrateContext(contextComposition);
    
    return {
      ...result,
      narrative,
      contextComposition,
      commitResult
    };
  }

  /**
   * Build context composition object for narrator
   */
  _buildContextComposition(contextFiles = null) {
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

    const composition = {
      total_tokens: 0,
      total_lines: 0,
      file_count: contextFiles.length
    };

    contextFiles.forEach(file => {
      const tokens = this.contextTracker.estimateTokens(file);
      const lines = this.contextTracker.countLines(file);
      const gitHash = this.contextTracker.getGitHash(file);

      composition[file] = { tokens, lines, git_hash: gitHash };
      composition.total_tokens += tokens;
      composition.total_lines += lines;
    });

    return composition;
  }

  /**
   * Track a tool execution (creates and auto-closes span)
   */
  trackToolExecution(turnId, toolName, options = {}) {
    return this.contextTracker.trackTool(turnId, toolName, options);
  }

  /**
   * Record turn completion metadata
   */
  recordTurnCompletion(turnId, options = {}) {
    const span = this.tracer.startSpan('turn.complete', {
      attributes: {
        'turn.id': turnId,
        'turn.total_cost': options.totalCost || 0,
        'turn.duration_ms': options.durationMs || 0,
      }
    });

    if (options.error) {
      span.setStatus({ code: 2, message: options.error });
    } else {
      span.setStatus({ code: 1 });
    }

    span.end();
    return { turnId, ...options };
  }

  /**
   * Shutdown telemetry
   */
  async shutdown() {
    await this.aosTracer.shutdown();
  }
}

module.exports = { AOS };
