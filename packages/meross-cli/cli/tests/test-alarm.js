'use strict';

/**
 * Live tests for {@link MerossDevice#alarm}: GET status and {@link AlarmFeature#getLastEvents} buffer.
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
    name: 'alarm',
    description: 'Tests alarm functionality and notifications',
    requiredAbilities: ['Appliance.Control.Alarm'],
    minDevices: 1
};

/**
 * Runs alarm scenario tests.
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
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Alarm', OnlineStatus.ONLINE);
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find alarm devices',
            passed: false,
            skipped: true,
            error: 'No Alarm device has been found to run this test on',
            device: null
        });
        return results;
    }

    results.push({
        name: 'should find alarm devices',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'alarm', deviceName, 'should expose alarm feature')) {
        return results;
    }

    try {
        const response = await testDevice.alarm.get({ channel });

        if (!response) {
            results.push({
                name: 'should get alarm status',
                passed: false,
                skipped: false,
                error: 'alarm.get() returned null or undefined',
                device: deviceName
            });
        } else if (!Array.isArray(response.alarm)) {
            results.push({
                name: 'should get alarm status',
                passed: false,
                skipped: false,
                error: 'Response alarm is not an array',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get alarm status',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { alarm: response.alarm }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get alarm status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const initialEvents = testDevice.alarm.getLastEvents();

        if (!Array.isArray(initialEvents)) {
            results.push({
                name: 'should expose last alarm events as an array',
                passed: false,
                skipped: false,
                error: 'alarm.getLastEvents() did not return an array',
                device: deviceName
            });
            return results;
        }

        await testDevice.alarm.get({ channel });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const events = testDevice.alarm.getLastEvents();

        if (!Array.isArray(events)) {
            results.push({
                name: 'should expose last alarm events as an array',
                passed: false,
                skipped: false,
                error: 'alarm.getLastEvents() did not return an array after alarm.get',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should expose last alarm events as an array',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { eventCount: events.length }
            });
        }
    } catch (error) {
        results.push({
            name: 'should expose last alarm events as an array',
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
