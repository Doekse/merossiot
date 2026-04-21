'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/runtime-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createRuntimeAbility = require('../lib/controller/abilities/runtime-ability');
const { MerossDeviceError } = require('..');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('runtime ability (mocked device)', () => {
    it('get uses GET Appliance.System.Runtime', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ runtime: { signal: -42 } })
        });
        const device = { publishMessage };
        const runtime = createRuntimeAbility(device);

        const data = await runtime.get();

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.System.Runtime');
        assert.strictEqual(data.signal, -42);
        assert.strictEqual(device.signalStrength, -42);
    });

    it('refreshState throws when system.getAllData is missing', async () => {
        const runtime = createRuntimeAbility({
            deviceType: 'x',
            publishMessage: async () => ({ header: {}, payload: {} })
        });

        await assert.rejects(() => runtime.refreshState(), (err) => err instanceof MerossDeviceError && err.code === 'UNKNOWN_DEVICE_TYPE');
    });
});
