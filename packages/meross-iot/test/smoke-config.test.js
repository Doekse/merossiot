'use strict';

/**
 * Mocked-device tests for {@link module:abilities/smoke-config}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createSmokeConfigAbility = require('../lib/abilities/smoke-config');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('smoke config ability (mocked device)', () => {
    it('get sends GET Appliance.Control.Smoke.Config', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ config: [] }) });
        const smoke = createSmokeConfigAbility({ publishMessage });

        await smoke.get({ channel: 0 });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Smoke.Config');
    });

    it('set sends SET Appliance.Control.Smoke.Config', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const smoke = createSmokeConfigAbility({ publishMessage });

        await smoke.set({ channel: 0, detect: true, dnd: false });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Smoke.Config');
    });
});
