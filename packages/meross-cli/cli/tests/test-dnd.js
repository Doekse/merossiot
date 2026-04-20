'use strict';

/**
 * Live tests for {@link MerossDevice#dnd}: {@link DNDFeature#get}, {@link DNDFeature#set}, optional {@code getRaw}.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    OnlineStatus,
    assertFeatureOrSkip
} = require('./test-helper');
const { DNDMode } = require('meross-iot');

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
        testDevices = await findDevicesByAbility(manager, 'Appliance.System.DNDMode', OnlineStatus.ONLINE);
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
        const initialMode = await testDevice.dnd.get();

        if (initialMode === null || initialMode === undefined) {
            results.push({
                name: 'should get and set DND mode',
                passed: false,
                skipped: false,
                error: 'dnd.get() returned null or undefined',
                device: deviceName
            });
        } else if (initialMode !== DNDMode.DND_DISABLED && initialMode !== DNDMode.DND_ENABLED) {
            results.push({
                name: 'should get and set DND mode',
                passed: false,
                skipped: false,
                error: `Invalid DND mode value: ${initialMode}`,
                device: deviceName
            });
        } else {
            const newMode = initialMode === DNDMode.DND_ENABLED ? DNDMode.DND_DISABLED : DNDMode.DND_ENABLED;
            await testDevice.dnd.set({ mode: newMode });
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const updatedMode = await testDevice.dnd.get();

            if (updatedMode !== newMode) {
                results.push({
                    name: 'should get and set DND mode',
                    passed: false,
                    skipped: false,
                    error: `DND mode did not change. Expected ${newMode}, got ${updatedMode}`,
                    device: deviceName
                });
            } else {
                await testDevice.dnd.set({ mode: initialMode });
                await new Promise((resolve) => setTimeout(resolve, 2000));

                const restoredMode = await testDevice.dnd.get();

                if (restoredMode !== initialMode) {
                    results.push({
                        name: 'should get and set DND mode',
                        passed: false,
                        skipped: false,
                        error: `Failed to restore DND mode. Expected ${initialMode}, got ${restoredMode}`,
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
        const initialMode = await testDevice.dnd.get();
        const initialBoolean = initialMode === DNDMode.DND_ENABLED;

        await testDevice.dnd.set({ mode: !initialBoolean });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const updatedMode = await testDevice.dnd.get();
        const expectedMode = !initialBoolean ? DNDMode.DND_ENABLED : DNDMode.DND_DISABLED;

        if (updatedMode !== expectedMode) {
            results.push({
                name: 'should accept boolean values for DND mode',
                passed: false,
                skipped: false,
                error: `Boolean set failed. Expected ${expectedMode}, got ${updatedMode}`,
                device: deviceName
            });
        } else {
            await testDevice.dnd.set({ mode: initialBoolean });
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

    try {
        if (typeof testDevice.dnd.getRaw !== 'function') {
            results.push({
                name: 'should get raw DND mode value',
                passed: false,
                skipped: true,
                error: 'dnd.getRaw is not implemented',
                device: deviceName
            });
        } else {
            const rawMode = await testDevice.dnd.getRaw();

            if (typeof rawMode !== 'number') {
                results.push({
                    name: 'should get raw DND mode value',
                    passed: false,
                    skipped: false,
                    error: `Raw mode is not a number: ${typeof rawMode}`,
                    device: deviceName
                });
            } else if (rawMode !== 0 && rawMode !== 1) {
                results.push({
                    name: 'should get raw DND mode value',
                    passed: false,
                    skipped: false,
                    error: `Invalid raw mode value: ${rawMode} (expected 0 or 1)`,
                    device: deviceName
                });
            } else {
                const enumMode = await testDevice.dnd.get();

                if (rawMode !== enumMode) {
                    results.push({
                        name: 'should get raw DND mode value',
                        passed: false,
                        skipped: false,
                        error: `Raw mode (${rawMode}) does not match enum mode (${enumMode})`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get raw DND mode value',
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
            name: 'should get raw DND mode value',
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
