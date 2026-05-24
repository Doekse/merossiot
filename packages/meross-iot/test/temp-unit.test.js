'use strict';

/**
 * Mocked-device tests for {@link module:abilities/temp-unit}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createTempUnitAbility = require('../lib/abilities/temp-unit');
const { TempUnitCodec } = require('../lib/enums');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('temp unit ability (mocked device)', () => {
    it('get sends GET Appliance.Control.TempUnit', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ tempUnit: [] }) });
        const tu = createTempUnitAbility({ publishMessage });

        await tu.get({ channel: 0 });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.TempUnit');
    });

    it('set sends SET Appliance.Control.TempUnit', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const tu = createTempUnitAbility({ publishMessage });

        await tu.set({ channel: 0, tempUnit: 1 });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.TempUnit');
        assert.strictEqual(calls[0].payload.tempUnit[0].tempUnit, 1);
    });

    it('set accepts semantic tempUnit string', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const tu = createTempUnitAbility({ publishMessage });

        await tu.set({ channel: 0, tempUnit: 'fahrenheit' });

        assert.strictEqual(calls[0].payload.tempUnit[0].tempUnit, TempUnitCodec.toWire('fahrenheit'));
    });
});
