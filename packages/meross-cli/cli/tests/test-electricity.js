'use strict';

/**
 * Electricity / consumption live tests.
 *
 * Exercises two separate optional features on `MerossDevice` (see `meross-iot` `index.d.ts`):
 * - **`device.electricity`** — instant readings (`ElectricityFeature.get`)
 * - **`device.consumption`** — daily energy series (`ConsumptionFeature.get`) and meter settings (`getConfig`)
 *
 * Registry entry **`electricity`** is canonical; **`consumption`** is an alias to this same file
 * (`test-registry.js` `TEST_METADATA.electricity.aliases`).
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    getPrimaryChannel,
    REQUIRE_ONLINE,
    assertFeatureOrSkip
} = require('./test-helper');

const ABILITY_FALLBACK_ORDER = [
    'Appliance.Control.ConsumptionH',
    'Appliance.Control.ConsumptionX',
    'Appliance.Control.Consumption',
    'Appliance.Control.Electricity'
];

const metadata = {
    name: 'electricity',
    description:
        'Instant metrics via device.electricity; daily/config via device.consumption. CLI alias: consumption.',
    requiredAbilities: [
        'Appliance.Control.ConsumptionH',
        'Appliance.Control.ConsumptionX',
        'Appliance.Control.Consumption',
        'Appliance.Control.Electricity'
    ],
    minDevices: 1
};

/**
 * Runs electricity and consumption feature checks against one discovered device.
 *
 * @param {Object} context - Runner context (`manager`, optional `devices`, `options`)
 * @returns {Promise<Array<Object>>} Structured test rows
 */
async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];

    let testDevices = devices || [];
    if (testDevices.length === 0) {
        for (const ability of ABILITY_FALLBACK_ORDER) {
            testDevices = await findDevicesByAbility(manager, ability, REQUIRE_ONLINE);
            if (testDevices.length > 0) {
                break;
            }
        }
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should get instant electricity metrics',
            passed: false,
            skipped: true,
            error:
                'No ConsumptionH/ConsumptionX/Consumption/Electricity device has been found to run this test on',
            device: null
        });
        return results;
    }

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    await waitForDeviceConnection(testDevice, timeout);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // --- device.electricity: instant metrics ---
    try {
        if (
            !assertFeatureOrSkip(
                results,
                testDevice,
                'electricity',
                deviceName,
                'should get instant electricity metrics'
            )
        ) {
            // skip row already pushed
        } else if (typeof testDevice.electricity.get !== 'function') {
            results.push({
                name: 'should get instant electricity metrics',
                passed: false,
                skipped: false,
                error: 'electricity feature has no get()',
                device: deviceName
            });
        } else {
            const metrics = await testDevice.electricity.get({ channel });

            if (!metrics || typeof metrics !== 'object') {
                results.push({
                    name: 'should get instant electricity metrics',
                    passed: false,
                    skipped: false,
                    error: 'electricity.get() returned null, undefined, or non-object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get instant electricity metrics',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { metrics }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get instant electricity metrics',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    // --- device.consumption: daily series ---
    try {
        if (
            !assertFeatureOrSkip(
                results,
                testDevice,
                'consumption',
                deviceName,
                'should get daily power consumption'
            )
        ) {
            // skip
        } else if (typeof testDevice.consumption.get !== 'function') {
            results.push({
                name: 'should get daily power consumption',
                passed: false,
                skipped: false,
                error: 'consumption feature has no get()',
                device: deviceName
            });
        } else {
            const consumption = await testDevice.consumption.get({ channel });

            if (!Array.isArray(consumption)) {
                results.push({
                    name: 'should get daily power consumption',
                    passed: false,
                    skipped: false,
                    error: 'consumption.get() did not return an array',
                    device: deviceName
                });
            } else if (consumption.length > 0) {
                const first = consumption[0];
                if (!first.date || first.totalConsumptionKwh === undefined) {
                    results.push({
                        name: 'should get daily power consumption',
                        passed: false,
                        skipped: false,
                        error:
                            'Consumption entries missing required properties (date or totalConsumptionKwh)',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should get daily power consumption',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { entryCount: consumption.length }
                    });
                }
            } else {
                results.push({
                    name: 'should get daily power consumption',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { entryCount: 0, note: 'No consumption data available' }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get daily power consumption',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    // --- device.consumption: meter config ---
    try {
        if (
            !assertFeatureOrSkip(
                results,
                testDevice,
                'consumption',
                deviceName,
                'should get consumption config'
            )
        ) {
            // skip
        } else if (typeof testDevice.consumption.getConfig !== 'function') {
            results.push({
                name: 'should get consumption config',
                passed: false,
                skipped: false,
                error: 'consumption feature has no getConfig()',
                device: deviceName
            });
        } else {
            const response = await testDevice.consumption.getConfig();

            if (!response) {
                results.push({
                    name: 'should get consumption config',
                    passed: false,
                    skipped: false,
                    error: 'getConfig() returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get consumption config',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { config: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get consumption config',
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
