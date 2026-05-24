'use strict';

/**
 * Live tests for {@link MerossDevice#smokeConfig} ({@link SmokeConfigFeature#get} / {@link SmokeConfigFeature#set} surface).
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
    name: 'smoke-config',
    description: 'Tests smoke detector configuration settings',
    requiredAbilities: ['Appliance.Control.Smoke.Config'],
    minDevices: 1
};

/**
 * Runs smoke configuration scenario tests.
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
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Smoke.Config', REQUIRE_ONLINE);
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find smoke config devices',
            passed: false,
            skipped: true,
            error: 'No Smoke Config device has been found to run this test on',
            device: null
        });
        return results;
    }

    results.push({
        name: 'should find smoke config devices',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    await waitForDeviceConnection(testDevice, timeout);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (!assertFeatureOrSkip(results, testDevice, 'smokeConfig', deviceName, 'should expose smokeConfig feature')) {
        return results;
    }

    try {
        const response = await testDevice.smokeConfig.get({ channel });

        if (!response) {
            results.push({
                name: 'should get smoke config',
                passed: false,
                skipped: false,
                error: 'smokeConfig.get() returned null or undefined',
                device: deviceName
            });
        } else if (!Array.isArray(response.config)) {
            results.push({
                name: 'should get smoke config',
                passed: false,
                skipped: false,
                error: 'Response config is not an array',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get smoke config',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { configCount: response.config.length }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get smoke config',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const currentResponse = await testDevice.smokeConfig.get({ channel });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!currentResponse || !Array.isArray(currentResponse.config)) {
            results.push({
                name: 'should expose smokeConfig.set',
                passed: false,
                skipped: true,
                error: 'Could not get current smoke config or config is not an array',
                device: deviceName
            });
        } else if (typeof testDevice.smokeConfig.set !== 'function') {
            results.push({
                name: 'should expose smokeConfig.set',
                passed: false,
                skipped: true,
                error: 'smokeConfig.set is not implemented',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should expose smokeConfig.set',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: {
                    configEntries: currentResponse.config.length,
                    note: 'set() not invoked to avoid disrupting the device'
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should expose smokeConfig.set',
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
