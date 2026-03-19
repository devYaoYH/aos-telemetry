/**
 * AOS Context Monitor - Track context usage and provide warnings
 * Addresses: GitHub #48252 (wrong context %), #45794 (UI breakage at 100%)
 */

const api = require('@opentelemetry/api');

class ContextMonitor {
  constructor(options = {}) {
    this.contextLimit = options.contextLimit || 200000; // Default 200K tokens
    this.warningThresholds = options.warningThresholds || [0.8, 0.9, 0.95]; // 80%, 90%, 95%
    
    // Track both lifetime and current context
    this.lifetimeTokens = 0;
    this.currentTurnTokens = 0;
    this.sessionStartTime = Date.now();
    this.turnStartTime = Date.now();
    
    // Track warnings already fired (don't spam)
    this.warningsFired = new Set();
    
    // Context composition tracking
    this.contextSources = {
      workspace: 0,
      memory: 0,
      tools: 0,
      conversation: 0,
      other: 0
    };
  }

  /**
   * Start a new turn - resets current context tracking
   */
  startTurn() {
    this.currentTurnTokens = 0;
    this.turnStartTime = Date.now();
    this.warningsFired.clear(); // Reset warnings for new turn
    this.contextSources = {
      workspace: 0,
      memory: 0,
      tools: 0,
      conversation: 0,
      other: 0
    };
  }

  /**
   * Add tokens to current context
   * @param {number} tokens - Number of tokens consumed
   * @param {string} source - Source of tokens (workspace, memory, tools, conversation)
   */
  addTokens(tokens, source = 'other') {
    this.currentTurnTokens += tokens;
    this.lifetimeTokens += tokens;
    
    if (this.contextSources[source] !== undefined) {
      this.contextSources[source] += tokens;
    } else {
      this.contextSources.other += tokens;
    }

    // Check thresholds and fire warnings
    this.checkThresholds();
  }

  /**
   * Check if context usage has crossed warning thresholds
   */
  checkThresholds() {
    const currentPercentage = this.currentTurnTokens / this.contextLimit;
    
    for (const threshold of this.warningThresholds) {
      if (currentPercentage >= threshold && !this.warningsFired.has(threshold)) {
        this.fireWarning(threshold, currentPercentage);
        this.warningsFired.add(threshold);
      }
    }
  }

  /**
   * Fire a warning event (with OpenTelemetry span event)
   */
  fireWarning(threshold, actualPercentage) {
    const tracer = api.trace.getTracer('aos-telemetry');
    const span = tracer.startSpan('context.warning', {
      attributes: {
        'context.threshold': threshold,
        'context.actual': actualPercentage,
        'context.current_tokens': this.currentTurnTokens,
        'context.limit': this.contextLimit,
        'context.remaining': this.contextLimit - this.currentTurnTokens,
        'context.lifetime_tokens': this.lifetimeTokens
      }
    });

    const warning = {
      level: this.getWarningLevel(threshold),
      threshold: threshold,
      current: actualPercentage,
      currentTokens: this.currentTurnTokens,
      limit: this.contextLimit,
      remaining: this.contextLimit - this.currentTurnTokens,
      lifetimeTokens: this.lifetimeTokens,
      message: this.getWarningMessage(threshold, actualPercentage),
      recommendation: this.getRecommendation(threshold, actualPercentage),
      timestamp: Date.now()
    };

    span.addEvent('context_warning_fired', {
      'warning.level': warning.level,
      'warning.message': warning.message
    });

    span.end();

    return warning;
  }

  /**
   * Get warning level based on threshold
   */
  getWarningLevel(threshold) {
    if (threshold >= 0.95) return 'critical';
    if (threshold >= 0.9) return 'high';
    if (threshold >= 0.8) return 'medium';
    return 'low';
  }

  /**
   * Get human-readable warning message
   */
  getWarningMessage(threshold, actualPercentage) {
    const pct = Math.round(actualPercentage * 100);
    const remaining = this.contextLimit - this.currentTurnTokens;
    
    if (threshold >= 0.95) {
      return `CRITICAL: Context at ${pct}% (${remaining.toLocaleString()} tokens remaining). UI may break at 100%.`;
    } else if (threshold >= 0.9) {
      return `HIGH: Context at ${pct}% (${remaining.toLocaleString()} tokens remaining). Approaching limit.`;
    } else {
      return `MEDIUM: Context at ${pct}% (${remaining.toLocaleString()} tokens remaining).`;
    }
  }

  /**
   * Get actionable recommendation based on context state
   */
  getRecommendation(threshold, actualPercentage) {
    const topSources = this.getTopContextSources();
    
    if (threshold >= 0.95) {
      return `Immediate action required: Consider ending turn, clearing old sessions, or reducing ${topSources[0].name} context (${topSources[0].tokens.toLocaleString()} tokens).`;
    } else if (threshold >= 0.9) {
      return `Plan ahead: Next turn will be limited. Top consumers: ${topSources.map(s => `${s.name} (${s.tokens.toLocaleString()})`).join(', ')}.`;
    } else {
      return `Monitor context: Current usage healthy but track ${topSources[0].name} growth.`;
    }
  }

  /**
   * Get top context sources sorted by token count
   */
  getTopContextSources() {
    return Object.entries(this.contextSources)
      .map(([name, tokens]) => ({ name, tokens }))
      .sort((a, b) => b.tokens - a.tokens);
  }

  /**
   * Get current context health status
   */
  getHealthStatus() {
    const currentPercentage = this.currentTurnTokens / this.contextLimit;
    const lifetimePercentage = this.lifetimeTokens / this.contextLimit;
    
    return {
      current: {
        tokens: this.currentTurnTokens,
        percentage: currentPercentage,
        remaining: this.contextLimit - this.currentTurnTokens,
        limit: this.contextLimit
      },
      lifetime: {
        tokens: this.lifetimeTokens,
        percentage: lifetimePercentage,
        turns: this.getTurnCount()
      },
      sources: this.contextSources,
      topSources: this.getTopContextSources(),
      health: this.getHealthLevel(currentPercentage),
      warnings: Array.from(this.warningsFired),
      sessionDuration: Date.now() - this.sessionStartTime,
      turnDuration: Date.now() - this.turnStartTime
    };
  }

  /**
   * Get health level based on current percentage
   */
  getHealthLevel(percentage) {
    if (percentage >= 0.95) return 'critical';
    if (percentage >= 0.9) return 'warning';
    if (percentage >= 0.8) return 'caution';
    return 'healthy';
  }

  /**
   * Estimate turn count (rough approximation)
   */
  getTurnCount() {
    // Rough estimate: average turn is ~20K tokens
    return Math.floor(this.lifetimeTokens / 20000) || 1;
  }

  /**
   * Reset all tracking (new session)
   */
  reset() {
    this.lifetimeTokens = 0;
    this.currentTurnTokens = 0;
    this.sessionStartTime = Date.now();
    this.turnStartTime = Date.now();
    this.warningsFired.clear();
    this.contextSources = {
      workspace: 0,
      memory: 0,
      tools: 0,
      conversation: 0,
      other: 0
    };
  }
}

module.exports = { ContextMonitor };
