'use strict';

/**
 * Mocked-device tests for {@link module:abilities/toggle}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createToggleAbility = require('../lib/abilities/toggle');
const { MerossDeviceError } = require('..');
const {
    createDeviceEmitter,
    createPublishRecorder,
    createDispatchStateShim
} = require('./helpers/mock-ability-device');

const pushToggleX = createDispatchStateShim('Appliance.Control.ToggleX', 'togglex');
const pushToggle = createDispatchStateShim('Appliance.Control.Toggle', 'toggle');

/**
 * @param {Object} partial
 * @param {Object} [publishRecorderOptions] - optional `createPublishRecorder` options (e.g. `responseFor`)
 * @returns {Object}
 */
function baseDevice(partial, publishRecorderOptions) {
    const emitter = createDeviceEmitter();
    const device = {
        deviceType: 'mock.mss110',
        lastFullUpdateTimestamp: null,
        abilities: {},
        _toggleStateByChannel: new Map(),
        ...partial,
        emit: emitter.emit.bind(emitter),
        on: emitter.on.bind(emitter)
    };
    const { calls, publishMessage } = createPublishRecorder({
        ...publishRecorderOptions,
        getDevice: () => device
    });
    device.publishMessage = publishMessage;
    return { device, calls, publishMessage };
}

describe('toggle ability (mocked device)', () => {
    it('set uses ToggleX namespace and payload when ToggleX is present', async () => {
        const { device, calls } = baseDevice({
            abilities: { 'Appliance.Control.ToggleX': {} }
        });
        const toggle = createToggleAbility(device);

        await toggle.set({ channel: 2, on: true });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.ToggleX');
        assert.deepStrictEqual(calls[0].payload, { togglex: { channel: 2, onoff: 1 } });
    });

    it('set uses Toggle namespace when only Toggle is present', async () => {
        const { device, calls } = baseDevice({
            abilities: { 'Appliance.Control.Toggle': {} }
        });
        const toggle = createToggleAbility(device);

        await toggle.set({ on: false });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Toggle');
        assert.deepStrictEqual(calls[0].payload, { toggle: { onoff: 0 } });
    });

    it('set prefers ToggleX when both namespaces exist', async () => {
        const { device, calls } = baseDevice({
            abilities: {
                'Appliance.Control.ToggleX': {},
                'Appliance.Control.Toggle': {}
            }
        });
        const toggle = createToggleAbility(device);

        await toggle.set({ channel: 0, on: true });

        assert.strictEqual(calls[0].namespace, 'Appliance.Control.ToggleX');
    });

    it('throws when neither Toggle nor ToggleX is available', async () => {
        const { device } = baseDevice({ abilities: {} });
        const toggle = createToggleAbility(device);

        await assert.rejects(
            () => toggle.set({ on: true }),
            (err) =>
                err instanceof MerossDeviceError &&
                err.code === 'UNKNOWN_DEVICE_TYPE' &&
                err.deviceType === 'mock.mss110'
        );
    });

    it('set requires `on`', async () => {
        const { device } = baseDevice({
            abilities: { 'Appliance.Control.ToggleX': {} }
        });
        const toggle = createToggleAbility(device);

        await assert.rejects(() => toggle.set({}), MerossDeviceError);
    });

    it('get returns cached state when cache is fresh', async () => {
        const { device, calls } = baseDevice({
            abilities: { 'Appliance.Control.ToggleX': {} }
        });
        device.lastFullUpdateTimestamp = Date.now();
        pushToggleX(device, { channel: 0, onoff: 1 }, 'response');
        const toggle = createToggleAbility(device);

        const state = await toggle.get({ channel: 0 });

        assert.strictEqual(calls.length, 0);
        assert.strictEqual(state?.isOn, true);
    });

    it('get fetches via ToggleX GET when cache is stale', async () => {
        const { device, calls } = baseDevice(
            {
                lastFullUpdateTimestamp: Date.now() - 10_000,
                abilities: { 'Appliance.Control.ToggleX': {} }
            },
            {
                responseFor(method, namespace, payload) {
                    if (method === 'GET' && namespace === 'Appliance.Control.ToggleX') {
                        assert.deepStrictEqual(payload, { togglex: { channel: 0 } });
                        return { togglex: { channel: 0, onoff: 1 } };
                    }
                    return {};
                }
            }
        );
        const toggle = createToggleAbility(device);

        const state = await toggle.get({ channel: 0 });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.ToggleX');
        assert.strictEqual(state?.isOn, true);
    });

    it('isOn reads from toggle state map', () => {
        const { device } = baseDevice({
            abilities: { 'Appliance.Control.ToggleX': {} }
        });
        pushToggleX(device, { channel: 1, onoff: 0 }, 'response');
        const toggle = createToggleAbility(device);

        assert.strictEqual(toggle.isOn({ channel: 1 }), false);
        assert.strictEqual(toggle.isOn({ channel: 99 }), undefined);
    });

    it('push-shaped togglex payload updates cache and emits stateChange', () => {
        const { device } = baseDevice({
            abilities: { 'Appliance.Control.ToggleX': {} }
        });
        const events = [];
        device.on('stateChange', (e) => events.push(e));

        pushToggleX(device, { channel: 0, onoff: 1 }, 'push');

        assert.strictEqual(device._toggleStateByChannel.get(0).isOn, true);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'toggle');
        assert.strictEqual(events[0].source, 'push');
        assert.strictEqual(events[0].channel, 0);
        assert.strictEqual(events[0].value, true);
    });
});
