'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/control-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createControlAbility = require('../lib/controller/abilities/control-ability');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('control ability (mocked device)', () => {
    it('setMultiple sends SET Appliance.Control.Multiple', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const control = createControlAbility({ publishMessage });

        await control.setMultiple({
            commands: [
                {
                    namespace: 'Appliance.Control.ToggleX',
                    method: 'SET',
                    payload: { togglex: { channel: 0, onoff: 1 } }
                }
            ]
        });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Multiple');
        assert.strictEqual(calls[0].payload.multiple[0].header.namespace, 'Appliance.Control.ToggleX');
    });

    it('acknowledgeOverTemp sends SETACK Appliance.Control.OverTemp', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const control = createControlAbility({ publishMessage });

        await control.acknowledgeOverTemp();

        assert.strictEqual(calls[0].method, 'SETACK');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.OverTemp');
    });

    it('setUpgrade sends SET Appliance.Control.Upgrade', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const control = createControlAbility({ publishMessage });

        await control.setUpgrade({ upgradeData: { foo: 1 } });

        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Upgrade');
        assert.deepStrictEqual(calls[0].payload.upgrade, { foo: 1 });
    });
});
