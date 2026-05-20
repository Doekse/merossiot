'use strict';

/**
 * Unit tests for {@link module:lib/push} notification classes: constructor
 * normalization (including {@link GenericPushNotification.normalizeToArray}) and
 * {@link GenericPushNotification#extractChanges}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
    GenericPushNotification,
    OnlinePushNotification,
    AlarmPushNotification,
    BindPushNotification,
    UnbindPushNotification,
    WaterLeakPushNotification,
    HubOnlinePushNotification,
    HubToggleXPushNotification,
    HubBatteryPushNotification,
    HubSensorAllPushNotification,
    HubSensorTempHumPushNotification,
    HubSensorAlertPushNotification,
    HubSensorSmokePushNotification,
    HubMts100AllPushNotification,
    HubMts100ModePushNotification,
    HubMts100TemperaturePushNotification,
    HubSubdeviceListPushNotification,
    SensorLatestXPushNotification,
    TimerXPushNotification,
    TriggerXPushNotification,
    ToggleXPushNotification,
    PresenceStudyPushNotification,
    DiffuserLightPushNotification,
    DiffuserSprayPushNotification,
    HardwareInfo,
    FirmwareInfo,
    TimeInfo,
    parsePushNotification
} = require('../lib/push');
const { PresenceState } = require('../lib/enums');

const UUID = 'push-test-uuid';

/**
 * Asserts that `normalizeToArray` yields the same stored payload for a single object vs a one-element array.
 *
 * @param {new (uuid: string, raw: Object) => GenericPushNotification} Ctor
 * @param {string} key - Top-level payload key (e.g. `togglex`)
 * @param {Object} item - One element object
 * @param {function(GenericPushNotification): Array} getNormalized - Returns normalized array from the instance
 * @returns {void}
 */
function assertSingleAndArrayPayloadMatch(Ctor, key, item, getNormalized) {
    const single = new Ctor(UUID, { [key]: item });
    const asArray = new Ctor(UUID, { [key]: [item] });
    assert.deepStrictEqual(getNormalized(single), getNormalized(asArray));
}

