'use strict';

/**
 * Mocked-device tests for {@link module:abilities/digest-timer}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createDigestTimerAbility = require('../lib/abilities/digest-timer');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('digest timer ability (mocked device)', () => {
    it('get uses GET Appliance.Digest.TimerX', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ digest: [] }) });
        const digestTimer = createDigestTimerAbility({ publishMessage });

        await digestTimer.get();

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Digest.TimerX');
        assert.deepStrictEqual(calls[0].payload, {});
    });
});
