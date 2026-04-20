'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/digest-trigger-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createDigestTriggerAbility = require('../lib/controller/abilities/digest-trigger-ability');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('digest trigger ability (mocked device)', () => {
    it('get uses GET Appliance.Digest.TriggerX', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ digest: [] }) });
        const digestTrigger = createDigestTriggerAbility({ publishMessage });

        await digestTrigger.get();

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Digest.TriggerX');
        assert.deepStrictEqual(calls[0].payload, {});
    });
});
