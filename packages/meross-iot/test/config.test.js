'use strict';

/**
 * Mocked-device tests for {@link module:abilities/config}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createConfigAbility = require('../lib/abilities/config');
const { MerossDeviceError } = require('..');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('config ability (mocked device)', () => {
    it('set sends SET Appliance.Config.OverTemp with enable and type', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ overTemp: { type: 2 } })
        });
        const config = createConfigAbility({ publishMessage });

        await config.set({ enable: true, type: 2 });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Config.OverTemp');
        assert.strictEqual(calls[0].payload.overTemp.enable, 1);
        assert.strictEqual(calls[0].payload.overTemp.type, 2);
    });

    it('throws when enable is missing', async () => {
        const config = createConfigAbility({ publishMessage: async () => ({ header: {}, payload: {} }) });

        await assert.rejects(() => config.set({}), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });
});
