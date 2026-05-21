'use strict';

/**
 * Header-timestamp ordering tests for {@link MerossSubDevice#handleMessage}.
 *
 * Exercises the per-handler ordering gate and the shared `'online'` gate inside
 * `_updateOnlineStatus` so stale broader hub pushes cannot overwrite state set by
 * fresher targeted messages (or responses).
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');
const { EventEmitter } = require('node:events');

const { MerossSubDevice } = require('../lib/device/subdevice');
const createSmokeAlarmAbility = require('../lib/abilities/hub-smoke');
const createTempHumAbility = require('../lib/abilities/hub-temp-hum');
const createSensorAlertAbility = require('../lib/abilities/hub-alert');
const createSensorAdjustAbility = require('../lib/abilities/hub-adjust');
const createWaterLeakAbility = require('../lib/abilities/hub-water-leak');
const createDoorWindowAbility = require('../lib/abilities/hub-door-window');
const createMts100Ability = require('../lib/abilities/hub-mts100');
const { OnlineStatus, SmokeAlarmStatus } = require('../lib/enums');
const SmokeAlarmState = require('../lib/states/smoke-alarm-state');

/** Default `_type` per capability kind (matches {@link SUBDEVICE_TYPES} models). */
const SUBDEVICE_TYPE_BY_KIND = {
    tempHum: 'ms100',
    doorWindow: 'ms200',
    waterLeak: 'ms400',
    smoke: 'ma151',
    mts100: 'mts100v3'
};

/** @type {Record<string, Record<string, object>>} */
const SUBDEVICE_ABILITIES = {
    tempHum: {
        'Appliance.Hub.Sensor.TempHum': {},
        'Appliance.Hub.Sensor.All': {},
        'Appliance.Hub.Sensor.Alert': {},
        'Appliance.Hub.Sensor.Adjust': {},
        'Appliance.Control.Sensor.LatestX': {},
        'Appliance.Hub.Battery': {},
        'Appliance.Hub.Mts100.Battery': {},
        'Appliance.Hub.Online': {}
    },
    doorWindow: {
        'Appliance.Hub.Sensor.DoorWindow': {},
        'Appliance.Hub.Sensor.All': {},
        'Appliance.Hub.Battery': {},
        'Appliance.Hub.Online': {}
    },
    waterLeak: {
        'Appliance.Hub.Sensor.WaterLeak': {},
        'Appliance.Hub.Sensor.All': {},
        'Appliance.Hub.Battery': {},
        'Appliance.Hub.Mts100.Battery': {},
        'Appliance.Hub.Online': {}
    },
    smoke: {
        'Appliance.Hub.Sensor.Smoke': {},
        'Appliance.Hub.Sensor.All': {},
        'Appliance.Hub.Battery': {},
        'Appliance.Hub.Mts100.Battery': {},
        'Appliance.Hub.Online': {}
    },
    mts100: {
        'Appliance.Hub.Mts100.All': {},
        'Appliance.Hub.ToggleX': {},
        'Appliance.Hub.Mts100.Mode': {},
        'Appliance.Hub.Mts100.Temperature': {},
        'Appliance.Hub.Mts100.Adjust': {},
        'Appliance.Hub.Mts100.SuperCtl': {},
        'Appliance.Hub.Mts100.ScheduleB': {},
        'Appliance.Hub.Mts100.Config': {},
        'Appliance.Hub.Battery': {},
        'Appliance.Hub.Mts100.Battery': {},
        'Appliance.Hub.Online': {}
    }
};

/**
 * @param {import('../lib/device/subdevice').MerossSubDevice} subdev
 * @param {'tempHum'|'doorWindow'|'waterLeak'|'smoke'|'mts100'} kind
 * @returns {void}
 */
function initSubdeviceStateMaps(subdev, kind) {
    subdev.abilities = SUBDEVICE_ABILITIES[kind] || {};
    subdev._batteryStateByChannel = new Map();

    if (kind === 'tempHum') {
        subdev._temperatureStateByChannel = new Map();
        subdev._humidityStateByChannel = new Map();
        subdev._luxStateByChannel = new Map();
        subdev._sensorAlertStateByChannel = new Map();
        subdev._sensorAdjustStateByChannel = new Map();
    } else if (kind === 'doorWindow') {
        subdev._doorWindowStateByChannel = new Map();
    } else if (kind === 'waterLeak') {
        subdev._waterLeakStateByChannel = new Map();
    } else if (kind === 'smoke') {
        subdev._smokeAlarmStateByChannel = new Map();
    } else if (kind === 'mts100') {
        subdev._hubThermostatStateByChannel = new Map();
    }
}

