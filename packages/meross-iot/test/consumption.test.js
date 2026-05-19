'use strict';

/**
 * Mocked-device tests for {@link module:abilities/consumption}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createConsumptionAbility = require('../lib/abilities/consumption');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('consumption ability (mocked device)', () => {
    it('get uses GET ConsumptionX when ConsumptionX is present', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor(method, namespace) {
                if (method === 'GET' && namespace === 'Appliance.Control.ConsumptionX') {
                    return {
                        consumptionx: [
                            { date: '2024-01-01', value: '5000', channel: 0 }
                        ]
                    };
                }
                return {};
            }
        });
        const emitter = createDeviceEmitter();
        const device = {
            abilities: { 'Appliance.Control.ConsumptionX': {} },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const consumption = createConsumptionAbility(device);

        const data = await consumption.get({ channel: 0 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.ConsumptionX');
        assert.deepStrictEqual(calls[0].payload, { channel: 0 });
        assert.ok(Array.isArray(data));
    });

    it('getConfig uses Appliance.Control.ConsumptionConfig', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const device = { abilities: {}, emit: () => {}, publishMessage };
        const consumption = createConsumptionAbility(device);

        await consumption.getConfig();

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.ConsumptionConfig');
        assert.deepStrictEqual(calls[0].payload, {});
    });
});
