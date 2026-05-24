'use strict';

/**
 * Builds a bidirectional string↔wire codec for enums with one-to-one mappings.
 *
 * @param {Record<string, number>} stringToWire
 * @param {string} defaultString - Fallback when `fromWire` receives an unknown code
 * @returns {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }}
 */
function createCodec(stringToWire, defaultString) {
    const wireToString = {};
    for (const [str, wire] of Object.entries(stringToWire)) {
        if (wireToString[wire] === undefined) {
            wireToString[wire] = str;
        }
    }
    return {
        toWire(str) {
            return stringToWire[str];
        },
        fromWire(wire) {
            return wireToString[wire] ?? defaultString;
        }
    };
}

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const TransportModeCodec = createCodec({
    mqtt: 0,
    'lan-http-first': 1,
    'lan-http-first-only-get': 2
}, 'mqtt');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ThermostatModeCodec = createCodec({
    heat: 0,
    cool: 1,
    economy: 2,
    auto: 3,
    manual: 4
}, 'heat');

/** Appliance.Control.Thermostat.Mode `state` (heating activity). @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ThermostatActivityCodec = createCodec({
    idle: 0,
    heating: 1
}, 'idle');

/** Appliance.Control.Thermostat.ModeB `mode`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ThermostatModeBModeCodec = createCodec({
    manual: 1,
    schedule: 2,
    timer: 3
}, 'manual');

/** Appliance.Control.Thermostat.ModeB `state` (operational). */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ThermostatModeBStateCodec = createCodec({
    working: 1,
    standby: 2,
    off: 3
}, 'standby');

/** Appliance.Control.Thermostat.ModeB `working` (no wire 0). */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ThermostatModeBWorkingCodec = createCodec({
    heating: 1,
    cooling: 2
}, 'heating');

/** Appliance.Control.Thermostat.ModeB `onoff` (valve open/closed). */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ThermostatModeBOnOffCodec = createCodec({
    open: 1,
    closed: 2
}, 'closed');

/** Appliance.Control.Thermostat.Mode `warning` / sensor validity on Mode. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ThermostatModeWarningCodec = createCodec({
    valid: 0,
    failed: 1
}, 'valid');

/** Appliance.Control.Thermostat.ModeB `sensorStatus`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ThermostatSensorStatusCodec = createCodec({
    valid: 1,
    invalid: 2
}, 'valid');

/**
 * Hub MTS100 valve mode (`Appliance.Hub.Mts100.Mode`).
 * Wire 3 is `schedule`; `auto` is accepted as an alias in {@link Mts100ModeCodec.toWire}.
 *
 * @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }}
 */
const Mts100ModeCodec = (() => {
    const base = createCodec({
        custom: 0,
        comfort: 1,
        economy: 2,
        schedule: 3
    }, 'custom');
    return {
        ...base,
        toWire(str) {
            if (str === 'auto') {
                return 3;
            }
            return base.toWire(str);
        }
    };
})();

/**
 * MTS100 v3 / MTS150 hub valve mode (`Appliance.Hub.Mts100.Mode`).
 *
 * @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }}
 */
const Mts100V3ModeCodec = (() => {
    const base = createCodec({
        custom: 0,
        heat: 1,
        cool: 2,
        auto: 3,
        economy: 4
    }, 'custom');
    return {
        ...base,
        toWire(str) {
            if (str === 'comfort') {
                return 1;
            }
            if (str === 'schedule') {
                return 3;
            }
            return base.toWire(str);
        }
    };
})();

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const DiffuserLightModeCodec = createCodec({
    'rotating-colors': 0,
    'fixed-rgb': 1,
    'fixed-luminance': 2
}, 'rotating-colors');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const DiffuserSprayModeCodec = createCodec({
    light: 0,
    strong: 1,
    off: 2
}, 'off');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const SprayModeCodec = createCodec({
    off: 0,
    continuous: 1,
    intermittent: 2
}, 'off');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const RollerShutterStatusCodec = createCodec({
    unknown: -1,
    idle: 0,
    opening: 1,
    closing: 2
}, 'unknown');

/** Appliance.RollerShutter.State `stoppedBy` (reported when movement is idle). */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const RollerShutterStoppedByCodec = createCodec({
    completed: 0,
    manual: 1,
    overheated: 2,
    'hall-stop': 3,
    'reed-stop': 4,
    'hall-failure': 5,
    'reed-failure': 6,
    'ntc-failure': 7,
    'hall-recoil': 8,
    'reed-recoil': 9
}, 'completed');

/** Appliance.RollerShutter.Adjust `status` (calibration result). */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const RollerShutterCalibrationStatusCodec = createCodec({
    success: 0,
    timeout: 1,
    stall: 2,
    'value-too-large': 3,
    'value-too-small': 4,
    'hall-failure': 5,
    'reed-failure': 6,
    'not-calibrated': 7
}, 'not-calibrated');

/** Appliance.Control.Light `effect`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const LightEffectCodec = createCodec({
    none: 0,
    'red-orange': 1,
    candle: 2,
    'single-color-rhythm': 3,
    'multi-color-breathing': 4,
    'night-light-white': 5,
    'yellow-night-light': 6,
    favorite: 7,
    'full-light': 8
}, 'none');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const PresenceStateCodec = createCodec({
    absent: 1,
    present: 2
}, 'unknown');

/**
 * Timer wire types 1 and 2 each carry two aliases (`weekly`/`auto-off` and
 * `single-shot`/`countdown`). The base codec handles the four unambiguous types;
 * `toWire` is extended to accept the aliases.
 *
 * @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }}
 */
