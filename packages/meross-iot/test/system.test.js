'use strict';

/**
 * Mocked-device tests for {@link module:abilities/system}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createSystemAbility = require('../lib/abilities/system');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('system ability (mocked device)', () => {
    it('getAbilities uses GET Appliance.System.Ability', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ ability: {} })
        });
        const device = {
            _updateAbilities() {},
            publishMessage
        };
        const system = createSystemAbility(device);

        await system.getAbilities();

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.System.Ability');
    });

    it('getHardware uses GET Appliance.System.Hardware', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ hardware: { version: '1' } })
        });
        const device = {
            publishMessage
        };
        const system = createSystemAbility(device);

        await system.getHardware();

        assert.strictEqual(calls[0].namespace, 'Appliance.System.Hardware');
    });

    it('getEncryptSuite uses GET Appliance.Encrypt.Suite', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const system = createSystemAbility({ publishMessage });

        await system.getEncryptSuite();

        assert.strictEqual(calls[0].namespace, 'Appliance.Encrypt.Suite');
    });
});
