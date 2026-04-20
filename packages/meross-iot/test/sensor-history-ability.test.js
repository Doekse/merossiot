'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/sensor-history-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createSensorHistoryAbility = require('../lib/controller/abilities/sensor-history-ability');
const { MerossDeviceError } = require('..');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('sensor history ability (mocked device)', () => {
    it('get sends GET Appliance.Control.Sensor.History with capacity', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ history: [] }) });
        const hist = createSensorHistoryAbility({ publishMessage });

        await hist.get({ channel: 0, capacity: 1 });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Sensor.History');
        assert.strictEqual(calls[0].payload.history[0].capacity, 1);
    });

    it('get throws when capacity is missing', async () => {
        const hist = createSensorHistoryAbility({ publishMessage: async () => ({}) });

        await assert.rejects(() => hist.get({ channel: 0 }), MerossDeviceError);
    });
});
