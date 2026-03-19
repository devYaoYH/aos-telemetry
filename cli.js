#!/usr/bin/env node
/**
 * AOS CLI - Command-line interface for OpenTelemetry-based agent telemetry
 */

const { AOS } = require('./src/index');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0];

const STATE_FILE = path.join(process.env.HOME, 'aos-telemetry', '.turn-state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    // Ignore
  }
  return null;
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

function clearState() {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

if (!command) {
  console.log(`
AOS Telemetry CLI (OpenTelemetry-based)

Usage:
  aos start-turn <turn-id> [files...]       Start tracking a turn
  aos track-tool <tool> [options]           Track a tool call
  aos end-turn [--cost <amount>]            End current turn
  aos query traces [--limit N]              Query recent traces
  aos context-health                        Check context usage & warnings
  
Examples:
  aos start-turn turn-1
  aos track-tool exec --duration 1234 --cost 0.0123 --model sonnet
  aos end-turn --cost 0.05
  aos context-health
  `);
  process.exit(0);
}

async function main() {
  const aos = new AOS();

  try {
    switch (command) {
      case 'start-turn': {
        const turnId = args[1] || `turn-${Date.now()}`;
        const contextFiles = args.slice(2);
        
        const result = aos.trackTurnContext(turnId, contextFiles.length > 0 ? contextFiles : null, {
          autoCommit: true
        });
        
        // Save turn state
        saveState({ 
          turnId, 
          startTime: Date.now(),
          totalTokens: result.totalTokens,
          commitHash: result.commitResult?.commitHash
        });
        
        console.log(`✅ Turn started: ${turnId}`);
        
        // Show commit status
        if (result.commitResult) {
          if (result.commitResult.committed) {
            console.log(`   📝 Auto-committed: ${result.commitResult.changes} changes → ${result.commitResult.commitHash.substring(0, 7)}`);
          } else if (result.commitResult.reason) {
            console.log(`   📝 No commit: ${result.commitResult.reason}`);
          }
        }
        
        console.log(`   Context: ${result.totalTokens} tokens, ${result.fileCount} files\n`);
        
        // Show human-readable narrative
        if (result.narrative) {
          console.log(result.narrative);
        }
        break;
      }

      case 'track-tool': {
        const state = loadState();
        if (!state) {
          console.error('❌ No active turn. Run "aos start-turn" first.');
          process.exit(1);
        }

        const toolName = args[1];
        if (!toolName) {
          console.error('❌ Tool name required');
          process.exit(1);
        }

        const options = {};
        for (let i = 2; i < args.length; i += 2) {
          const key = args[i].replace('--', '');
          const value = args[i + 1];
          
          if (key === 'duration') options.durationMs = parseInt(value);
          else if (key === 'cost') options.cost = parseFloat(value);
          else if (key === 'model') options.model = value;
          else if (key === 'status') options.status = value;
          else if (key === 'tokens-in') options.tokensInput = parseInt(value);
          else if (key === 'tokens-out') options.tokensOutput = parseInt(value);
        }

        aos.trackToolExecution(state.turnId, toolName, options);
        
        console.log(`✅ Tool logged: ${toolName} (${options.status || 'success'}, $${options.cost || 0})`);
        break;
      }

      case 'end-turn': {
        const state = loadState();
        if (!state) {
          console.error('❌ No active turn to end.');
          process.exit(1);
        }

        const totalCost = parseFloat(args.find((a, i) => args[i - 1] === '--cost')) || 0;
        const duration = Date.now() - state.startTime;

        // Record turn completion as an event
        aos.recordTurnCompletion(state.turnId, { totalCost, durationMs: duration });
        
        clearState();
        
        console.log(`✅ Turn ended: ${state.turnId}`);
        console.log(`   Duration: ${duration}ms, Cost: $${totalCost}`);
        break;
      }

      case 'query': {
        const subcommand = args[1];
        if (subcommand === 'traces') {
          const tracesDir = path.join(process.env.HOME, 'aos-telemetry', 'traces');
          
          if (!fs.existsSync(tracesDir)) {
            console.log('No traces found yet');
            break;
          }

          const files = fs.readdirSync(tracesDir).filter(f => f.endsWith('.jsonl')).sort().reverse();
          const limit = parseInt(args.find((a, i) => args[i - 1] === '--limit')) || 5;

          console.log(`📊 Recent traces (${limit} most recent files):\n`);
          files.slice(0, limit).forEach(file => {
            const content = fs.readFileSync(path.join(tracesDir, file), 'utf8');
            const traces = content.trim().split('\n').map(line => JSON.parse(line));
            
            console.log(`📁 ${file} (${traces.length} spans)`);
            traces.forEach(trace => {
              const turnId = trace.attributes?.['turn.id'] || 'unknown';
              const cost = trace.attributes?.['turn.total_cost'] || trace.attributes?.['tool.cost'] || 0;
              const tokens = trace.attributes?.['context.total_tokens'] || 
                            trace.attributes?.['tool.tokens.total'] || 0;
              console.log(`  • ${trace.name} [${turnId}] - ${tokens} tokens, $${cost}`);
            });
            console.log('');
          });
        }
        break;
      }

      case 'context-health': {
        // Load context monitor state if exists
        const contextStateFile = path.join(process.env.HOME, 'aos-telemetry', '.context-state.json');
        const { ContextMonitor } = require('./src/context-monitor');
        const monitor = new ContextMonitor();
        
        if (fs.existsSync(contextStateFile)) {
          const state = JSON.parse(fs.readFileSync(contextStateFile, 'utf8'));
          monitor.currentTurnTokens = state.currentTurnTokens || 0;
          monitor.lifetimeTokens = state.lifetimeTokens || 0;
          monitor.contextSources = state.contextSources || monitor.contextSources;
        }
        
        const health = monitor.getHealthStatus();
        
        console.log('📊 Context Health Status\n');
        
        // Current turn
        const currentPct = (health.current.percentage * 100).toFixed(1);
        const healthIcon = health.health === 'healthy' ? '✅' : 
                          health.health === 'caution' ? '⚠️' :
                          health.health === 'warning' ? '🟠' : '🔴';
        
        console.log(`${healthIcon} Current Turn: ${currentPct}% (${health.current.tokens.toLocaleString()} / ${health.current.limit.toLocaleString()} tokens)`);
        console.log(`   Remaining: ${health.current.remaining.toLocaleString()} tokens`);
        console.log(`   Health: ${health.health.toUpperCase()}\n`);
        
        // Lifetime
        console.log(`📈 Lifetime: ${health.lifetime.tokens.toLocaleString()} tokens across ~${health.lifetime.turns} turns`);
        console.log(`   Session duration: ${Math.round(health.sessionDuration / 1000 / 60)} minutes\n`);
        
        // Top sources
        console.log(`📂 Context Sources:`);
        health.topSources.forEach(source => {
          if (source.tokens > 0) {
            const pct = ((source.tokens / health.current.tokens) * 100).toFixed(1);
            console.log(`   ${source.name.padEnd(15)}: ${source.tokens.toLocaleString().padStart(8)} tokens (${pct}%)`);
          }
        });
        
        // Warnings
        if (health.warnings.length > 0) {
          console.log(`\n⚠️  Active Warnings:`);
          health.warnings.forEach(threshold => {
            console.log(`   - ${(threshold * 100).toFixed(0)}% threshold crossed`);
          });
        }
        
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }

    await aos.shutdown();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
