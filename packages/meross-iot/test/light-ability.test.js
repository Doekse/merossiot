'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/light-ability}.
 * Uses the same stub pattern as {@link ./toggle-ability.test.js}: record `publishMessage`
 * calls on a minimal object with ability metadata and per-feature state maps.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createLightAbility = require('../lib/controller/abilities/light-ability');
const { _updateLightState: updateLightState } = require('../lib/controller/abilities/light-ability');
const { LightMode } = require('../lib/model/enums');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');

describe('light ability (mocked device)', () => {
    it('set sends SET Appliance.Control.Light with RGB payload when capacity includes MODE_RGB', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const emitter = createDeviceEmitter();
        const device = {
            abilities: {
                'Appliance.Control.Light': { capacity: LightMode.MODE_RGB }
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
        assert.strictEqual((lp.capacity & LightMode.MODE_RGB) === LightMode.MODE_RGB, true);
        assert.strictEqual(lp.rgb, 0xff0000);
    });

    it('set sends temperature when capacity includes MODE_TEMPERATURE', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const emitter = createDeviceEmitter();
        const device = {
            abilities: {
                'Appliance.Control.Light': { capacity: LightMode.MODE_TEMPERATURE }
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
        assert.strictEqual((lp.capacity & LightMode.MODE_TEMPERATURE) === LightMode.MODE_TEMPERATURE, true);
        assert.strictEqual(lp.gradual, 0);
    });

    it('set sends luminance when capacity includes MODE_LUMINANCE', async () => {
        const { calls, publishMessage } = createPublishRecorder();
        const emitter = createDeviceEmitter();
        const device = {
            abilities: {
                'Appliance.Control.Light': { capacity: LightMode.MODE_LUMINANCE }
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
        assert.strictEqual((lp.capacity & LightMode.MODE_LUMINANCE) === LightMode.MODE_LUMINANCE, true);
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

        updateLightState(device, { channel: 0, onoff: 1, rgb: 0xff0000 }, 'push');

        assert.strictEqual(device._lightStateByChannel.get(0).isOn, true);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'light');
        assert.strictEqual(events[0].source, 'push');
        assert.strictEqual(events[0].channel, 0);
        assert.deepStrictEqual(events[0].value.rgb, [255, 0, 0]);
    });
});
