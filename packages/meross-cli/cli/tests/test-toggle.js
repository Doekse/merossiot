'use strict';

/**
 * Toggle/Switch Device Tests
 * Tests on/off control for switches and smart plugs
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

/**
 * Test metadata
 */
const metadata = {
    name: 'switch',
    description: 'Tests on/off control for switches and smart plugs',
    requiredAbilities: ['Appliance.Control.ToggleX', 'Appliance.Control.Toggle'],
    minDevices: 1
};

/**
 * Helper function to find all toggle-capable devices
 * @param {Object} manager - ManagerMeross instance
 * @returns {Promise<Array>} Array of toggle devices
 */
async function findAllToggleDevices(manager) {
    const toggleXDevices = await findDevicesByAbility(manager, 'Appliance.Control.ToggleX', OnlineStatus.ONLINE);
    const toggleDevices = await findDevicesByAbility(manager, 'Appliance.Control.Toggle', OnlineStatus.ONLINE);
    
    // Combine and deduplicate
    const allToggleDevices = [...toggleXDevices];
    for (const device of toggleDevices) {
        const uuid = device.uuid;
        if (!allToggleDevices.find(d => d.uuid === uuid)) {
            allToggleDevices.push(device);
        }
    }
    return allToggleDevices;
}

/**
 * Runs all tests for toggle/switch devices
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
    let toggleDevices = devices || [];
    if (toggleDevices.length === 0) {
        toggleDevices = await findAllToggleDevices(manager);
    }
    
    // Wait for devices to be connected
    for (const device of toggleDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 1: Check if devices were found
    if (toggleDevices.length === 0) {
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
    
    const testDevice = toggleDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 2: Get toggle state
    try {
        if (testDevice.toggle) {
            const toggleState = await testDevice.toggle.get({ channel: 0 });
            const isOn = testDevice.toggle.isOn({ channel: 0 });
            
            if (!toggleState) {
                results.push({
                    name: 'should get toggle state',
                    passed: false,
                    skipped: false,
                    error: 'toggle.get() returned null or undefined',
                    device: deviceName
                });
            } else {
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
            let initialState = testDevice.toggle.isOn({ channel: 0 });
            
            // Test turn on
            await testDevice.toggle.set({ channel: 0, on: true });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const isOnAfter = testDevice.toggle.isOn({ channel: 0 });
            if (!isOnAfter) {
                results.push({
                    name: 'should control toggle state (turn on)',
                    passed: false,
                    skipped: false,
                    error: 'Device did not turn on after set({ on: true })',
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
            await testDevice.toggle.set({ channel: 0, on: false });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const isOffAfter = testDevice.toggle.isOn({ channel: 0 });
            if (isOffAfter) {
                results.push({
                    name: 'should control toggle state (turn off)',
                    passed: false,
                    skipped: false,
                    error: 'Device did not turn off after set({ on: false })',
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
                await testDevice.toggle.set({ channel: 0, on: initialState });
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
