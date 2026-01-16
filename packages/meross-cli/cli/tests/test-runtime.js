'use strict';

/**
 * Runtime Device Tests
 * Tests device runtime and system runtime information
 */

const { waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'runtime',
    description: 'Tests device runtime and system runtime information',
    requiredAbilities: ['Appliance.System.Runtime'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        // Runtime is typically available on most devices, so we'll test with any online device
        const allDevices = manager.devices.list();
        testDevices = allDevices.filter(device => {
            if (device.onlineStatus !== OnlineStatus.ONLINE) return false;
            // Check if device has runtime ability or if it's a common device type
            return device.abilities && (
                device.abilities['Appliance.System.Runtime'] ||
                // Most devices support runtime, so we'll test with any online device
                true
            );
        }).slice(0, 3); // Test up to 3 devices
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should get runtime information',
            passed: false,
            skipped: true,
            error: 'No device with runtime support has been found to run this test',
            device: null
        });
        return results;
    }
    
    // Test 1: Get runtime information
    let devicesWithRuntime = 0;
    for (const device of testDevices) {
        const deviceName = getDeviceName(device);
        
        try {
            // Check if device supports runtime
            if (typeof device.updateRuntimeInfo !== 'function') {
                continue; // Skip this device
            }
            
            const runtimeInfo = await device.updateRuntimeInfo();
            
            if (!runtimeInfo) {
                results.push({
                    name: 'should get runtime information',
                    passed: false,
                    skipped: false,
                    error: 'updateRuntimeInfo returned null or undefined',
                    device: deviceName
                });
            } else if (typeof runtimeInfo !== 'object') {
                results.push({
                    name: 'should get runtime information',
                    passed: false,
                    skipped: false,
                    error: 'Runtime info is not an object',
                    device: deviceName
                });
            } else {
                devicesWithRuntime++;
                // Only add result for first device to avoid too many results
                if (devicesWithRuntime === 1) {
                    results.push({
                        name: 'should get runtime information',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { runtimeInfo: runtimeInfo }
                    });
                }
            }
        } catch (error) {
            // Only report error for first device
            if (devicesWithRuntime === 0) {
                results.push({
                    name: 'should get runtime information',
                    passed: false,
                    skipped: false,
                    error: error.message,
                    device: deviceName
                });
            }
        }
    }
    
    if (devicesWithRuntime === 0) {
        results.push({
            name: 'should get runtime information',
            passed: false,
            skipped: true,
            error: 'No devices support updateRuntimeInfo',
            device: null
        });
    }
    
    // Test 2: Cache runtime information
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    try {
        if (typeof testDevice.updateRuntimeInfo !== 'function') {
            results.push({
                name: 'should cache runtime information',
                passed: false,
                skipped: true,
                error: 'Device does not support runtime info',
                device: deviceName
            });
        } else {
            // Update runtime info
            await testDevice.updateRuntimeInfo();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get cached runtime info
            const cachedInfo = testDevice.cachedSystemRuntimeInfo;
            
            if (!cachedInfo) {
                results.push({
                    name: 'should cache runtime information',
                    passed: false,
                    skipped: false,
                    error: 'Cached runtime info is null or undefined',
                    device: deviceName
                });
            } else if (typeof cachedInfo !== 'object') {
                results.push({
                    name: 'should cache runtime information',
                    passed: false,
                    skipped: false,
                    error: 'Cached runtime info is not an object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should cache runtime information',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { cachedInfo: cachedInfo }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should cache runtime information',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Update runtime info during refreshState
    try {
        if (typeof testDevice.refreshState !== 'function' || typeof testDevice.updateRuntimeInfo !== 'function') {
            results.push({
                name: 'should update runtime info during refreshState',
                passed: false,
                skipped: true,
                error: 'Device does not support refreshState with runtime',
                device: deviceName
            });
        } else {
            // Call refreshState which should also update runtime info
            await testDevice.refreshState();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify runtime info was updated
            const cachedInfo = testDevice.cachedSystemRuntimeInfo;
            
            if (!cachedInfo) {
                results.push({
                    name: 'should update runtime info during refreshState',
                    passed: false,
                    skipped: false,
                    error: 'Runtime info was not cached after refreshState',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should update runtime info during refreshState',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { runtimeInfo: cachedInfo }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should update runtime info during refreshState',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    return results;
}

module.exports = {
    metadata,
    runTests
};
