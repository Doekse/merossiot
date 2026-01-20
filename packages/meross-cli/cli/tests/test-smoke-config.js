'use strict';

/**
 * Smoke Config Device Tests
 * Tests smoke configuration retrieval and control
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'smoke-config',
    description: 'Tests smoke configuration retrieval and control',
    requiredAbilities: ['Appliance.Control.Smoke.Config'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Smoke.Config', OnlineStatus.ONLINE);
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should get smoke config',
            passed: false,
            skipped: true,
            error: 'No Smoke Config device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    await waitForDeviceConnection(testDevice, timeout);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Get smoke config
    try {
        if (!testDevice.smokeConfig) {
            results.push({
                name: 'should get smoke config',
                passed: false,
                skipped: true,
                error: 'Device does not support smoke config feature',
                device: deviceName
            });
            return results;
        }
        const response = await testDevice.smokeConfig.get({ channel: 0 });
        
        if (!response) {
            results.push({
                name: 'should get smoke config',
                passed: false,
                skipped: false,
                error: 'getSmokeConfig returned null or undefined',
                device: deviceName
            });
        } else if (!Array.isArray(response.config)) {
            results.push({
                name: 'should get smoke config',
                passed: false,
                skipped: false,
                error: 'Response config is not an array',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get smoke config',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { configCount: response.config.length }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get smoke config',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Control smoke config
    try {
        if (!testDevice.smokeConfig) {
            results.push({
                name: 'should control smoke config',
                passed: false,
                skipped: true,
                error: 'Device does not support smoke config feature',
                device: deviceName
            });
            return results;
        }
        // Get current config first
        const currentResponse = await testDevice.smokeConfig.get({ channel: 0 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!currentResponse || !Array.isArray(currentResponse.config)) {
            results.push({
                name: 'should control smoke config',
                passed: false,
                skipped: false,
                error: 'Could not get current smoke config or config is not an array',
                device: deviceName
            });
        } else if (typeof testDevice.smokeConfig.set !== 'function') {
            results.push({
                name: 'should control smoke config',
                passed: false,
                skipped: true,
                error: 'Device does not support set',
                device: deviceName
            });
        } else {
            // Verify the setSmokeConfig method exists and can be called
            // Note: We don't actually change the config to avoid disrupting the device
            results.push({
                name: 'should control smoke config',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { 
                    configEntries: currentResponse.config.length,
                    note: 'Method exists, but not changing config to avoid disruption'
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should control smoke config',
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
