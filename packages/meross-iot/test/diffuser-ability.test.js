'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/diffuser-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createDiffuserAbility = require('../lib/controller/abilities/diffuser-ability');
const { MerossDeviceError } = require('..');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('diffuser ability (mocked device)', () => {
    it('set with light uses Appliance.Control.Diffuser.Light', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 'dev-uuid',
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const diffuser = createDiffuserAbility(device);

        await diffuser.set({ light: { channel: 0, onoff: 1 } });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Diffuser.Light');
        assert.strictEqual(calls[0].payload.light[0].uuid, 'dev-uuid');
    });

    it('set with mode uses Appliance.Control.Diffuser.Spray', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const device = {
            uuid: 'dev-uuid',
            emit: () => {},
            publishMessage
        };
        const diffuser = createDiffuserAbility(device);

        await diffuser.set({ channel: 0, mode: 1 });

        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Diffuser.Spray');
    });

    it('getSensor uses Appliance.Control.Diffuser.Sensor', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const diffuser = createDiffuserAbility({ uuid: 'x', publishMessage });

        await diffuser.getSensor();

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Diffuser.Sensor');
    });

    it('throws when neither light nor mode is provided', async () => {
        const diffuser = createDiffuserAbility({ uuid: 'x', publishMessage: async () => ({ header: {}, payload: {} }) });

        await assert.rejects(() => diffuser.set({}), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });

    it('get throws for invalid type', async () => {
        const diffuser = createDiffuserAbility({
            uuid: 'x',
            lastFullUpdateTimestamp: Date.now(),
            _diffuserLightStateByChannel: new Map(),
            _diffuserSprayStateByChannel: new Map(),
            publishMessage: async () => ({ header: {}, payload: {} })
        });

        await assert.rejects(() => diffuser.get({ type: 'invalid' }), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });
});
