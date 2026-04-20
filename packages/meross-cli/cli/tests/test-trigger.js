'use strict';

/**
 * Live tests for {@link MerossDevice#trigger}: create, query, delete, and digest push handling.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    getPrimaryChannel,
    OnlineStatus,
    assertFeatureOrSkip
} = require('./test-helper');
const { TriggerType } = require('meross-iot');

const metadata = {
    name: 'trigger',
    description: 'Tests trigger configuration and execution',
    requiredAbilities: ['Appliance.Control.TriggerX', 'Appliance.Digest.TriggerX'],
    minDevices: 1
};

const TEST_ALIAS = 'Test Trigger - CLI Test';

/**
 * Merges two ability-based device lists by UUID (deduplicated).
 *
 * @param {Array<Object>} a - First list
 * @param {Array<Object>} b - Second list
 * @returns {Array<Object>} Combined devices
 */
function mergeDevicesByUuid(a, b) {
    const out = [...a];
    for (const device of b) {
        if (!out.some((d) => d.uuid === device.uuid)) {
            out.push(device);
        }
    }
    return out;
}

/**
 * Runs trigger scenario tests.
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
        const control = await findDevicesByAbility(manager, 'Appliance.Control.TriggerX', OnlineStatus.ONLINE);
        const digest = await findDevicesByAbility(manager, 'Appliance.Digest.TriggerX', OnlineStatus.ONLINE);
        testDevices = mergeDevicesByUuid(control, digest);
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with trigger capability',
            passed: false,
            skipped: true,
            error: 'No devices with trigger capability found',
            device: null
        });
        return results;
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    results.push({
        name: 'should find devices with trigger capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'trigger', deviceName, 'should expose trigger feature')) {
        return results;
    }

    let createdTriggerId = null;

    try {
        const testTrigger = testDevice.trigger.createTrigger({
            alias: TEST_ALIAS,
            duration: '30m',
            days: ['weekday'],
            type: TriggerType.SINGLE_POINT_WEEKLY_CYCLE,
            channel,
            enabled: true
        });

        let triggerIdFromPush = null;
        const pushNotificationPromise = new Promise((resolve) => {
            const handler = (event) => {
                if (event.type === 'trigger' && event.value) {
                    const triggerData = Array.isArray(event.value) ? event.value : [event.value];
                    const created = triggerData.find(
                        (t) => t.channel === channel && t.alias === TEST_ALIAS && t.id
                    );
                    if (created && created.id) {
                        triggerIdFromPush = created.id;
                        testDevice.removeListener('stateChange', handler);
                        resolve();
                    }
                }
            };
            testDevice.on('stateChange', handler);
            setTimeout(() => {
                testDevice.removeListener('stateChange', handler);
                resolve();
            }, 5000);
        });

        const createResult = await testDevice.trigger.set({ triggerx: testTrigger });

        if (!createResult) {
            results.push({
                name: 'should create trigger',
                passed: false,
                skipped: false,
                error: 'trigger.set() returned null or undefined',
                device: deviceName
            });
            return results;
        }

        await pushNotificationPromise;

        if (triggerIdFromPush) {
            createdTriggerId = triggerIdFromPush;
        } else if (testTrigger.id) {
            createdTriggerId = testTrigger.id;
        } else {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const triggers = await testDevice.trigger.get({ channel });
            const foundTrigger = triggers?.triggerx?.find((t) => t.alias === TEST_ALIAS);
            if (foundTrigger && foundTrigger.id) {
                createdTriggerId = foundTrigger.id;
            }
        }

        if (!createdTriggerId) {
            results.push({
                name: 'should create trigger',
                passed: false,
                skipped: false,
                error: 'Could not get trigger ID after creation',
                device: deviceName
            });
            return results;
        }

        const triggerInfo = await testDevice.trigger.get({ channel });
        const triggerExists = triggerInfo?.triggerx?.some((t) => t.id === createdTriggerId);

        if (!triggerExists) {
            results.push({
                name: 'should create trigger',
                passed: false,
                skipped: false,
                error: 'Created trigger not found when querying',
                device: deviceName
            });
            return results;
        }

        const triggerResponse = await testDevice.trigger.get({ channel });
        const cachedTriggers = triggerResponse?.triggerx || [];

        results.push({
            name: 'should create trigger',
            passed: true,
            skipped: false,
            error: null,
            device: deviceName,
            details: {
                triggerId: createdTriggerId,
                cachedTriggerCount: cachedTriggers.length
            }
        });
    } catch (error) {
        results.push({
            name: 'should create trigger',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
        return results;
    }

    if (createdTriggerId) {
        try {
            const deleteResponse = await testDevice.trigger.delete({ triggerId: createdTriggerId, channel });

            const deleteResponseError = deleteResponse?.error;
            const hasError = deleteResponseError !== null && deleteResponseError !== undefined;
            const isIdNotFound =
                deleteResponseError?.code === 5050 || deleteResponseError?.detail === 'id not found';

            if (hasError && !isIdNotFound) {
                results.push({
                    name: 'should delete trigger',
                    passed: false,
                    skipped: false,
                    error: `trigger.delete failed: ${JSON.stringify(deleteResponseError)}`,
                    device: deviceName,
                    details: {
                        triggerId: createdTriggerId,
                        deleteResponse
                    }
                });
            } else {
                results.push({
                    name: 'should delete trigger',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        triggerId: createdTriggerId,
                        deleteResponse: isIdNotFound
                            ? 'Trigger deleted (error 5050 - id not found)'
                            : 'DELETE accepted (empty DELETEACK)'
                    }
                });
            }
        } catch (error) {
            results.push({
                name: 'should delete trigger',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName,
                details: {
                    triggerId: createdTriggerId
                }
            });
        }
    }

    return results;
}

module.exports = {
    metadata,
    runTests
};
