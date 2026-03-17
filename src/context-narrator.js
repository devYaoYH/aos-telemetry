/**
 * AOS Context Narrator - Human-readable context explanations
 * 
 * Goal: Make context window composition understandable to humans, not just telemetry.
 * Transform "11,478 tokens" → "Here's what I was thinking about when I made that decision"
 */

const fs = require('fs');
const path = require('path');

class ContextNarrator {
  constructor(workspaceDir = '/root/.openclaw/workspace') {
    this.workspaceDir = workspaceDir;
  }

  /**
   * Generate human-readable summary of context composition
   */
  narrateContext(contextComposition) {
    const narratives = [];
    
    // Sort files by token count (most significant first)
    const files = Object.entries(contextComposition)
      .filter(([name, _]) => name !== 'total_tokens' && name !== 'total_lines' && name !== 'file_count')
      .map(([name, data]) => ({
        name,
        tokens: data.tokens || 0,
        lines: data.lines || 0,
        gitHash: data.git_hash || 'unknown'
      }))
      .sort((a, b) => b.tokens - a.tokens);

    // Narrative structure
    narratives.push("**What I'm thinking about:**\n");

    // Top context files (>5% of total)
    const totalTokens = contextComposition.total_tokens || files.reduce((sum, f) => sum + f.tokens, 0);
    const significantFiles = files.filter(f => f.tokens > totalTokens * 0.05);

    significantFiles.forEach(file => {
      const percentage = ((file.tokens / totalTokens) * 100).toFixed(1);
      const narrative = this.narrateFile(file.name, file.tokens, file.lines);
      narratives.push(`- **${file.name}** (${percentage}% of context, ${file.tokens} tokens):`);
      narratives.push(`  ${narrative}`);
    });

    // Smaller files grouped
    const smallFiles = files.filter(f => f.tokens <= totalTokens * 0.05);
    if (smallFiles.length > 0) {
      const smallTokens = smallFiles.reduce((sum, f) => sum + f.tokens, 0);
      const percentage = ((smallTokens / totalTokens) * 100).toFixed(1);
      narratives.push(`\n- **Supporting context** (${percentage}%, ${smallFiles.length} files):`);
      narratives.push(`  ${smallFiles.map(f => f.name).join(', ')}`);
    }

    narratives.push(`\n**Total:** ${totalTokens.toLocaleString()} tokens across ${files.length} files`);

    return narratives.join('\n');
  }

  /**
   * Generate narrative for specific file
   */
  narrateFile(filename, tokens, lines) {
    const fileType = this.identifyFileType(filename);
    
    switch (fileType) {
      case 'memory':
        return this.narrateMemory(filename, tokens, lines);
      case 'soul':
        return "My personality, values, and behavioral guidelines";
      case 'agents':
        return "Instructions for how I should operate and behave";
      case 'tools':
        return "Notes about available tools, skills, and how to use them";
      case 'heartbeat':
        return "My scheduled tasks and proactive work checklist";
      case 'user':
        return "Information about you (preferences, context, relationship)";
      case 'identity':
        return "My name, role, and self-concept";
      case 'daily':
        return this.narrateDaily(filename, tokens, lines);
      default:
        return `Context from ${filename}`;
    }
  }

  /**
   * Identify file type
   */
  identifyFileType(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('memory.md')) return 'memory';
    if (lower.includes('soul.md')) return 'soul';
    if (lower.includes('agents.md')) return 'agents';
    if (lower.includes('tools.md')) return 'tools';
    if (lower.includes('heartbeat.md')) return 'heartbeat';
    if (lower.includes('user.md')) return 'user';
    if (lower.includes('identity.md')) return 'identity';
    if (lower.match(/memory\/\d{4}-\d{2}-\d{2}\.md/)) return 'daily';
    return 'other';
  }

  /**
   * Narrate MEMORY.md
   */
  narrateMemory(filename, tokens, lines) {
    // Try to extract recent topics from MEMORY.md
    try {
      const fullPath = path.join(this.workspaceDir, filename);
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Extract headers (markdown ##)
      const headers = content.match(/^##\s+(.+)$/gm) || [];
      const recentTopics = headers.slice(-5).map(h => h.replace(/^##\s+/, '')).join(', ');
      
      if (recentTopics) {
        return `Long-term memory: ${recentTopics}`;
      }
    } catch (error) {
      // Fallback
    }
    
    return "Long-term memory and learnings across sessions";
  }

  /**
   * Narrate daily memory file
   */
  narrateDaily(filename, tokens, lines) {
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const date = dateMatch[1];
      const today = new Date().toISOString().split('T')[0];
      
      if (date === today) {
        return "Today's work log and activities";
      } else {
        return `Work log from ${date}`;
      }
    }
    
    return "Daily work log";
  }

  /**
   * Generate decision provenance narrative
   * Links context to specific decisions/actions
   */
  narrateDecision(decision, contextUsed) {
    const narratives = [];
    
    narratives.push(`**Decision:** ${decision}`);
    narratives.push(`**Based on:**`);
    
    contextUsed.forEach(source => {
      narratives.push(`- ${source.file}: ${source.reason}`);
      if (source.snippet) {
        narratives.push(`  > "${source.snippet}"`);
      }
    });
    
    return narratives.join('\n');
  }

  /**
   * Extract key themes from context
   */
  extractThemes(contextComposition) {
    const themes = [];
    
    // Analyze file composition
    const hasMemory = Object.keys(contextComposition).some(k => k.includes('MEMORY'));
    const hasTools = Object.keys(contextComposition).some(k => k.includes('TOOLS'));
    const hasDaily = Object.keys(contextComposition).some(k => k.match(/\d{4}-\d{2}-\d{2}/));
    
    if (hasMemory) themes.push("Using long-term learnings");
    if (hasTools) themes.push("Aware of available capabilities");
    if (hasDaily) themes.push("Tracking recent work");
    
    return themes;
  }
}

module.exports = { ContextNarrator };
