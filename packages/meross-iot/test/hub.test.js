'use strict';

/**
 * Mocked-device tests for {@link module:abilities/hub}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createHubAbility = require('../lib/abilities/hub');
const createMts100Ability = require('../lib/abilities/hub-mts100');
const { handlePushNotification } = require('../lib/abilities/hub');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('hub ability (mocked device)', () => {
    it('setToggle sends SET Appliance.Hub.ToggleX', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const hub = createHubAbility({ publishMessage });

        await hub.setToggle({ subId: 's1', on: true });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.ToggleX');
        assert.deepStrictEqual(calls[0].payload.togglex[0], { id: 's1', onoff: 1 });
    });

    it('getOnline uses GET Appliance.Hub.Online', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const hub = createHubAbility({ publishMessage });

        await hub.getOnline();

        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.Online');
    });

    it('mts100.setMode sends SET Appliance.Hub.Mts100.Mode from hub', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const mts100 = createMts100Ability({ publishMessage });

        await mts100.setMode({ subId: 'v1', mode: 'auto' });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.Mts100.Mode');
    });

    it('handlePushNotification returns false for unmapped namespace', () => {
        const device = {
            constructor: { name: 'MerossHubDevice' },
            uuid: 'hub-uuid',
            meross: { options: {} }
        };

        assert.strictEqual(handlePushNotification(device, 'Appliance.Unknown.Namespace', {}), false);
    });
});
