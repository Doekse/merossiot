'use strict';

/**
 * DND Mode Tests
 * Tests do-not-disturb mode functionality
 */

const { findDevicesByAbility, getDeviceName, OnlineStatus } = require('./test-helper');
const { DNDMode } = require('meross-iot');

const metadata = {
    name: 'dnd',
    description: 'Tests do-not-disturb mode functionality',
    requiredAbilities: ['Appliance.System.DNDMode'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        // Find devices that support DND mode (most devices support this)
        const allDevices = manager.devices.list();
        testDevices = allDevices.filter(d => {
            return d.onlineStatus === OnlineStatus.ONLINE &&
                   typeof d.getDNDMode === 'function' &&
                   typeof d.setDNDMode === 'function';
        });
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with DND mode capability',
            passed: false,
            skipped: true,
            error: 'No online devices found to test DND mode',
            device: null
        });
        return results;
    }
    
    results.push({
        name: 'should find devices with DND mode capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Get and set DND mode
    try {
        // Get current DND mode
        const initialMode = await testDevice.getDNDMode();
        
        if (initialMode === null || initialMode === undefined) {
            results.push({
                name: 'should get and set DND mode',
                passed: false,
                skipped: false,
                error: 'getDNDMode returned null or undefined',
                device: deviceName
            });
        } else if (initialMode !== DNDMode.DND_DISABLED && initialMode !== DNDMode.DND_ENABLED) {
            results.push({
                name: 'should get and set DND mode',
                passed: false,
                skipped: false,
                error: `Invalid DND mode value: ${initialMode}`,
                device: deviceName
            });
        } else {
            // Toggle DND mode
            const newMode = initialMode === DNDMode.DND_ENABLED ? DNDMode.DND_DISABLED : DNDMode.DND_ENABLED;
            await testDevice.setDNDMode({ mode: newMode });
            
            // Wait for the change to take effect
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify the change
            const updatedMode = await testDevice.getDNDMode();
            
            if (updatedMode !== newMode) {
                results.push({
                    name: 'should get and set DND mode',
                    passed: false,
                    skipped: false,
                    error: `DND mode did not change. Expected ${newMode}, got ${updatedMode}`,
                    device: deviceName
                });
            } else {
                // Restore original mode
                await testDevice.setDNDMode({ mode: initialMode });
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const restoredMode = await testDevice.getDNDMode();
                
                if (restoredMode !== initialMode) {
                    results.push({
                        name: 'should get and set DND mode',
                        passed: false,
                        skipped: false,
                        error: `Failed to restore DND mode. Expected ${initialMode}, got ${restoredMode}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get and set DND mode',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName
                    });
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get and set DND mode',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Accept boolean values for DND mode
    try {
        // Get current mode
        const initialMode = await testDevice.getDNDMode();
        const initialBoolean = initialMode === DNDMode.DND_ENABLED;
        
        // Set using boolean (true = enabled)
        await testDevice.setDNDMode({ mode: !initialBoolean });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const updatedMode = await testDevice.getDNDMode();
        const expectedMode = !initialBoolean ? DNDMode.DND_ENABLED : DNDMode.DND_DISABLED;
        
        if (updatedMode !== expectedMode) {
            results.push({
                name: 'should accept boolean values for DND mode',
                passed: false,
                skipped: false,
                error: `Boolean set failed. Expected ${expectedMode}, got ${updatedMode}`,
                device: deviceName
            });
        } else {
            // Restore original mode
            await testDevice.setDNDMode({ mode: initialBoolean });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            results.push({
                name: 'should accept boolean values for DND mode',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should accept boolean values for DND mode',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Get raw DND mode value
    try {
        if (typeof testDevice.getRawDNDMode !== 'function') {
            results.push({
                name: 'should get raw DND mode value',
                passed: false,
                skipped: true,
                error: 'Device does not support getRawDNDMode',
                device: deviceName
            });
        } else {
            const rawMode = await testDevice.getRawDNDMode();
            
            if (typeof rawMode !== 'number') {
                results.push({
                    name: 'should get raw DND mode value',
                    passed: false,
                    skipped: false,
                    error: `Raw mode is not a number: ${typeof rawMode}`,
                    device: deviceName
                });
            } else if (rawMode !== 0 && rawMode !== 1) {
                results.push({
                    name: 'should get raw DND mode value',
                    passed: false,
                    skipped: false,
                    error: `Invalid raw mode value: ${rawMode} (expected 0 or 1)`,
                    device: deviceName
                });
            } else {
                // Verify it matches enum value
                const enumMode = await testDevice.getDNDMode();
                
                if (rawMode !== enumMode) {
                    results.push({
                        name: 'should get raw DND mode value',
                        passed: false,
                        skipped: false,
                        error: `Raw mode (${rawMode}) does not match enum mode (${enumMode})`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get raw DND mode value',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName
                    });
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get raw DND mode value',
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
