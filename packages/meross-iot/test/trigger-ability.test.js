'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/trigger-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createTriggerAbility = require('../lib/controller/abilities/trigger-ability');
const { MerossDeviceError } = require('..');
const { createDeviceEmitter, createDispatchStateShim, createPublishRecorder } = require('./helpers/mock-ability-device');

const pushTriggerX = createDispatchStateShim('Appliance.Control.TriggerX', 'triggerx');

describe('trigger ability (mocked device)', () => {
    it('get sends GET TriggerX with channel in payload when cache miss', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor() {
                return { triggerx: [] };
            }
        });
        const device = {
            lastFullUpdateTimestamp: Date.now() - 60_000,
            _triggerxStateByChannel: new Map(),
            publishMessage
        };
        const trigger = createTriggerAbility(device);

        await trigger.get({ channel: 2 });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.TriggerX');
        assert.deepStrictEqual(calls[0].payload, { triggerx: { channel: 2 } });
    });

    it('set sends SET TriggerX', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const emitter = createDeviceEmitter();
        const device = {
            emit: emitter.emit.bind(emitter),
            publishMessage,
            _triggerxStateByChannel: new Map()
        };
        const trigger = createTriggerAbility(device);

        await trigger.set({ triggerx: { id: 'a', channel: 0, alias: 'test' } });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.TriggerX');
    });

    it('delete throws when triggerId is missing', async () => {
        const trigger = createTriggerAbility({ publishMessage: async () => ({ header: {}, payload: {} }) });

        await assert.rejects(() => trigger.delete({}), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });

    it('push-shaped triggerx payload updates cache and emits stateChange', () => {
        const emitter = createDeviceEmitter();
        const events = [];
        emitter.on('stateChange', (e) => events.push(e));
        const device = {
            emit: emitter.emit.bind(emitter),
            _triggerxStateByChannel: new Map()
        };

        pushTriggerX(device, { id: 'p1', channel: 0, enable: 1, type: 0 }, 'push');

        assert.strictEqual(device._triggerxStateByChannel.get(0).length, 1);
        assert.strictEqual(device._triggerxStateByChannel.get(0)[0].id, 'p1');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'trigger');
        assert.strictEqual(events[0].source, 'push');
    });
});
