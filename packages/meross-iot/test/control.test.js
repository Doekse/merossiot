'use strict';

/**
 * Mocked-device tests for {@link module:abilities/control}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createControlAbility = require('../lib/abilities/control');
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

    it('setUpgrade caches decoded upgradeInfo from response', async () => {
        const device = {};
        const { publishMessage } = createPublishRecorder({
            responseFor: () => ({
                upgradeInfo: { status: 1, subdev: [{ devid: 'x', status: 0 }] }
            })
        });
        device.publishMessage = publishMessage;
        const control = createControlAbility(device);

        await control.setUpgrade({ upgradeData: { url: 'x' } });

        assert.strictEqual(control.getLastUpgrade().status, 'start-download');
        assert.strictEqual(control.getLastUpgrade().subdev[0].status, 'pending-transfer');
    });
});
