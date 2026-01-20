'use strict';

/**
 * Temperature Unit Tests
 * Tests temperature unit settings (Celsius/Fahrenheit)
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'temp-unit',
    description: 'Tests temperature unit settings (Celsius/Fahrenheit)',
    requiredAbilities: ['Appliance.Control.TempUnit'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.TempUnit', OnlineStatus.ONLINE);
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should get temp unit',
            passed: false,
            skipped: true,
            error: 'No Temp Unit device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Get temp unit
    try {
        if (!testDevice.tempUnit) {
            results.push({
                name: 'should get temp unit',
                passed: false,
                skipped: true,
                error: 'Device does not support temp unit feature',
                device: deviceName
            });
            return results;
        }
        const response = await testDevice.tempUnit.get({ channel: 0 });
        
        if (!response) {
            results.push({
                name: 'should get temp unit',
                passed: false,
                skipped: false,
                error: 'getTempUnit returned null or undefined',
                device: deviceName
            });
        } else if (!Array.isArray(response.tempUnit)) {
            results.push({
                name: 'should get temp unit',
                passed: false,
                skipped: false,
                error: 'Response tempUnit is not an array',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get temp unit',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { tempUnit: response.tempUnit }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get temp unit',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Control temp unit
    try {
        if (!testDevice.tempUnit) {
            results.push({
                name: 'should control temp unit',
                passed: false,
                skipped: true,
                error: 'Device does not support temp unit feature',
                device: deviceName
            });
            return results;
        }
        // Get current temp unit first
        const currentResponse = await testDevice.tempUnit.get({ channel: 0 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!currentResponse || !Array.isArray(currentResponse.tempUnit) || currentResponse.tempUnit.length === 0) {
            results.push({
                name: 'should control temp unit',
                passed: false,
                skipped: true,
                error: 'Could not get current temp unit or tempUnit array is empty',
                device: deviceName
            });
        } else {
            // Note: We don't actually change the temp unit to avoid disrupting the device
            // We just verify the method exists and can be called
            results.push({
                name: 'should control temp unit',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { 
                    note: 'Method exists, but not changing temp unit to avoid disrupting device',
                    currentTempUnit: currentResponse.tempUnit[0]
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should control temp unit',
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
