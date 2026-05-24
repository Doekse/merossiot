'use strict';

/**
 * State getters for PR1 binary sensor / lock codecs.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const DoorWindowState = require('../lib/states/door-window-state');
const WaterLeakState = require('../lib/states/water-leak-state');
const GarageDoorState = require('../lib/states/garage-door-state');
const SmokeAlarmState = require('../lib/states/smoke-alarm-state');

describe('binary sensor state codecs', () => {
    it('DoorWindowState decodes contactState and snapshot', () => {
        const closed = new DoorWindowState({ status: 0 });
        assert.strictEqual(closed.contactState, 'closed');
        assert.strictEqual(closed.isOpen, false);
        assert.deepStrictEqual(closed.toSnapshot().contactState, 'closed');

        const open = new DoorWindowState({ status: 1 });
        assert.strictEqual(open.contactState, 'open');
        assert.strictEqual(open.isOpen, true);
    });

    it('WaterLeakState decodes leakState and snapshot', () => {
        const state = new WaterLeakState();
        state.update(true, 100);
        assert.strictEqual(state.leakState, 'leaking');
        assert.strictEqual(state.isLeaking, true);
        assert.deepStrictEqual(state.toSnapshot().leakState, 'leaking');

        state.update(false, 200);
        assert.strictEqual(state.leakState, 'dry');
    });

    it('GarageDoorState decodes openState and executeState', () => {
        const state = new GarageDoorState({ open: 1, execute: 0, channel: 0 });
        assert.strictEqual(state.openState, 'open');
        assert.strictEqual(state.isOpen, true);
        assert.strictEqual(state.executeState, 'not-executed');

        const closed = new GarageDoorState({ open: 0, execute: 1 });
        assert.strictEqual(closed.openState, 'closed');
        assert.strictEqual(closed.executeState, 'executed');
    });

    it('SmokeAlarmState decodes interConnStatus', () => {
        const state = new SmokeAlarmState({ status: 170, interConn: 1 });
        assert.strictEqual(state.interConnStatus, 'active');
        assert.deepStrictEqual(state.interconnect, { linkActive: true, raw: 1 });
    });
});
