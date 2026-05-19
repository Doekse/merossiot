'use strict';

/**
 * Mocked-device tests for {@link module:abilities/timer}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createTimerAbility = require('../lib/abilities/timer');
const { MerossDeviceError } = require('..');
const { createDeviceEmitter, createDispatchStateShim, createPublishRecorder } = require('./helpers/mock-ability-device');

const pushTimerX = createDispatchStateShim('Appliance.Control.TimerX', 'timerx');

describe('timer ability (mocked device)', () => {
    it('get by timerId sends GET Appliance.Control.TimerX with id payload', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor() {
                return { timerx: { id: 't1', channel: 0 } };
            }
        });
        const device = {
            publishMessage,
            _timerxStateByChannel: new Map()
        };
        const timer = createTimerAbility(device);

        await timer.get({ timerId: 't1' });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.TimerX');
        assert.deepStrictEqual(calls[0].payload, { timerx: { id: 't1' } });
    });

    it('set sends SET TimerX with timerx payload', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const emitter = createDeviceEmitter();
        const device = {
            emit: emitter.emit.bind(emitter),
            publishMessage,
            _timerxStateByChannel: new Map()
        };
        const timer = createTimerAbility(device);

        await timer.set({
            timerx: { id: 'x', channel: 0, enable: 1 }
        });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.TimerX');
        assert.strictEqual(calls[0].payload.timerx.id, 'x');
    });

    it('delete throws when timerId is missing', async () => {
        const timer = createTimerAbility({ publishMessage: async () => ({ header: {}, payload: {} }) });

        await assert.rejects(() => timer.delete({}), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });

    it('getAll returns timers from cache across channels', async () => {
        const device = {
            capabilities: { channels: { ids: [0, 1], count: 2 } },
            publishMessage: async () => ({ header: {}, payload: {} }),
            _timerxStateByChannel: new Map([
                [0, [{ id: 'a', channel: 0, toObject: () => ({ id: 'a', channel: 0 }) }]],
                [1, [{ id: 'b', channel: 1, toObject: () => ({ id: 'b', channel: 1 }) }]]
            ])
        };
        const timer = createTimerAbility(device);

        const all = await timer.getAll();

        assert.strictEqual(all.length, 2);
        assert.strictEqual(all[0].id, 'a');
        assert.strictEqual(all[1].id, 'b');
    });

    it('count returns number of cached timers', async () => {
        const device = {
            capabilities: { channels: { ids: [0], count: 1 } },
            publishMessage: async () => ({ header: {}, payload: {} }),
            _timerxStateByChannel: new Map([
                [0, [{ id: 'a', channel: 0, toObject: () => ({ id: 'a' }) }]]
            ])
        };
        const timer = createTimerAbility(device);

        assert.strictEqual(await timer.count(), 1);

        const response = await timer.get({ channel: 0 });
        assert.strictEqual(response.timerx.length, 1);
    });

    it('invalidateCache clears channel or all cached timers', () => {
        const device = {
            _timerxStateByChannel: new Map([
                [0, [{ id: 'a' }]],
                [1, [{ id: 'b' }]]
            ])
        };
        const timer = createTimerAbility(device);

        timer.invalidateCache({ channel: 0 });
        assert.strictEqual(device._timerxStateByChannel.has(0), false);
        assert.strictEqual(device._timerxStateByChannel.has(1), true);

        timer.invalidateCache();
        assert.strictEqual(device._timerxStateByChannel.size, 0);
    });

    it('push-shaped timerx payload updates cache and emits stateChange', () => {
        const emitter = createDeviceEmitter();
        const events = [];
        emitter.on('stateChange', (e) => events.push(e));
        const device = {
            emit: emitter.emit.bind(emitter),
            _timerxStateByChannel: new Map()
        };

        pushTimerX(device, { id: 'p1', channel: 0, enable: 1, type: 0, time: 0, week: 0 }, 'push');

        assert.strictEqual(device._timerxStateByChannel.get(0).length, 1);
        assert.strictEqual(device._timerxStateByChannel.get(0)[0].id, 'p1');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'timer');
        assert.strictEqual(events[0].source, 'push');
    });
});