const TimerTypeCodec = (() => {
    const base = createCodec({
        'single-point-weekly': 1,
        'single-point-single-shot': 2,
        'continuous-weekly': 3,
        'continuous-single-shot': 4
    }, 'single-point-weekly');
    return {
        ...base,
        toWire(str) {
            if (str === 'auto-off')    { return 1; }
            if (str === 'countdown')   { return 2; }
            if (str === 'door-off')    { return 0; }
            if (str === 'door-notify') { return 1; }
            return base.toWire(str);
        }
    };
})();

/**
 * Garage door timer types (`Appliance.Control.TimerX.type` on msg100/msg200).
 * Wire 0 and 1 share numeric codes with other timer semantics; decode with this
 * codec on garage devices only.
 *
 * @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }}
 */
const GarageDoorTimerTypeCodec = createCodec({
    'door-off': 0,
    'door-notify': 1
}, 'door-off');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const TriggerTypeCodec = createCodec({
    'single-point-weekly': 1,
    'single-point-single-shot': 2,
    'continuous-weekly': 3,
    'continuous-single-shot': 4
}, 'single-point-weekly');

/**
 * Status codes sent by smoke detector firmware (MA151 etc.).
 *
 * String labels follow the pattern `<type>[-muted]` for errors and
 * `alarm-<type>` / `mute-<type>` for active/silenced alarms, making
 * structural string checks in classification logic straightforward.
 *
 * @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }}
 */
const SmokeAlarmStatusCodec = createCodec({
    'error-temperature': 17,
    'error-smoke': 18,
    'error-battery': 19,
    'error-temperature-muted': 20,
    'error-smoke-muted': 21,
    'error-battery-muted': 22,
    normal: 23,
    'alarm-temperature': 24,
    'alarm-smoke': 25,
    'mute-temperature': 26,
    'mute-smoke': 27,
    interconnection: 170
}, 'unknown');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const DndModeCodec = createCodec({
    off: 0,
    on: 1
}, 'off');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const ContactStateCodec = createCodec({
    closed: 0,
    open: 1
}, 'closed');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const WaterLeakCodec = createCodec({
    dry: 0,
    leaking: 1
}, 'dry');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const GarageDoorOpenCodec = createCodec({
    closed: 0,
    open: 1
}, 'closed');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const GarageDoorExecuteCodec = createCodec({
    'not-executed': 0,
    executed: 1
}, 'not-executed');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const PhysicalLockCodec = createCodec({
    unlocked: 0,
    locked: 1
}, 'unlocked');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const TempUnitCodec = createCodec({
    celsius: 1,
    fahrenheit: 2
}, 'celsius');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const SmokeInterConnCodec = createCodec({
    inactive: 0,
    active: 1
}, 'inactive');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const SmokeTestTypeCodec = createCodec({
    manual: 1,
    automatic: 2
}, 'manual');

/** `Appliance.Control.Upgrade` `upgradeInfo.status`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const UpgradeStatusCodec = createCodec({
    'start-download': 1,
    success: 2,
    failed: 3,
    'signing-failed': 4
}, 'start-download');

/** Hub sub-device image transfer (`upgradeInfo.subdev[].status`). */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const UpgradeTransferStatusCodec = createCodec({
    'pending-transfer': 0,
    transferring: 1,
    success: 2,
    failed: 3
}, 'pending-transfer');

/** `Appliance.Control.OverTemp` `overTemp.value`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const OverTempValueCodec = createCodec({
    'over-temp': 1,
    normal: 2
}, 'normal');

/** `Appliance.Control.OverTemp` / `Appliance.Config.OverTemp` `overTemp.type`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const OverTempTypeCodec = createCodec({
    'early-warning': 1,
    'shutoff-relay': 2
}, 'early-warning');

/** `Appliance.Control.Alarm` event `value` (`interConn`, `security`, `maSecurity`). */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const AlarmActionCodec = createCodec({
    execute: 1,
    normal: 2
}, 'normal');

/** `Appliance.Control.Alarm` `interConn.type`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const AlarmScopeCodec = createCodec({
    local: 1,
    'all-except-source': 2,
    'all-including-source': 3
}, 'local');

/** `Appliance.System.Runtime` `netType`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const NetTypeCodec = createCodec({
    wifi: 1,
    ethernet: 2
}, 'wifi');

/** `Appliance.System.Runtime` `iotStatus`. */
/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string }} */
const IotStatusCodec = createCodec({
    connecting: 0,
    normal: 1,
    abnormal: 2
}, 'connecting');

/** @type {{ toWire: (s: string) => number|undefined, fromWire: (n: number) => string, isOnline: (n: number) => boolean }} */
const ConnectivityCodec = {
    ...createCodec({
        'not-online': 0,
        online: 1,
        offline: 2,
        unknown: -1,
        upgrading: 3
    }, 'unknown'),
    isOnline(wire) {
        return wire === 1;
    }
};

module.exports = {
    SmokeAlarmStatusCodec,
    DndModeCodec,
    ContactStateCodec,
    WaterLeakCodec,
    GarageDoorOpenCodec,
    GarageDoorExecuteCodec,
    PhysicalLockCodec,
    TempUnitCodec,
    SmokeInterConnCodec,
    SmokeTestTypeCodec,
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
    UpgradeStatusCodec,
    UpgradeTransferStatusCodec,
    OverTempValueCodec,
    OverTempTypeCodec,
    AlarmActionCodec,
    AlarmScopeCodec,
    NetTypeCodec,
    IotStatusCodec,
    ConnectivityCodec
};
