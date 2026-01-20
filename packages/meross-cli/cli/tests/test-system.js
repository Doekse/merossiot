'use strict';

/**
 * System Device Tests
 * Tests system information, hardware, firmware, abilities, and configuration
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'system',
    description: 'Tests system information, hardware, firmware, abilities, and configuration',
    requiredAbilities: ['Appliance.System.All', 'Appliance.System.Ability'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        // Find devices with system abilities (most devices support this)
        const systemDevices = await findDevicesByAbility(manager, 'Appliance.System.All', OnlineStatus.ONLINE);
        
        // Also try System.Ability if no devices found
        if (systemDevices.length === 0) {
            const abilityDevices = await findDevicesByAbility(manager, 'Appliance.System.Ability', OnlineStatus.ONLINE);
            testDevices = abilityDevices;
        } else {
            testDevices = systemDevices;
        }
        
        // Fallback: get any online device (most devices support system features)
        if (testDevices.length === 0) {
            const allDevices = manager.devices.list();
            const onlineDevices = allDevices.filter(device => {
                return device.onlineStatus === OnlineStatus.ONLINE;
            });
            testDevices = onlineDevices.slice(0, 1);
        }
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with system capabilities',
            passed: false,
            skipped: true,
            error: 'No device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    results.push({
        name: 'should find devices with system capabilities',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Get all system data
    try {
        if (!testDevice.system || typeof testDevice.system.getAllData !== 'function') {
            results.push({
                name: 'should get all system data',
                passed: false,
                skipped: true,
                error: 'Device does not support system.getAllData',
                device: deviceName
            });
        } else {
            const allData = await testDevice.system.getAllData();
            
            if (!allData || typeof allData !== 'object') {
                results.push({
                    name: 'should get all system data',
                    passed: false,
                    skipped: false,
                    error: 'system.getAllData() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get all system data',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { hasAllData: !!allData.all }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get all system data',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Get device abilities
    try {
        if (!testDevice.system || typeof testDevice.system.getAbilities !== 'function') {
            results.push({
                name: 'should get device abilities',
                passed: false,
                skipped: true,
                error: 'Device does not support system.getAbilities',
                device: deviceName
            });
        } else {
            const abilities = await testDevice.system.getAbilities();
            
            if (!abilities || typeof abilities !== 'object') {
                results.push({
                    name: 'should get device abilities',
                    passed: false,
                    skipped: false,
                    error: 'system.getAbilities() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                const abilityCount = abilities.ability ? Object.keys(abilities.ability).length : 0;
                results.push({
                    name: 'should get device abilities',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { abilityCount: abilityCount }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get device abilities',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Get hardware information
    try {
        if (!testDevice.system || typeof testDevice.system.getHardware !== 'function') {
            results.push({
                name: 'should get hardware information',
                passed: false,
                skipped: true,
                error: 'Device does not support system.getHardware',
                device: deviceName
            });
        } else {
            const hardware = await testDevice.system.getHardware();
            
            if (!hardware || typeof hardware !== 'object') {
                results.push({
                    name: 'should get hardware information',
                    passed: false,
                    skipped: false,
                    error: 'system.getHardware() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get hardware information',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { hasHardware: !!hardware.hardware }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get hardware information',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 4: Get firmware information
    try {
        if (!testDevice.system || typeof testDevice.system.getFirmware !== 'function') {
            results.push({
                name: 'should get firmware information',
                passed: false,
                skipped: true,
                error: 'Device does not support system.getFirmware',
                device: deviceName
            });
        } else {
            const firmware = await testDevice.system.getFirmware();
            
            if (!firmware || typeof firmware !== 'object') {
                results.push({
                    name: 'should get firmware information',
                    passed: false,
                    skipped: false,
                    error: 'system.getFirmware() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get firmware information',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { hasFirmware: !!firmware.firmware }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get firmware information',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 5: Get online status
    try {
        if (!testDevice.system || typeof testDevice.system.getOnlineStatus !== 'function') {
            results.push({
                name: 'should get online status',
                passed: false,
                skipped: true,
                error: 'Device does not support system.getOnlineStatus',
                device: deviceName
            });
        } else {
            const onlineStatus = await testDevice.system.getOnlineStatus();
            
            if (!onlineStatus || typeof onlineStatus !== 'object') {
                results.push({
                    name: 'should get online status',
                    passed: false,
                    skipped: false,
                    error: 'system.getOnlineStatus() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get online status',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { hasOnlineStatus: !!onlineStatus.online }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get online status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 6: Get time information
    try {
        if (!testDevice.system || typeof testDevice.system.getTime !== 'function') {
            results.push({
                name: 'should get time information',
                passed: false,
                skipped: true,
                error: 'Device does not support system.getTime',
                device: deviceName
            });
        } else {
            const time = await testDevice.system.getTime();
            
            if (!time || typeof time !== 'object') {
                results.push({
                    name: 'should get time information',
                    passed: false,
                    skipped: false,
                    error: 'system.getTime() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get time information',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { hasTime: !!time.time }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get time information',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 7: Get LED mode (if supported)
    try {
        if (!testDevice.system || typeof testDevice.system.getLedMode !== 'function') {
            results.push({
                name: 'should get LED mode',
                passed: false,
                skipped: true,
                error: 'Device does not support system.getLedMode',
                device: deviceName
            });
        } else {
            const ledMode = await testDevice.system.getLedMode();
            
            if (!ledMode || typeof ledMode !== 'object') {
                results.push({
                    name: 'should get LED mode',
                    passed: false,
                    skipped: false,
                    error: 'system.getLedMode() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get LED mode',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { hasLedMode: !!ledMode.ledMode }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get LED mode',
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
