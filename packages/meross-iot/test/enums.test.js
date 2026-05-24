'use strict';

/**
 * Codec round-trips for string ↔ wire conversion in {@link ../lib/enums.js}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const meross = require('..');
const {
    TransportModeCodec,
    ThermostatModeCodec,
    ThermostatActivityCodec,
    ThermostatModeBModeCodec,
    ThermostatModeBStateCodec,
    ThermostatModeBWorkingCodec,
    ThermostatModeBOnOffCodec,
    ThermostatModeWarningCodec,
    ThermostatSensorStatusCodec,
    Mts100ModeCodec,
    Mts100V3ModeCodec,
    DiffuserLightModeCodec,
    DiffuserSprayModeCodec,
    SprayModeCodec,
    RollerShutterStatusCodec,
    RollerShutterStoppedByCodec,
    RollerShutterCalibrationStatusCodec,
    LightEffectCodec,
    PresenceStateCodec,
    TimerTypeCodec,
    GarageDoorTimerTypeCodec,
    TriggerTypeCodec,
    ConnectivityCodec,
    DndModeCodec,
    ContactStateCodec,
    WaterLeakCodec,
    GarageDoorOpenCodec,
    GarageDoorExecuteCodec,
    PhysicalLockCodec,
    TempUnitCodec,
    SmokeInterConnCodec,
    SmokeTestTypeCodec,
    UpgradeStatusCodec,
    UpgradeTransferStatusCodec,
    OverTempValueCodec,
    OverTempTypeCodec,
    AlarmActionCodec,
    AlarmScopeCodec,
    NetTypeCodec,
    IotStatusCodec
} = require('../lib/enums');

/**
 * @param {import('node:assert').Assert} assertFn
 * @param {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} codec
 * @param {string[]} strings
 */
function assertCodecRoundTrips(assertFn, codec, strings) {
    for (const str of strings) {
        const wire = codec.toWire(str);
        assertFn.notStrictEqual(wire, undefined, `toWire("${str}")`);
        assertFn.strictEqual(codec.fromWire(wire), str, `round-trip for "${str}"`);
    }
}

describe('package root does not export numeric enums', () => {
    const dropped = [
        'TransportMode',
        'ThermostatMode',
        'LightMode',
        'DiffuserLightMode',
        'DiffuserSprayMode',
        'SprayMode',
        'DNDMode',
        'DndMode',
        'ContactState',
        'WaterLeakState',
        'GarageDoorOpen',
        'GarageDoorExecute',
        'PhysicalLockState',
        'TempUnit',
        'SmokeInterConn',
        'SmokeTestType',
        'OnlineStatus',
        'TimerType',
        'GarageDoorTimerType',
        'TriggerType',
        'RollerShutterStoppedBy',
        'RollerShutterCalibrationStatus',
        'LightEffect',
        'SmokeAlarmStatus',
        'UpgradeStatus',
        'UpgradeTransferStatus',
        'OverTempValue',
        'OverTempType',
        'AlarmAction',
        'AlarmScope',
        'NetType',
        'IotStatus'
    ];

    for (const key of dropped) {
        it(`does not export ${key}`, () => {
            assert.strictEqual(meross[key], undefined);
        });
    }
});

