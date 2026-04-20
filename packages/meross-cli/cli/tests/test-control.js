'use strict';

/**
 * Control live tests — `device.control` is attached when batch/upgrade abilities exist; not
 * declared on `MerossDevice` typings (`[key: string]: any` at runtime).
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    OnlineStatus,
    assertFeatureOrSkip,
    deviceHasAbility
} = require('./test-helper');

const metadata = {
    name: 'control',
    description:
        'Tests MerossDevice.control: setMultiple (Appliance.Control.Multiple), acknowledgeOverTemp, setUpgrade — runtime extension vs typings',
    requiredAbilities: ['Appliance.Control.Multiple', 'Appliance.Control.Upgrade', 'Appliance.Control.OverTemp'],
    minDevices: 1
};

/**
 * Collects online devices that declare any of the registry control namespaces.
 *
 * @param {import('meross-iot')} manager
 * @param {Array<Object>|null} deviceFilter
 * @returns {Promise<Array<Object>>}
 */
async function findControlCandidateDevices(manager, deviceFilter) {
    const namespaces = [
        'Appliance.Control.Multiple',
        'Appliance.Control.Upgrade',
        'Appliance.Control.OverTemp'
    ];
    const seen = new Set();
    const out = [];
    for (const ns of namespaces) {
        const batch = await findDevicesByAbility(manager, ns, OnlineStatus.ONLINE, deviceFilter);
        for (const d of batch) {
            if (!seen.has(d.uuid)) {
                seen.add(d.uuid);
                out.push(d);
            }
        }
    }
    return out;
}

/**
 * Runs control scenario tests.
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
        testDevices = await findControlCandidateDevices(manager, null);
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find a device with control namespaces',
            passed: false,
            skipped: true,
            error: 'No online device with Appliance.Control.Multiple / Upgrade / OverTemp',
            device: null
        });
        return results;
    }

    const device = testDevices[0];
    const deviceName = getDeviceName(device);

    if (!assertFeatureOrSkip(results, device, 'control', deviceName)) {
        return results;
    }

    try {
        if (typeof device.control.setMultiple !== 'function') {
            results.push({
                name: 'should execute multiple commands via control.setMultiple',
                passed: false,
                skipped: true,
                error: 'control.setMultiple not available',
                device: deviceName
            });
        } else if (!deviceHasAbility(device, 'Appliance.Control.Multiple')) {
            results.push({
                name: 'should execute multiple commands via control.setMultiple',
                passed: false,
                skipped: true,
                error: 'Device lacks Appliance.Control.Multiple',
                device: deviceName
            });
        } else {
            const commands = [
                { namespace: 'Appliance.System.All', method: 'GET', payload: {} },
                { namespace: 'Appliance.System.Ability', method: 'GET', payload: {} }
            ];
            const response = await device.control.setMultiple({ commands });
            if (!response) {
                results.push({
                    name: 'should execute multiple commands via control.setMultiple',
                    passed: false,
                    skipped: false,
                    error: 'control.setMultiple returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should execute multiple commands via control.setMultiple',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should execute multiple commands via control.setMultiple',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (typeof device.control.acknowledgeOverTemp !== 'function') {
            results.push({
                name: 'should expose acknowledgeOverTemp',
                passed: false,
                skipped: true,
                error: 'control.acknowledgeOverTemp not available',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should expose acknowledgeOverTemp',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: {
                    note: 'SETACK not sent — avoids ack without a real over-temp event'
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should expose acknowledgeOverTemp',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (typeof device.control.setUpgrade !== 'function') {
            results.push({
                name: 'should expose setUpgrade',
                passed: false,
                skipped: true,
                error: 'control.setUpgrade not available',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should expose setUpgrade',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { note: 'Firmware upgrade not triggered in live test' }
            });
        }
    } catch (error) {
        results.push({
            name: 'should expose setUpgrade',
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
