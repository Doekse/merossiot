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

const {
    HubTempHumSensor,
    HubDoorWindowSensor,
    HubWaterLeakSensor,
    HubSmokeDetector,
    HubThermostatValve
} = require('../lib/device/subdevice');
const { OnlineStatus, SmokeAlarmStatus } = require('../lib/enums');

/**
 * Builds a subdevice stub without invoking the real constructor (which requires a
 * manager/hub chain). Copies the instance-init behaviour of each concrete class.
 *
 * @template {Function} Ctor
 * @param {Ctor} Ctor
 * @returns {InstanceType<Ctor>}
 */
function createStub(Ctor) {
    const subdev = Object.create(Ctor.prototype);
    EventEmitter.call(subdev);
    subdev._subdeviceId = 'sub-1';
    subdev._hub = { uuid: 'hub-uuid', onlineStatus: OnlineStatus.ONLINE };
    subdev._onlineStatus = OnlineStatus.UNKNOWN;
    subdev._subscriptionStateSnapshot = null;
    subdev.emit = EventEmitter.prototype.emit.bind(subdev);
    subdev.on = EventEmitter.prototype.on.bind(subdev);

    if (Ctor === HubTempHumSensor) {
        subdev._temperature = {};
        subdev._humidity = {};
        subdev._battery = null;
        subdev._lux = null;
        subdev._samples = [];
        subdev._lastSampledTime = null;
        subdev._alert = {};
        subdev._adjust = {};
    } else if (Ctor === HubDoorWindowSensor) {
        subdev._battery = null;
        subdev._doorWindowStatus = null;
        subdev._lmTime = null;
        subdev._syncedTime = null;
        subdev._samples = [];
    } else if (Ctor === HubWaterLeakSensor) {
        subdev._battery = null;
        subdev._waterLeakState = null;
        subdev._lastEventTs = null;
        subdev._cachedEvents = [];
        subdev._maxEventsQueueLen = 30;
        subdev._lastWaterLeakEventTs = null;
    } else if (Ctor === HubSmokeDetector) {
        subdev._battery = null;
        subdev._alarmStatus = null;
        subdev._interConn = null;
        subdev._lastStatusUpdate = null;
        subdev._testEvents = [];
        subdev._maxTestEvents = 10;
    } else if (Ctor === HubThermostatValve) {
        subdev._battery = null;
        subdev._togglex = {};
        subdev._mode = {};
        subdev._temperature = {};
        subdev._adjust = {};
        subdev._scheduleBMode = null;
        subdev._scheduleB = null;
        subdev._superCtl = null;
        subdev._mts100Config = null;
        subdev._lastActiveTime = null;
    }

    return subdev;
}

/** @param {number} timestamp */
const headerAt = (timestamp) => ({ timestamp, timestampMs: 0 });

