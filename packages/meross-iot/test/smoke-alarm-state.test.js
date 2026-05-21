'use strict';

const assert = require('node:assert');
const { describe, it } = require('node:test');

const SmokeAlarmState = require('../lib/states/smoke-alarm-state');
const { SmokeAlarmStatus } = require('../lib/enums');

describe('SmokeAlarmState derived getters', () => {
    it('maps interconnect heartbeat to safe with mesh metadata', () => {
        const state = new SmokeAlarmState({
            status: SmokeAlarmStatus.INTERCONNECTION_STATUS,
            interConn: 0
        });
        assert.strictEqual(state.condition, 'safe');
        assert.strictEqual(state.channel, null);
        assert.deepStrictEqual(state.interconnect, { linkActive: false, raw: 0 });
        assert.strictEqual(state.status, 170);
        assert.strictEqual(state.alarmType, 'interconnection');
        assert.strictEqual(state.isActive, false);
    });

    it('maps active and silenced alarms by channel', () => {
        const active = new SmokeAlarmState({ status: SmokeAlarmStatus.ALARM_SMOKE });
        assert.strictEqual(active.condition, 'alarming');
        assert.strictEqual(active.channel, 'smoke');
        assert.strictEqual(active.isActive, true);

        const silenced = new SmokeAlarmState({ status: SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM });
        assert.strictEqual(silenced.condition, 'silenced');
        assert.strictEqual(silenced.channel, 'temperature');
        assert.strictEqual(silenced.isMuted, true);
    });

    it('maps faults by channel', () => {
        const state = new SmokeAlarmState({ status: SmokeAlarmStatus.ERROR_BATTERY_MUTED });
        assert.strictEqual(state.condition, 'fault');
        assert.strictEqual(state.channel, 'battery');
        assert.strictEqual(state.isError, true);
        assert.strictEqual(state.isMuted, true);
    });
});

describe('SmokeAlarmState snapshot', () => {
    it('exposes only derived subscription fields', () => {
        const state = new SmokeAlarmState({
            status: SmokeAlarmStatus.INTERCONNECTION_STATUS,
            interConn: 0,
            lastStatusUpdate: 1681997644
        });
        const snap = state.toSnapshot();
        assert.deepStrictEqual(snap, {
            condition: 'safe',
            channel: null,
            interconnect: { linkActive: false, raw: 0 },
            lastStatusUpdate: 1681997644
        });
        assert.strictEqual('status' in snap, false);
        assert.strictEqual('alarmType' in snap, false);
        assert.strictEqual('isActive' in snap, false);
        assert.strictEqual('interConn' in snap, false);
    });
});
