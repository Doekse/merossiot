'use strict';

/**
 * Live tests for {@link MerossDevice#sensorHistory} ({@link SensorHistoryFeature#get} and optional {@code delete}).
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    getPrimaryChannel,
    REQUIRE_ONLINE,
    assertFeatureOrSkip
} = require('./test-helper');

const metadata = {
    name: 'sensor-history',
    description: 'Tests sensor history data retrieval',
    requiredAbilities: ['Appliance.Control.Sensor.History'],
    minDevices: 1
};

/**
 * Runs sensor history scenario tests.
 *
 * @param {Object} context - Runner context
 * @param {Object} context.manager - Connected manager
 * @param {Array<Object>} [context.devices] - Pre-filtered devices
 * @param {Object} [context.options] - Options (e.g. timeout)
 * @returns {Promise<Array<Object>>} Result rows
 */
async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];

    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Sensor.History', REQUIRE_ONLINE);
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find sensor history devices',
            passed: false,
            skipped: true,
            error: 'No Sensor History device has been found to run this test on',
            device: null
        });
        return results;
    }

    results.push({
        name: 'should find sensor history devices',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'sensorHistory', deviceName, 'should expose sensorHistory feature')) {
        return results;
    }

    try {
        let historyRetrieved = false;
        let lastError = null;

        for (const capacity of [1, 2, 3]) {
            try {
                const response = await testDevice.sensorHistory.get({ channel, capacity });

                if (!response) {
                    lastError = `sensorHistory.get() returned null or undefined for capacity ${capacity}`;
                    continue;
                }

                if (!Array.isArray(response.history)) {
                    lastError = `Response history is not an array for capacity ${capacity}`;
                    continue;
                }

                historyRetrieved = true;
                results.push({
                    name: 'should get sensor history',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        capacity,
                        historyEntries: response.history.length
                    }
                });
                break;
            } catch (error) {
                lastError = `Capacity ${capacity} not supported: ${error.message}`;
            }
        }

        if (!historyRetrieved) {
            results.push({
                name: 'should get sensor history',
                passed: false,
                skipped: false,
                error: lastError || 'Could not retrieve sensor history with any capacity value',
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should get sensor history',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (typeof testDevice.sensorHistory.delete !== 'function') {
            results.push({
                name: 'should expose sensorHistory.delete when supported',
                passed: false,
                skipped: true,
                error: 'sensorHistory.delete is not implemented',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should expose sensorHistory.delete when supported',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: {
                    note: 'delete() not invoked to avoid data loss'
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should expose sensorHistory.delete when supported',
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
