'use strict';

/**
 * Electricity/Consumption Device Tests
 * Tests electricity metrics and power consumption tracking
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'electricity',
    description: 'Tests electricity metrics and power consumption tracking',
    requiredAbilities: ['Appliance.Control.ConsumptionH', 'Appliance.Control.ConsumptionX', 'Appliance.Control.Consumption', 'Appliance.Control.Electricity'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        // Find consumption/electricity devices (try ConsumptionH first, then ConsumptionX, then Consumption, then Electricity)
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.ConsumptionH', OnlineStatus.ONLINE);
        
        if (testDevices.length === 0) {
            testDevices = await findDevicesByAbility(manager, 'Appliance.Control.ConsumptionX', OnlineStatus.ONLINE);
        }
        
        if (testDevices.length === 0) {
            testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Consumption', OnlineStatus.ONLINE);
        }
        
        if (testDevices.length === 0) {
            testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Electricity', OnlineStatus.ONLINE);
        }
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should get instant electricity metrics',
            passed: false,
            skipped: true,
            error: 'No ConsumptionH/ConsumptionX/Consumption/Electricity device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    await waitForDeviceConnection(testDevice, timeout);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 1: Get instant electricity metrics
    try {
        if (!testDevice.electricity || typeof testDevice.electricity.get !== 'function') {
            results.push({
                name: 'should get instant electricity metrics',
                passed: false,
                skipped: true,
                error: 'Device does not support electricity feature',
                device: deviceName
            });
        } else {
            const metrics = await testDevice.electricity.get({ channel: 0 });
            
            if (!metrics || typeof metrics !== 'object') {
                results.push({
                    name: 'should get instant electricity metrics',
                    passed: false,
                    skipped: false,
                    error: 'electricity.get() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get instant electricity metrics',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { metrics: metrics }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get instant electricity metrics',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Get daily power consumption
    try {
        if (!testDevice.consumption) {
            results.push({
                name: 'should get daily power consumption',
                passed: false,
                skipped: true,
                error: 'Device does not support daily power consumption tracking',
                device: deviceName
            });
        } else {
            const consumption = await testDevice.consumption.get({ channel: 0 });
            
            if (!Array.isArray(consumption)) {
                results.push({
                    name: 'should get daily power consumption',
                    passed: false,
                    skipped: false,
                    error: 'Consumption is not an array',
                    device: deviceName
                });
            } else {
                // If we got data, verify structure
                if (consumption.length > 0) {
                    const first = consumption[0];
                    if (!first.date || first.totalConsumptionKwh === undefined) {
                        results.push({
                            name: 'should get daily power consumption',
                            passed: false,
                            skipped: false,
                            error: 'Consumption entries missing required properties (date or totalConsumptionKwh)',
                            device: deviceName
                        });
                    } else {
                        results.push({
                            name: 'should get daily power consumption',
                            passed: true,
                            skipped: false,
                            error: null,
                            device: deviceName,
                            details: { entryCount: consumption.length }
                        });
                    }
                } else {
                    results.push({
                        name: 'should get daily power consumption',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { entryCount: 0, note: 'No consumption data available' }
                    });
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get daily power consumption',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Get consumption config
    try {
        if (!testDevice.consumption) {
            results.push({
                name: 'should get consumption config',
                passed: false,
                skipped: true,
                error: 'Device does not support consumption config',
                device: deviceName
            });
        } else {
            const response = await testDevice.consumption.getConfig();
            
            if (!response) {
                results.push({
                    name: 'should get consumption config',
                    passed: false,
                    skipped: false,
                    error: 'getConfig returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get consumption config',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { config: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get consumption config',
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
