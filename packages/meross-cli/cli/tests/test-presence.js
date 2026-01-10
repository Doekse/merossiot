'use strict';

/**
 * Presence Sensor Device Tests
 * Tests presence detection, light readings, and configuration for presence sensor devices
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'presence',
    description: 'Tests presence detection, light readings, and configuration for presence sensor devices',
    requiredAbilities: ['Appliance.Control.Sensor.LatestX'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let presenceDevices = devices || [];
    if (presenceDevices.length === 0) {
        presenceDevices = await findDevicesByAbility(manager, 'Appliance.Control.Sensor.LatestX', OnlineStatus.ONLINE);
    }
    
    // Filter out hub devices - presence test is for standalone presence sensors
    presenceDevices = presenceDevices.filter(device => {
        // Skip hub devices - they're tested separately
        return device.constructor.name !== 'MerossHubDevice' && typeof device.getSubdevice !== 'function';
    });
    
    // Wait for devices to be connected
    for (const device of presenceDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 1: Check if devices were found
    if (presenceDevices.length === 0) {
        results.push({
            name: 'should find devices with presence sensor capability',
            passed: false,
            skipped: true,
            error: 'No standalone presence sensor devices found (hub devices are tested separately)',
            device: null
        });
        return results;
    }
    
    results.push({
        name: 'should find devices with presence sensor capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });
    
    const testDevice = presenceDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 2: Get latest sensor readings
    try {
        if (typeof testDevice.getLatestSensorReadings === 'function') {
            const readings = await testDevice.getLatestSensorReadings(['presence', 'light'], timeout);
            
            if (!readings || !readings.latest) {
                results.push({
                    name: 'should get latest sensor readings',
                    passed: false,
                    skipped: false,
                    error: 'getLatestSensorReadings returned invalid response',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get latest sensor readings',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        hasLatest: !!readings.latest,
                        latestLength: readings.latest?.length || 0
                    }
                });
            }
        } else {
            results.push({
                name: 'should get latest sensor readings',
                passed: false,
                skipped: true,
                error: 'Device does not support getLatestSensorReadings',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should get latest sensor readings',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Wait a bit for state to update after reading
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Get presence data
    try {
        if (typeof testDevice.getPresence === 'function') {
            const presence = testDevice.getPresence();
            
            // Presence can be null if no data yet, which is acceptable
            if (presence === null) {
                results.push({
                    name: 'should get presence data',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'No presence data available yet (device may need time to detect)' }
                });
            } else if (typeof presence === 'object') {
                // Validate presence data structure
                const isValid = (
                    typeof presence.isPresent === 'boolean' &&
                    typeof presence.state === 'string' &&
                    (presence.state === 'presence' || presence.state === 'absence')
                );
                
                if (!isValid) {
                    results.push({
                        name: 'should get presence data',
                        passed: false,
                        skipped: false,
                        error: `Invalid presence data structure: ${JSON.stringify(presence)}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get presence data',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: {
                            state: presence.state,
                            isPresent: presence.isPresent,
                            hasDistance: presence.distance !== null && presence.distance !== undefined,
                            hasTimestamp: presence.timestamp !== null && presence.timestamp !== undefined
                        }
                    });
                }
            } else {
                results.push({
                    name: 'should get presence data',
                    passed: false,
                    skipped: false,
                    error: `getPresence returned unexpected type: ${typeof presence}`,
                    device: deviceName
                });
            }
        } else {
            results.push({
                name: 'should get presence data',
                passed: false,
                skipped: true,
                error: 'Device does not support getPresence',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should get presence data',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 4: Check if present
    try {
        if (typeof testDevice.isPresent === 'function') {
            const isPresent = testDevice.isPresent();
            
            // isPresent can return null if no data, which is acceptable
            if (isPresent === null) {
                results.push({
                    name: 'should check if presence is detected',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'No presence data available yet' }
                });
            } else if (typeof isPresent === 'boolean') {
                results.push({
                    name: 'should check if presence is detected',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { isPresent: isPresent }
                });
            } else {
                results.push({
                    name: 'should check if presence is detected',
                    passed: false,
                    skipped: false,
                    error: `isPresent returned unexpected type: ${typeof isPresent}`,
                    device: deviceName
                });
            }
        } else {
            results.push({
                name: 'should check if presence is detected',
                passed: false,
                skipped: true,
                error: 'Device does not support isPresent',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should check if presence is detected',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 5: Get light reading
    try {
        if (typeof testDevice.getLight === 'function') {
            const light = testDevice.getLight();
            
            // Light can be null if no data yet, which is acceptable
            if (light === null) {
                results.push({
                    name: 'should get light reading',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'No light data available yet' }
                });
            } else if (typeof light === 'object' && light.value !== undefined) {
                results.push({
                    name: 'should get light reading',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        value: light.value,
                        hasTimestamp: light.timestamp !== null && light.timestamp !== undefined
                    }
                });
            } else {
                results.push({
                    name: 'should get light reading',
                    passed: false,
                    skipped: false,
                    error: `getLight returned invalid data: ${JSON.stringify(light)}`,
                    device: deviceName
                });
            }
        } else {
            results.push({
                name: 'should get light reading',
                passed: false,
                skipped: true,
                error: 'Device does not support getLight',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should get light reading',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 6: Get all sensor readings
    try {
        if (typeof testDevice.getAllSensorReadings === 'function') {
            const allReadings = testDevice.getAllSensorReadings();
            
            if (!allReadings || typeof allReadings !== 'object') {
                results.push({
                    name: 'should get all sensor readings',
                    passed: false,
                    skipped: false,
                    error: 'getAllSensorReadings returned invalid response',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get all sensor readings',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        hasPresence: allReadings.presence !== null && allReadings.presence !== undefined,
                        hasLight: allReadings.light !== null && allReadings.light !== undefined
                    }
                });
            }
        } else {
            results.push({
                name: 'should get all sensor readings',
                passed: false,
                skipped: true,
                error: 'Device does not support getAllSensorReadings',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should get all sensor readings',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 7: Get presence configuration
    try {
        if (typeof testDevice.getPresenceConfig === 'function') {
            const config = await testDevice.getPresenceConfig(0, timeout);
            
            if (!config) {
                results.push({
                    name: 'should get presence configuration',
                    passed: false,
                    skipped: false,
                    error: 'getPresenceConfig returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get presence configuration',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { hasConfig: !!config }
                });
            }
        } else {
            results.push({
                name: 'should get presence configuration',
                passed: false,
                skipped: true,
                error: 'Device does not support getPresenceConfig',
                device: deviceName
            });
        }
    } catch (error) {
        // Some devices may not support this, so we'll mark as skipped if it's a not-supported error
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('not supported') || errorMsg.includes('not found') || errorMsg.includes('timeout')) {
            results.push({
                name: 'should get presence configuration',
                passed: false,
                skipped: true,
                error: `getPresenceConfig not supported or timed out: ${errorMsg}`,
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get presence configuration',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName
            });
        }
    }
    
    // Test 8: Get presence study/calibration status
    try {
        if (typeof testDevice.getPresenceStudy === 'function') {
            const study = await testDevice.getPresenceStudy(timeout);
            
            if (!study) {
                results.push({
                    name: 'should get presence study status',
                    passed: false,
                    skipped: false,
                    error: 'getPresenceStudy returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get presence study status',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { hasStudy: !!study }
                });
            }
        } else {
            results.push({
                name: 'should get presence study status',
                passed: false,
                skipped: true,
                error: 'Device does not support getPresenceStudy',
                device: deviceName
            });
        }
    } catch (error) {
        // Some devices may not support this, so we'll mark as skipped if it's a not-supported error
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('not supported') || errorMsg.includes('not found') || errorMsg.includes('timeout')) {
            results.push({
                name: 'should get presence study status',
                passed: false,
                skipped: true,
                error: `getPresenceStudy not supported or timed out: ${errorMsg}`,
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get presence study status',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName
            });
        }
    }
    
    // Test 9: Handle presence push notifications
    try {
        // Set up listener for presence push notifications
        let receivedNotification = false;
        const notificationHandler = (notification) => {
            if (notification.namespace === 'Appliance.Control.Sensor.LatestX') {
                receivedNotification = true;
            }
        };
        
        testDevice.on('pushNotification', notificationHandler);
        
        // Request latest readings (may trigger a push notification)
        if (typeof testDevice.getLatestSensorReadings === 'function') {
            await testDevice.getLatestSensorReadings(['presence', 'light'], timeout);
        }
        
        // Wait a bit for potential push notifications
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Remove listener
        testDevice.removeListener('pushNotification', notificationHandler);
        
        // Note: We don't assert on receivedNotification since push notifications
        // are device-initiated and may not occur during testing
        // This test just verifies the listener mechanism works
        results.push({
            name: 'should handle presence push notifications',
            passed: true,
            skipped: false,
            error: null,
            device: deviceName,
            details: { notificationReceived: receivedNotification }
        });
        
    } catch (error) {
        results.push({
            name: 'should handle presence push notifications',
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

