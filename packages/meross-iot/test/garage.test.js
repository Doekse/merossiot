'use strict';

/**
 * Mocked-device tests for {@link module:abilities/garage}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createGarageAbility = require('../lib/abilities/garage');
const { MerossDeviceError } = require('..');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('garage ability (mocked device)', () => {
    it('set sends SET Appliance.GarageDoor.State with uuid', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ state: [{ channel: 0, open: 1 }] })
        });
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 'u1',
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const garage = createGarageAbility(device);

        await garage.set({ channel: 0, open: true });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.GarageDoor.State');
        assert.strictEqual(calls[0].payload.state.uuid, 'u1');
        assert.strictEqual(calls[0].payload.state.open, 1);
    });

    it('throws when open is missing', async () => {
        const garage = createGarageAbility({
            uuid: 'u1',
            publishMessage: async () => ({ header: {}, payload: {} })
        });

        await assert.rejects(() => garage.set({ channel: 0 }), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });
});
