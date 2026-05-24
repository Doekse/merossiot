'use strict';

/**
 * Mocked-device tests for {@link module:abilities/electricity} ElectricityX support.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createElectricityAbility = require('../lib/abilities/electricity');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('electricity ability ElectricityX (mocked device)', () => {
    it('get auto-detects ElectricityX and fetches with empty payload', async () => {
        const emitter = createDeviceEmitter();
        let device;
        const { calls, publishMessage } = createPublishRecorder({
            responseFor(method, namespace) {
                if (method === 'GET' && namespace === 'Appliance.Control.ElectricityX') {
                    return {
                        electricity: [{
                            channel: 0,
                            current: 2000,
                            voltage: 230000,
                            power: 1500,
                            factor: 95,
                            mConsume: 12345
                        }]
                    };
                }
                return {};
            },
            getDevice: () => device
        });
        device = {
            abilities: { 'Appliance.Control.ElectricityX': {} },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const electricity = createElectricityAbility(device);

        const info = await electricity.get({ channel: 0 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.ElectricityX');
        assert.deepStrictEqual(calls[0].payload, {});
        assert.strictEqual(info.amperage, 2);
        assert.strictEqual(info.voltage, 230);
        assert.strictEqual(info.wattage, 1.5);
        assert.strictEqual(info.powerFactor, 0.95);
        assert.strictEqual(info.monthlyConsumptionWh, 12345);
    });

    it('get falls back to channel-indexed ElectricityX payload when empty GET fails', async () => {
        let attempt = 0;
        const { calls, publishMessage } = createPublishRecorder({
            async responseFor(method, namespace, payload) {
                if (method === 'GET' && namespace === 'Appliance.Control.ElectricityX') {
                    attempt += 1;
                    if (attempt === 1) {
                        throw new Error('device rejected empty query');
                    }
                    return {
                        electricity: [{
                            channel: 1,
                            current: 500,
                            voltage: 120000,
                            power: 600,
                            factor: 100,
                            mConsume: 500
                        }]
                    };
                }
                return {};
            }
        });
        const device = {
            abilities: { 'Appliance.Control.ElectricityX': {} },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: () => {},
            publishMessage
        };
        const electricity = createElectricityAbility(device);

        const info = await electricity.get({ channel: 1 });

        assert.strictEqual(calls.length, 2);
        assert.deepStrictEqual(calls[0].payload, {});
        assert.deepStrictEqual(calls[1].payload, { channel: [{ channel: 1 }] });
        assert.strictEqual(info.voltage, 120);
        assert.strictEqual(info.wattage, 0.6);
        assert.strictEqual(info.powerFactor, 1);
        assert.strictEqual(info.monthlyConsumptionWh, 500);
    });

    it('get prefers Electricity when both namespaces are present', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor(method, namespace) {
                if (method === 'GET' && namespace === 'Appliance.Control.Electricity') {
                    return {
                        electricity: {
                            channel: 0,
                            current: 1000,
                            voltage: 230000,
                            power: 500
                        }
                    };
                }
                return {};
            }
        });
        const device = {
            abilities: {
                'Appliance.Control.Electricity': {},
                'Appliance.Control.ElectricityX': {}
            },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: () => {},
            publishMessage
        };
        const electricity = createElectricityAbility(device);

        await electricity.get({ channel: 0 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Electricity');
    });

    it('GETACK ElectricityX via dispatcher updates cache with X fields', async () => {
        const { publishMessage } = createPublishRecorder({
            responseFor(method, namespace) {
                if (method === 'GET' && namespace === 'Appliance.Control.ElectricityX') {
                    return {
                        electricity: [{
                            channel: 0,
                            current: 1000,
                            voltage: 230000,
                            power: 500,
                            factor: 90,
                            mConsume: 999
                        }]
                    };
                }
                return {};
            },
            getDevice: () => device
        });
        const device = {
            abilities: { 'Appliance.Control.ElectricityX': {} },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: () => {},
            publishMessage
        };
        createElectricityAbility(device);

        await publishMessage('GET', 'Appliance.Control.ElectricityX', {});

        const cached = device._channelCachedSamples.get(0);
        assert.strictEqual(cached.voltage, 230);
        assert.strictEqual(cached.powerFactor, 0.9);
        assert.strictEqual(cached.monthlyConsumptionWh, 999);
    });

    it('fills all channels from one ElectricityX GET and reuses cache for further get() calls', async () => {
        let getCount = 0;
        const { publishMessage } = createPublishRecorder({
            responseFor(method, namespace) {
                if (method === 'GET' && namespace === 'Appliance.Control.ElectricityX') {
                    getCount += 1;
                    return {
                        electricity: [
                            { channel: 0, current: 1000, voltage: 230000, power: 500 },
                            { channel: 1, current: 2000, voltage: 230000, power: 1000 }
                        ]
                    };
                }
                return {};
            }
        });
        const device = {
            abilities: { 'Appliance.Control.ElectricityX': {} },
            lastFullUpdateTimestamp: Date.now() - 60_000,
            emit: () => {},
            publishMessage
        };
        const electricity = createElectricityAbility(device);

        await electricity.get({ channel: 0 });
        await electricity.get({ channel: 1 });

        assert.strictEqual(getCount, 1);
        assert.strictEqual(device._channelCachedSamples.get(1).wattage, 1);
        assert.ok(device.lastFullUpdateTimestamp > Date.now() - 5000);
    });

    it('ElectricityX scales voltage in millivolts, not tenths of a volt', () => {
        const { updateElectricityState } = require('../lib/abilities/electricity');
        const device = { emit: () => {}, _channelCachedSamples: new Map() };

        updateElectricityState(device, { channel: 0, voltage: 230000, current: 0, power: 0 }, 'response', {
            voltageDivisor: 1000
        });
        assert.strictEqual(device._channelCachedSamples.get(0).voltage, 230);

        device._channelCachedSamples.clear();
        updateElectricityState(device, { channel: 0, voltage: 2300, current: 0, power: 0 }, 'response', {
            voltageDivisor: 10
        });
        assert.strictEqual(device._channelCachedSamples.get(0).voltage, 230);
    });
});