/**
 * Builds a subdevice stub without invoking the real constructor (which requires a
 * manager/hub chain). Wires ability factories for the given capability kind.
 *
 * @param {'tempHum'|'doorWindow'|'waterLeak'|'smoke'|'mts100'} kind
 * @returns {import('../lib/device/subdevice').MerossSubDevice}
 */
function createStub(kind) {
    const subdev = Object.create(MerossSubDevice.prototype);
    EventEmitter.call(subdev);
    subdev._subdeviceId = 'sub-1';
    subdev._type = SUBDEVICE_TYPE_BY_KIND[kind];
    subdev._hub = { uuid: 'hub-uuid', onlineStatus: OnlineStatus.ONLINE };
    subdev._onlineStatus = OnlineStatus.UNKNOWN;
    subdev.emit = EventEmitter.prototype.emit.bind(subdev);
    subdev.on = EventEmitter.prototype.on.bind(subdev);

    initSubdeviceStateMaps(subdev, kind);

    if (kind === 'tempHum') {
        subdev.tempHum = createTempHumAbility(subdev);
        subdev.sensorAlert = createSensorAlertAbility(subdev);
        subdev.sensorAdjust = createSensorAdjustAbility(subdev);
    } else if (kind === 'doorWindow') {
        subdev.doorWindow = createDoorWindowAbility(subdev);
    } else if (kind === 'waterLeak') {
        subdev.waterLeak = createWaterLeakAbility(subdev);
    } else if (kind === 'smoke') {
        subdev.smokeAlarm = createSmokeAlarmAbility(subdev);
    } else if (kind === 'mts100') {
        subdev.mts100 = createMts100Ability(subdev);
    }

    return subdev;
}

/** @param {number} timestamp */
const headerAt = (timestamp) => ({ timestamp, timestampMs: 0 });

