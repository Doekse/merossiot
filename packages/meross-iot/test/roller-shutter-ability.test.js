'use strict';

/**
 * Mocked-device tests for {@link module:controller/abilities/roller-shutter-ability}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createRollerShutterAbility = require('../lib/controller/abilities/roller-shutter-ability');
const { MerossDeviceError } = require('..');
const { createDeviceEmitter, createPublishRecorder } = require('./helpers/mock-ability-device');
const { dispatch, getNamespaceDescriptors } = require('../lib/controller/state-dispatcher');

const ROLLER_SHUTTER_STATE_NS = 'Appliance.RollerShutter.State';

/**
 * Simulates production routing for RollerShutter.State: same path as SETACK/PUSH/digest.
 *
 * @param {object} device
 * @param {object} payload
 * @param {string} [source='push']
 * @returns {void}
 */
function routeRollerShutterState(device, payload, source = 'push') {
    for (const d of getNamespaceDescriptors(ROLLER_SHUTTER_STATE_NS)) {
        dispatch(device, d, payload, source, null, undefined);
    }
}

describe('roller shutter ability (mocked device)', () => {
    it('set sends SET Appliance.RollerShutter.Position', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({ position: [{ channel: 0, position: 50 }] })
        });
        const emitter = createDeviceEmitter();
        const device = {
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const rs = createRollerShutterAbility(device);

        await rs.set({ channel: 0, position: 50 });

        assert.strictEqual(calls[0].method, 'SET');
        assert.strictEqual(calls[0].namespace, 'Appliance.RollerShutter.Position');
        assert.deepStrictEqual(calls[0].payload.position, { position: 50, channel: 0 });
    });

    it('throws when position is missing', async () => {
        const rs = createRollerShutterAbility({ publishMessage: async () => ({ header: {}, payload: {} }) });

        await assert.rejects(() => rs.set({ channel: 0 }), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });

    it('getConfig uses Appliance.RollerShutter.Config', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const device = { _rollerShutterConfigByChannel: new Map(), publishMessage };
        const rs = createRollerShutterAbility(device);

        await rs.getConfig();

        assert.strictEqual(calls[0].namespace, 'Appliance.RollerShutter.Config');
    });

    it('setConfig throws when config is missing', async () => {
        const rs = createRollerShutterAbility({ publishMessage: async () => ({ header: {}, payload: {} }) });

        await assert.rejects(() => rs.setConfig({}), (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR');
    });

    it('push-shaped roller shutter state updates cache and emits stateChange', () => {
        const emitter = createDeviceEmitter();
        const events = [];
        emitter.on('stateChange', (e) => events.push(e));
        const device = {
            emit: emitter.emit.bind(emitter),
            _rollerShutterStateByChannel: new Map()
        };

        routeRollerShutterState(device, { state: [{ channel: 0, state: 0, position: 40 }] });

        assert.strictEqual(device._rollerShutterStateByChannel.get(0).position, 40);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'rollerShutter');
        assert.strictEqual(events[0].source, 'push');
    });
});