describe('push notification models', () => {
    it('GenericPushNotification.normalizeToArray handles array, single object, and empty', () => {
        assert.deepStrictEqual(GenericPushNotification.normalizeToArray([1, 2]), [1, 2]);
        assert.deepStrictEqual(GenericPushNotification.normalizeToArray({ a: 1 }), [{ a: 1 }]);
        assert.deepStrictEqual(GenericPushNotification.normalizeToArray(null), []);
        assert.deepStrictEqual(GenericPushNotification.normalizeToArray(undefined), []);
    });

    it('GenericPushNotification extractChanges is empty by default', () => {
        const n = new GenericPushNotification('Appliance.Unknown', UUID, {});
        assert.deepStrictEqual(n.extractChanges(), {});
    });

    /**
     * Table-driven check that every namespace in {@link module:lib/push/factory}'s
     * `PUSH_NOTIFICATION_BINDING` routes to its declared class.
     *
     * Keeping this one test in lock-step with the factory binding catches accidental drops
     * (a removed row here fails the test) and accidental re-routings (a changed class
     * returns a different instance).
     */
    const PARSE_CASES = [
        ['Appliance.System.Online', OnlinePushNotification],
        ['Appliance.Control.Alarm', AlarmPushNotification],
        ['Appliance.Control.Bind', BindPushNotification],
        ['Appliance.Control.Unbind', UnbindPushNotification],
        ['Appliance.Control.ToggleX', ToggleXPushNotification],
        ['Appliance.Control.TimerX', TimerXPushNotification],
        ['Appliance.Control.TriggerX', TriggerXPushNotification],
        ['Appliance.Hub.Sensor.WaterLeak', WaterLeakPushNotification],
        ['Appliance.Hub.Online', HubOnlinePushNotification],
        ['Appliance.Hub.ToggleX', HubToggleXPushNotification],
        ['Appliance.Hub.Battery', HubBatteryPushNotification],
        ['Appliance.Hub.Mts100.Battery', HubBatteryPushNotification],
        ['Appliance.Hub.Sensor.All', HubSensorAllPushNotification],
        ['Appliance.Hub.Sensor.TempHum', HubSensorTempHumPushNotification],
        ['Appliance.Hub.Sensor.Alert', HubSensorAlertPushNotification],
        ['Appliance.Hub.Sensor.Smoke', HubSensorSmokePushNotification],
        ['Appliance.Hub.Mts100.All', HubMts100AllPushNotification],
        ['Appliance.Hub.Mts100.Mode', HubMts100ModePushNotification],
        ['Appliance.Hub.Mts100.Temperature', HubMts100TemperaturePushNotification],
        ['Appliance.Hub.SubdeviceList', HubSubdeviceListPushNotification],
        ['Appliance.Control.Sensor.LatestX', SensorLatestXPushNotification],
        ['Appliance.Control.Presence.Study', PresenceStudyPushNotification],
        ['Appliance.Control.Diffuser.Light', DiffuserLightPushNotification],
        ['Appliance.Control.Diffuser.Spray', DiffuserSprayPushNotification]
    ];

    for (const [namespace, ExpectedClass] of PARSE_CASES) {
        it(`parsePushNotification maps ${namespace} to ${ExpectedClass.name}`, () => {
            const n = parsePushNotification(namespace, {}, UUID);
            assert.ok(
                n instanceof ExpectedClass,
                `expected ${ExpectedClass.name}, got ${n && n.constructor.name}`
            );
            assert.strictEqual(n.namespace, namespace);
            assert.strictEqual(n.originatingDeviceUuid, UUID);
        });
    }

    it('parsePushNotification falls back to GenericPushNotification for unmapped namespaces', () => {
        const n = parsePushNotification('Appliance.Totally.Unknown', {}, UUID);
        assert.ok(n instanceof GenericPushNotification);
        assert.strictEqual(n.constructor, GenericPushNotification);
        assert.strictEqual(n.namespace, 'Appliance.Totally.Unknown');
    });

    it('parsePushNotification returns null when namespace or uuid is missing', () => {
        assert.strictEqual(parsePushNotification(null, {}, UUID), null);
        assert.strictEqual(parsePushNotification('', {}, UUID), null);
        assert.strictEqual(parsePushNotification('Appliance.Control.ToggleX', {}, null), null);
        assert.strictEqual(parsePushNotification('Appliance.Control.ToggleX', {}, ''), null);
    });

    it('parsePushNotification attaches optional MQTT header on mapped and generic notifications', () => {
        const hdr = { timestamp: 12, timestampMs: 34 };
        const mapped = parsePushNotification('Appliance.Control.ToggleX', { togglex: [] }, UUID, hdr);
        assert.strictEqual(mapped.header, hdr);
        const generic = parsePushNotification('Appliance.Totally.Unknown', {}, UUID, hdr);
        assert.strictEqual(generic.header, hdr);
    });

    it('ToggleXPushNotification normalizes togglex and extractChanges maps channels to booleans', () => {
        assertSingleAndArrayPayloadMatch(
            ToggleXPushNotification,
            'togglex',
            { channel: 0, onoff: 1 },
            (n) => n.togglexData
        );
        const n = new ToggleXPushNotification(UUID, {
            togglex: [
                { channel: 0, onoff: 1 },
                { channel: 1, onoff: 0 }
            ]
        });
        assert.deepStrictEqual(n.extractChanges(), { toggle: { 0: true, 1: false } });
    });

    it('OnlinePushNotification exposes online status', () => {
        const n = new OnlinePushNotification(UUID, { online: { status: 1 } });
        assert.strictEqual(n.status, 1);
        assert.deepStrictEqual(n.extractChanges(), {});
    });

    it('AlarmPushNotification normalizes alarm array and reads first alarm interConn', () => {
        const item = {
            channel: 2,
            event: {
                interConn: {
                    value: 99,
                    timestamp: 1000,
                    source: { subId: 'sub-1' }
                }
            }
        };
        assertSingleAndArrayPayloadMatch(AlarmPushNotification, 'alarm', item, (n) => n.rawData.alarm);
        const n = new AlarmPushNotification(UUID, { alarm: item });
        assert.strictEqual(n.channel, 2);
        assert.strictEqual(n.value, 99);
        assert.strictEqual(n.timestamp, 1000);
        assert.strictEqual(n.subdeviceId, 'sub-1');
        assert.deepStrictEqual(n.extractChanges(), {});
    });

    it('BindPushNotification exposes TimeInfo, HardwareInfo, and FirmwareInfo', () => {
        const n = new BindPushNotification(UUID, {
            bind: {
                time: { timezone: 'UTC', timestamp: 1, timeRule: 'x' },
                hardware: { version: '1', uuid: 'hw', type: 't', subType: 's', macAddress: 'm', chipType: 'c' },
                firmware: {
                    wifiMac: 'w',
                    version: 'fv',
                    userId: 'u',
                    server: 's',
                    port: 443,
                    innerIp: 'i',
                    compileTime: 'ct'
                }
            }
        });
        assert.ok(n.time instanceof TimeInfo);
        assert.ok(n.hwinfo instanceof HardwareInfo);
        assert.ok(n.fwinfo instanceof FirmwareInfo);
        assert.strictEqual(n.hwinfo.type, 't');
        assert.strictEqual(n.fwinfo.version, 'fv');
        assert.deepStrictEqual(n.extractChanges(), {});
    });

    it('HardwareInfo.fromDict and FirmwareInfo.fromDict return null for invalid input', () => {
        assert.strictEqual(HardwareInfo.fromDict(null), null);
        assert.strictEqual(FirmwareInfo.fromDict(undefined), null);
    });

    it('UnbindPushNotification only carries namespace and raw data', () => {
        const n = new UnbindPushNotification(UUID, { extra: 1 });
        assert.strictEqual(n.namespace, 'Appliance.Control.Unbind');
        assert.deepStrictEqual(n.extractChanges(), {});
    });

    it('WaterLeakPushNotification normalizes waterLeak', () => {
        const item = {
            id: 'w1',
            latestWaterLeak: false,
            latestSampleTime: 5,
            syncedTime: 6,
            sample: []
        };
        assertSingleAndArrayPayloadMatch(
            WaterLeakPushNotification,
            'waterLeak',
            item,
            (n) => n.rawData.waterLeak
        );
        const n = new WaterLeakPushNotification(UUID, { waterLeak: item });
        assert.strictEqual(n.subdeviceId, 'w1');
        assert.strictEqual(n.latestSampleIsLeak, false);
        assert.deepStrictEqual(n.extractChanges(), {});
    });

    it('TimerXPushNotification normalizes timerx', () => {
        const item = { id: 't1', channel: 0, enable: 1, type: 1, time: 0, week: 0 };
        assertSingleAndArrayPayloadMatch(TimerXPushNotification, 'timerx', item, (n) => n.timerxData);
        assert.deepStrictEqual(new TimerXPushNotification(UUID, { timerx: item }).extractChanges(), {});
    });

    it('TriggerXPushNotification normalizes triggerx', () => {
        const item = { id: 'tr1', channel: 1, enable: 1, type: 0, rule: {} };
        assertSingleAndArrayPayloadMatch(TriggerXPushNotification, 'triggerx', item, (n) => n.triggerxData);
        assert.deepStrictEqual(new TriggerXPushNotification(UUID, { triggerx: item }).extractChanges(), {});
    });

    it('PresenceStudyPushNotification normalizes study', () => {
        const item = { channel: 0, value: 2, status: 1 };
        assertSingleAndArrayPayloadMatch(PresenceStudyPushNotification, 'study', item, (n) => n.studyData);
        assert.deepStrictEqual(new PresenceStudyPushNotification(UUID, { study: item }).extractChanges(), {});
    });

    it('hub push classes normalize their payload arrays', () => {
        assertSingleAndArrayPayloadMatch(
            HubOnlinePushNotification,
            'online',
            { id: 's1', status: 1 },
            (n) => n.onlineData
        );
        assertSingleAndArrayPayloadMatch(
            HubToggleXPushNotification,
            'togglex',
            { id: 's1', channel: 0, onoff: 1 },
            (n) => n.togglexData
        );
        assertSingleAndArrayPayloadMatch(
            HubBatteryPushNotification,
            'battery',
            { id: 's1', battery: 80 },
            (n) => n.batteryData
        );
        assertSingleAndArrayPayloadMatch(
            HubSensorAllPushNotification,
            'all',
            { id: 's1', x: 1 },
            (n) => n.allData
        );
        assertSingleAndArrayPayloadMatch(
            HubSensorTempHumPushNotification,
            'tempHum',
            { id: 's1', temperature: 200, humidity: 50 },
            (n) => n.tempHumData
        );
        assertSingleAndArrayPayloadMatch(
            HubSensorAlertPushNotification,
            'alert',
            { id: 's1', type: 1, value: 2 },
            (n) => n.alertData
        );
        assertSingleAndArrayPayloadMatch(
            HubMts100AllPushNotification,
            'all',
            { id: 's1', mode: 0 },
            (n) => n.allData
        );
        assertSingleAndArrayPayloadMatch(
            HubMts100ModePushNotification,
            'mode',
            { id: 's1', mode: 3 },
            (n) => n.modeData
        );
        assertSingleAndArrayPayloadMatch(
            HubMts100TemperaturePushNotification,
            'temperature',
            { id: 's1', currentTemp: 200, targetTemp: 210 },
            (n) => n.temperatureData
        );
    });

    it('HubSensorSmokePushNotification normalizes smokeAlarm and reads first entry', () => {
        const item = {
            id: 'sm1',
            status: 1,
            interConn: {},
            timestamp: 9,
            event: { test: true }
        };
        assertSingleAndArrayPayloadMatch(
            HubSensorSmokePushNotification,
            'smokeAlarm',
            item,
            (n) => n.rawData.smokeAlarm
        );
        const n = new HubSensorSmokePushNotification(UUID, { smokeAlarm: item });
        assert.strictEqual(n.subdeviceId, 'sm1');
        assert.strictEqual(n.testEvent, true);
        assert.deepStrictEqual(n.extractChanges(), {});
    });

    it('HubSubdeviceListPushNotification exposes subdevice list array', () => {
        const list = [{ id: 'a', type: 'MS100' }];
        const n = new HubSubdeviceListPushNotification(UUID, { subdeviceList: list });
        assert.deepStrictEqual(n.subdeviceListData, list);
        assert.deepStrictEqual(n.extractChanges(), {});
    });

    it('SensorLatestXPushNotification normalizes latest and extractChanges maps presence', () => {
        const latestItem = {
            channel: 0,
            data: {
                presence: [{ value: PresenceState.PRESENCE, distance: 5, timestamp: 1, times: 2 }],
                light: [{ value: 400, timestamp: 3 }]
            }
        };
        assertSingleAndArrayPayloadMatch(
            SensorLatestXPushNotification,
            'latest',
            latestItem,
            (n) => n.latestData
        );
        const n = new SensorLatestXPushNotification(UUID, { latest: latestItem });
        const ch = n.extractChanges().presence[0];
        assert.strictEqual(ch.isPresent, true);
        assert.strictEqual(ch.distance, 5);
        assert.strictEqual(ch.light, 400);
    });

    it('DiffuserLightPushNotification normalizes light and extractChanges maps diffuserLight', () => {
        const item = { channel: 0, onoff: 1, mode: 2, rgb: 0xff00, luminance: 50 };
        assertSingleAndArrayPayloadMatch(DiffuserLightPushNotification, 'light', item, (n) => n.lightData);
        const n = new DiffuserLightPushNotification(UUID, { light: item });
        assert.deepStrictEqual(n.extractChanges().diffuserLight[0], {
            isOn: true,
            mode: 2,
            rgb: 0xff00,
            luminance: 50
        });
    });

    it('DiffuserSprayPushNotification normalizes spray and extractChanges maps diffuserSpray', () => {
        const item = { channel: 0, mode: 2 };
        assertSingleAndArrayPayloadMatch(DiffuserSprayPushNotification, 'spray', item, (n) => n.sprayData);
        const n = new DiffuserSprayPushNotification(UUID, { spray: item });
        assert.deepStrictEqual(n.extractChanges().diffuserSpray[0], { mode: 2 });
    });
});