describe('enum codecs (string ↔ wire)', () => {
    it('TransportModeCodec round-trips', () => {
        assertCodecRoundTrips(assert, TransportModeCodec, [
            'mqtt',
            'lan-http-first',
            'lan-http-first-only-get'
        ]);
    });

    it('ThermostatModeCodec round-trips', () => {
        assertCodecRoundTrips(assert, ThermostatModeCodec, [
            'heat',
            'cool',
            'economy',
            'auto',
            'manual'
        ]);
    });

    it('ThermostatActivityCodec round-trips', () => {
        assertCodecRoundTrips(assert, ThermostatActivityCodec, [
            'idle',
            'heating'
        ]);
    });

    it('ThermostatModeBModeCodec round-trips', () => {
        assertCodecRoundTrips(assert, ThermostatModeBModeCodec, [
            'manual',
            'schedule',
            'timer'
        ]);
    });

    it('ThermostatModeBStateCodec round-trips', () => {
        assertCodecRoundTrips(assert, ThermostatModeBStateCodec, [
            'working',
            'standby',
            'off'
        ]);
    });

    it('ThermostatModeBWorkingCodec round-trips', () => {
        assertCodecRoundTrips(assert, ThermostatModeBWorkingCodec, [
            'heating',
            'cooling'
        ]);
    });

    it('ThermostatModeBOnOffCodec round-trips', () => {
        assertCodecRoundTrips(assert, ThermostatModeBOnOffCodec, [
            'open',
            'closed'
        ]);
    });

    it('ThermostatModeWarningCodec round-trips', () => {
        assertCodecRoundTrips(assert, ThermostatModeWarningCodec, [
            'valid',
            'failed'
        ]);
    });

    it('ThermostatSensorStatusCodec round-trips', () => {
        assertCodecRoundTrips(assert, ThermostatSensorStatusCodec, [
            'valid',
            'invalid'
        ]);
    });

    it('Mts100ModeCodec round-trips legacy labels and auto alias', () => {
        assertCodecRoundTrips(assert, Mts100ModeCodec, [
            'custom',
            'comfort',
            'economy',
            'schedule'
        ]);
        assert.strictEqual(Mts100ModeCodec.toWire('auto'), 3);
        assert.strictEqual(Mts100ModeCodec.fromWire(3), 'schedule');
    });

    it('Mts100V3ModeCodec round-trips v3 labels and comfort alias', () => {
        assertCodecRoundTrips(assert, Mts100V3ModeCodec, [
            'custom',
            'heat',
            'cool',
            'auto',
            'economy'
        ]);
        assert.strictEqual(Mts100V3ModeCodec.toWire('comfort'), 1);
        assert.strictEqual(Mts100V3ModeCodec.toWire('schedule'), 3);
    });

    it('DiffuserLightModeCodec round-trips', () => {
        assertCodecRoundTrips(assert, DiffuserLightModeCodec, [
            'rotating-colors',
            'fixed-rgb',
            'fixed-luminance'
        ]);
    });

    it('DiffuserSprayModeCodec round-trips', () => {
        assertCodecRoundTrips(assert, DiffuserSprayModeCodec, [
            'light',
            'strong',
            'off'
        ]);
    });

    it('SprayModeCodec round-trips', () => {
        assertCodecRoundTrips(assert, SprayModeCodec, [
            'off',
            'continuous',
            'intermittent'
        ]);
    });

    it('RollerShutterStatusCodec round-trips', () => {
        assertCodecRoundTrips(assert, RollerShutterStatusCodec, [
            'unknown',
            'idle',
            'opening',
            'closing'
        ]);
    });

    it('RollerShutterStoppedByCodec round-trips', () => {
        assertCodecRoundTrips(assert, RollerShutterStoppedByCodec, [
            'completed',
            'manual',
            'overheated',
            'hall-stop',
            'reed-stop',
            'hall-failure',
            'reed-failure',
            'ntc-failure',
            'hall-recoil',
            'reed-recoil'
        ]);
    });

    it('RollerShutterCalibrationStatusCodec round-trips', () => {
        assertCodecRoundTrips(assert, RollerShutterCalibrationStatusCodec, [
            'success',
            'timeout',
            'stall',
            'value-too-large',
            'value-too-small',
            'hall-failure',
            'reed-failure',
            'not-calibrated'
        ]);
    });

    it('LightEffectCodec round-trips', () => {
        assertCodecRoundTrips(assert, LightEffectCodec, [
            'none',
            'red-orange',
            'candle',
            'single-color-rhythm',
            'multi-color-breathing',
            'night-light-white',
            'yellow-night-light',
            'favorite',
            'full-light'
        ]);
    });

    it('PresenceStateCodec round-trips', () => {
        assertCodecRoundTrips(assert, PresenceStateCodec, [
            'absent',
            'present'
        ]);
        assert.strictEqual(PresenceStateCodec.fromWire(99), 'unknown');
    });

    it('TimerTypeCodec round-trips unambiguous types', () => {
        assertCodecRoundTrips(assert, TimerTypeCodec, [
            'single-point-weekly',
            'single-point-single-shot',
            'continuous-weekly',
            'continuous-single-shot'
        ]);
    });

    it('TimerTypeCodec maps auto-off and countdown to shared wire codes', () => {
        assert.strictEqual(TimerTypeCodec.toWire('auto-off'), 1);
        assert.strictEqual(TimerTypeCodec.toWire('countdown'), 2);
        assert.strictEqual(TimerTypeCodec.fromWire(1), 'single-point-weekly');
        assert.strictEqual(TimerTypeCodec.fromWire(2), 'single-point-single-shot');
    });

    it('TimerTypeCodec maps garage door timer aliases to wire codes', () => {
        assert.strictEqual(TimerTypeCodec.toWire('door-off'), 0);
        assert.strictEqual(TimerTypeCodec.toWire('door-notify'), 1);
    });

    it('GarageDoorTimerTypeCodec round-trips', () => {
        assertCodecRoundTrips(assert, GarageDoorTimerTypeCodec, [
            'door-off',
            'door-notify'
        ]);
    });

    it('TriggerTypeCodec round-trips', () => {
        assertCodecRoundTrips(assert, TriggerTypeCodec, [
            'single-point-weekly',
            'single-point-single-shot',
            'continuous-weekly',
            'continuous-single-shot'
        ]);
    });

    it('DndModeCodec round-trips', () => {
        assertCodecRoundTrips(assert, DndModeCodec, ['off', 'on']);
    });

    it('ContactStateCodec round-trips', () => {
        assertCodecRoundTrips(assert, ContactStateCodec, ['closed', 'open']);
    });

    it('WaterLeakCodec round-trips', () => {
        assertCodecRoundTrips(assert, WaterLeakCodec, ['dry', 'leaking']);
    });

    it('GarageDoorOpenCodec round-trips', () => {
        assertCodecRoundTrips(assert, GarageDoorOpenCodec, ['closed', 'open']);
    });

    it('GarageDoorExecuteCodec round-trips', () => {
        assertCodecRoundTrips(assert, GarageDoorExecuteCodec, ['not-executed', 'executed']);
    });

    it('PhysicalLockCodec round-trips', () => {
        assertCodecRoundTrips(assert, PhysicalLockCodec, ['unlocked', 'locked']);
    });

    it('TempUnitCodec round-trips', () => {
        assertCodecRoundTrips(assert, TempUnitCodec, ['celsius', 'fahrenheit']);
    });

    it('SmokeInterConnCodec round-trips', () => {
        assertCodecRoundTrips(assert, SmokeInterConnCodec, ['inactive', 'active']);
    });

    it('SmokeTestTypeCodec round-trips', () => {
        assertCodecRoundTrips(assert, SmokeTestTypeCodec, ['manual', 'automatic']);
    });

    it('UpgradeStatusCodec round-trips', () => {
        assertCodecRoundTrips(assert, UpgradeStatusCodec, [
            'start-download',
            'success',
            'failed',
            'signing-failed'
        ]);
    });

    it('UpgradeTransferStatusCodec round-trips', () => {
        assertCodecRoundTrips(assert, UpgradeTransferStatusCodec, [
            'pending-transfer',
            'transferring',
            'success',
            'failed'
        ]);
    });

    it('OverTempValueCodec round-trips', () => {
        assertCodecRoundTrips(assert, OverTempValueCodec, ['over-temp', 'normal']);
    });

    it('OverTempTypeCodec round-trips', () => {
        assertCodecRoundTrips(assert, OverTempTypeCodec, ['early-warning', 'shutoff-relay']);
    });

    it('AlarmActionCodec round-trips', () => {
        assertCodecRoundTrips(assert, AlarmActionCodec, ['execute', 'normal']);
    });

    it('AlarmScopeCodec round-trips', () => {
        assertCodecRoundTrips(assert, AlarmScopeCodec, [
            'local',
            'all-except-source',
            'all-including-source'
        ]);
    });

    it('NetTypeCodec round-trips', () => {
        assertCodecRoundTrips(assert, NetTypeCodec, ['wifi', 'ethernet']);
    });

    it('IotStatusCodec round-trips', () => {
        assertCodecRoundTrips(assert, IotStatusCodec, ['connecting', 'normal', 'abnormal']);
    });

    it('ConnectivityCodec round-trips and derives isOnline', () => {
        assertCodecRoundTrips(assert, ConnectivityCodec, [
            'not-online',
            'online',
            'offline',
            'unknown',
            'upgrading'
        ]);
        assert.strictEqual(ConnectivityCodec.isOnline(1), true);
        assert.strictEqual(ConnectivityCodec.isOnline(0), false);
        assert.strictEqual(ConnectivityCodec.isOnline(2), false);
        assert.strictEqual(ConnectivityCodec.isOnline(-1), false);
        assert.strictEqual(ConnectivityCodec.isOnline(3), false);
        assert.strictEqual(ConnectivityCodec.fromWire(99), 'unknown');
    });
});
