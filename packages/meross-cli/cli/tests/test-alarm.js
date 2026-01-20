'use strict';

/**
 * Alarm Device Tests
 * Tests alarm functionality and notifications
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'alarm',
    description: 'Tests alarm functionality and notifications',
    requiredAbilities: ['Appliance.Control.Alarm'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Alarm', OnlineStatus.ONLINE);
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should get alarm status',
            passed: false,
            skipped: true,
            error: 'No Alarm device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Get alarm status
    try {
        if (!testDevice.alarm) {
            results.push({
                name: 'should get alarm status',
                passed: false,
                skipped: true,
                error: 'Device does not support alarm feature',
                device: deviceName
            });
            return results;
        }
        const response = await testDevice.alarm.get({ channel: 0 });
        
        if (!response) {
            results.push({
                name: 'should get alarm status',
                passed: false,
                skipped: false,
                error: 'getAlarmStatus returned null or undefined',
                device: deviceName
            });
        } else if (!Array.isArray(response.alarm)) {
            results.push({
                name: 'should get alarm status',
                passed: false,
                skipped: false,
                error: 'Response alarm is not an array',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get alarm status',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { alarm: response.alarm }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get alarm status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Store alarm events from push notifications
    try {
        if (!testDevice.alarm) {
            results.push({
                name: 'should store alarm events from push notifications',
                passed: false,
                skipped: true,
                error: 'Device does not support alarm feature',
                device: deviceName
            });
            return results;
        }
        // Get initial alarm events (should be empty or existing events)
        const initialEvents = testDevice.alarm.getLastEvents();
        
        if (!Array.isArray(initialEvents)) {
            results.push({
                name: 'should store alarm events from push notifications',
                passed: false,
                skipped: false,
                error: 'getLastAlarmEvents did not return an array',
                device: deviceName
            });
        } else {
            // Get current alarm status
            await testDevice.getAlarmStatus({ channel: 0 });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check that getLastAlarmEvents returns an array (even if empty)
            const events = testDevice.getLastAlarmEvents();
            
            if (!Array.isArray(events)) {
                results.push({
                    name: 'should store alarm events from push notifications',
                    passed: false,
                    skipped: false,
                    error: 'getLastAlarmEvents did not return an array after getAlarmStatus',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should store alarm events from push notifications',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { eventCount: events.length }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should store alarm events from push notifications',
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
