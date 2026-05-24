'use strict';

/**
 * Test Template - Example of new test file structure
 * 
 * This file demonstrates the new test structure. Copy this template
 * when creating new tests or migrating existing tests.
 * 
 * Key changes from old structure:
 * - No Mocha describe/it blocks
 * - No globals or environment variables
 * - Explicit context object passed to runTests()
 * - Structured test results returned as array
 * - Metadata exported separately (aligned with test-registry.js)
 * - Use getPrimaryChannel(device) for channel-scoped calls instead of hardcoding 0
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, getPrimaryChannel, REQUIRE_ONLINE } = require('./test-helper');
const { runSingleTest } = require('./test-runner');

/**
 * Test metadata
 * This information is also stored in test-registry.js, but exporting it here
 * allows the test file to be self-documenting and enables auto-discovery.
 */
const metadata = {
    name: 'example',
    description: 'Example test demonstrating the new test structure',
    requiredAbilities: ['Appliance.Control.ToggleX', 'Appliance.Control.Toggle'],
    minDevices: 1
};

/**
 * Runs all tests for this test type
 * @param {Object} context - Test context object
 * @param {Object} context.manager - Meross instance (already connected)
 * @param {Array<Object>} context.devices - Pre-filtered devices (from CLI selection or auto-discovery)
 * @param {Object} context.options - Test options (timeout, verbose, etc.)
 * @returns {Promise<Array>} Array of test result objects
 */
async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        // Find devices with required abilities
        const toggleXDevices = await findDevicesByAbility(manager, 'Appliance.Control.ToggleX', REQUIRE_ONLINE);
        const toggleDevices = await findDevicesByAbility(manager, 'Appliance.Control.Toggle', REQUIRE_ONLINE);
        
        // Combine and deduplicate
        testDevices = [...toggleXDevices];
        for (const device of toggleDevices) {
            const uuid = device.uuid;
            if (!testDevices.find(d => d.uuid === uuid)) {
                testDevices.push(device);
            }
        }
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 1: Check if devices were found
    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with toggle capability',
            passed: false,
            skipped: true,
            error: 'No devices with toggle capability found',
            device: null
        });
        return results; // Early return if no devices
    }
    
    results.push({
        name: 'should find devices with toggle capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });
    
    // Test 2: Get toggle state
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);
    
    try {
        if (testDevice.toggle) {
            const toggleState = await testDevice.toggle.get({ channel });
            
            if (!toggleState) {
                results.push({
                    name: 'should get toggle state',
                    passed: false,
                    skipped: false,
                    error: 'toggle.get() returned null or undefined',
                    device: deviceName
                });
            } else {
                // Check cached toggle state
                const isOn = testDevice.toggle.isOn({ channel });
                
                results.push({
                    name: 'should get toggle state',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        toggleState: toggleState,
                        isOn: isOn
                    }
                });
            }
        } else {
            results.push({
                name: 'should get toggle state',
                passed: false,
                skipped: true,
                error: 'Device does not support toggle feature',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should get toggle state',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Control toggle state (turn on/off)
    try {
        if (!testDevice.toggle) {
            results.push({
                name: 'should control toggle state',
                passed: false,
                skipped: true,
                error: 'Device does not support toggle feature',
                device: deviceName
            });
        } else {
            // Get initial state
            let initialState = testDevice.toggle.isOn({ channel });
            
            // Test turn on
            await testDevice.toggle.set({ on: true, channel });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify state
            const isOnAfter = testDevice.toggle.isOn({ channel });
            if (!isOnAfter) {
                results.push({
                    name: 'should control toggle state (turn on)',
                    passed: false,
                    skipped: false,
                    error: 'Device did not turn on after toggle.set({ on: true, channel }) call',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should control toggle state (turn on)',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
            
            // Test turn off
            await testDevice.toggle.set({ on: false, channel });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify state
            const isOffAfter = testDevice.toggle.isOn({ channel });
            if (isOffAfter) {
                results.push({
                    name: 'should control toggle state (turn off)',
                    passed: false,
                    skipped: false,
                    error: 'Device did not turn off after toggle.set({ on: false, channel }) call',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should control toggle state (turn off)',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
            
            // Restore initial state if we changed it
            if (initialState !== undefined) {
                await testDevice.toggle.set({ on: initialState, channel });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
    } catch (error) {
        results.push({
            name: 'should control toggle state',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    return results;
}

// Export metadata and runTests function
module.exports = {
    metadata,
    runTests
};

