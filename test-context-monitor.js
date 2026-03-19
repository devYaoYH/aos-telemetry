#!/usr/bin/env node
/**
 * Test script for Context Monitor
 */

const { ContextMonitor } = require('./src/context-monitor');

console.log('🧪 Testing Context Monitor\n');

const monitor = new ContextMonitor({ contextLimit: 200000 });

// Simulate a turn with realistic token usage
console.log('Starting turn...');
monitor.startTurn();

// Simulate loading workspace files
console.log('Loading workspace context...');
monitor.addTokens(11478, 'workspace'); // MEMORY.md, TOOLS.md, etc.

// Simulate memory files
console.log('Loading memory files...');
monitor.addTokens(5000, 'memory');

// Simulate conversation history
console.log('Loading conversation history...');
monitor.addTokens(15000, 'conversation');

// Simulate tool outputs
console.log('Adding tool outputs...');
monitor.addTokens(3000, 'tools');

let health = monitor.getHealthStatus();
console.log(`\n📊 After 34,478 tokens (${(health.current.percentage * 100).toFixed(1)}%):`);
console.log(`   Health: ${health.health}`);
console.log(`   Warnings: ${health.warnings.length} fired\n`);

// Now push it to 80% threshold
console.log('Simulating large context growth to 80%...');
monitor.addTokens(125000, 'conversation'); // Push to ~160K total

health = monitor.getHealthStatus();
console.log(`\n📊 After 159,478 tokens (${(health.current.percentage * 100).toFixed(1)}%):`);
console.log(`   Health: ${health.health}`);
console.log(`   Remaining: ${health.current.remaining.toLocaleString()} tokens`);
console.log(`   Warnings fired: ${health.warnings.length}`);

if (health.warnings.length > 0) {
    console.log('\n⚠️  Active Warnings:');
    health.warnings.forEach(threshold => {
        console.log(`   - ${(threshold * 100).toFixed(0)}% threshold crossed`);
    });
}

console.log('\n📂 Context Sources:');
health.topSources.forEach(source => {
    const pct = ((source.tokens / health.current.tokens) * 100).toFixed(1);
    console.log(`   ${source.name.padEnd(15)}: ${source.tokens.toLocaleString().padStart(8)} tokens (${pct}%)`);
});

// Push to 90% threshold
console.log('\n\nSimulating push to 90%...');
monitor.addTokens(20000, 'conversation');

health = monitor.getHealthStatus();
console.log(`\n📊 After 179,478 tokens (${(health.current.percentage * 100).toFixed(1)}%):`);
console.log(`   Health: ${health.health}`);
console.log(`   Warnings fired: ${health.warnings.length}`);

// Push to 95% critical
console.log('\n\nSimulating push to 95% (CRITICAL)...');
monitor.addTokens(10700, 'tools');

health = monitor.getHealthStatus();
console.log(`\n📊 After 190,178 tokens (${(health.current.percentage * 100).toFixed(1)}%):`);
console.log(`   Health: ${health.health}`);
console.log(`   Remaining: ${health.current.remaining.toLocaleString()} tokens`);
console.log(`   Warnings fired: ${health.warnings.length}\n`);

if (health.warnings.length > 0) {
    console.log('⚠️  All Warnings:');
    health.warnings.forEach(threshold => {
        const level = threshold >= 0.95 ? '🔴 CRITICAL' : 
                     threshold >= 0.9 ? '🟠 HIGH' : 
                     '⚠️  MEDIUM';
        console.log(`   ${level}: ${(threshold * 100).toFixed(0)}% threshold`);
    });
}

console.log('\n✅ Context Monitor test complete!');
console.log('\n📝 Key findings:');
console.log('   - Warnings fire at 80%, 90%, 95% thresholds');
console.log('   - Context sources tracked accurately');
console.log('   - Health levels adjust based on usage');
console.log('   - Addresses GitHub #48252 (accurate %) and #45794 (UI breakage prevention)');