describe('MerossSubDevice.handleMessage header-timestamp ordering', () => {
    it('stale Hub.Sensor.All does not overwrite temperature set by fresh Hub.Sensor.TempHum', async () => {
        const sensor = createStub('tempHum');

        await sensor.handleMessage({
            header: headerAt(200),
            namespace: 'Appliance.Hub.Sensor.TempHum',
            payload: { id: 'sub-1', temperature: { latest: 250 } }
        });
        assert.strictEqual(sensor._temperatureStateByChannel.get(0)._state.latest, 250);

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.All',
            payload: { id: 'sub-1', temperature: { latest: 999 } }
        });
        assert.strictEqual(
            sensor._temperatureStateByChannel.get(0)._state.latest,
            250,
            'stale Sensor.All must not clobber temperature under the shared _handleSensorAll gate'
        );
    });

    it('stale Hub.Sensor.All cannot overwrite _onlineStatus set by fresh Hub.Online', async () => {
        const sensor = createStub('waterLeak');

        await sensor.handleMessage({
            header: headerAt(200),
            namespace: 'Appliance.Hub.Online',
            payload: { id: 'sub-1', status: 1 }
        });
        assert.strictEqual(sensor._onlineStatus, OnlineStatus.ONLINE);

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.All',
            payload: { id: 'sub-1', online: { status: 2 } }
        });
        assert.strictEqual(
            sensor._onlineStatus,
            OnlineStatus.ONLINE,
            'stale Sensor.All must not flip _onlineStatus under the shared "online" gate'
        );
    });

    it('equal-timestamp updates are accepted (matches shouldApplyUpdate semantics)', async () => {
        const sensor = createStub('tempHum');

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.TempHum',
            payload: { id: 'sub-1', temperature: { latest: 250 } }
        });
        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.TempHum',
            payload: { id: 'sub-1', temperature: { latest: 300 } }
        });

        assert.strictEqual(sensor._temperatureStateByChannel.get(0)._state.latest, 300);
    });

    it('handleMessage with no header applies unconditionally (treats messageTs as null)', async () => {
        const sensor = createStub('tempHum');

        await sensor.handleMessage({
            header: headerAt(500),
            namespace: 'Appliance.Hub.Sensor.TempHum',
            payload: { id: 'sub-1', temperature: { latest: 250 } }
        });
        await sensor.handleMessage({
            header: undefined,
            namespace: 'Appliance.Hub.Sensor.TempHum',
            payload: { id: 'sub-1', temperature: { latest: 400 } }
        });

        assert.strictEqual(sensor._temperatureStateByChannel.get(0)._state.latest, 400);
    });

    it('ignores namespaces not registered on the class', async () => {
        const sensor = createStub('tempHum');

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Control.ToggleX',
            payload: { togglex: [{ channel: 0, onoff: 1 }] }
        });

        assert.strictEqual(sensor._temperatureStateByChannel.size, 0);
    });

    it('emits a "message" event with the envelope for every call', async () => {
        const sensor = createStub('tempHum');
        const seen = [];
        sensor.on('message', (envelope) => seen.push(envelope));

        const envelope = {
            header: headerAt(100),
            namespace: 'Appliance.Hub.Battery',
            payload: { id: 'sub-1', value: 42 }
        };
        await sensor.handleMessage(envelope);

        assert.strictEqual(seen.length, 1);
        assert.strictEqual(seen[0].namespace, 'Appliance.Hub.Battery');
        assert.strictEqual(seen[0].payload, envelope.payload);
    });

    for (const [label, kind] of [
        ['tempHum subdevice', 'tempHum'],
        ['waterLeak subdevice', 'waterLeak'],
        ['smoke subdevice', 'smoke'],
        ['mts100 subdevice', 'mts100']
    ]) {
        for (const [batteryNs, batteryLabel] of [
            ['Appliance.Hub.Battery', 'Hub.Battery'],
            ['Appliance.Hub.Mts100.Battery', 'Hub.Mts100.Battery']
        ]) {
            it(`${label} caches ${batteryLabel} value`, async () => {
                const subdevice = createStub(kind);

                await subdevice.handleMessage({
                    header: headerAt(100),
                    namespace: batteryNs,
                    payload: { id: 'sub-1', value: 88 }
                });

                assert.strictEqual(subdevice.getBattery(), 88);
            });
        }
    }

    it('HubTempHumSensor caches alert and adjust namespaces', async () => {
        const sensor = createStub('tempHum');

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.Alert',
            payload: { id: 'sub-1', temperature: [[1, -100, 500]] }
        });
        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.Adjust',
            payload: { id: 'sub-1', temperature: -20, humidity: 30 }
        });

        assert.deepStrictEqual(sensor.sensorAlert.getAlert().temperature, [[1, -100, 500]]);
        assert.strictEqual(sensor.sensorAdjust.getAdjust().temperature, -20);
        assert.strictEqual(sensor.sensorAdjust.getAdjust().humidity, 30);
    });

    it('HubDoorWindowSensor caches door/window state', async () => {
        const sensor = createStub('doorWindow');

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.DoorWindow',
            payload: { id: 'sub-1', status: 1, lmTime: 1615876016 }
        });

        assert.strictEqual(sensor.doorWindow.isOpen(), true);
        assert.strictEqual(sensor.doorWindow.getLatestLmTime(), 1615876016);
    });

    it('HubThermostatValve caches MTS100 adjust, superCtl, scheduleB, and config', async () => {
        const valve = createStub('mts100');

        await valve.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Mts100.Adjust',
            payload: { id: 'sub-1', temperature: -200 }
        });
        await valve.handleMessage({
            namespace: 'Appliance.Hub.Mts100.SuperCtl',
            payload: { id: 'sub-1', enable: 2, level: 1, alert: 1 }
        });
        await valve.handleMessage({
            namespace: 'Appliance.Hub.Mts100.ScheduleB',
            payload: { id: 'sub-1', mon: [[480, 220]] }
        });
        await valve.handleMessage({
            namespace: 'Appliance.Hub.Mts100.Config',
            payload: { id: 'sub-1', pid: { grade: 0, p: 0, i: 0 } }
        });

        assert.strictEqual(valve.mts100.getAdjust(), -2);
        assert.deepStrictEqual(valve.mts100.getSuperCtl(), { id: 'sub-1', enable: 2, level: 1, alert: 1 });
        assert.deepStrictEqual(valve.mts100.getScheduleB().mon, [[480, 220]]);
        assert.deepStrictEqual(valve.mts100.getConfig().pid, { grade: 0, p: 0, i: 0 });
    });

    it('HubTempHumSensor applies Hub.Online and records lastActiveTime', async () => {
        const sensor = createStub('tempHum');

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Online',
            payload: { id: 'sub-1', status: 1, lastActiveTime: 12345 }
        });

        assert.strictEqual(sensor._onlineStatus, OnlineStatus.ONLINE);
        assert.strictEqual(sensor._lastActiveTime, 12345);
    });
});

describe('MerossSubDevice subscription parity', () => {
    it('emits stateChange and getState after hub message', async () => {
        const sensor = createStub('tempHum');
        const events = [];
        sensor.on('stateChange', (e) => events.push(e));

        await sensor.handleMessage({
            header: { ...headerAt(100), method: 'PUSH' },
            namespace: 'Appliance.Hub.Battery',
            payload: { id: 'sub-1', value: 77 }
        });

        assert.strictEqual(sensor.getBattery(), 77);
        const batteryEvent = events.find((e) => e.type === 'battery');
        assert.ok(batteryEvent, `expected battery stateChange, got: ${events.map(e => e.type).join(',')}`);
        assert.strictEqual(batteryEvent.channel, 0);
        assert.strictEqual(batteryEvent.value, 77);
        assert.strictEqual(batteryEvent.source, 'push');
        assert.deepStrictEqual(sensor.getState().battery, { 0: 77 });
    });
});

