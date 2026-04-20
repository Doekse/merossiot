'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/child-lock-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createChildLockAbility = require('../lib/controller/abilities/child-lock-ability');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('child lock ability (mocked device)', () => {
    it('get sends GET Appliance.Control.PhysicalLock', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ lock: [] }) });
        const lock = createChildLockAbility({ publishMessage });

        await lock.get({ channel: 0 });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.PhysicalLock');
        assert.deepStrictEqual(calls[0].payload.lock[0], { channel: 0 });
    });

    it('set sends SET with onoff', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const lock = createChildLockAbility({ publishMessage });

        await lock.set({ channel: 0, onoff: 1 });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.PhysicalLock');
        assert.strictEqual(calls[0].payload.lock[0].onoff, 1);
    });
});
