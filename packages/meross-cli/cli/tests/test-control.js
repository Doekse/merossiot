'use strict';

/**
 * Control Device Tests
 * Tests multiple control features and device capabilities
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'control',
    description: 'Tests multiple control features and device capabilities',
    requiredAbilities: ['Appliance.Control.Multiple', 'Appliance.Control.Upgrade', 'Appliance.Control.OverTemp'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        // Find devices with control multiple support (most devices support this)
        const multipleDevices = await findDevicesByAbility(manager, 'Appliance.Control.Multiple', OnlineStatus.ONLINE);
        
        // Also get any online device for testing control features
        const allDevices = manager.devices.list();
        const onlineDevices = allDevices.filter(device => {
            return device.onlineStatus === OnlineStatus.ONLINE;
        });
        
        // Combine and deduplicate
        testDevices = [...multipleDevices];
        for (const device of onlineDevices.slice(0, 2)) {
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
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with control capabilities',
            passed: false,
            skipped: true,
            error: 'No device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const device = testDevices[0];
    const deviceName = getDeviceName(device);
    
    // Test 1: Control Multiple
    try {
        if (!device.control || typeof device.control.setMultiple !== 'function') {
            results.push({
                name: 'should execute multiple commands',
                passed: false,
                skipped: true,
                error: 'Device does not support control.setMultiple',
                device: deviceName
            });
        } else {
            const commands = [
                {
                    namespace: 'Appliance.System.All',
                    method: 'GET',
                    payload: {}
                },
                {
                    namespace: 'Appliance.System.Ability',
                    method: 'GET',
                    payload: {}
                }
            ];
            
            const response = await device.control.setMultiple({ commands });
            
            if (!response) {
                results.push({
                    name: 'should execute multiple commands',
                    passed: false,
                    skipped: false,
                    error: 'control.setMultiple returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should execute multiple commands',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should execute multiple commands',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Control Over Temp
    try {
        if (!device.control || typeof device.control.acknowledgeOverTemp !== 'function') {
            results.push({
                name: 'should acknowledge over temp event',
                passed: false,
                skipped: true,
                error: 'Device does not support control.acknowledgeOverTemp',
                device: deviceName
            });
        } else {
            // Note: OverTemp is typically SET by the device, and we acknowledge it
            // We don't actually trigger an over temp event, just verify the method exists
            results.push({
                name: 'should acknowledge over temp event',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { note: 'Method exists, but not triggering actual over temp event' }
            });
        }
    } catch (error) {
        results.push({
            name: 'should acknowledge over temp event',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Control Upgrade
    try {
        if (!device.control || typeof device.control.setUpgrade !== 'function') {
            results.push({
                name: 'should have upgrade method available',
                passed: false,
                skipped: true,
                error: 'Device does not support control.setUpgrade',
                device: deviceName
            });
        } else {
            // Note: We don't actually trigger an upgrade to avoid disrupting the device
            // We just verify the method exists
            results.push({
                name: 'should have upgrade method available',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { note: 'Method exists, but not triggering actual upgrade' }
            });
        }
    } catch (error) {
        results.push({
            name: 'should have upgrade method available',
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
