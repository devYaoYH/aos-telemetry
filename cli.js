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
  
Examples:
  aos start-turn turn-1
  aos track-tool exec --duration 1234 --cost 0.0123 --model sonnet
  aos end-turn --cost 0.05
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
        
        const result = aos.trackTurnContext(turnId, contextFiles.length > 0 ? contextFiles : null);
        
        // Save turn state
        saveState({ 
          turnId, 
          startTime: Date.now(),
          totalTokens: result.totalTokens 
        });
        
        console.log(`✅ Turn started: ${turnId}`);
        console.log(`   Context: ${result.totalTokens} tokens, ${result.fileCount} files`);
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
