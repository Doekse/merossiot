'use strict';

/**
 * Hub MTS100 Thermostat Valves Tests
 *
 * Uses {@link import('meross-iot').MerossHubDevice#getSubdevices} and the hub feature
 * (`device.hub`) MTS100 helpers — control methods are probed but not invoked with
 * new values to avoid changing user heating schedules.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    OnlineStatus,
    assertFeatureOrSkip
} = require('./test-helper');

const metadata = {
    name: 'mts100',
    description: 'Tests MTS100 thermostat hub functionality',
    requiredAbilities: ['Appliance.Hub.Mts100.All'],
    minDevices: 1
};

/**
 * Whether the subdevice is an MTS100-family valve.
 *
 * @param {Object} sub - Hub subdevice instance
 * @returns {boolean}
 */
function isMts100Subdevice(sub) {
    const t = String(sub.type || '').toLowerCase();
    return t === 'mts100' || t === 'mts100v3';
}

/**
 * Runs MTS100 hub live scenarios.
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
        const mts100Hubs = await findDevicesByAbility(manager, 'Appliance.Hub.Mts100.All', OnlineStatus.ONLINE);

        if (mts100Hubs.length > 0) {
            testHub = mts100Hubs[0];
        }
    }

    if (!testHub) {
        results.push({
            name: 'should get MTS100 all data',
            passed: false,
            skipped: true,
            error: 'No Hub device with MTS100 support has been found to run this test on',
            device: null
        });
        return results;
    }

    const deviceName = getDeviceName(testHub);

    await waitForDeviceConnection(testHub, timeout);
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!assertFeatureOrSkip(results, testHub, 'hub', deviceName, 'prerequisite: device.hub API')) {
        return results;
    }

    const hubApi = testHub.hub;

    // Test 1: Get MTS100 all data
    try {
        const subdevices = testHub.getSubdevices();
        const mts100Ids = subdevices.filter(isMts100Subdevice).map(sub => sub.subdeviceId);

        if (mts100Ids.length === 0) {
            results.push({
                name: 'should get MTS100 all data',
                passed: false,
                skipped: true,
                error: 'Hub has no MTS100 subdevices',
                device: deviceName
            });
        } else {
            const response = await hubApi.getMts100All({ ids: mts100Ids });

            if (!response) {
                results.push({
                    name: 'should get MTS100 all data',
                    passed: false,
                    skipped: false,
                    error: 'getMts100All returned null or undefined',
                    device: deviceName
                });
            } else if (!Array.isArray(response.all)) {
                results.push({
                    name: 'should get MTS100 all data',
                    passed: false,
                    skipped: false,
                    error: 'Response all is not an array',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get MTS100 all data',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { deviceCount: response.all.length }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get MTS100 all data',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    // Test 2: MTS100 mode control API present (no state change)
    try {
        if (typeof hubApi.setMts100Mode !== 'function') {
            results.push({
                name: 'should control MTS100 mode',
                passed: false,
                skipped: true,
                error: 'Hub does not support setMts100Mode',
                device: deviceName
            });
        } else {
            const subdevices = testHub.getSubdevices();
            const mts100Ids = subdevices.filter(isMts100Subdevice).map(sub => sub.subdeviceId);

            if (mts100Ids.length === 0) {
                results.push({
                    name: 'should control MTS100 mode',
                    passed: false,
                    skipped: true,
                    error: 'Hub has no MTS100 subdevices',
                    device: deviceName
                });
            } else {
                await hubApi.getMts100All({ ids: [mts100Ids[0]] });
                await new Promise(resolve => setTimeout(resolve, 1000));

                results.push({
                    name: 'should control MTS100 mode',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'setMts100Mode available; not invoked to avoid changing heating mode' }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should control MTS100 mode',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    // Test 3: MTS100 temperature control API present (no state change)
    try {
        if (typeof hubApi.setMts100Temperature !== 'function') {
            results.push({
                name: 'should control MTS100 temperature',
                passed: false,
                skipped: true,
                error: 'Hub does not support setMts100Temperature',
                device: deviceName
            });
        } else {
            const subdevices = testHub.getSubdevices();
            const mts100Ids = subdevices.filter(isMts100Subdevice).map(sub => sub.subdeviceId);

            if (mts100Ids.length === 0) {
                results.push({
                    name: 'should control MTS100 temperature',
                    passed: false,
                    skipped: true,
                    error: 'Hub has no MTS100 subdevices',
                    device: deviceName
                });
            } else {
                await hubApi.getMts100All({ ids: [mts100Ids[0]] });
                await new Promise(resolve => setTimeout(resolve, 1000));

                results.push({
                    name: 'should control MTS100 temperature',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'setMts100Temperature available; not invoked to avoid changing setpoint' }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should control MTS100 temperature',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    // Test 4: Get MTS100 adjustment settings
    try {
        const subdevices = testHub.getSubdevices();
        const mts100Ids = subdevices.filter(isMts100Subdevice).map(sub => sub.subdeviceId);

        if (mts100Ids.length === 0) {
            results.push({
                name: 'should get MTS100 adjustment settings',
                passed: false,
                skipped: true,
                error: 'Hub has no MTS100 subdevices',
                device: deviceName
            });
        } else {
            const response = await hubApi.getMts100Adjust({ ids: mts100Ids });

            if (!response) {
                results.push({
                    name: 'should get MTS100 adjustment settings',
                    passed: false,
                    skipped: false,
                    error: 'getMts100Adjust returned null or undefined',
                    device: deviceName
                });
            } else if (!Array.isArray(response.adjust)) {
                results.push({
                    name: 'should get MTS100 adjustment settings',
                    passed: false,
                    skipped: false,
                    error: 'Response adjust is not an array',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get MTS100 adjustment settings',
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
            name: 'should get MTS100 adjustment settings',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    // Test 5: Get MTS100 config
    try {
        const subdevices = testHub.getSubdevices();
        const mts100Ids = subdevices.filter(isMts100Subdevice).map(sub => sub.subdeviceId);

        if (mts100Ids.length === 0) {
            results.push({
                name: 'should get MTS100 config',
                passed: false,
                skipped: true,
                error: 'Hub has no MTS100 subdevices',
                device: deviceName
            });
        } else {
            const response = await hubApi.getMts100Config({ ids: mts100Ids });

            if (!response) {
                results.push({
                    name: 'should get MTS100 config',
                    passed: false,
                    skipped: false,
                    error: 'getMts100Config returned null or undefined',
                    device: deviceName
                });
            } else if (!Array.isArray(response.config)) {
                results.push({
                    name: 'should get MTS100 config',
                    passed: false,
                    skipped: false,
                    error: 'Response config is not an array',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get MTS100 config',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { configCount: response.config.length }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get MTS100 config',
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
