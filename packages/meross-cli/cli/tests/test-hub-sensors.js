'use strict';

/**
 * Hub Sensors Tests
 * Tests hub sensor discovery and readings for various sensor types
 */

const { findDevicesByType, findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'hub-sensors',
    description: 'Tests hub sensor discovery and readings for various sensor types',
    requiredAbilities: ['Appliance.Hub.Sensor.All'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testHub = null;
    if (devices && devices.length > 0) {
        testHub = devices[0];
    } else {
        // Find hub devices (test-runner.js already filters out subdevices, so we can use findDevicesByAbility)
        const hubTypes = ['ms100', 'msh300', 'msh300h', 'msh450'];
        let hubDevices = [];
        
        for (const hubType of hubTypes) {
            const foundDevices = await findDevicesByType(manager, hubType, OnlineStatus.ONLINE);
            hubDevices = hubDevices.concat(foundDevices);
        }
        
        // Also try finding by hub sensor abilities
        const sensorHubs = await findDevicesByAbility(manager, 'Appliance.Hub.Sensor.All', OnlineStatus.ONLINE);
        for (const device of sensorHubs) {
            if (!hubDevices.find(d => d.uuid === device.uuid)) {
                hubDevices.push(device);
            }
        }
        
        if (hubDevices.length > 0) {
            testHub = hubDevices[0];
        }
    }
    
    if (!testHub) {
        results.push({
            name: 'should get all sensors',
            passed: false,
            skipped: true,
            error: 'No Hub device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const deviceName = getDeviceName(testHub);
    
    await waitForDeviceConnection(testHub, timeout);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // With single-phase initialization, abilities are already loaded and features are applied
    // when the device is created. No need to query or apply abilities here.
    // Just wait for connection to stabilize.
    if (testHub.deviceConnected) {
                await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 1: Get all sensors
    try {
        if (typeof testHub.getAllSensors !== 'function') {
            results.push({
                name: 'should get all sensors',
                passed: false,
                skipped: true,
                error: 'Hub does not support getAllSensors',
                device: deviceName
            });
        } else {
            // Get subdevices to find sensor IDs
            const subdevices = testHub.getSubdevices();
            if (subdevices.length === 0) {
                results.push({
                    name: 'should get all sensors',
                    passed: false,
                    skipped: true,
                    error: 'Hub has no subdevices',
                    device: deviceName
                });
            } else {
                const sensorIds = subdevices.map(sub => sub.subdeviceId).slice(0, 5); // Test up to 5 sensors
                
                const response = await testHub.getAllSensors(sensorIds);
                
                if (!response) {
                    results.push({
                        name: 'should get all sensors',
                        passed: false,
                        skipped: false,
                        error: 'getAllSensors returned null or undefined',
                        device: deviceName
                    });
                } else if (!Array.isArray(response.all)) {
                    results.push({
                        name: 'should get all sensors',
                        passed: false,
                        skipped: false,
                        error: 'Response all is not an array',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get all sensors',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { sensorCount: response.all.length }
                    });
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get all sensors',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Get temperature and humidity sensors
    try {
        if (typeof testHub.getTempHumSensor !== 'function') {
            results.push({
                name: 'should get temperature and humidity sensors',
                passed: false,
                skipped: true,
                error: 'Hub does not support getTempHumSensor',
                device: deviceName
            });
        } else {
            const subdevices = testHub.getSubdevices();
            if (subdevices.length === 0) {
                results.push({
                    name: 'should get temperature and humidity sensors',
                    passed: false,
                    skipped: true,
                    error: 'Hub has no subdevices',
                    device: deviceName
                });
            } else {
                // Filter for temp/humidity sensors: ms100, ms100f, ms130
                const sensorIds = subdevices
                    .filter(sub => {
                        const type = (sub.type || sub._type || '').toLowerCase();
                        return type === 'ms100' || type === 'ms100f' || type === 'ms130';
                    })
                    .map(sub => sub.subdeviceId)
                    .slice(0, 3);
                
                if (sensorIds.length === 0) {
                    results.push({
                        name: 'should get temperature and humidity sensors',
                        passed: false,
                        skipped: true,
                        error: 'Hub has no temperature/humidity sensors',
                        device: deviceName
                    });
                } else {
                    const response = await testHub.getTempHumSensor(sensorIds);
                    
                    if (!response || !Array.isArray(response.tempHum)) {
                        results.push({
                            name: 'should get temperature and humidity sensors',
                            passed: false,
                            skipped: false,
                            error: 'Response tempHum is not an array',
                            device: deviceName
                        });
                    } else {
                        results.push({
                            name: 'should get temperature and humidity sensors',
                            passed: true,
                            skipped: false,
                            error: null,
                            device: deviceName,
                            details: { sensorCount: response.tempHum.length }
                        });
                    }
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get temperature and humidity sensors',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Get latest sensor readings
    try {
        if (typeof testHub.getLatestHubSensorReadings !== 'function') {
            results.push({
                name: 'should get latest sensor readings',
                passed: false,
                skipped: true,
                error: 'Hub does not support getLatestHubSensorReadings',
                device: deviceName
            });
        } else {
            const subdevices = testHub.getSubdevices();
            if (subdevices.length === 0) {
                results.push({
                    name: 'should get latest sensor readings',
                    passed: false,
                    skipped: true,
                    error: 'Hub has no subdevices',
                    device: deviceName
                });
            } else {
                const sensorIds = subdevices.map(sub => sub.subdeviceId).slice(0, 3);
                
                const response = await testHub.getLatestHubSensorReadings(sensorIds, ['light', 'temp', 'humi']);
                
                if (!response || !Array.isArray(response.latest)) {
                    results.push({
                        name: 'should get latest sensor readings',
                        passed: false,
                        skipped: false,
                        error: 'Response latest is not an array',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get latest sensor readings',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { readingCount: response.latest.length }
                    });
                }
            }
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
    
    // Test 4: Get water leak sensors
    try {
        if (typeof testHub.getWaterLeakSensor !== 'function') {
            results.push({
                name: 'should get water leak sensors',
                passed: false,
                skipped: true,
                error: 'Hub does not support getWaterLeakSensor',
                device: deviceName
            });
        } else {
            const subdevices = testHub.getSubdevices();
            const waterLeakSensors = subdevices
                .filter(sub => {
                    const type = (sub.type || sub._type || '').toLowerCase();
                    return type === 'ms400' || type === 'ms405';
                })
                .map(sub => sub.subdeviceId)
                .slice(0, 3);
            
            if (waterLeakSensors.length === 0) {
                results.push({
                    name: 'should get water leak sensors',
                    passed: false,
                    skipped: true,
                    error: 'Hub has no water leak sensors',
                    device: deviceName
                });
            } else {
                const response = await testHub.getWaterLeakSensor(waterLeakSensors);
                
                if (!response || !Array.isArray(response.waterLeak)) {
                    results.push({
                        name: 'should get water leak sensors',
                        passed: false,
                        skipped: false,
                        error: 'Response waterLeak is not an array',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get water leak sensors',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { sensorCount: response.waterLeak.length }
                    });
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get water leak sensors',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 5: Get smoke alarm status
    try {
        if (typeof testHub.getSmokeAlarmStatus !== 'function') {
            results.push({
                name: 'should get smoke alarm status',
                passed: false,
                skipped: true,
                error: 'Hub does not support getSmokeAlarmStatus',
                device: deviceName
            });
        } else {
            const subdevices = testHub.getSubdevices();
            // Filter for smoke detectors: ma151
            const smokeSensors = subdevices
                .filter(sub => {
                    const type = (sub.type || sub._type || '').toLowerCase();
                    return type === 'ma151';
                })
                .map(sub => sub.subdeviceId)
                .slice(0, 3);
            
            if (smokeSensors.length === 0) {
                results.push({
                    name: 'should get smoke alarm status',
                    passed: false,
                    skipped: true,
                    error: 'Hub has no smoke sensors',
                    device: deviceName
                });
            } else {
                const response = await testHub.getSmokeAlarmStatus(smokeSensors);
                
                if (!response || !Array.isArray(response.smokeAlarm)) {
                    results.push({
                        name: 'should get smoke alarm status',
                        passed: false,
                        skipped: false,
                        error: 'Response smokeAlarm is not an array',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get smoke alarm status',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { sensorCount: response.smokeAlarm.length }
                    });
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get smoke alarm status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 6: Get hub battery status
    try {
        if (typeof testHub.getHubBattery !== 'function') {
            results.push({
                name: 'should get hub battery status',
                passed: false,
                skipped: true,
                error: 'Hub does not support getHubBattery',
                device: deviceName
            });
        } else {
            const response = await testHub.getHubBattery();
            
            if (!response || !Array.isArray(response.battery)) {
                results.push({
                    name: 'should get hub battery status',
                    passed: false,
                    skipped: false,
                    error: 'Response battery is not an array',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get hub battery status',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { batteryCount: response.battery.length }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get hub battery status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 7: Get sensor adjustment settings
    try {
        if (typeof testHub.getHubSensorAdjust !== 'function') {
            results.push({
                name: 'should get sensor adjustment settings',
                passed: false,
                skipped: true,
                error: 'Hub does not support getHubSensorAdjust',
                device: deviceName
            });
        } else {
            const subdevices = testHub.getSubdevices();
            if (subdevices.length === 0) {
                results.push({
                    name: 'should get sensor adjustment settings',
                    passed: false,
                    skipped: true,
                    error: 'Hub has no subdevices',
                    device: deviceName
                });
            } else {
                const sensorIds = subdevices.map(sub => sub.subdeviceId).slice(0, 3);
                
                const response = await testHub.getHubSensorAdjust(sensorIds);
                
                if (!response || !Array.isArray(response.adjust)) {
                    results.push({
                        name: 'should get sensor adjustment settings',
                        passed: false,
                        skipped: false,
                        error: 'Response adjust is not an array',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get sensor adjustment settings',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { adjustCount: response.adjust.length }
                    });
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get sensor adjustment settings',
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
