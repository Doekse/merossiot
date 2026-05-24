'use strict';

/**
 * Mocked-device tests for {@link module:abilities/thermostat}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createThermostatAbility = require('../lib/abilities/thermostat');
const { MerossDeviceError } = require('..');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');
const { dispatch, getNamespaceDescriptors } = require('../lib/dispatcher');
const { getMessageTimestamp } = require('../lib/utilities/state-ordering');

const THERMOSTAT_MODE_NS = 'Appliance.Control.Thermostat.Mode';

/**
 * Simulates device routing for Thermostat.Mode: same path as production SETACK/PUSH
 * with header-derived ordering.
 *
 * @param {object} device
 * @param {object} payload
 * @param {string} source
 * @param {object} header
 * @returns {void}
 */
function routeThermostatMode(device, payload, source, header) {
    const messageTs = getMessageTimestamp(header);
    for (const d of getNamespaceDescriptors(THERMOSTAT_MODE_NS)) {
        dispatch(device, d, payload, source, messageTs, header);
    }
}

describe('thermostat ability (mocked device)', () => {
    it('set sends SET Appliance.Control.Thermostat.Mode for mode payload', async () => {
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 't1',
            abilities: { 'Appliance.Control.Thermostat.Mode': {} },
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter)
        };
        const { calls, publishMessage } = createPublishRecorder({
            getDevice: () => device,
            responseFor: () => ({ mode: [{ channel: 0, mode: 0 }] })
        });
        device.publishMessage = publishMessage;
        const thermostat = createThermostatAbility(device);

        await thermostat.set({ channel: 0, mode: 0, onoff: 1 });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Thermostat.Mode');
        assert.ok(calls[0].payload.mode);
    });

    it('set maps Celsius heatTemperature to tenths-of-degree heatTemp in payload', async () => {
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 't1',
            abilities: { 'Appliance.Control.Thermostat.Mode': {} },
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter)
        };
        const { calls, publishMessage } = createPublishRecorder({
            getDevice: () => device,
            responseFor: () => ({ mode: [{ channel: 0, mode: 0 }] })
        });
        device.publishMessage = publishMessage;
        const thermostat = createThermostatAbility(device);

        await thermostat.set({ channel: 0, mode: 0, onoff: 1, heatTemperature: 20.5 });

        const modePayload = calls[0].payload.mode[0];
        assert.strictEqual(modePayload.heatTemp, 205);
    });

    it('set with windowOpened uses Appliance.Control.Thermostat.WindowOpened', async () => {
        const device = {
            uuid: 't1',
            abilities: {},
            _thermostatStateByChannel: new Map()
        };
        const { calls, publishMessage } = createPublishRecorder({
            getDevice: () => device,
            responseFor: () => ({})
        });
        device.publishMessage = publishMessage;
        const thermostat = createThermostatAbility(device);

        await thermostat.set({ channel: 0, windowOpened: false });

        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Thermostat.WindowOpened');
    });

    it('set with state throws when ModeB namespace is not in abilities', async () => {
        const thermostat = createThermostatAbility({
            uuid: 't1',
            abilities: { 'Appliance.Control.Thermostat.Mode': {} },
            _thermostatStateByChannel: new Map(),
            publishMessage: async () => ({ header: {}, payload: {} })
        });

        await assert.rejects(
            () => thermostat.set({ channel: 0, state: 1 }),
            (err) => err instanceof MerossDeviceError && err.code === 'COMMAND_FAILED'
        );
    });

    it('set with state sends SET Appliance.Control.Thermostat.ModeB when supported', async () => {
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 't1',
            abilities: { 'Appliance.Control.Thermostat.ModeB': {} },
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter)
        };
        const { calls, publishMessage } = createPublishRecorder({
            getDevice: () => device,
            responseFor: () => ({ modeB: [{ channel: 0, state: 1 }] })
        });
        device.publishMessage = publishMessage;
        const thermostat = createThermostatAbility(device);

        await thermostat.set({ channel: 0, state: 1 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Thermostat.ModeB');
        assert.deepStrictEqual(calls[0].payload, { modeB: [{ channel: 0, state: 1 }] });
        assert.strictEqual(device._thermostatStateByChannel.get(0).state, 'working');
    });

    it('push-shaped mode array updates thermostat cache and emits stateChange', () => {
        const emitter = createDeviceEmitter();
        const events = [];
        emitter.on('stateChange', (e) => events.push(e));
        const device = {
            uuid: 't1',
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter)
        };

        routeThermostatMode(
            device,
            { mode: [{ channel: 0, mode: 0, currentTemp: 205, targetTemp: 210 }] },
            'push',
            undefined
        );

        const cached = device._thermostatStateByChannel.get(0);
        assert.strictEqual(cached.currentTemperatureCelsius, 205 / 10);
        assert.strictEqual(cached.targetTemperatureCelsius, 210 / 10);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'thermostat');
        assert.strictEqual(events[0].source, 'push');
        assert.strictEqual(events[0].channel, 0);
    });

    it('dispatcher drops stale PUSH after SETACK (older combined timestampMs)', () => {
        const emitter = createDeviceEmitter();
        const events = [];
        emitter.on('stateChange', (e) => events.push(e));
        const device = {
            uuid: 't1',
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter)
        };

        const setAck = {
            mode: [{ channel: 0, mode: 1, onoff: 1, targetTemp: 220, currentTemp: 210 }]
        };
        const stalePush = {
            mode: [{ channel: 0, mode: 0, onoff: 0, targetTemp: 200, currentTemp: 190 }]
        };

        routeThermostatMode(device, setAck, 'response', { timestamp: 2, timestampMs: 0 });
        assert.strictEqual(device._thermostatStateByChannel.get(0).targetTemperatureCelsius, 22);
        const nAfterSetAck = events.length;

        routeThermostatMode(device, stalePush, 'push', { timestamp: 1, timestampMs: 999 });
        assert.strictEqual(device._thermostatStateByChannel.get(0).targetTemperatureCelsius, 22);
        assert.strictEqual(events.length, nAfterSetAck, 'stale push must not emit or overwrite');
    });

    it('dispatcher drops stale PUSH when second equals second counter but timestampMs is older', () => {
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 't1',
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter)
        };

        const setAck = {
            mode: [{ channel: 0, mode: 1, targetTemp: 230, currentTemp: 210 }]
        };
        const stalePush = {
            mode: [{ channel: 0, mode: 0, targetTemp: 200, currentTemp: 190 }]
        };

        routeThermostatMode(device, setAck, 'response', { timestamp: 1000, timestampMs: 500 });
        assert.strictEqual(device._thermostatStateByChannel.get(0).targetTemperatureCelsius, 23);

        routeThermostatMode(device, stalePush, 'push', { timestamp: 1000, timestampMs: 400 });
        assert.strictEqual(device._thermostatStateByChannel.get(0).targetTemperatureCelsius, 23);
    });
});
