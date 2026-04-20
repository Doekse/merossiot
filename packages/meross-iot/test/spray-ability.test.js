'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/spray-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createSprayAbility = require('../lib/controller/abilities/spray-ability');
const { MerossDeviceError } = require('..');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('spray ability (mocked device)', () => {
    it('set sends SET Appliance.Control.Spray', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ spray: { channel: 0, mode: 1 } }) });
        const emitter = createDeviceEmitter();
        const device = {
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const spray = createSprayAbility(device);

        await spray.set({ channel: 0, mode: 2 });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Spray');
        assert.deepStrictEqual(calls[0].payload, { spray: { channel: 0, mode: 2 } });
    });

    it('throws when mode is missing', async () => {
        const spray = createSprayAbility({ publishMessage: async () => ({}) });

        await assert.rejects(() => spray.set({ channel: 0 }), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });
});
