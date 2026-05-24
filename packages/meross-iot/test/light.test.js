'use strict';

/**
 * Mocked-device tests for {@link module:abilities/light}.
 * Uses the same stub pattern as {@link ./toggle.test.js}: record `publishMessage`
 * calls on a minimal object with ability metadata and per-feature state maps.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createLightAbility = require('../lib/abilities/light');
const { createDeviceEmitter, createPublishRecorder, createDispatchStateShim } = require('./helpers/mock-ability-device');

const pushLightState = createDispatchStateShim('Appliance.Control.Light', 'light');

describe('light ability (mocked device)', () => {
    it('set sends SET Appliance.Control.Light with RGB payload when capacity includes MODE_RGB', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const emitter = createDeviceEmitter();
        const device = {
            abilities: {
                'Appliance.Control.Light': { capacity: 1 }
            },
            _lightStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const light = createLightAbility(device);

        await light.set({ channel: 0, rgb: [255, 0, 0] });

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Light');
        const { light: lp } = calls[0].payload;
        assert.strictEqual(lp.channel, 0);
        assert.strictEqual(lp.gradual, 1);
        assert.strictEqual((lp.capacity & 1) === 1, true);
        assert.strictEqual(lp.rgb, 0xff0000);
    });

    it('set sends effect when capacity includes MODE_EFFECT', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const emitter = createDeviceEmitter();
        const device = {
            abilities: {
                'Appliance.Control.Light': { capacity: 8 }
            },
            _lightStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const light = createLightAbility(device);

        await light.set({ channel: 0, effect: 'candle' });

        assert.strictEqual(calls.length, 1);
        const { light: lp } = calls[0].payload;
        assert.strictEqual(lp.effect, 2);
        assert.strictEqual((lp.capacity & 8) === 8, true);
    });

    it('set sends temperature when capacity includes MODE_TEMPERATURE', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const emitter = createDeviceEmitter();
        const device = {
            abilities: {
                'Appliance.Control.Light': { capacity: 2 }
            },
            _lightStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const light = createLightAbility(device);

        await light.set({ channel: 0, temperature: 50 });

        assert.strictEqual(calls.length, 1);
        const { light: lp } = calls[0].payload;
        assert.strictEqual(lp.temperature, 50);
        assert.strictEqual((lp.capacity & 2) === 2, true);
        assert.strictEqual(lp.gradual, 0);
    });

    it('set sends luminance when capacity includes MODE_LUMINANCE', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const emitter = createDeviceEmitter();
        const device = {
            abilities: {
                'Appliance.Control.Light': { capacity: 4 }
            },
            _lightStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const light = createLightAbility(device);

        await light.set({ channel: 0, luminance: 75 });

        assert.strictEqual(calls.length, 1);
        const { light: lp } = calls[0].payload;
        assert.strictEqual(lp.luminance, 75);
        assert.strictEqual((lp.capacity & 4) === 4, true);
        assert.strictEqual(lp.gradual, 0);
    });

    it('push-shaped light payload updates cache and emits stateChange', () => {
        const emitter = createDeviceEmitter();
        const events = [];
        emitter.on('stateChange', (e) => events.push(e));
        const device = {
            _lightStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter)
        };

        pushLightState(device, { channel: 0, onoff: 1, rgb: 0xff0000, effect: 1 }, 'push');

        assert.strictEqual(device._lightStateByChannel.get(0).isOn, true);
        assert.strictEqual(device._lightStateByChannel.get(0).effect, 'red-orange');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'light');
        assert.strictEqual(events[0].source, 'push');
        assert.strictEqual(events[0].channel, 0);
        assert.deepStrictEqual(events[0].value.rgb, [255, 0, 0]);
    });
});
