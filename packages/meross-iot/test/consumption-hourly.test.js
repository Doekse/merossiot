'use strict';

/**
 * Mocked-device tests for ConsumptionH hourly data in {@link module:abilities/consumption}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createConsumptionAbility = require('../lib/abilities/consumption');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('consumption ability ConsumptionH hourly (mocked device)', () => {
    it('get preserves hourly data on cached consumption entries', async () => {
        const hourlyTimestamp = 1700000000;
        const { calls, publishMessage } = createPublishRecorder({
            responseFor(method, namespace) {
                if (method === 'GET' && namespace === 'Appliance.Control.ConsumptionH') {
                    return {
                        consumptionH: [{
                            channel: 0,
                            total: 5000,
                            data: [
                                { timestamp: hourlyTimestamp, value: 42 },
                                { timestamp: hourlyTimestamp + 3600, value: 55 }
                            ]
                        }]
                    };
                }
                return {};
            }
        });
        const emitter = createDeviceEmitter();
        const device = {
            abilities: { 'Appliance.Control.ConsumptionH': {} },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const consumption = createConsumptionAbility(device);

        const data = await consumption.get({ channel: 0 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.ConsumptionH');
        assert.ok(Array.isArray(data));
        assert.strictEqual(data.length, 1);
        assert.strictEqual(data[0].totalConsumptionKwh, 5);
        assert.ok(Array.isArray(data[0].hourly));
        assert.strictEqual(data[0].hourly.length, 2);
        assert.strictEqual(data[0].hourly[0].valueWh, 42);
        assert.strictEqual(data[0].hourly[0].timestamp.getTime(), hourlyTimestamp * 1000);
        assert.strictEqual(data[0].hourly[1].valueWh, 55);
    });

    it('getHourlyConsumption returns the hourly slice for a channel', async () => {
        const { publishMessage } = createPublishRecorder({
            responseFor(method, namespace) {
                if (method === 'GET' && namespace === 'Appliance.Control.ConsumptionH') {
                    return {
                        consumptionH: [{
                            channel: 0,
                            total: 1000,
                            data: [{ timestamp: 1700000000, value: 10 }]
                        }]
                    };
                }
                return {};
            }
        });
        const device = {
            abilities: { 'Appliance.Control.ConsumptionH': {} },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: () => {},
            publishMessage
        };
        const consumption = createConsumptionAbility(device);

        const hourly = await consumption.getHourlyConsumption({ channel: 0 });

        assert.strictEqual(hourly.length, 1);
        assert.strictEqual(hourly[0].valueWh, 10);
    });
});
