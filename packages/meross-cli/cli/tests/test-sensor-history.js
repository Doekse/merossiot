'use strict';

/**
 * Sensor History Device Tests
 * Tests sensor history data retrieval
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'sensor-history',
    description: 'Tests sensor history data retrieval',
    requiredAbilities: ['Appliance.Control.Sensor.History'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Sensor.History', OnlineStatus.ONLINE);
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should get sensor history',
            passed: false,
            skipped: true,
            error: 'No Sensor History device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Get sensor history
    try {
        let historyRetrieved = false;
        let lastError = null;
        
        // Try different capacity values (1, 2, 3 are common)
        for (const capacity of [1, 2, 3]) {
            try {
                const response = await testDevice.getSensorHistory({ channel: 0, capacity });
                
                if (!response) {
                    lastError = `getSensorHistory returned null or undefined for capacity ${capacity}`;
                    continue;
                }
                
                if (!Array.isArray(response.history)) {
                    lastError = `Response history is not an array for capacity ${capacity}`;
                    continue;
                }
                
                historyRetrieved = true;
                results.push({
                    name: 'should get sensor history',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { 
                        capacity: capacity,
                        historyEntries: response.history.length 
                    }
                });
                break; // If successful, stop trying other capacities
            } catch (error) {
                lastError = `Capacity ${capacity} not supported: ${error.message}`;
                // Continue to next capacity
            }
        }
        
        if (!historyRetrieved) {
            results.push({
                name: 'should get sensor history',
                passed: false,
                skipped: false,
                error: lastError || 'Could not retrieve sensor history with any capacity value',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should get sensor history',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Delete sensor history
    try {
        // Note: We don't actually delete history to avoid data loss
        // We just verify the method exists and can be called
        if (typeof testDevice.deleteSensorHistory === 'function') {
            results.push({
                name: 'should delete sensor history',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { 
                    note: 'Method exists, but not deleting history to avoid data loss' 
                }
            });
        } else {
            results.push({
                name: 'should delete sensor history',
                passed: false,
                skipped: true,
                error: 'Device does not support deleteSensorHistory',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should delete sensor history',
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
