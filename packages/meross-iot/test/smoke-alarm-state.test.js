'use strict';

const assert = require('node:assert');
const { describe, it } = require('node:test');

const SmokeAlarmState = require('../lib/states/smoke-alarm-state');

describe('SmokeAlarmState derived getters', () => {
    it('maps interconnect heartbeat to safe with mesh metadata', () => {
        const state = new SmokeAlarmState({ status: 170, interConn: 0 });
        assert.strictEqual(state.condition, 'safe');
        assert.strictEqual(state.channel, null);
        assert.deepStrictEqual(state.interconnect, { linkActive: false, raw: 0 });
        assert.strictEqual(state.status, 'interconnection');
        assert.strictEqual(state.interConnStatus, 'inactive');
    });

    it('maps active and silenced alarms by channel', () => {
        const active = new SmokeAlarmState({ status: 25 });
        assert.strictEqual(active.condition, 'alarming');
        assert.strictEqual(active.channel, 'smoke');

        const silenced = new SmokeAlarmState({ status: 26 });
        assert.strictEqual(silenced.condition, 'silenced');
        assert.strictEqual(silenced.channel, 'temperature');
    });

    it('maps faults by channel', () => {
        const state = new SmokeAlarmState({ status: 22 });
        assert.strictEqual(state.condition, 'fault');
        assert.strictEqual(state.channel, 'battery');
    });
});

describe('SmokeAlarmState snapshot', () => {
    it('exposes only derived subscription fields', () => {
        const state = new SmokeAlarmState({ status: 170, interConn: 0, lastStatusUpdate: 1681997644 });
        const snap = state.toSnapshot();
        assert.deepStrictEqual(snap, {
            condition: 'safe',
            channel: null,
            interconnect: { linkActive: false, raw: 0 },
            lastStatusUpdate: 1681997644
        });
        assert.strictEqual('status' in snap, false);
        assert.strictEqual('interConn' in snap, false);
    });
});
