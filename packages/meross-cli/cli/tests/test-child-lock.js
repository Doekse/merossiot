'use strict';

/**
 * Child Lock (Physical Lock) Tests
 * Tests physical lock/child lock safety features
 */

const { findDevicesByAbility, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'child-lock',
    description: 'Tests physical lock/child lock safety features',
    requiredAbilities: ['Appliance.Control.PhysicalLock'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.PhysicalLock', OnlineStatus.ONLINE);
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with child lock capability',
            passed: false,
            skipped: true,
            error: 'No devices with child lock capability found',
            device: null
        });
        return results;
    }
    
    results.push({
        name: 'should find devices with child lock capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Get child lock status
    try {
        if (!testDevice.childLock) {
            results.push({
                name: 'should get child lock status',
                passed: false,
                skipped: true,
                error: 'Device does not support child lock feature',
                device: deviceName
            });
            return results;
        }
        const lockStatus = await testDevice.childLock.get({ channel: 0 });
        
        if (!lockStatus) {
            results.push({
                name: 'should get child lock status',
                passed: false,
                skipped: false,
                error: 'childLock.get() returned null or undefined',
                device: deviceName
            });
        } else if (!lockStatus.lock) {
            results.push({
                name: 'should get child lock status',
                passed: false,
                skipped: false,
                error: 'Response does not contain lock property',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get child lock status',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { lockStatus: lockStatus.lock }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get child lock status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Control child lock status
    try {
        if (!testDevice.childLock) {
            results.push({
                name: 'should control child lock status',
                passed: false,
                skipped: true,
                error: 'Device does not support child lock feature',
                device: deviceName
            });
            return results;
        }
        // Get initial lock status
        const initialStatus = await testDevice.childLock.get({ channel: 0 });
        
        if (!initialStatus || !initialStatus.lock || !Array.isArray(initialStatus.lock) || initialStatus.lock.length === 0) {
            results.push({
                name: 'should control child lock status',
                passed: false,
                skipped: true,
                error: 'Could not get initial lock status or lock array is empty',
                device: deviceName
            });
        } else {
            const initialLockState = initialStatus.lock[0].onoff;
            
            // Toggle lock state
            const newLockState = initialLockState === 1 ? 0 : 1;
            const lockData = {
                channel: 0,
                onoff: newLockState
            };
            
            await testDevice.childLock.set({ channel: 0, onoff: newLockState });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify the change
            const updatedStatus = await testDevice.childLock.get({ channel: 0 });
            
            if (!updatedStatus || !updatedStatus.lock || !updatedStatus.lock[0]) {
                results.push({
                    name: 'should control child lock status',
                    passed: false,
                    skipped: false,
                    error: 'Could not verify updated lock status',
                    device: deviceName
                });
            } else if (updatedStatus.lock[0].onoff !== newLockState) {
                results.push({
                    name: 'should control child lock status',
                    passed: false,
                    skipped: false,
                    error: `Lock state did not change. Expected ${newLockState}, got ${updatedStatus.lock[0].onoff}`,
                    device: deviceName
                });
            } else {
                // Restore original state
                const restoreLockData = {
                    channel: 0,
                    onoff: initialLockState
                };
                await testDevice.childLock.set({ channel: 0, onoff: initialLockState });
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const restoredStatus = await testDevice.childLock.get({ channel: 0 });
                
                if (!restoredStatus || !restoredStatus.lock || !restoredStatus.lock[0] || 
                    restoredStatus.lock[0].onoff !== initialLockState) {
                    results.push({
                        name: 'should control child lock status',
                        passed: false,
                        skipped: false,
                        error: `Failed to restore lock state. Expected ${initialLockState}, got ${restoredStatus?.lock?.[0]?.onoff}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should control child lock status',
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
            name: 'should control child lock status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Handle multiple channel lock control
    try {
        if (!testDevice.childLock) {
            results.push({
                name: 'should handle multiple channel lock control',
                passed: false,
                skipped: true,
                error: 'Device does not support child lock feature',
                device: deviceName
            });
            return results;
        }
        // Get initial status for all channels
        const initialStatus = await testDevice.childLock.get({ channel: 0 });
        
        if (!initialStatus || !initialStatus.lock) {
            results.push({
                name: 'should handle multiple channel lock control',
                passed: false,
                skipped: true,
                error: 'Could not get initial lock status',
                device: deviceName
            });
        } else {
            // Control multiple channels using array
            const lockDataArray = [
                {
                    channel: 0,
                    onoff: initialStatus.lock[0]?.onoff || 0
                }
            ];
            
            // If device has multiple channels, add them
            if (initialStatus.lock.length > 1) {
                for (let i = 1; i < initialStatus.lock.length; i++) {
                    lockDataArray.push({
                        channel: initialStatus.lock[i].channel || i,
                        onoff: initialStatus.lock[i].onoff || 0
                    });
                }
            }
            
            await testDevice.childLock.set({ lockData: lockDataArray });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify all channels were set
            const updatedStatus = await testDevice.childLock.get({ channel: 0 });
            
            if (!updatedStatus) {
                results.push({
                    name: 'should handle multiple channel lock control',
                    passed: false,
                    skipped: false,
                    error: 'Could not verify updated lock status',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should handle multiple channel lock control',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should handle multiple channel lock control',
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
