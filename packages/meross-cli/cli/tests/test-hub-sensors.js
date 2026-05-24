'use strict';

/**
 * Hub Sensors Tests
 *
 * Exercises {@link import('meross-iot').MerossHubDevice#getSubdevices} and the hub
 * feature object (`device.hub` from hub-ability) for sensor reads — the published
 * `index.d.ts` surface is minimal; runtime methods live on `device.hub`.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    REQUIRE_ONLINE,
    assertFeatureOrSkip
} = require('./test-helper');

const metadata = {
    name: 'hub',
    description: 'Tests hub sensor discovery and temperature/humidity readings',
    requiredAbilities: ['Appliance.Hub.Sensor.All', 'Appliance.Hub.Sensor.TempHum', 'Appliance.Hub.Battery'],
    minDevices: 1
};

/**
 * Lowercase subdevice type for filtering (Meross uses several field names).
 *
 * @param {Object} sub - Hub subdevice instance
 * @returns {string}
 */
function subdeviceTypeLower(sub) {
    return String(sub.type || '').toLowerCase();
}

/**
 * Runs hub sensor live scenarios.
 *
 * @param {Object} context - Runner context
 * @param {import('meross-iot').Meross} context.manager - Cloud manager
 * @param {Array<import('meross-iot').MerossHubDevice>} [context.devices] - Pre-selected hubs
 * @param {Object} [context.options]
 * @returns {Promise<Array<Object>>}
 */
async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];

    let testHub = null;
    if (devices && devices.length > 0) {
        testHub = devices[0];
    } else {
        const byAll = await findDevicesByAbility(manager, 'Appliance.Hub.Sensor.All', REQUIRE_ONLINE);
        const byHum = await findDevicesByAbility(manager, 'Appliance.Hub.Sensor.TempHum', REQUIRE_ONLINE);
        const merged = [...byAll];
        for (const d of byHum) {
            if (!merged.find(x => x.uuid === d.uuid)) {
                merged.push(d);
            }
        }
        if (merged.length > 0) {
            testHub = merged[0];
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

    if (testHub.deviceConnected) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!assertFeatureOrSkip(results, testHub, 'hub', deviceName, 'prerequisite: device.hub API')) {
        return results;
    }

    const hubApi = testHub.hub;

    // Test 1: Get all sensors
    try {
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
            const sensorIds = subdevices.map(sub => sub.subdeviceId).slice(0, 5);

            const response = await hubApi.getAllSensors(sensorIds);

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
            const sensorIds = subdevices
                .filter(sub => {
                    const type = subdeviceTypeLower(sub);
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
                const response = await testHub.tempHum.get({ sensorIds });

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
        const subdevices = testHub.getSubdevices();
        if (subdevices.length === 0) {
            results.push({
                name: 'should get latest sensor readings',
                passed: false,
                skipped: true,
                error: 'Hub has no subdevices',
                device: deviceName
            });
        } else if (typeof hubApi.getLatestSensorReadings !== 'function') {
            results.push({
                name: 'should get latest sensor readings',
                passed: false,
                skipped: true,
                error: 'Hub does not support getLatestSensorReadings',
                device: deviceName
            });
        } else {
            const sensorIds = subdevices.map(sub => sub.subdeviceId).slice(0, 3);

            const response = await hubApi.getLatestSensorReadings({
                sensorIds,
                dataTypes: ['light', 'temp', 'humi']
            });

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
        const subdevices = testHub.getSubdevices();
        const waterLeakSensors = subdevices
            .filter(sub => {
                const type = subdeviceTypeLower(sub);
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
            const response = await testHub.waterLeak.get({ sensorIds: waterLeakSensors });

            const wl = response && (response.waterLeak || response.waterleak);
            if (!response || !Array.isArray(wl)) {
                results.push({
                    name: 'should get water leak sensors',
                    passed: false,
                    skipped: false,
                    error: 'Response water leak list is not an array',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get water leak sensors',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { sensorCount: wl.length }
                });
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
        const subdevices = testHub.getSubdevices();
        const smokeSensors = subdevices
            .filter(sub => {
                const type = subdeviceTypeLower(sub);
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
        } else if (!testHub.smokeAlarm || typeof testHub.smokeAlarm.get !== 'function') {
            results.push({
                name: 'should get smoke alarm status',
                passed: false,
                skipped: true,
                error: 'Hub does not support smokeAlarm.get',
                device: deviceName
            });
        } else {
            const response = await testHub.smokeAlarm.get({ sensorIds: smokeSensors });

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
        if (typeof hubApi.getBattery !== 'function') {
            results.push({
                name: 'should get hub battery status',
                passed: false,
                skipped: true,
                error: 'Hub does not support getBattery',
                device: deviceName
            });
        } else {
            const response = await hubApi.getBattery();

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

            const response = await testHub.sensorAdjust.get({ sensorIds });

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
