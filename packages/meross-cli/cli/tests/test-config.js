'use strict';

/**
 * Config live tests — `MerossDevice.config` (`ConfigFeature`) for Appliance.Config.OverTemp.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    REQUIRE_ONLINE,
    assertFeatureOrSkip
} = require('./test-helper');

const metadata = {
    name: 'config',
    description: 'Tests MerossDevice.config.get/set for over-temperature protection (Appliance.Config.OverTemp)',
    requiredAbilities: ['Appliance.Config.OverTemp'],
    minDevices: 1
};

/**
 * Runs config scenario tests.
 *
 * @param {Object} context - Runner context
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
            'Appliance.Config.OverTemp',
            REQUIRE_ONLINE
        );
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should get over-temperature config',
            passed: false,
            skipped: true,
            error: 'No online device with Appliance.Config.OverTemp found',
            device: null
        });
        return results;
    }

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'config', deviceName)) {
        return results;
    }

    try {
        const response = await testDevice.config.get();
        if (!response) {
            results.push({
                name: 'should get over-temperature config',
                passed: false,
                skipped: false,
                error: 'config.get() returned null or undefined',
                device: deviceName
            });
        } else if (!response.overTemp) {
            results.push({
                name: 'should get over-temperature config',
                passed: false,
                skipped: false,
                error: 'Response has no overTemp field',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get over-temperature config',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { overTemp: response.overTemp }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get over-temperature config',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const currentResponse = await testDevice.config.get();
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!currentResponse || !currentResponse.overTemp) {
            results.push({
                name: 'should read config before optional set (no mutation)',
                passed: false,
                skipped: true,
                error: 'Could not read current over-temperature config',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should read config before optional set (no mutation)',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: {
                    note: 'config.set not invoked — avoids changing user settings on hardware',
                    overTemp: currentResponse.overTemp
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should read config before optional set (no mutation)',
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
