#!/usr/bin/env node
/**
 * cost-projections.js - Calculate cost projections and trends
 * Analyzes telemetry data to project monthly costs and identify trends
 */

const fs = require('fs');
const path = require('path');

const TOOL_CALLS_FILE = path.join(__dirname, 'tool-calls.jsonl');

function loadToolCalls() {
    if (!fs.existsSync(TOOL_CALLS_FILE)) {
        return [];
    }
    
    const lines = fs.readFileSync(TOOL_CALLS_FILE, 'utf8')
        .split('\n')
        .filter(line => line.trim());
    
    return lines.map(line => {
        try {
            return JSON.parse(line);
        } catch (e) {
            return null;
        }
    }).filter(Boolean);
}

function calculateProjections() {
    const toolCalls = loadToolCalls();
    
    if (toolCalls.length === 0) {
        return {
            error: 'No telemetry data available',
            avgDailyCost: 0,
            projectedMonthlyCost: 0,
            trend: 'unknown'
        };
    }
    
    // Group by date
    const dailyStats = {};
    
    toolCalls.forEach(tc => {
        const date = tc.timestamp ? tc.timestamp.split('T')[0] : 'unknown';
        if (date === 'unknown') return;
        
        if (!dailyStats[date]) {
            dailyStats[date] = { date, cost: 0, calls: 0 };
        }
        
        dailyStats[date].cost += tc.cost || 0;
        dailyStats[date].calls++;
    });
    
    // Convert to sorted array (most recent first)
    const dailyArray = Object.values(dailyStats)
        .sort((a, b) => b.date.localeCompare(a.date));
    
    if (dailyArray.length === 0) {
        return {
            error: 'No dated telemetry data',
            avgDailyCost: 0,
            projectedMonthlyCost: 0,
            trend: 'unknown'
        };
    }
    
    // Calculate average daily cost (last 7 days or all available)
    const recentDays = Math.min(7, dailyArray.length);
    const recentData = dailyArray.slice(0, recentDays);
    const avgDailyCost = recentData.reduce((sum, day) => sum + day.cost, 0) / recentDays;
    
    // Project monthly cost (avg daily * 30)
    const projectedMonthlyCost = avgDailyCost * 30;
    
    // Determine trend (compare first half vs second half of recent data)
    let trend = 'stable';
    if (recentDays >= 4) {
        const firstHalf = recentData.slice(0, Math.floor(recentDays / 2));
        const secondHalf = recentData.slice(Math.floor(recentDays / 2));
        
        const firstAvg = firstHalf.reduce((sum, day) => sum + day.cost, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, day) => sum + day.cost, 0) / secondHalf.length;
        
        const percentChange = ((firstAvg - secondAvg) / secondAvg) * 100;
        
        if (percentChange > 20) trend = 'increasing';
        else if (percentChange < -20) trend = 'decreasing';
        else trend = 'stable';
    }
    
    // Get breakdown by tool for recent period
    const toolCosts = {};
    recentData.forEach(day => {
        toolCalls.filter(tc => tc.timestamp?.startsWith(day.date)).forEach(tc => {
            if (!toolCosts[tc.tool]) {
                toolCosts[tc.tool] = 0;
            }
            toolCosts[tc.tool] += tc.cost || 0;
        });
    });
    
    const topTools = Object.entries(toolCosts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tool, cost]) => ({
            tool,
            cost: parseFloat(cost.toFixed(2)),
            percentage: parseFloat((cost / (avgDailyCost * recentDays) * 100).toFixed(1))
        }));
    
    return {
        avgDailyCost: parseFloat(avgDailyCost.toFixed(2)),
        projectedMonthlyCost: parseFloat(projectedMonthlyCost.toFixed(2)),
        trend,
        daysAnalyzed: recentDays,
        topCostDrivers: topTools,
        totalDaysTracked: dailyArray.length,
        oldestDate: dailyArray[dailyArray.length - 1].date,
        newestDate: dailyArray[0].date
    };
}

// Add endpoint to api-server
function addProjectionsEndpoint(routes) {
    routes['/api/projections'] = (req, res) => {
        const projections = calculateProjections();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(projections, null, 2));
    };
}

// CLI mode
if (require.main === module) {
    const projections = calculateProjections();
    console.log(JSON.stringify(projections, null, 2));
}

module.exports = { calculateProjections, addProjectionsEndpoint };
