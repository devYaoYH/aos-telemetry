#!/usr/bin/env node
/**
 * test-dashboard.js - Playwright tests for AOS dashboards
 * Verifies dashboards load without errors and render correctly
 */

const { chromium } = require('playwright');

async function testDashboard(url, tabSelectors = []) {
    console.log(`\n🧪 Testing: ${url}`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const errors = [];
    const warnings = [];
    
    // Capture console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(`Console error: ${msg.text()}`);
        } else if (msg.type() === 'warning') {
            warnings.push(`Console warning: ${msg.text()}`);
        }
    });
    
    // Capture page errors
    page.on('pageerror', error => {
        errors.push(`Page error: ${error.message}`);
    });
    
    try {
        // Load the page
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        console.log('  ✅ Page loaded');
        
        // Wait a bit for JavaScript to execute
        await page.waitForTimeout(2000);
        
        // Check for error messages in the DOM (ignore placeholder messages)
        const errorElements = await page.$$('.error');
        if (errorElements.length > 0) {
            for (const el of errorElements) {
                const text = await el.textContent();
                // Ignore placeholder messages
                if (!text.includes('Integration Needed') && !text.includes('Make sure the API server is running')) {
                    errors.push(`DOM error element: ${text.trim()}`);
                }
            }
        }
        
        // Test tab switching if tabs exist
        if (tabSelectors.length > 0) {
            console.log('  🔄 Testing tab switching...');
            for (const selector of tabSelectors) {
                try {
                    const tab = await page.$(selector);
                    if (tab) {
                        await tab.click();
                        await page.waitForTimeout(1000);
                        console.log(`    ✅ Clicked: ${selector}`);
                    } else {
                        warnings.push(`Tab not found: ${selector}`);
                    }
                } catch (e) {
                    errors.push(`Failed to click ${selector}: ${e.message}`);
                }
            }
        }
        
        // Take a screenshot
        const screenshotPath = `/tmp/dashboard-test-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  📸 Screenshot: ${screenshotPath}`);
        
    } catch (error) {
        errors.push(`Test error: ${error.message}`);
    }
    
    await browser.close();
    
    // Report results
    if (errors.length > 0) {
        console.log('\n  ❌ ERRORS FOUND:');
        errors.forEach(e => console.log(`     - ${e}`));
    }
    if (warnings.length > 0) {
        console.log('\n  ⚠️  WARNINGS:');
        warnings.forEach(w => console.log(`     - ${w}`));
    }
    if (errors.length === 0 && warnings.length === 0) {
        console.log('  ✅ All tests passed!');
    }
    
    return { errors, warnings };
}

async function runTests() {
    console.log('🚀 Starting Dashboard Tests\n');
    
    const baseUrl = 'http://localhost:3003';
    
    // Test unified dashboard with tab switching
    const unifiedResults = await testDashboard(`${baseUrl}/dashboard`, [
        '.tab:nth-child(2)', // Sessions tab
        '.tab:nth-child(3)', // Context Health tab
        '.tab:nth-child(4)', // Tool Usage tab
        '.tab:nth-child(5)'  // Insights tab
    ]);
    
    // Test context-sessions dashboard
    const contextResults = await testDashboard(`${baseUrl}/context-sessions`, [
        'button.tab:nth-child(2)' // Sessions tab
    ]);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Unified Dashboard: ${unifiedResults.errors.length} errors, ${unifiedResults.warnings.length} warnings`);
    console.log(`Context-Sessions: ${contextResults.errors.length} errors, ${contextResults.warnings.length} warnings`);
    
    const totalErrors = unifiedResults.errors.length + contextResults.errors.length;
    if (totalErrors > 0) {
        console.log('\n❌ TESTS FAILED');
        process.exit(1);
    } else {
        console.log('\n✅ ALL TESTS PASSED');
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    runTests().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { testDashboard, runTests };
