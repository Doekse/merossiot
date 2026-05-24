'use strict';

/**
 * Ensures {@link MerossSubDevice#refreshState} polls only this subdevice's abilities
 * and does not delegate to the hub-wide refresh path.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');
const { EventEmitter } = require('node:events');

const { MerossSubDevice } = require('../lib/device/subdevice');
const createTempHumAbility = require('../lib/abilities/hub-temp-hum');
const createSensorAlertAbility = require('../lib/abilities/hub-alert');
const createSensorAdjustAbility = require('../lib/abilities/hub-adjust');

/**
 * @param {string} subdeviceId
 * @param {string} [type='ms100']
 * @returns {import('../lib/device/subdevice').MerossSubDevice}
 */
function createTempHumSubdevice(subdeviceId, type = 'ms100') {
    const subdev = Object.create(MerossSubDevice.prototype);
    EventEmitter.call(subdev);
    subdev._subdeviceId = subdeviceId;
    subdev._type = type;
    subdev._connectivityWire = -1;
    subdev._temperatureStateByChannel = new Map();
    subdev._humidityStateByChannel = new Map();
    subdev._luxStateByChannel = new Map();
    subdev._sensorAlertStateByChannel = new Map();
    subdev._sensorAdjustStateByChannel = new Map();
    subdev.abilities = {
        'Appliance.Hub.Sensor.TempHum': {},
        'Appliance.Hub.Sensor.Alert': {},
        'Appliance.Hub.Sensor.Adjust': {}
    };
    subdev.emit = EventEmitter.prototype.emit.bind(subdev);
    subdev.getState = () => ({ subdeviceId });
    subdev.tempHum = createTempHumAbility(subdev);
    subdev.sensorAlert = createSensorAlertAbility(subdev);
    subdev.sensorAdjust = createSensorAdjustAbility(subdev);

    let hubRefreshCalls = 0;
    subdev._hub = {
        uuid: 'hub-uuid',
        _connectivityWire: 1,
        get isOnline() {
            return true;
        },
        get connectivity() {
            return 'online';
        },
        refreshState: async () => {
            hubRefreshCalls += 1;
        },
        get _hubRefreshCalls() {
            return hubRefreshCalls;
        }
    };

    return subdev;
}

describe('MerossSubDevice.refreshState', () => {
    it('does not call hub.refreshState and only GETs this subdevice id', async () => {
        const sensor = createTempHumSubdevice('sub-a');
        const publishCalls = [];

        sensor.publishMessage = async (method, namespace, payload) => {
            publishCalls.push({ method, namespace, payload });
            return { header: { namespace }, payload: {} };
        };
        sensor.handleMessage = async () => {};

        await sensor.refreshState();

        assert.strictEqual(sensor._hub._hubRefreshCalls, 0);

        const idsInPayloads = publishCalls.flatMap((call) => {
            const key = Object.keys(call.payload)[0];
            const entries = call.payload[key];
            if (!Array.isArray(entries)) {
                return [];
            }
            return entries.map((entry) => entry.id);
        });

        assert.ok(publishCalls.length >= 3, 'expected tempHum, sensorAlert, and sensorAdjust GETs');
        assert.ok(idsInPayloads.every((id) => id === 'sub-a'));
        assert.ok(!idsInPayloads.includes('sub-b'));
    });

    it('does not include sibling subdevice ids when two sensors share a hub', async () => {
        const sensorA = createTempHumSubdevice('sub-a');
        const sensorB = createTempHumSubdevice('sub-b');
        sensorA._hub = sensorB._hub = {
            uuid: 'hub-uuid',
            _connectivityWire: 1,
            get isOnline() {
                return true;
            },
            get connectivity() {
                return 'online';
            },
            refreshState: async () => {
                throw new Error('hub refreshState should not run');
            }
        };

        const publishCalls = [];
        const sharedPublish = async (method, namespace, payload) => {
            publishCalls.push({ subdeviceId: sensorA.subdeviceId, method, namespace, payload });
            return { header: { namespace }, payload: {} };
        };

        sensorA.publishMessage = sharedPublish;
        sensorB.publishMessage = async (method, namespace, payload) => {
            publishCalls.push({ subdeviceId: 'sub-b', method, namespace, payload });
            return { header: { namespace }, payload: {} };
        };
        sensorA.handleMessage = async () => {};
        sensorB.handleMessage = async () => {};

        await sensorA.refreshState();

        const touchedSubB = publishCalls.some((call) => {
            const key = Object.keys(call.payload)[0];
            const entries = call.payload[key];
            return Array.isArray(entries) && entries.some((entry) => entry.id === 'sub-b');
        });

        assert.strictEqual(touchedSubB, false);
        assert.ok(
            publishCalls.every((call) => call.subdeviceId === 'sub-a'),
            'only sensor A refresh should publish'
        );
    });
});
