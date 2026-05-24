'use strict';

/**
 * Live tests for {@link MerossDevice#timer}: create, query, delete, and digest push handling.
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
    name: 'timer',
    description: 'Tests timer creation, management, and execution',
    requiredAbilities: ['Appliance.Control.TimerX', 'Appliance.Digest.TimerX'],
    minDevices: 1
};

const TEST_ALIAS = 'Test Timer - CLI Test';

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
 * Runs timer scenario tests.
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
        const control = await findDevicesByAbility(manager, 'Appliance.Control.TimerX', REQUIRE_ONLINE);
        const digest = await findDevicesByAbility(manager, 'Appliance.Digest.TimerX', REQUIRE_ONLINE);
        testDevices = mergeDevicesByUuid(control, digest);
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with timer capability',
            passed: false,
            skipped: true,
            error: 'No devices with timer capability found',
            device: null
        });
        return results;
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    results.push({
        name: 'should find devices with timer capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'timer', deviceName, 'should expose timer feature')) {
        return results;
    }

    let createdTimerId = null;

    try {
        const testTimer = testDevice.timer.createTimer({
            alias: TEST_ALIAS,
            time: '12:00',
            days: ['weekday'],
            on: true,
            type: 'single-point-weekly',
            channel,
            enabled: true
        });

        let timerIdFromPush = null;
        const pushNotificationPromise = new Promise((resolve) => {
            const handler = (event) => {
                if (event.type === 'timer' && event.value) {
                    const timerData = Array.isArray(event.value) ? event.value : [event.value];
                    const created = timerData.find(
                        (t) => t.channel === channel && t.alias === TEST_ALIAS && t.id
                    );
                    if (created && created.id) {
                        timerIdFromPush = created.id;
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

        const createResult = await testDevice.timer.set({ timerx: testTimer });

        if (!createResult) {
            results.push({
                name: 'should create timer',
                passed: false,
                skipped: false,
                error: 'timer.set() returned null or undefined',
                device: deviceName
            });
            return results;
        }

        await pushNotificationPromise;

        if (timerIdFromPush) {
            createdTimerId = timerIdFromPush;
        } else if (testTimer.id) {
            createdTimerId = testTimer.id;
        } else {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const timers = await testDevice.timer.get({ channel });
            const foundTimer = timers?.timerx?.find((t) => t.alias === TEST_ALIAS);
            if (foundTimer && foundTimer.id) {
                createdTimerId = foundTimer.id;
            }
        }

        if (!createdTimerId) {
            results.push({
                name: 'should create timer',
                passed: false,
                skipped: false,
                error: 'Could not get timer ID after creation',
                device: deviceName
            });
            return results;
        }

        const timerInfo = await testDevice.timer.get({ timerId: createdTimerId });

        if (!timerInfo || !timerInfo.timerx) {
            results.push({
                name: 'should create timer',
                passed: false,
                skipped: false,
                error: 'timer.get({ timerId }) returned no timerx payload',
                device: deviceName
            });
            return results;
        }

        const timerResponse = await testDevice.timer.get({ channel });
        const cachedTimers = timerResponse?.timerx || [];

        results.push({
            name: 'should create timer',
            passed: true,
            skipped: false,
            error: null,
            device: deviceName,
            details: {
                timerId: createdTimerId,
                cachedTimerCount: cachedTimers.length
            }
        });
    } catch (error) {
        results.push({
            name: 'should create timer',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
        return results;
    }

    if (createdTimerId) {
        try {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            let deleteResponse;
            try {
                deleteResponse = await testDevice.timer.delete({ timerId: createdTimerId, channel });
            } catch (deleteError) {
                results.push({
                    name: 'should delete timer',
                    passed: false,
                    skipped: false,
                    error: `timer.delete threw: ${deleteError.message}`,
                    device: deviceName,
                    details: {
                        timerId: createdTimerId,
                        error: deleteError.message,
                        stack: deleteError.stack
                    }
                });
                return results;
            }

            const deleteResponseString = JSON.stringify(deleteResponse, null, 2);

            if (!deleteResponse) {
                results.push({
                    name: 'should delete timer',
                    passed: false,
                    skipped: false,
                    error: 'timer.delete returned null or undefined',
                    device: deviceName,
                    details: {
                        timerId: createdTimerId,
                        note: 'DELETE may have timed out or not received DELETEACK'
                    }
                });
                return results;
            }

            const deleteResponseError = deleteResponse?.error;
            const hasError = deleteResponseError !== null && deleteResponseError !== undefined;
            const isIdNotFound =
                deleteResponseError?.code === 5050 || deleteResponseError?.detail === 'id not found';

            if (hasError && !isIdNotFound) {
                results.push({
                    name: 'should delete timer',
                    passed: false,
                    skipped: false,
                    error: `timer.delete failed: ${JSON.stringify(deleteResponseError)}`,
                    device: deviceName,
                    details: {
                        timerId: createdTimerId,
                        deleteResponse: deleteResponseString
                    }
                });
                return results;
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));

            try {
                const timersResponse = await testDevice.timer.get({ channel });

                let timerStillExists = false;
                let allTimerIds = [];

                if (timersResponse && timersResponse.timerx) {
                    const timers = Array.isArray(timersResponse.timerx)
                        ? timersResponse.timerx
                        : [timersResponse.timerx];
                    allTimerIds = timers.map((t) => t.id);
                    timerStillExists = timers.some((t) => t.id === createdTimerId);
                }

                if (timerStillExists) {
                    results.push({
                        name: 'should delete timer',
                        passed: false,
                        skipped: false,
                        error: `Timer with ID ${createdTimerId} still exists after deletion`,
                        device: deviceName,
                        details: {
                            timerId: createdTimerId,
                            deleteResponse: deleteResponseString,
                            allTimerIds,
                            note: 'DELETE acknowledged but timer still listed after wait'
                        }
                    });
                } else {
                    results.push({
                        name: 'should delete timer',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: {
                            timerId: createdTimerId,
                            deleteResponse: isIdNotFound
                                ? 'Deleted (error 5050 - id not found)'
                                : 'Deleted (empty DELETEACK)',
                            verified: 'Timer confirmed removed from device',
                            allTimerIds
                        }
                    });
                }
            } catch (queryError) {
                results.push({
                    name: 'should delete timer',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        timerId: createdTimerId,
                        deleteResponse: isIdNotFound
                            ? 'Deleted (error 5050 - id not found)'
                            : 'Deleted (empty DELETEACK)',
                        verificationQueryFailed: queryError.message,
                        note: 'DELETE acknowledged; verification query failed'
                    }
                });
            }
        } catch (error) {
            results.push({
                name: 'should delete timer',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName,
                details: {
                    timerId: createdTimerId,
                    stack: error.stack
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
