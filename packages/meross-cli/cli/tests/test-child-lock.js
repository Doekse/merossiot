'use strict';

/**
 * Live tests for {@link MerossDevice#childLock} ({@link ChildLockFeature}) on {@link Appliance.Control.PhysicalLock}.
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
    name: 'child-lock',
    description: 'Tests physical lock/child lock safety features',
    requiredAbilities: ['Appliance.Control.PhysicalLock'],
    minDevices: 1
};

/**
 * Runs child-lock scenario tests.
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
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.PhysicalLock', REQUIRE_ONLINE);
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with child lock capability',
            passed: false,
            skipped: true,
            error: 'No devices with Appliance.Control.PhysicalLock found online',
            device: null
        });
        return results;
    }

    results.push({
        name: 'should find devices with child lock capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'childLock', deviceName, 'should expose childLock feature')) {
        return results;
    }

    try {
        const lockStatus = await testDevice.childLock.get({ channel });

        if (!lockStatus) {
            results.push({
                name: 'should get child lock status',
                passed: false,
                skipped: false,
                error: 'childLock.get() returned null or undefined',
                device: deviceName
            });
        } else if (!lockStatus.lock) {
            results.push({
                name: 'should get child lock status',
                passed: false,
                skipped: false,
                error: 'Response does not contain lock property',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get child lock status',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { lockStatus: lockStatus.lock }
            });
        }
    } catch (error) {
        results.push({
            name: 'should get child lock status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const initialStatus = await testDevice.childLock.get({ channel });

        if (!initialStatus || !initialStatus.lock || !Array.isArray(initialStatus.lock) || initialStatus.lock.length === 0) {
            results.push({
                name: 'should control child lock status',
                passed: false,
                skipped: true,
                error: 'Could not get initial lock status or lock array is empty',
                device: deviceName
            });
        } else {
            const initialLockState = initialStatus.lock[0].onoff;
            const newLockState = initialLockState === 1 ? 0 : 1;

            await testDevice.childLock.set({ channel, onoff: newLockState });
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const updatedStatus = await testDevice.childLock.get({ channel });

            if (!updatedStatus || !updatedStatus.lock || !updatedStatus.lock[0]) {
                results.push({
                    name: 'should control child lock status',
                    passed: false,
                    skipped: false,
                    error: 'Could not verify updated lock status',
                    device: deviceName
                });
            } else if (updatedStatus.lock[0].onoff !== newLockState) {
                results.push({
                    name: 'should control child lock status',
                    passed: false,
                    skipped: false,
                    error: `Lock state did not change. Expected ${newLockState}, got ${updatedStatus.lock[0].onoff}`,
                    device: deviceName
                });
            } else {
                await testDevice.childLock.set({ channel, onoff: initialLockState });
                await new Promise((resolve) => setTimeout(resolve, 2000));

                const restoredStatus = await testDevice.childLock.get({ channel });

                if (!restoredStatus || !restoredStatus.lock || !restoredStatus.lock[0] ||
                    restoredStatus.lock[0].onoff !== initialLockState) {
                    results.push({
                        name: 'should control child lock status',
                        passed: false,
                        skipped: false,
                        error: `Failed to restore lock state. Expected ${initialLockState}, got ${restoredStatus?.lock?.[0]?.onoff}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should control child lock status',
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
            name: 'should control child lock status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        const initialStatus = await testDevice.childLock.get({ channel });

        if (!initialStatus || !initialStatus.lock) {
            results.push({
                name: 'should handle multiple channel lock control',
                passed: false,
                skipped: true,
                error: 'Could not get initial lock status',
                device: deviceName
            });
        } else {
            const lockDataArray = [
                {
                    channel,
                    onoff: initialStatus.lock[0]?.onoff ?? 0
                }
            ];

            if (initialStatus.lock.length > 1) {
                for (let i = 1; i < initialStatus.lock.length; i++) {
                    lockDataArray.push({
                        channel: initialStatus.lock[i].channel ?? i,
                        onoff: initialStatus.lock[i].onoff ?? 0
                    });
                }
            }

            await testDevice.childLock.set({ lockData: lockDataArray });
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const updatedStatus = await testDevice.childLock.get({ channel });

            if (!updatedStatus) {
                results.push({
                    name: 'should handle multiple channel lock control',
                    passed: false,
                    skipped: false,
                    error: 'Could not verify updated lock status',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should handle multiple channel lock control',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should handle multiple channel lock control',
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
