'use strict';

/**
 * Mocked-device tests for hub subdevice ability modules.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createTempHumAbility = require('../lib/abilities/hub-temp-hum');
const createSensorAlertAbility = require('../lib/abilities/hub-alert');
const createSensorAdjustAbility = require('../lib/abilities/hub-adjust');
const createWaterLeakAbility = require('../lib/abilities/hub-water-leak');
const createDoorWindowAbility = require('../lib/abilities/hub-door-window');
const createMts100Ability = require('../lib/abilities/hub-mts100');
const SensorAdjustState = require('../lib/states/sensor-adjust-state');
const { MerossSubDevice } = require('../lib/device/subdevice');
const { createPublishRecorder } = require('./helpers/mock-ability-device');
const DoorWindowState = require('../lib/states/door-window-state');

/** Default `_type` per capability kind (matches {@link SUBDEVICE_TYPES} models). */
const SUBDEVICE_TYPE_BY_KIND = {
    tempHum: 'ms100',
    waterLeak: 'ms400',
    doorWindow: 'ms200',
    mts100: 'mts100v3'
};

/**
 * @param {'tempHum'|'waterLeak'|'doorWindow'|'mts100'} kind
 * @param {Object} [fields={}]
 * @returns {object}
 */
function createSubdeviceStub(kind, fields = {}) {
    const device = Object.create(MerossSubDevice.prototype);
    device._subdeviceId = 'sub-1';
    device._type = fields._type ?? SUBDEVICE_TYPE_BY_KIND[kind];
    Object.assign(device, fields);
    Object.defineProperty(device, 'subdeviceId', {
        get() {
            return this._subdeviceId;
        }
    });
    return device;
}

describe('hub subdevice abilities (mocked device)', () => {
    it('tempHum.get() sends GET Appliance.Hub.Sensor.TempHum for subdevice', async () => {
        const sensor = createSubdeviceStub('tempHum', {
            _temperatureStateByChannel: new Map(),
            _humidityStateByChannel: new Map(),
            _luxStateByChannel: new Map()
        });
        const handleCalls = [];
        sensor.handleMessage = async (message) => {
            handleCalls.push(message);
        };

        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({
                tempHum: [{ id: 'sub-1', temperature: { latest: 250 } }]
            })
        });
        sensor.publishMessage = publishMessage;
        const tempHum = createTempHumAbility(sensor);

        await tempHum.get();

        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.Sensor.TempHum');
        assert.deepStrictEqual(calls[0].payload, { tempHum: [{ id: 'sub-1' }] });
        assert.strictEqual(handleCalls.length, 1);
    });

    it('waterLeak.get() fans out on hub through subdevice handleMessage', async () => {
        const subdevice = createSubdeviceStub('waterLeak', {
            _waterLeakStateByChannel: new Map()
        });
        const handleCalls = [];
        subdevice.handleMessage = async (message) => {
            handleCalls.push(message);
        };

        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({
                waterleak: [{ id: 'sub-1', latestWaterLeak: 0, latestSampleTime: 100 }]
            })
        });

        const hub = {
            publishMessage,
            getSubdevice(id) {
                return id === 'sub-1' ? subdevice : null;
            }
        };
        const waterLeak = createWaterLeakAbility(hub);

        await waterLeak.get({ sensorIds: 'sub-1' });

        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.Sensor.WaterLeak');
        assert.strictEqual(handleCalls.length, 1);
    });

    it('sensorAlert.set() sends SET Appliance.Hub.Sensor.Alert for subdevice', async () => {
        const sensor = createSubdeviceStub('tempHum', {
            _sensorAlertStateByChannel: new Map()
        });
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        sensor.publishMessage = publishMessage;
        const sensorAlert = createSensorAlertAbility(sensor);

        await sensorAlert.set({
            temperature: [[1, -100, 100]]
        });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.Sensor.Alert');
        assert.deepStrictEqual(calls[0].payload, {
            alert: [{ id: 'sub-1', temperature: [[1, -100, 100]] }]
        });
    });

    it('sensorAdjust.set() sends delta on wire and updates cache with absolute offset', async () => {
        const sensor = createSubdeviceStub('tempHum', {
            _sensorAdjustStateByChannel: new Map([[0, new SensorAdjustState({ temperature: 10, humidity: 0 })]])
        });
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        sensor.publishMessage = publishMessage;
        const sensorAdjust = createSensorAdjustAbility(sensor);

        await sensorAdjust.set({ temperature: 5 });

        assert.deepStrictEqual(calls[0].payload, {
            adjust: [{ id: 'sub-1', temperature: 5 }]
        });
        assert.strictEqual(sensorAdjust.getAdjust().temperature, 15);
    });

    it('mts100.get({ complete: true }) polls ScheduleB with schedule array key', async () => {
        const valve = createSubdeviceStub('mts100');
        valve._hubThermostatStateByChannel = new Map();
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: (method, namespace) => {
                if (namespace === 'Appliance.Hub.Mts100.All') {
                    return { all: [{ id: 'sub-1' }] };
                }
                if (namespace === 'Appliance.Hub.Mts100.ScheduleB') {
                    return { schedule: [{ id: 'sub-1', mon: [[480, 220]] }] };
                }
                return {};
            }
        });
        valve.publishMessage = publishMessage;
        const mts100 = createMts100Ability(valve);

        valve.handleMessage = async () => {};
        await mts100.get({ complete: true });

        const scheduleCall = calls.find(c => c.namespace === 'Appliance.Hub.Mts100.ScheduleB');
        assert.ok(scheduleCall);
        assert.strictEqual(scheduleCall.method, 'GET');
        assert.deepStrictEqual(scheduleCall.payload, { schedule: [{ id: 'sub-1' }] });
    });

    it('mts100.setScheduleB() sends SET with schedule array key', async () => {
        const valve = createSubdeviceStub('mts100');
        valve._hubThermostatStateByChannel = new Map();
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        valve.publishMessage = publishMessage;
        const mts100 = createMts100Ability(valve);

        await mts100.setScheduleB({ mon: [[480, 220]] });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.Mts100.ScheduleB');
        assert.deepStrictEqual(calls[0].payload, {
            schedule: [{ id: 'sub-1', mon: [[480, 220]] }]
        });
    });

    it('mts100.setToggle() sends SET Appliance.Hub.ToggleX for subdevice', async () => {
        const valve = createSubdeviceStub('mts100');
        valve._hubThermostatStateByChannel = new Map();
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        valve.publishMessage = publishMessage;
        const mts100 = createMts100Ability(valve);

        valve._hubThermostatStateByChannel = new Map();
        await mts100.setToggle({ on: true });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.ToggleX');
        assert.strictEqual(valve._hubThermostatStateByChannel.get(0)?.isOn, true);
    });

    it('doorWindow.isOpen() reads cached state', () => {
        const sensor = createSubdeviceStub('doorWindow');
        sensor._doorWindowStateByChannel = new Map();
        sensor._doorWindowStateByChannel.set(0, new DoorWindowState({
            status: 1,
            lmTime: 100
        }));
        const doorWindow = createDoorWindowAbility(sensor);

        assert.strictEqual(doorWindow.isOpen(), true);
        assert.strictEqual(doorWindow.getContactState(), 'open');
        assert.strictEqual(doorWindow.getLatestLmTime(), 100);
    });
});
