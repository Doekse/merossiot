'use strict';

/**
 * Live tests for {@link MerossDevice#tempUnit} ({@link TempUnitFeature#get} / {@link TempUnitFeature#set}).
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
    name: 'temp-unit',
    description: 'Tests temperature unit settings (Celsius/Fahrenheit)',
    requiredAbilities: ['Appliance.Control.TempUnit'],
    minDevices: 1
};

/**
 * Runs temperature unit scenario tests.
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
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.TempUnit', REQUIRE_ONLINE);
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find temp unit devices',
            passed: false,
            skipped: true,
            error: 'No Temp Unit device has been found to run this test on',
            device: null
        });
        return results;
    }

    results.push({
        name: 'should find temp unit devices',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'tempUnit', deviceName, 'should expose tempUnit feature')) {
        return results;
    }

    try {
        const response = await testDevice.tempUnit.get({ channel });

        if (!response) {
            results.push({
                name: 'should get temp unit',
                passed: false,
                skipped: false,
                error: 'tempUnit.get() returned null or undefined',
                device: deviceName
            });
        } else if (!Array.isArray(response.tempUnit)) {
            results.push({
                name: 'should get temp unit',
                passed: false,
                skipped: false,
                error: 'Response tempUnit is not an array',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get temp unit',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { tempUnit: response.tempUnit }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get temp unit',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const currentResponse = await testDevice.tempUnit.get({ channel });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!currentResponse || !Array.isArray(currentResponse.tempUnit) || currentResponse.tempUnit.length === 0) {
            results.push({
                name: 'should expose tempUnit.set',
                passed: false,
                skipped: true,
                error: 'Could not get current temp unit or tempUnit array is empty',
                device: deviceName
            });
        } else if (typeof testDevice.tempUnit.set !== 'function') {
            results.push({
                name: 'should expose tempUnit.set',
                passed: false,
                skipped: true,
                error: 'tempUnit.set is not implemented',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should expose tempUnit.set',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: {
                    note: 'set() not invoked to avoid disrupting the device',
                    currentTempUnit: currentResponse.tempUnit[0]
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should expose tempUnit.set',
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
