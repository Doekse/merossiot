'use strict';

/**
 * Runtime live tests — exercise {@link MerossDevice.runtime} (`get`, `getCached`, `refreshState`)
 * as documented on `RuntimeFeature` in `meross-iot` typings.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    REQUIRE_ONLINE,
    assertFeatureOrSkip
} = require('./test-helper');

const metadata = {
    name: 'runtime',
    description:
        'Tests MerossDevice.runtime: GET Appliance.System.Runtime via runtime.get(), cache via getCached(), and runtime.refreshState()',
    requiredAbilities: ['Appliance.System.Runtime'],
    minDevices: 1
};

/**
 * Runs runtime scenario tests.
 *
 * @param {Object} context - Runner context
 * @param {import('meross-iot')} context.manager - Connected manager
 * @param {Array<Object>} [context.devices] - Pre-selected devices
 * @param {Object} [context.options] - Options (e.g. timeout)
 * @returns {Promise<Array<Object>>} Result rows
 */
async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];

    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(
            manager,
            'Appliance.System.Runtime',
            REQUIRE_ONLINE
        );
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find a device with Appliance.System.Runtime',
            passed: false,
            skipped: true,
            error: 'No online device with runtime support found',
            device: null
        });
        return results;
    }

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'runtime', deviceName)) {
        return results;
    }

    try {
        const data = await testDevice.runtime.get();
        if (!data || typeof data !== 'object') {
            results.push({
                name: 'should fetch runtime via runtime.get()',
                passed: false,
                skipped: false,
                error: 'runtime.get() did not return an object',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should fetch runtime via runtime.get()',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { keys: Object.keys(data) }
            });
        }
    } catch (error) {
        results.push({
            name: 'should fetch runtime via runtime.get()',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const cached = testDevice.runtime.getCached();
        if (!cached || typeof cached !== 'object') {
            results.push({
                name: 'should expose cached runtime after get()',
                passed: false,
                skipped: false,
                error: 'runtime.getCached() did not return an object after get()',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should expose cached runtime after get()',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should expose cached runtime after get()',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (typeof testDevice.runtime.refreshState !== 'function') {
            results.push({
                name: 'should refresh runtime via runtime.refreshState()',
                passed: false,
                skipped: true,
                error: 'runtime.refreshState is not available',
                device: deviceName
            });
        } else {
            await testDevice.runtime.refreshState();
            await new Promise((resolve) => setTimeout(resolve, 500));
            const after = testDevice.runtime.getCached();
            if (!after || typeof after !== 'object') {
                results.push({
                    name: 'should refresh runtime via runtime.refreshState()',
                    passed: false,
                    skipped: false,
                    error: 'runtime cache empty after refreshState()',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should refresh runtime via runtime.refreshState()',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should refresh runtime via runtime.refreshState()',
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
