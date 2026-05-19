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
    HubWaterLeakSensor,
    HubSmokeDetector
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
    subdev._onlineStatus = OnlineStatus.UNKNOWN;

    if (Ctor === HubTempHumSensor) {
        subdev._temperature = {};
        subdev._humidity = {};
        subdev._battery = null;
        subdev._lux = null;
        subdev._samples = [];
        subdev._lastSampledTime = null;
    } else if (Ctor === HubWaterLeakSensor) {
        subdev._waterLeakState = null;
        subdev._lastEventTs = null;
        subdev._cachedEvents = [];
        subdev._maxEventsQueueLen = 30;
        subdev._lastWaterLeakEventTs = null;
    } else if (Ctor === HubSmokeDetector) {
        subdev._alarmStatus = null;
        subdev._interConn = null;
        subdev._lastStatusUpdate = null;
        subdev._testEvents = [];
        subdev._maxTestEvents = 10;
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
});

describe('HubSmokeDetector.refreshAlarmStatus routes through handleMessage', () => {
    it('applies the GET response through the dispatcher (ordering gate honoured)', async () => {
        const detector = createStub(HubSmokeDetector);

        // Shared publishMessage stub; `header` controls the ordering gate.
        let pendingResponse = null;
        detector.publishMessage = async () => pendingResponse;

        pendingResponse = {
            header: headerAt(200),
            payload: { smokeAlarm: [{ id: 'sub-1', status: SmokeAlarmStatus.MUTE_SMOKE_ALARM, timestamp: 999 }] }
        };
        await detector.refreshAlarmStatus();
        assert.strictEqual(detector._alarmStatus, SmokeAlarmStatus.MUTE_SMOKE_ALARM);

        // Stale response must not flip alarm status back.
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
