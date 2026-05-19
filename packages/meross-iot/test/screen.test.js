'use strict';

/**
 * Mocked-device tests for {@link module:abilities/screen}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createScreenAbility = require('../lib/abilities/screen');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('screen ability (mocked device)', () => {
    it('get sends GET Appliance.Control.Screen.Brightness', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ brightness: [] }) });
        const screen = createScreenAbility({ publishMessage });

        await screen.get({ channel: 1 });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Screen.Brightness');
        assert.strictEqual(calls[0].payload.brightness[0].channel, 1);
    });

    it('set sends SET with brightness payload', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const screen = createScreenAbility({ publishMessage });

        await screen.set({ channel: 0, standby: 1, operation: 80, standbyView: 2 });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Screen.Brightness');
    });
});
