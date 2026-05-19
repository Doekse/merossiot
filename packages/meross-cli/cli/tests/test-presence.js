'use strict';

/**
 * Live tests for {@link MerossDevice#presence} ({@link PresenceFeature}) and presence-sensor helpers on the feature object.
 * Standalone LatestX sensors only (hub flows are covered in the hub scenario).
 */

const { MerossHubDevice } = require('meross-iot');
const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    getPrimaryChannel,
    OnlineStatus,
    assertFeatureOrSkip
} = require('./test-helper');

const metadata = {
    name: 'presence',
    description: 'Tests presence detection, light readings, and configuration for presence sensor devices',
    requiredAbilities: ['Appliance.Control.Sensor.LatestX'],
    minDevices: 1
};

/**
 * Runs presence sensor scenario tests.
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

    let presenceDevices = devices || [];
    if (presenceDevices.length === 0) {
        presenceDevices = await findDevicesByAbility(manager, 'Appliance.Control.Sensor.LatestX', OnlineStatus.ONLINE);
    }

    presenceDevices = presenceDevices.filter((device) => !(device instanceof MerossHubDevice));

    for (const device of presenceDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

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
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'presence', deviceName, 'should expose presence feature')) {
        return results;
    }

    const presence = testDevice.presence;

    try {
        const state = await presence.get({ dataTypes: ['presence', 'light'], channel });

        if (state === undefined || state === null) {
            results.push({
                name: 'should get presence sensor state via presence.get',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { note: 'No cached PresenceSensorState yet after get()' }
            });
        } else if (typeof state !== 'object') {
            results.push({
                name: 'should get presence sensor state via presence.get',
                passed: false,
                skipped: false,
                error: `presence.get() returned unexpected type: ${typeof state}`,
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get presence sensor state via presence.get',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { hasState: true }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get presence sensor state via presence.get',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
        if (typeof presence.getPresence !== 'function') {
            results.push({
                name: 'should get presence data',
                passed: false,
                skipped: true,
                error: 'presence.getPresence is not implemented',
                device: deviceName
            });
        } else {
            const p = presence.getPresence({ channel });

            if (p === null) {
                results.push({
                    name: 'should get presence data',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'No presence data in cache yet' }
                });
            } else if (typeof p === 'object' && typeof p.isPresent === 'boolean' &&
                (p.state === 'presence' || p.state === 'absence')) {
                results.push({
                    name: 'should get presence data',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        state: p.state,
                        isPresent: p.isPresent,
                        hasDistance: p.distance !== null && p.distance !== undefined,
                        hasTimestamp: p.timestamp !== null && p.timestamp !== undefined
                    }
                });
            } else {
                results.push({
                    name: 'should get presence data',
                    passed: false,
                    skipped: false,
                    error: `getPresence returned unexpected shape: ${JSON.stringify(p)}`,
                    device: deviceName
                });
            }
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

    try {
        if (typeof presence.isPresent !== 'function') {
            results.push({
                name: 'should check presence via presence.isPresent',
                passed: false,
                skipped: true,
                error: 'presence.isPresent is not implemented',
                device: deviceName
            });
        } else {
            const isPresent = presence.isPresent({ channel });

            if (isPresent === null) {
                results.push({
                    name: 'should check presence via presence.isPresent',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'No presence data in cache yet' }
                });
            } else if (typeof isPresent === 'boolean') {
                results.push({
                    name: 'should check presence via presence.isPresent',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { isPresent }
                });
            } else {
                results.push({
                    name: 'should check presence via presence.isPresent',
                    passed: false,
                    skipped: false,
                    error: `isPresent returned unexpected type: ${typeof isPresent}`,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should check presence via presence.isPresent',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (typeof presence.getLight !== 'function') {
            results.push({
                name: 'should get light reading',
                passed: false,
                skipped: true,
                error: 'presence.getLight is not implemented',
                device: deviceName
            });
        } else {
            const light = presence.getLight({ channel });

            if (light === null) {
                results.push({
                    name: 'should get light reading',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'No light data in cache yet' }
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

    try {
        if (typeof presence.getAllSensorReadings !== 'function') {
            results.push({
                name: 'should get all sensor readings',
                passed: false,
                skipped: true,
                error: 'presence.getAllSensorReadings is not implemented',
                device: deviceName
            });
        } else {
            const allReadings = presence.getAllSensorReadings({ channel });

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

    try {
        if (typeof presence.getConfig !== 'function') {
            results.push({
                name: 'should get presence configuration',
                passed: false,
                skipped: true,
                error: 'presence.getConfig is not implemented',
                device: deviceName
            });
        } else {
            const config = await presence.getConfig({ channel });

            if (!config) {
                results.push({
                    name: 'should get presence configuration',
                    passed: false,
                    skipped: false,
                    error: 'presence.getConfig() returned null or undefined',
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
        }
    } catch (error) {
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('not supported') || errorMsg.includes('not found') || errorMsg.includes('timeout')) {
            results.push({
                name: 'should get presence configuration',
                passed: false,
                skipped: true,
                error: `getConfig not supported or timed out: ${errorMsg}`,
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

    try {
        if (typeof presence.getStudy !== 'function') {
            results.push({
                name: 'should get presence study status',
                passed: false,
                skipped: true,
                error: 'presence.getStudy is not implemented',
                device: deviceName
            });
        } else {
            const study = await presence.getStudy();

            if (!study) {
                results.push({
                    name: 'should get presence study status',
                    passed: false,
                    skipped: false,
                    error: 'presence.getStudy() returned null or undefined',
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
        }
    } catch (error) {
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('not supported') || errorMsg.includes('not found') || errorMsg.includes('timeout')) {
            results.push({
                name: 'should get presence study status',
                passed: false,
                skipped: true,
                error: `getStudy not supported or timed out: ${errorMsg}`,
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

    return results;
}

module.exports = {
    metadata,
    runTests
};
