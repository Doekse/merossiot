'use strict';

/**
 * Mocked-device tests for {@link module:abilities/dnd}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createDNDAbility = require('../lib/abilities/dnd');
const { MerossDeviceError } = require('..');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('DND ability (mocked device)', () => {
    it('set sends SET Appliance.System.DNDMode', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const dnd = createDNDAbility({ uuid: 'u1', publishMessage });

        await dnd.set({ enabled: true });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.System.DNDMode');
        assert.strictEqual(calls[0].payload.DNDMode.mode, 1);
    });

    it('throws when enabled is missing', async () => {
        const dnd = createDNDAbility({ uuid: 'u1', publishMessage: async () => ({ header: {}, payload: {} }) });

        await assert.rejects(() => dnd.set({}), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });

    it('throws for non-boolean enabled value', async () => {
        const dnd = createDNDAbility({ uuid: 'u1', publishMessage: async () => ({ header: {}, payload: {} }) });

        await assert.rejects(() => dnd.set({ enabled: 1 }), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });
});
