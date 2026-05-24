'use strict';

/**
 * Mocked-device tests for {@link module:abilities/hub-smoke}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createSmokeAlarmAbility = require('../lib/abilities/hub-smoke');
const { MerossSubDevice } = require('../lib/device/subdevice');
const SmokeAlarmState = require('../lib/states/smoke-alarm-state');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

/**
 * Minimal smoke detector stub with subdeviceId and handleMessage from the prototype.
 *
 * @returns {import('../lib/device/subdevice').MerossSubDevice}
 */
function createSmokeDetectorStub() {
    const detector = Object.create(MerossSubDevice.prototype);
    detector._subdeviceId = 'sub-1';
    detector._type = 'ma151';
    detector._smokeAlarmStateByChannel = new Map();
    detector.abilities = {
        'Appliance.Hub.Sensor.Smoke': {},
        'Appliance.Hub.Sensor.All': {}
    };
    Object.defineProperty(detector, 'subdeviceId', {
        get() {
            return this._subdeviceId;
        }
    });
    return detector;
}

describe('smoke alarm ability (mocked device)', () => {
    it('get() sends GET Appliance.Hub.Sensor.Smoke for subdevice', async () => {
        const detector = createSmokeDetectorStub();
        const handleCalls = [];
        detector.handleMessage = async (message) => {
            handleCalls.push(message);
        };

        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({
                smokeAlarm: [{ id: 'sub-1', status: 23, timestamp: 100 }]
            })
        });
        detector.publishMessage = publishMessage;
        const smokeAlarm = createSmokeAlarmAbility(detector);

        await smokeAlarm.get();

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.Sensor.Smoke');
        assert.deepStrictEqual(calls[0].payload, {
            smokeAlarm: [{ id: 'sub-1' }]
        });
        assert.strictEqual(handleCalls.length, 1);
        assert.strictEqual(handleCalls[0].namespace, 'Appliance.Hub.Sensor.Smoke');
    });

    it('set() sends mute-smoke wire code when muteSmoke is true', async () => {
        const detector = createSmokeDetectorStub();
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        detector.publishMessage = publishMessage;
        const smokeAlarm = createSmokeAlarmAbility(detector);

        await smokeAlarm.set({ muteSmoke: true });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Hub.Sensor.Smoke');
        assert.deepStrictEqual(calls[0].payload, {
            smokeAlarm: [{ id: 'sub-1', status: 27 }]
        });
        assert.strictEqual(smokeAlarm.getStatus(), 'mute-smoke');
    });

    it('set() sends mute-temperature wire code when muteSmoke is false', async () => {
        const detector = createSmokeDetectorStub();
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        detector.publishMessage = publishMessage;
        const smokeAlarm = createSmokeAlarmAbility(detector);

        await smokeAlarm.set({ muteSmoke: false });

        assert.deepStrictEqual(calls[0].payload, {
            smokeAlarm: [{ id: 'sub-1', status: 26 }]
        });
        assert.strictEqual(smokeAlarm.getStatus(), 'mute-temperature');
    });

    it('getState smokeAlarm slice matches derived toSnapshot only', () => {
        const detector = createSmokeDetectorStub();
        const smokeAlarm = createSmokeAlarmAbility(detector);

        detector._smokeAlarmStateByChannel.set(0, new SmokeAlarmState({
            status: 25,
            lastStatusUpdate: 500
        }));

        assert.deepStrictEqual(detector._smokeAlarmStateByChannel.get(0).toSnapshot(), {
            condition: 'alarming',
            channel: 'smoke',
            interconnect: null,
            lastStatusUpdate: 500
        });
        assert.strictEqual(smokeAlarm.getStatus(), 'alarm-smoke');
        assert.strictEqual(smokeAlarm.getCondition(), 'alarming');
    });

    it('getCondition and getInterconnect expose structured view', () => {
        const detector = createSmokeDetectorStub();
        const smokeAlarm = createSmokeAlarmAbility(detector);

        detector._smokeAlarmStateByChannel.set(0, new SmokeAlarmState({
            status: 170,
            interConn: 0
        }));
        assert.strictEqual(smokeAlarm.getCondition(), 'safe');
        assert.deepStrictEqual(smokeAlarm.getInterconnect(), { linkActive: false, raw: 0 });
        assert.strictEqual(smokeAlarm.getChannel(), null);

        detector._smokeAlarmStateByChannel.set(0, new SmokeAlarmState({ status: 25 }));
        assert.strictEqual(smokeAlarm.getCondition(), 'alarming');
        assert.strictEqual(smokeAlarm.getChannel(), 'smoke');
        assert.strictEqual(smokeAlarm.getInterconnect(), null);
    });

    it('test() sends SET with normal wire code (self-test)', async () => {
        const detector = createSmokeDetectorStub();
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        detector.publishMessage = publishMessage;
        const smokeAlarm = createSmokeAlarmAbility(detector);

        await smokeAlarm.test();

        assert.deepStrictEqual(calls[0].payload, {
            smokeAlarm: [{ id: 'sub-1', status: 23 }]
        });
    });

    it('hub get({ sensorIds }) fans out each entry through subdevice handleMessage', async () => {
        const subdevice = createSmokeDetectorStub();
        const handleCalls = [];
        subdevice.handleMessage = async (message) => {
            handleCalls.push(message);
        };

        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({
                smokeAlarm: [
                    { id: 'sub-1', status: 25, timestamp: 200 },
                    { id: 'sub-2', status: 23, timestamp: 201 }
                ]
            })
        });

        const hub = {
            publishMessage,
            getSubdevice(id) {
                return id === 'sub-1' ? subdevice : null;
            }
        };
        const smokeAlarm = createSmokeAlarmAbility(hub);

        await smokeAlarm.get({ sensorIds: ['sub-1', 'sub-2'] });

        assert.strictEqual(calls[0].method, 'GET');
        assert.deepStrictEqual(calls[0].payload, {
            smokeAlarm: [{ id: 'sub-1' }, { id: 'sub-2' }]
        });
        assert.strictEqual(handleCalls.length, 1);
        assert.strictEqual(handleCalls[0].namespace, 'Appliance.Hub.Sensor.Smoke');
        assert.deepStrictEqual(handleCalls[0].payload, {
            id: 'sub-1',
            status: 25,
            timestamp: 200
        });
    });
});