describe('HubSmokeDetector smokeAlarm.get routes through handleMessage', () => {
    it('applies the GET response through the dispatcher (ordering gate honoured)', async () => {
        const detector = createStub('smoke');

        let pendingResponse = null;
        detector.publishMessage = async () => pendingResponse;

        pendingResponse = {
            header: headerAt(200),
            payload: { smokeAlarm: [{ id: 'sub-1', status: SmokeAlarmStatus.MUTE_SMOKE_ALARM, timestamp: 999 }] }
        };
        await detector.smokeAlarm.get();
        assert.strictEqual(detector.smokeAlarm.getStatus(), SmokeAlarmStatus.MUTE_SMOKE_ALARM);

        pendingResponse = {
            header: headerAt(100),
            payload: { smokeAlarm: [{ id: 'sub-1', status: SmokeAlarmStatus.NORMAL, timestamp: 1000 }] }
        };
        await detector.smokeAlarm.get();
        assert.strictEqual(
            detector.smokeAlarm.getStatus(),
            SmokeAlarmStatus.MUTE_SMOKE_ALARM,
            'stale response header must not overwrite alarm state'
        );
    });
});

describe('HubSmokeDetector smokeAlarm state slice', () => {
    it('derives alarm fields from status codes', () => {
        const detector = createStub('smoke');

        detector._smokeAlarmStateByChannel.set(0, new SmokeAlarmState({ status: SmokeAlarmStatus.ALARM_SMOKE }));
        assert.strictEqual(detector.smokeAlarm.getType(), 'smoke');
        assert.strictEqual(detector.smokeAlarm.isActive(), true);
        assert.strictEqual(detector.smokeAlarm.isMuted(), false);
        assert.strictEqual(detector.smokeAlarm.isError(), false);

        detector._smokeAlarmStateByChannel.set(0, new SmokeAlarmState({ status: SmokeAlarmStatus.ALARM_TEMPERATURE }));
        assert.strictEqual(detector.smokeAlarm.getType(), 'temperature');
        assert.strictEqual(detector.smokeAlarm.isActive(), true);

        detector._smokeAlarmStateByChannel.set(0, new SmokeAlarmState({ status: SmokeAlarmStatus.ERROR_BATTERY }));
        assert.strictEqual(detector.smokeAlarm.getType(), 'battery');
        assert.strictEqual(detector.smokeAlarm.isError(), true);

        detector._smokeAlarmStateByChannel.set(0, new SmokeAlarmState({
            status: SmokeAlarmStatus.INTERCONNECTION_STATUS,
            interConn: 0
        }));
        assert.strictEqual(detector.smokeAlarm.getType(), 'interconnection');
        assert.strictEqual(detector.smokeAlarm.getCondition(), 'safe');
        assert.deepStrictEqual(detector.smokeAlarm.getInterconnect(), { linkActive: false, raw: 0 });
    });

    it('emits smokeAlarm stateChange with derived fields from Sensor.All lmTime', async () => {
        const detector = createStub('smoke');
        const events = [];
        detector.on('stateChange', (event) => events.push(event));

        await detector.handleMessage({
            header: { method: 'PUSH', timestamp: 500 },
            namespace: 'Appliance.Hub.Sensor.All',
            payload: {
                id: 'sub-1',
                smokeAlarm: {
                    status: SmokeAlarmStatus.ALARM_TEMPERATURE,
                    lmTime: 1681997644,
                    interConn: 0
                }
            }
        });

        assert.strictEqual(detector.smokeAlarm.getStatus(), SmokeAlarmStatus.ALARM_TEMPERATURE);
        assert.strictEqual(detector.smokeAlarm.getType(), 'temperature');
        assert.strictEqual(detector.smokeAlarm.isActive(), true);
        assert.strictEqual(detector.smokeAlarm.getLastStatusUpdate(), 1681997644);

        const smokeEvent = events.find((event) => event.type === 'smokeAlarm');
        assert.ok(smokeEvent, `expected smokeAlarm stateChange, got: ${events.map((e) => e.type).join(',')}`);
        assert.strictEqual(smokeEvent.channel, 0);
        assert.strictEqual(smokeEvent.value.condition, 'alarming');
        assert.strictEqual(smokeEvent.value.channel, 'temperature');
        assert.strictEqual(smokeEvent.value.lastStatusUpdate, 1681997644);
        assert.strictEqual('status' in smokeEvent.value, false);
        assert.deepStrictEqual(detector.getState().smokeAlarm[0], smokeEvent.value);
    });
});
