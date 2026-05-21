'use strict';

/**
 * Keeps public enum / constant object values aligned with {@link index.d.ts} for TypeScript consumers.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const meross = require('..');

describe('exported enums and status constants', () => {
    it('TransportMode matches declaration', () => {
        assert.deepStrictEqual(meross.TransportMode, {
            MQTT_ONLY: 0,
            LAN_HTTP_FIRST: 1,
            LAN_HTTP_FIRST_ONLY_GET: 2
        });
    });

    it('ThermostatMode matches declaration', () => {
        assert.deepStrictEqual(meross.ThermostatMode, {
            HEAT: 0,
            COOL: 1,
            ECONOMY: 2,
            AUTO: 3,
            MANUAL: 4
        });
    });

    it('LightMode matches declaration', () => {
        assert.deepStrictEqual(meross.LightMode, {
            MODE_RGB: 1,
            MODE_TEMPERATURE: 2,
            MODE_LUMINANCE: 4
        });
    });

    it('DiffuserLightMode, DiffuserSprayMode, SprayMode match declaration', () => {
        assert.deepStrictEqual(meross.DiffuserLightMode, {
            ROTATING_COLORS: 0,
            FIXED_RGB: 1,
            FIXED_LUMINANCE: 2
        });
        assert.deepStrictEqual(meross.DiffuserSprayMode, {
            LIGHT: 0,
            STRONG: 1,
            OFF: 2
        });
        assert.deepStrictEqual(meross.SprayMode, {
            OFF: 0,
            CONTINUOUS: 1,
            INTERMITTENT: 2
        });
    });

    it('DNDMode and OnlineStatus match declaration', () => {
        assert.deepStrictEqual(meross.DNDMode, {
            DND_DISABLED: 0,
            DND_ENABLED: 1
        });
        assert.deepStrictEqual(meross.OnlineStatus, {
            NOT_ONLINE: 0,
            ONLINE: 1,
            OFFLINE: 2,
            UNKNOWN: -1,
            UPGRADING: 3
        });
    });

    it('does not export SmokeAlarmStatus (use getCondition / getStatus on smokeAlarm)', () => {
        assert.strictEqual(meross.SmokeAlarmStatus, undefined);
    });

    it('TimerType, TriggerType match declaration', () => {
        assert.deepStrictEqual(meross.TimerType, {
            SINGLE_POINT_WEEKLY_CYCLE: 1,
            SINGLE_POINT_SINGLE_SHOT: 2,
            CONTINUOUS_WEEKLY_CYCLE: 3,
            CONTINUOUS_SINGLE_SHOT: 4,
            AUTO_OFF: 1,
            COUNTDOWN: 2
        });
        assert.deepStrictEqual(meross.TriggerType, {
            SINGLE_POINT_WEEKLY_CYCLE: 1,
            SINGLE_POINT_SINGLE_SHOT: 2,
            CONTINUOUS_WEEKLY_CYCLE: 3,
            CONTINUOUS_SINGLE_SHOT: 4
        });
    });
});
