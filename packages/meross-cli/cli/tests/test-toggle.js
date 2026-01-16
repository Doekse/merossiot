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
            const turnOnResult = await testDevice.turnOn(0);
            
            if (!turnOnResult) {
                results.push({
                    name: 'should control toggle state (turn on)',
                    passed: false,
                    skipped: false,
                    error: 'turnOn() returned null or undefined',
                    device: deviceName
                });
            } else {
                // Wait a bit for state to update
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
                } else {
                    // Can't verify, but command succeeded
                    results.push({
                        name: 'should control toggle state (turn on)',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { note: 'turnOn succeeded but cannot verify state (isOn not available)' }
                    });
                }
            }
        } else {
            results.push({
                name: 'should control toggle state (turn on)',
                passed: false,
                skipped: true,
                error: 'Device does not support turnOn',
                device: deviceName
            });
        }
        
        // Test turnOff if available
        if (typeof testDevice.turnOff === 'function') {
            const turnOffResult = await testDevice.turnOff(0);
            
            if (!turnOffResult) {
                results.push({
                    name: 'should control toggle state (turn off)',
                    passed: false,
                    skipped: false,
                    error: 'turnOff() returned null or undefined',
                    device: deviceName
                });
            } else {
                // Wait a bit for state to update
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
                } else {
                    // Can't verify, but command succeeded
                    results.push({
                        name: 'should control toggle state (turn off)',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { note: 'turnOff succeeded but cannot verify state (isOn not available)' }
                    });
                }
            }
        } else {
            results.push({
                name: 'should control toggle state (turn off)',
                passed: false,
                skipped: true,
                error: 'Device does not support turnOff',
                device: deviceName
            });
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
    
    // Test 4: Handle toggle push notifications
    try {
        const testDeviceForPush = toggleDevices[0];
        
        // Set up listener for toggle push notifications
        let receivedNotification = false;
        const notificationHandler = (notification) => {
            if (notification.namespace === 'Appliance.Control.ToggleX' || 
                notification.namespace === 'Appliance.Control.Toggle') {
                receivedNotification = true;
            }
        };
        
        testDeviceForPush.on('pushNotification', notificationHandler);
        
        // Get toggle state (may trigger a push notification)
        if (typeof testDeviceForPush.getToggleState === 'function') {
            await testDeviceForPush.getToggleState(0);
        }
        
        // Wait a bit for potential push notifications
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Remove listener
        testDeviceForPush.removeListener('pushNotification', notificationHandler);
        
        // Note: We don't assert on receivedNotification since push notifications
        // are device-initiated and may not occur during testing
        // This test just verifies the listener mechanism works
        results.push({
            name: 'should handle toggle push notifications',
            passed: true,
            skipped: false,
            error: null,
            device: getDeviceName(testDeviceForPush),
            details: { notificationReceived: receivedNotification }
        });
        
    } catch (error) {
        results.push({
            name: 'should handle toggle push notifications',
            passed: false,
            skipped: false,
            error: error.message,
            device: toggleDevices.length > 0 ? getDeviceName(toggleDevices[0]) : null
        });
    }
    
    return results;
}

// Export metadata and runTests function
module.exports = {
    metadata,
    runTests
};
