'use strict';

/**
 * Garage Door Opener Tests
 *
 * Uses {@link MerossDevice#garage} (get, isOpen, open, close, config) per the public API.
 */

const {
    findDevicesByAbility,
    findDevicesByType,
    waitForDeviceConnection,
    getDeviceName,
    getPrimaryChannel,
    hasFeature,
    REQUIRE_ONLINE
} = require('./test-helper');

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
        garageDevices = await findDevicesByAbility(manager, 'Appliance.GarageDoor.State', REQUIRE_ONLINE);

        if (garageDevices.length === 0) {
            garageDevices = await findDevicesByType(manager, 'msg100', REQUIRE_ONLINE);
        }
    }

    garageDevices = garageDevices.filter((d) => hasFeature(d, 'garage'));

    // Wait for devices to be connected
    for (const device of garageDevices) {
        await waitForDeviceConnection(device, timeout);
        const ch = getPrimaryChannel(device);
        await device.garage.get({ channel: ch });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (garageDevices.length === 0) {
        results.push({
            name: 'should find a garage opener with garage feature',
            passed: false,
            skipped: true,
            error: 'Could not find any Garage Opener with device.garage within the given set of devices',
            device: null
        });
        return results;
    }

    const garage = garageDevices[0];
    const deviceName = getDeviceName(garage);
    const channel = getPrimaryChannel(garage);

    // Test 1: Open and close garage door
    try {
        // Trigger the full update
        await garage.garage.get({ channel });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const currentStatus = await garage.garage.get({ channel });
        
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
        
        // Get current state (cached after get above)
        let isOpen = garage.garage.isOpen({ channel });
        if (isOpen === undefined) {
            results.push({
                name: 'should open and close garage door',
                passed: false,
                skipped: false,
                error: 'garage.isOpen returned undefined',
                device: deviceName
            });
            return results;
        }

        if (isOpen) {
            await garage.garage.close({ channel });
        } else {
            await garage.garage.open({ channel });
        }
        
        // Wait for door operation (garage doors take time)
        await new Promise(resolve => setTimeout(resolve, 40000));
        
        await garage.garage.get({ channel });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newIsOpen = garage.garage.isOpen({ channel });
        
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
            await garage.garage.close({ channel });
        } else {
            await garage.garage.open({ channel });
        }
        
        await new Promise(resolve => setTimeout(resolve, 40000));
        
        await garage.garage.get({ channel });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const finalIsOpen = garage.garage.isOpen({ channel });
        
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
        if (!garage.garage || typeof garage.garage.getMultipleConfig !== 'function') {
            results.push({
                name: 'should get garage door multiple config',
                passed: false,
                skipped: true,
                error: 'Device does not support getMultipleConfig',
                device: deviceName
            });
        } else {
            const response = await garage.garage.getMultipleConfig();
            const config = response?.config;
            
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
        if (!garage.garage || typeof garage.garage.getConfig !== 'function') {
            results.push({
                name: 'should get garage door config',
                passed: false,
                skipped: true,
                error: 'Device does not support getConfig',
                device: deviceName
            });
        } else {
            const config = await garage.garage.getConfig();
            
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
