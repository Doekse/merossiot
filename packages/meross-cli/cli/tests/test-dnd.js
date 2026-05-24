'use strict';

/**
 * Live tests for {@link MerossDevice#dnd}: {@link DNDFeature#get}, {@link DNDFeature#set}.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    REQUIRE_ONLINE,
    assertFeatureOrSkip
} = require('./test-helper');

const metadata = {
    name: 'dnd',
    description: 'Tests do-not-disturb mode functionality',
    requiredAbilities: ['Appliance.System.DNDMode'],
    minDevices: 1
};

/**
 * Runs DND scenario tests against {@link MerossDevice#dnd}.
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
        testDevices = await findDevicesByAbility(manager, 'Appliance.System.DNDMode', REQUIRE_ONLINE);
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with DND mode capability',
            passed: false,
            skipped: true,
            error: 'No devices with Appliance.System.DNDMode found online',
            device: null
        });
        return results;
    }

    results.push({
        name: 'should find devices with DND mode capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'dnd', deviceName, 'should expose dnd feature')) {
        return results;
    }

    try {
        const initialEnabled = await testDevice.dnd.get();

        if (typeof initialEnabled !== 'boolean') {
            results.push({
                name: 'should get and set DND mode',
                passed: false,
                skipped: false,
                error: `dnd.get() returned non-boolean: ${initialEnabled}`,
                device: deviceName
            });
        } else {
            const newEnabled = !initialEnabled;
            await testDevice.dnd.set({ enabled: newEnabled });
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const updatedEnabled = await testDevice.dnd.get();

            if (updatedEnabled !== newEnabled) {
                results.push({
                    name: 'should get and set DND mode',
                    passed: false,
                    skipped: false,
                    error: `DND state did not change. Expected ${newEnabled}, got ${updatedEnabled}`,
                    device: deviceName
                });
            } else {
                await testDevice.dnd.set({ enabled: initialEnabled });
                await new Promise((resolve) => setTimeout(resolve, 2000));

                const restoredEnabled = await testDevice.dnd.get();

                if (restoredEnabled !== initialEnabled) {
                    results.push({
                        name: 'should get and set DND mode',
                        passed: false,
                        skipped: false,
                        error: `Failed to restore DND state. Expected ${initialEnabled}, got ${restoredEnabled}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get and set DND mode',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName
                    });
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should get and set DND mode',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const initialEnabled = await testDevice.dnd.get();

        await testDevice.dnd.set({ enabled: !initialEnabled });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const updatedEnabled = await testDevice.dnd.get();

        if (updatedEnabled !== !initialEnabled) {
            results.push({
                name: 'should accept boolean values for DND mode',
                passed: false,
                skipped: false,
                error: `Boolean set failed. Expected ${!initialEnabled}, got ${updatedEnabled}`,
                device: deviceName
            });
        } else {
            await testDevice.dnd.set({ enabled: initialEnabled });
            await new Promise((resolve) => setTimeout(resolve, 2000));

            results.push({
                name: 'should accept boolean values for DND mode',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should accept boolean values for DND mode',
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
