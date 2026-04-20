'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/thermostat-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createThermostatAbility = require('../lib/controller/abilities/thermostat-ability');
const { _updateThermostatMode: updateThermostatMode } = require('../lib/controller/abilities/thermostat-ability');
const { MerossDeviceError } = require('..');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('thermostat ability (mocked device)', () => {
    it('set sends SET Appliance.Control.Thermostat.Mode for mode payload', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ mode: [{ channel: 0, mode: 0 }] })
        });
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 't1',
            abilities: { 'Appliance.Control.Thermostat.Mode': {} },
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const thermostat = createThermostatAbility(device);

        await thermostat.set({ channel: 0, mode: 0, onoff: 1 });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Thermostat.Mode');
        assert.ok(calls[0].payload.mode);
    });

    it('set maps Celsius heatTemperature to tenths-of-degree heatTemp in payload', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ mode: [{ channel: 0, mode: 0 }] })
        });
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 't1',
            abilities: { 'Appliance.Control.Thermostat.Mode': {} },
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const thermostat = createThermostatAbility(device);

        await thermostat.set({ channel: 0, mode: 0, onoff: 1, heatTemperature: 20.5 });

        const modePayload = calls[0].payload.mode[0];
        assert.strictEqual(modePayload.heatTemp, 205);
    });

    it('set with windowOpened uses Appliance.Control.Thermostat.WindowOpened', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const device = {
            uuid: 't1',
            abilities: {},
            _thermostatStateByChannel: new Map(),
            publishMessage
        };
        const thermostat = createThermostatAbility(device);

        await thermostat.set({ channel: 0, windowOpened: false });

        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Thermostat.WindowOpened');
    });

    it('set with state throws when ModeB namespace is not in abilities', async () => {
        const thermostat = createThermostatAbility({
            uuid: 't1',
            abilities: { 'Appliance.Control.Thermostat.Mode': {} },
            _thermostatStateByChannel: new Map(),
            publishMessage: async () => ({})
        });

        await assert.rejects(
            () => thermostat.set({ channel: 0, state: 1 }),
            (err) => err instanceof MerossDeviceError && err.code === 'COMMAND_FAILED'
        );
    });

    it('set with state sends SET Appliance.Control.Thermostat.ModeB when supported', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ modeB: [{ channel: 0, state: 1 }] })
        });
        const emitter = createDeviceEmitter();
        const device = {
            uuid: 't1',
            abilities: { 'Appliance.Control.Thermostat.ModeB': {} },
            _thermostatStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const thermostat = createThermostatAbility(device);

        await thermostat.set({ channel: 0, state: 1 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Thermostat.ModeB');
        assert.deepStrictEqual(calls[0].payload, { modeB: [{ channel: 0, state: 1 }] });
        assert.strictEqual(device._thermostatStateByChannel.get(0).rawState, 1);
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

        updateThermostatMode(
            device,
            [{ channel: 0, mode: 0, currentTemp: 205, targetTemp: 210 }],
            'push'
        );

        const cached = device._thermostatStateByChannel.get(0);
        assert.strictEqual(cached.currentTemperatureCelsius, 205 / 10);
        assert.strictEqual(cached.targetTemperatureCelsius, 210 / 10);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'thermostat');
        assert.strictEqual(events[0].source, 'push');
        assert.strictEqual(events[0].channel, 0);
    });
});
