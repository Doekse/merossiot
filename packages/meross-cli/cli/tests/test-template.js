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
 * - Metadata exported separately
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');
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
 * @param {Object} context.manager - ManagerMeross instance (already connected)
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
        const toggleXDevices = await findDevicesByAbility(manager, 'Appliance.Control.ToggleX', OnlineStatus.ONLINE);
        const toggleDevices = await findDevicesByAbility(manager, 'Appliance.Control.Toggle', OnlineStatus.ONLINE);
        
        // Combine and deduplicate
        testDevices = [...toggleXDevices];
        for (const device of toggleDevices) {
            const uuid = device.dev?.uuid || device.uuid;
            if (!testDevices.find(d => (d.dev?.uuid || d.uuid) === uuid)) {
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
    
    try {
        if (typeof testDevice.getToggleState === 'function') {
            const toggleState = await testDevice.getToggleState(0);
            
            if (!toggleState) {
                results.push({
                    name: 'should get toggle state',
                    passed: false,
                    skipped: false,
                    error: 'getToggleState returned null or undefined',
                    device: deviceName
                });
            } else {
                // Check cached toggle state
                const cachedState = testDevice.getCachedToggleState(0);
                const isOn = testDevice.isOn(0);
                
                results.push({
                    name: 'should get toggle state',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        toggleState: toggleState,
                        cachedState: cachedState,
                        isOn: isOn
                    }
                });
            }
        } else {
            results.push({
                name: 'should get toggle state',
                passed: false,
                skipped: true,
                error: 'Device does not support getToggleState',
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
        // Get initial state
        let initialState = undefined;
        if (typeof testDevice.getToggleState === 'function') {
            const stateResponse = await testDevice.getToggleState(0);
            if (stateResponse && stateResponse.togglex) {
                initialState = stateResponse.togglex[0]?.onoff || stateResponse.togglex.onoff;
            }
        } else if (typeof testDevice.isOn === 'function') {
            initialState = testDevice.isOn(0);
        }
        
        // Test turnOn if available
        if (typeof testDevice.turnOn === 'function') {
            await testDevice.turnOn(0);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify state
            if (typeof testDevice.isOn === 'function') {
                const isOnAfter = testDevice.isOn(0);
                if (!isOnAfter) {
                    results.push({
                        name: 'should control toggle state (turn on)',
                        passed: false,
                        skipped: false,
                        error: 'Device did not turn on after turnOn() call',
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
            }
        }
        
        // Test turnOff if available
        if (typeof testDevice.turnOff === 'function') {
            await testDevice.turnOff(0);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify state
            if (typeof testDevice.isOn === 'function') {
                const isOnAfter = testDevice.isOn(0);
                if (isOnAfter) {
                    results.push({
                        name: 'should control toggle state (turn off)',
                        passed: false,
                        skipped: false,
                        error: 'Device did not turn off after turnOff() call',
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
            }
        }
        
        // Restore initial state if we changed it
        if (initialState !== undefined && typeof testDevice.turnOn === 'function' && typeof testDevice.turnOff === 'function') {
            if (initialState === 1 || initialState === true) {
                await testDevice.turnOn(0);
            } else {
                await testDevice.turnOff(0);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
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

