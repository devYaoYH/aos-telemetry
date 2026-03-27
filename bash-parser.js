#!/usr/bin/env node
/**
 * bash-parser.js - Parse bash command chains for proper cost attribution
 * 
 * Handles: &&, ||, ;, | operators
 * Splits compound commands into individual operations
 * Attributes cost proportionally based on output/complexity
 */

function parseBashChain(command) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    let inHeredoc = false;
    let heredocDelim = null;
    
    // Simple state machine for parsing
    for (let i = 0; i < command.length; i++) {
        const char = command[i];
        const next = command[i + 1];
        
        // Handle quotes
        if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
            current += char;
            continue;
        }
        
        if (char === quoteChar && inQuotes) {
            inQuotes = false;
            quoteChar = null;
            current += char;
            continue;
        }
        
        // Handle heredocs (<<)
        if (char === '<' && next === '<' && !inQuotes) {
            inHeredoc = true;
            current += command.slice(i, i + 2);
            i++; // Skip next <
            
            // Find delimiter
            let delimStart = i + 1;
            while (delimStart < command.length && command[delimStart] === ' ') delimStart++;
            let delimEnd = delimStart;
            while (delimEnd < command.length && !/[\s\n]/.test(command[delimEnd])) delimEnd++;
            
            heredocDelim = command.slice(delimStart, delimEnd).replace(/['"]/g, '');
            current += command.slice(i + 1, delimEnd);
            i = delimEnd - 1;
            continue;
        }
        
        // Check for heredoc end
        if (inHeredoc && current.includes(heredocDelim + '\n')) {
            inHeredoc = false;
            heredocDelim = null;
        }
        
        // Handle operators (if not in quotes or heredoc)
        if (!inQuotes && !inHeredoc) {
            // && operator
            if (char === '&' && next === '&') {
                if (current.trim()) {
                    parts.push({ operator: null, command: current.trim() });
                }
                parts.push({ operator: '&&', command: null });
                current = '';
                i++; // Skip next &
                continue;
            }
            
            // || operator
            if (char === '|' && next === '|') {
                if (current.trim()) {
                    parts.push({ operator: null, command: current.trim() });
                }
                parts.push({ operator: '||', command: null });
                current = '';
                i++; // Skip next |
                continue;
            }
            
            // | pipe operator
            if (char === '|' && next !== '|') {
                if (current.trim()) {
                    parts.push({ operator: null, command: current.trim() });
                }
                parts.push({ operator: '|', command: null });
                current = '';
                continue;
            }
            
            // ; separator
            if (char === ';') {
                if (current.trim()) {
                    parts.push({ operator: null, command: current.trim() });
                }
                parts.push({ operator: ';', command: null });
                current = '';
                continue;
            }
        }
        
        current += char;
    }
    
    // Add remaining command
    if (current.trim()) {
        parts.push({ operator: null, command: current.trim() });
    }
    
    // Build final chain structure
    const chain = [];
    let lastOp = null;
    
    for (const part of parts) {
        if (part.command) {
            chain.push({
                operator: lastOp,
                command: part.command,
                type: getCommandType(part.command)
            });
            lastOp = null;
        } else {
            lastOp = part.operator;
        }
    }
    
    return chain;
}

function getCommandType(command) {
    // Extract first word (command name)
    const match = command.match(/^(\S+)/);
    if (!match) return 'unknown';
    
    const cmd = match[1];
    
    // Strip path
    const baseName = cmd.split('/').pop();
    
    // Common commands
    const knownCommands = [
        'cd', 'ls', 'cat', 'grep', 'find', 'sed', 'awk',
        'git', 'npm', 'node', 'python3', 'python', 'ruby',
        'curl', 'wget', 'ssh', 'scp', 'rsync',
        'mkdir', 'rm', 'cp', 'mv', 'chmod', 'chown',
        'systemctl', 'service', 'docker', 'kubectl',
        'echo', 'printf', 'read', 'test', 'true', 'false',
        'sqlite3', 'mysql', 'psql', 'mongo',
        'tar', 'gzip', 'unzip', 'zip',
        'head', 'tail', 'sort', 'uniq', 'wc',
        'ps', 'top', 'kill', 'killall',
        'date', 'sleep', 'timeout', 'nohup',
        'source', 'export', 'alias'
    ];
    
    return knownCommands.includes(baseName) ? baseName : 'script';
}

function attributeCost(chain, totalCost, outputSizes) {
    /**
     * Attribute cost across chain commands
     * 
     * Rules:
     * 1. cd gets 0 cost (just changes directory)
     * 2. Pipes: last command gets output cost, others split execution cost
     * 3. &&/||/;: split cost by command complexity (simple heuristic: output size)
     */
    
    const costAttribution = chain.map(c => ({
        ...c,
        cost: 0,
        reasoning: ''
    }));
    
    if (chain.length === 0) return [];
    if (chain.length === 1) {
        costAttribution[0].cost = totalCost;
        costAttribution[0].reasoning = 'single command';
        return costAttribution;
    }
    
    // Find cd commands (always first in chain)
    const cdIndices = chain.map((c, i) => c.type === 'cd' ? i : -1).filter(i => i >= 0);
    
    // cd gets minimal cost
    cdIndices.forEach(i => {
        costAttribution[i].cost = 0.0001; // Negligible
        costAttribution[i].reasoning = 'directory change (minimal cost)';
    });
    
    // Remaining cost to distribute
    let remainingCost = totalCost - (cdIndices.length * 0.0001);
    const nonCdCommands = costAttribution.filter((_, i) => !cdIndices.includes(i));
    
    if (nonCdCommands.length === 0) {
        // Only cd commands (shouldn't happen)
        return costAttribution;
    }
    
    // Check for pipe chains
    const hasPipes = chain.some(c => c.operator === '|');
    
    if (hasPipes) {
        // Pipe chain: attribute most cost to final command (produces output)
        const lastNonCd = costAttribution.length - 1;
        
        // 70% to final command, 30% split among others
        costAttribution[lastNonCd].cost += remainingCost * 0.7;
        costAttribution[lastNonCd].reasoning = 'final command in pipe (generates output)';
        
        const otherCost = (remainingCost * 0.3) / Math.max(1, nonCdCommands.length - 1);
        nonCdCommands.slice(0, -1).forEach(cmd => {
            cmd.cost += otherCost;
            cmd.reasoning = 'intermediate pipe command';
        });
    } else {
        // Sequential (&&/||/;): split evenly among non-cd commands
        const perCommand = remainingCost / nonCdCommands.length;
        nonCdCommands.forEach(cmd => {
            cmd.cost += perCommand;
            cmd.reasoning = 'sequential command';
        });
    }
    
    return costAttribution;
}

// CLI usage
if (require.main === module) {
    const command = process.argv[2] || 'cd ~/test && python3 script.py | grep output';
    const totalCost = parseFloat(process.argv[3]) || 0.05;
    
    console.log('Original command:', command);
    console.log('Total cost:', `$${totalCost.toFixed(4)}`);
    console.log('\nParsed chain:');
    
    const chain = parseBashChain(command);
    const attributed = attributeCost(chain, totalCost, []);
    
    attributed.forEach((part, i) => {
        const op = part.operator || 'START';
        console.log(`  ${i + 1}. [${op.padEnd(5)}] ${part.type.padEnd(12)} $${part.cost.toFixed(4)} - ${part.command.substring(0, 60)}`);
        console.log(`      ${' '.repeat(22)} (${part.reasoning})`);
    });
}

module.exports = { parseBashChain, getCommandType, attributeCost };
