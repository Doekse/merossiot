'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/dnd-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createDNDAbility = require('../lib/controller/abilities/dnd-ability');
const { DNDMode } = require('../lib/model/enums');
const { MerossDeviceError } = require('..');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('DND ability (mocked device)', () => {
    it('set sends SET Appliance.System.DNDMode', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const dnd = createDNDAbility({ uuid: 'u1', publishMessage });

        await dnd.set({ mode: true });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.System.DNDMode');
        assert.strictEqual(calls[0].payload.DNDMode.mode, DNDMode.DND_ENABLED);
    });

    it('throws when mode is missing', async () => {
        const dnd = createDNDAbility({ uuid: 'u1', publishMessage: async () => ({}) });

        await assert.rejects(() => dnd.set({}), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });

    it('throws for invalid mode value', async () => {
        const dnd = createDNDAbility({ uuid: 'u1', publishMessage: async () => ({}) });

        await assert.rejects(() => dnd.set({ mode: 99 }), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });
});
