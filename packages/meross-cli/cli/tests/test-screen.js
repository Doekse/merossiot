'use strict';

/**
 * Live tests for {@link MerossDevice#screen} ({@link ScreenFeature#get} / brightness array).
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    getPrimaryChannel,
    OnlineStatus,
    assertFeatureOrSkip
} = require('./test-helper');

const metadata = {
    name: 'screen',
    description: 'Tests screen brightness control',
    requiredAbilities: ['Appliance.Control.Screen.Brightness'],
    minDevices: 1
};

/**
 * Runs screen brightness scenario tests.
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
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Screen.Brightness', OnlineStatus.ONLINE);
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find screen brightness devices',
            passed: false,
            skipped: true,
            error: 'No Screen Brightness device has been found to run this test on',
            device: null
        });
        return results;
    }

    results.push({
        name: 'should find screen brightness devices',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'screen', deviceName, 'should expose screen feature')) {
        return results;
    }

    try {
        const response = await testDevice.screen.get({ channel });

        if (!response) {
            results.push({
                name: 'should get screen brightness',
                passed: false,
                skipped: false,
                error: 'screen.get() returned null or undefined',
                device: deviceName
            });
        } else if (!Array.isArray(response.brightness)) {
            results.push({
                name: 'should get screen brightness',
                passed: false,
                skipped: false,
                error: 'Response brightness is not an array',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get screen brightness',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { brightness: response.brightness }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get screen brightness',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const currentResponse = await testDevice.screen.get({ channel });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!currentResponse || !Array.isArray(currentResponse.brightness) || currentResponse.brightness.length === 0) {
            results.push({
                name: 'should read screen brightness via feature API',
                passed: false,
                skipped: true,
                error: 'Could not get current brightness or brightness array is empty',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should read screen brightness via feature API',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: {
                    note: 'Brightness not changed to avoid disrupting the device',
                    channel,
                    sample: currentResponse.brightness[0]
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should read screen brightness via feature API',
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
