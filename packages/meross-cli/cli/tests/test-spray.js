'use strict';

/**
 * Spray Device Tests
 * Tests spray mode control for spray devices
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');
const { SprayMode } = require('meross-iot');

const metadata = {
    name: 'spray',
    description: 'Tests spray mode control for spray devices',
    requiredAbilities: ['Appliance.Control.Spray'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Spray', OnlineStatus.ONLINE);
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await device.getSprayState();
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should set different spray modes',
            passed: false,
            skipped: true,
            error: 'Could not find any Spray device within the given set of devices',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test: Set different spray modes
    try {
        // Set CONTINUOUS mode
        await testDevice.setSpray(0, SprayMode.CONTINUOUS);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mode1 = testDevice.getCurrentSprayMode(0);
        if (mode1 !== SprayMode.CONTINUOUS) {
            results.push({
                name: 'should set different spray modes',
                passed: false,
                skipped: false,
                error: `Failed to set CONTINUOUS mode. Expected ${SprayMode.CONTINUOUS}, got ${mode1}`,
                device: deviceName
            });
            return results;
        }
        
        // Set INTERMITTENT mode
        await testDevice.setSpray(0, SprayMode.INTERMITTENT);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mode2 = testDevice.getCurrentSprayMode(0);
        if (mode2 !== SprayMode.INTERMITTENT) {
            results.push({
                name: 'should set different spray modes',
                passed: false,
                skipped: false,
                error: `Failed to set INTERMITTENT mode. Expected ${SprayMode.INTERMITTENT}, got ${mode2}`,
                device: deviceName
            });
            return results;
        }
        
        // Set OFF mode
        await testDevice.setSpray(0, SprayMode.OFF);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mode3 = testDevice.getCurrentSprayMode(0);
        if (mode3 !== SprayMode.OFF) {
            results.push({
                name: 'should set different spray modes',
                passed: false,
                skipped: false,
                error: `Failed to set OFF mode. Expected ${SprayMode.OFF}, got ${mode3}`,
                device: deviceName
            });
            return results;
        }
        
        // Update state
        await testDevice.getSprayState();
        
        results.push({
            name: 'should set different spray modes',
            passed: true,
            skipped: false,
            error: null,
            device: deviceName,
            details: {
                testedModes: ['CONTINUOUS', 'INTERMITTENT', 'OFF'],
                finalMode: mode3
            }
        });
        
    } catch (error) {
        results.push({
            name: 'should set different spray modes',
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
