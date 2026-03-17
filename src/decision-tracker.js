/**
 * AOS Decision Tracker - Link decisions to context sources
 * 
 * Goal: "I used X from MEMORY.md to decide Y"
 * Enables understanding how context influences agent decisions
 */

const fs = require('fs');
const path = require('path');

class DecisionTracker {
  constructor(workspaceDir = '/root/.openclaw/workspace') {
    this.workspaceDir = workspaceDir;
    this.decisions = []; // Track decisions during a turn
  }

  /**
   * Record a decision and its context sources
   * 
   * @param {string} decision - What was decided (e.g., "Post to m/agent-infra")
   * @param {Array} contextSources - Which files/sections influenced this
   * @param {Object} metadata - Additional context (timing, alternatives considered, etc.)
   */
  recordDecision(decision, contextSources = [], metadata = {}) {
    const record = {
      timestamp: new Date().toISOString(),
      decision,
      contextSources,
      metadata
    };

    this.decisions.push(record);
    return record;
  }

  /**
   * Link a decision to specific content from context files
   * 
   * Example:
   * {
   *   decision: "Built auto-commit feature",
   *   sources: [
   *     {
   *       file: "AGENTS.md",
   *       reason: "Following directive: 'Take time to reflect and build tools'",
   *       snippet: "build tools to operate better, more effectively"
   *     },
   *     {
   *       file: "MEMORY.md", 
   *       reason: "Learned from past: Git commits were manual",
   *       snippet: "manually committed - defeats the purpose of automation"
   *     }
   *   ]
   * }
   */
  linkDecisionToContext(decision, sources) {
    return this.recordDecision(decision, sources, {
      type: 'context-linked'
    });
  }

  /**
   * Generate human-readable provenance narrative
   */
  narrateDecision(decision) {
    const lines = [];
    
    lines.push(`**Decision:** ${decision.decision}`);
    
    if (decision.contextSources && decision.contextSources.length > 0) {
      lines.push(`**Based on:**`);
      
      decision.contextSources.forEach(source => {
        lines.push(`- **${source.file}**: ${source.reason}`);
        if (source.snippet) {
          lines.push(`  > "${source.snippet}"`);
        }
      });
    }

    if (decision.metadata.alternatives) {
      lines.push(`\n**Alternatives considered:** ${decision.metadata.alternatives.join(', ')}`);
    }

    if (decision.metadata.confidence) {
      lines.push(`**Confidence:** ${decision.metadata.confidence}`);
    }

    return lines.join('\n');
  }

  /**
   * Get all decisions for current turn
   */
  getTurnDecisions() {
    return this.decisions;
  }

  /**
   * Clear decisions (call at end of turn)
   */
  clearDecisions() {
    this.decisions = [];
  }

  /**
   * Export decisions as OpenTelemetry span events
   */
  exportAsSpanEvents(span) {
    if (!span) return;

    this.decisions.forEach((decision, index) => {
      span.addEvent(`decision.${index}`, {
        'decision.text': decision.decision,
        'decision.sources': decision.contextSources.map(s => s.file).join(', '),
        'decision.timestamp': decision.timestamp
      });
    });
  }

  /**
   * Suggest which context files might be relevant for a decision type
   * 
   * This helps agents explicitly link decisions to context sources
   */
  suggestRelevantContext(decisionType) {
    const suggestions = {
      'communication': ['SOUL.md', 'USER.md', 'AGENTS.md'],
      'tool-use': ['TOOLS.md', 'AGENTS.md'],
      'memory-update': ['MEMORY.md', 'memory/YYYY-MM-DD.md'],
      'task-planning': ['HEARTBEAT.md', 'AGENTS.md', 'MEMORY.md'],
      'identity': ['SOUL.md', 'IDENTITY.md', 'USER.md'],
      'default': ['MEMORY.md', 'AGENTS.md']
    };

    return suggestions[decisionType] || suggestions.default;
  }
}

module.exports = { DecisionTracker };
