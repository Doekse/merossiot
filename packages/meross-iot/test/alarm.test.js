'use strict';

/**
 * Mocked-device tests for {@link module:abilities/alarm}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createAlarmAbility = require('../lib/abilities/alarm');
const { updateAlarmEvents } = require('../lib/abilities/alarm');
const { MerossDeviceError } = require('..');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

describe('alarm ability (mocked device)', () => {
    it('set sends SET Appliance.Control.Alarm with security payload', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const device = {
            deviceType: 'mock.alarm',
            abilities: {},
            publishMessage
        };
        const alarm = createAlarmAbility(device);

        await alarm.set({ channel: 0, on: true, duration: 30 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Alarm');
        assert.strictEqual(calls[0].payload.alarm[0].channel, 0);
        assert.strictEqual(calls[0].payload.alarm[0].event.security.value, 1);
        assert.strictEqual(calls[0].payload.alarm[0].event.security.time, 30);
    });

    it('throws when `on` is missing', async () => {
        const { publishMessage } = createPublishRecorder();
        const alarm = createAlarmAbility({ deviceType: 'x', abilities: {}, publishMessage });

        await assert.rejects(() => alarm.set({ channel: 0 }), MerossDeviceError);
    });

    it('setConfig throws when Appliance.Config.Alarm is not in abilities', async () => {
        const { publishMessage } = createPublishRecorder();
        const alarm = createAlarmAbility({ deviceType: 'x', abilities: {}, publishMessage });

        await assert.rejects(
            () => alarm.setConfig({ enable: 1, volume: 50, song: 1 }),
            (err) => err instanceof MerossDeviceError && err.code === 'UNKNOWN_DEVICE_TYPE'
        );
    });

    it('get sends GET with alarm channel payload', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const alarm = createAlarmAbility({ deviceType: 'x', abilities: {}, publishMessage });

        await alarm.get({ channel: 2 });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Alarm');
        assert.deepStrictEqual(calls[0].payload, { alarm: [{ channel: 2 }] });
    });

    it('getLastEvents stores decoded alarm event fields', () => {
        const events = [];
        const device = {
            _lastAlarmEvents: [],
            emit(_type, payload) {
                events.push(payload);
            }
        };
        updateAlarmEvents(device, {
            channel: 0,
            event: {
                interConn: { value: 2, type: 3, timestamp: 5 }
            }
        }, 'push');

        const stored = device._lastAlarmEvents[0];
        assert.strictEqual(stored.event.interConn.action, 'normal');
        assert.strictEqual(stored.event.interConn.scope, 'all-including-source');
        assert.strictEqual(stored.event.interConn.value, undefined);
        assert.strictEqual(events[0].value.event.interConn.action, 'normal');
    });
});