describe('MerossSubDevice.handleMessage header-timestamp ordering', () => {
    it('stale Hub.Sensor.All does not overwrite temperature set by fresh Hub.Sensor.TempHum', async () => {
        const sensor = createStub(HubTempHumSensor);

        await sensor.handleMessage({
            header: headerAt(200),
            namespace: 'Appliance.Hub.Sensor.TempHum',
            payload: { id: 'sub-1', temperature: { latest: 250 } }
        });
        assert.strictEqual(sensor._temperature.latest, 250);

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.All',
            payload: { id: 'sub-1', temperature: { latest: 999 } }
        });
        assert.strictEqual(
            sensor._temperature.latest,
            250,
            'stale Sensor.All must not clobber temperature under the shared _handleSensorAll gate'
        );
    });

    it('stale Hub.Sensor.All cannot overwrite _onlineStatus set by fresh Hub.Online', async () => {
        const sensor = createStub(HubWaterLeakSensor);

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
        const sensor = createStub(HubTempHumSensor);

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

        assert.strictEqual(sensor._temperature.latest, 300);
    });

    it('handleMessage with no header applies unconditionally (treats messageTs as null)', async () => {
        const sensor = createStub(HubTempHumSensor);

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

        assert.strictEqual(sensor._temperature.latest, 400);
    });

    it('ignores namespaces not registered on the class', async () => {
        const sensor = createStub(HubTempHumSensor);

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Control.ToggleX',
            payload: { togglex: [{ channel: 0, onoff: 1 }] }
        });

        assert.deepStrictEqual(sensor._temperature, {});
    });

    it('emits a "message" event with the envelope for every call', async () => {
        const sensor = createStub(HubTempHumSensor);
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

    for (const [label, Ctor] of [
        ['HubTempHumSensor', HubTempHumSensor],
        ['HubWaterLeakSensor', HubWaterLeakSensor],
        ['HubSmokeDetector', HubSmokeDetector],
        ['HubThermostatValve', HubThermostatValve]
    ]) {
        for (const [batteryNs, batteryLabel] of [
            ['Appliance.Hub.Battery', 'Hub.Battery'],
            ['Appliance.Hub.Mts100.Battery', 'Hub.Mts100.Battery']
        ]) {
            it(`${label} caches ${batteryLabel} value`, async () => {
                const subdevice = createStub(Ctor);

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
        const sensor = createStub(HubTempHumSensor);

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

        assert.deepStrictEqual(sensor.getAlert().temperature, [[1, -100, 500]]);
        assert.strictEqual(sensor.getAdjust().temperature, -20);
        assert.strictEqual(sensor.getAdjust().humidity, 30);
    });

    it('HubDoorWindowSensor caches door/window state', async () => {
        const sensor = createStub(HubDoorWindowSensor);

        await sensor.handleMessage({
            header: headerAt(100),
            namespace: 'Appliance.Hub.Sensor.DoorWindow',
            payload: { id: 'sub-1', status: 1, lmTime: 1615876016 }
        });

        assert.strictEqual(sensor.isOpen(), true);
        assert.strictEqual(sensor.getLatestLmTime(), 1615876016);
    });

    it('HubThermostatValve caches MTS100 adjust, superCtl, scheduleB, and config', async () => {
        const valve = createStub(HubThermostatValve);

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

        assert.strictEqual(valve.getAdjust(), -2);
        assert.deepStrictEqual(valve.getSuperCtl(), { id: 'sub-1', enable: 2, level: 1, alert: 1 });
        assert.deepStrictEqual(valve.getScheduleB().mon, [[480, 220]]);
        assert.deepStrictEqual(valve.getMts100Config().pid, { grade: 0, p: 0, i: 0 });
    });

    it('HubTempHumSensor applies Hub.Online and records lastActiveTime', async () => {
        const sensor = createStub(HubTempHumSensor);

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
    it('uses internalId as subscriptionKey', () => {
        const sensor = createStub(HubTempHumSensor);
        assert.ok(sensor.subscriptionKey.includes('hub-uuid'));
        assert.ok(sensor.subscriptionKey.includes('sub-1'));
    });

    it('emits stateChange and getState after hub message', async () => {
        const sensor = createStub(HubTempHumSensor);
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

describe('HubSmokeDetector.refreshAlarmStatus routes through handleMessage', () => {
    it('applies the GET response through the dispatcher (ordering gate honoured)', async () => {
        const detector = createStub(HubSmokeDetector);

        let pendingResponse = null;
        detector.publishMessage = async () => pendingResponse;

        pendingResponse = {
            header: headerAt(200),
            payload: { smokeAlarm: [{ id: 'sub-1', status: SmokeAlarmStatus.MUTE_SMOKE_ALARM, timestamp: 999 }] }
        };
        await detector.refreshAlarmStatus();
        assert.strictEqual(detector._alarmStatus, SmokeAlarmStatus.MUTE_SMOKE_ALARM);

        pendingResponse = {
            header: headerAt(100),
            payload: { smokeAlarm: [{ id: 'sub-1', status: SmokeAlarmStatus.NORMAL, timestamp: 1000 }] }
        };
        await detector.refreshAlarmStatus();
        assert.strictEqual(
            detector._alarmStatus,
            SmokeAlarmStatus.MUTE_SMOKE_ALARM,
            'stale response header must not overwrite alarm state'
        );
    });
});
