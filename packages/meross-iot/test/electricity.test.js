'use strict';

/**
 * Mocked-device tests for {@link module:abilities/electricity}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createElectricityAbility = require('../lib/abilities/electricity');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('electricity ability (mocked device)', () => {
    it('get fetches GET Electricity when cache is stale', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor() {
                return {
                    electricity: {
                        channel: 0,
                        current: '1000',
                        voltage: '2300',
                        power: '500'
                    }
                };
            }
        });
        const emitter = createDeviceEmitter();
        const device = {
            abilities: { 'Appliance.Control.Electricity': {} },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const electricity = createElectricityAbility(device);

        const info = await electricity.get({ channel: 0 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Electricity');
        assert.deepStrictEqual(calls[0].payload, { channel: 0 });
        assert.strictEqual(info.voltage, 230);
        assert.strictEqual(info.amperage, 1);
        assert.strictEqual(info.wattage, 0.5);
    });

    it('getRaw forwards GET Electricity', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const device = { abilities: {}, publishMessage };
        const electricity = createElectricityAbility(device);

        await electricity.getRaw({ channel: 1 });

        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Electricity');
        assert.deepStrictEqual(calls[0].payload, { channel: 1 });
    });
});
