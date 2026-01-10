'use strict';

/**
 * Garage Door Opener Tests
 * Tests open/close control for garage door openers
 */

const { findDevicesByAbility, findDevicesByType, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'garage',
    description: 'Tests open/close control for garage door openers',
    requiredAbilities: ['Appliance.GarageDoor.State'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 120000; // Garage doors take time
    const results = [];
    
    // If no devices provided, discover them
    let garageDevices = devices || [];
    if (garageDevices.length === 0) {
        // Find garage door devices (try by ability first, then by type)
        garageDevices = await findDevicesByAbility(manager, 'Appliance.GarageDoor.State', OnlineStatus.ONLINE);
        
        if (garageDevices.length === 0) {
            garageDevices = await findDevicesByType(manager, 'msg100', OnlineStatus.ONLINE);
        }
    }
    
    // Wait for devices to be connected
    for (const device of garageDevices) {
        await waitForDeviceConnection(device, timeout);
        await device.getGarageDoorState();
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (garageDevices.length === 0) {
        results.push({
            name: 'should open and close garage door',
            passed: false,
            skipped: true,
            error: 'Could not find any Garage Opener within the given set of devices',
            device: null
        });
        return results;
    }
    
    const garage = garageDevices[0];
    const deviceName = getDeviceName(garage);
    
    // Test 1: Open and close garage door
    try {
        // Without a full update, the status will be undefined
        let currentStatus = garage.getCachedGarageDoorState(0);
        
        // Trigger the full update
        await garage.getGarageDoorState();
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentStatus = garage.getCachedGarageDoorState(0);
        
        if (!currentStatus) {
            results.push({
                name: 'should open and close garage door',
                passed: false,
                skipped: false,
                error: 'Could not get garage door state',
                device: deviceName
            });
            return results;
        }
        
        // Get current state
        let isOpen = garage.isGarageDoorOpened(0);
        if (isOpen === undefined) {
            results.push({
                name: 'should open and close garage door',
                passed: false,
                skipped: false,
                error: 'isGarageDoorOpened returned undefined',
                device: deviceName
            });
            return results;
        }
        
        // Toggle
        if (isOpen) {
            await garage.closeGarageDoor({ channel: 0 });
        } else {
            await garage.openGarageDoor({ channel: 0 });
        }
        
        // Wait for door operation (garage doors take time)
        await new Promise(resolve => setTimeout(resolve, 40000));
        
        await garage.getGarageDoorState();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newIsOpen = garage.isGarageDoorOpened(0);
        
        if (newIsOpen === undefined) {
            results.push({
                name: 'should open and close garage door',
                passed: false,
                skipped: false,
                error: 'Could not verify door state after toggle',
                device: deviceName
            });
            return results;
        }
        
        if (newIsOpen === isOpen) {
            results.push({
                name: 'should open and close garage door',
                passed: false,
                skipped: false,
                error: `Door state did not change. Expected ${!isOpen}, got ${newIsOpen}`,
                device: deviceName
            });
            return results;
        }
        
        // Toggle back
        isOpen = newIsOpen;
        if (isOpen) {
            await garage.closeGarageDoor({ channel: 0 });
        } else {
            await garage.openGarageDoor({ channel: 0 });
        }
        
        await new Promise(resolve => setTimeout(resolve, 40000));
        
        await garage.getGarageDoorState();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const finalIsOpen = garage.isGarageDoorOpened(0);
        
        if (finalIsOpen === undefined || finalIsOpen === isOpen) {
            results.push({
                name: 'should open and close garage door',
                passed: false,
                skipped: false,
                error: `Failed to toggle back. Expected ${!isOpen}, got ${finalIsOpen}`,
                device: deviceName
            });
        } else {
            results.push({
                name: 'should open and close garage door',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should open and close garage door',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Get garage door multiple config
    try {
        if (typeof garage.getGarageDoorMultipleState !== 'function') {
            results.push({
                name: 'should get garage door multiple config',
                passed: false,
                skipped: true,
                error: 'Device does not support getGarageDoorMultipleState',
                device: deviceName
            });
        } else {
            const config = await garage.getGarageDoorMultipleState();
            
            if (!config) {
                results.push({
                    name: 'should get garage door multiple config',
                    passed: false,
                    skipped: false,
                    error: 'getGarageDoorMultipleState returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get garage door multiple config',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { config: config.config || config }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get garage door multiple config',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Get garage door config
    try {
        if (typeof garage.getGarageDoorConfig !== 'function') {
            results.push({
                name: 'should get garage door config',
                passed: false,
                skipped: true,
                error: 'Device does not support getGarageDoorConfig',
                device: deviceName
            });
        } else {
            const config = await garage.getGarageDoorConfig();
            
            if (!config) {
                results.push({
                    name: 'should get garage door config',
                    passed: false,
                    skipped: false,
                    error: 'getGarageDoorConfig returned null or undefined',
                    device: deviceName
                });
            } else {
                // Note: We don't test controlGarageDoorConfig as it modifies device settings
                // that may affect operation. Only read operations are tested.
                results.push({
                    name: 'should get garage door config',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { config: config }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get garage door config',
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
