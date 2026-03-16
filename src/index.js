/**
 * AOS Telemetry - Main Entry Point
 * OpenTelemetry-based context provenance tracking for AI agents
 */

const { AOSTracer } = require('./tracer');
const { ContextTracker } = require('./context-tracker');
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
  }

  /**
   * Track context composition for a turn (creates and auto-closes span)
   */
  trackTurnContext(turnId, contextFiles = null) {
    return this.contextTracker.trackTurn(turnId, contextFiles);
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
