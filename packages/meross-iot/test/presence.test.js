'use strict';

/**
 * Mocked-device tests for {@link module:abilities/presence}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createPresenceSensorAbility = require('../lib/abilities/presence');
const { PresenceState } = require('../lib/enums');
const { createDeviceEmitter, createDispatchStateShim, createPublishRecorder } = require('./helpers/mock-ability-device');

const pushLatestX = createDispatchStateShim('Appliance.Control.Sensor.LatestX', 'latest');

describe('presence sensor ability (mocked device)', () => {
    it('get sends GET Appliance.Control.Sensor.LatestX', async () => {
        const { calls, publishMessage } = createPublishRecorder({
            responseFor: () => ({
                latest: [{ channel: 0, data: {} }]
            })
        });
        const emitter = createDeviceEmitter();
        const device = {
            lastFullUpdateTimestamp: Date.now() - 60_000,
            _presenceSensorStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter),
            publishMessage
        };
        const presence = createPresenceSensorAbility(device);

        await presence.get({ channel: 0, dataTypes: ['presence'] });

        assert.strictEqual(calls[0].method, 'GET');
        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Sensor.LatestX');
        assert.ok(calls[0].payload.latest[0].data);
    });

    it('getConfig uses Appliance.Control.Presence.Config', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({ config: [] }) });
        const presence = createPresenceSensorAbility({
            _presenceSensorStateByChannel: new Map(),
            publishMessage
        });

        await presence.getConfig({ channel: 0 });

        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Presence.Config');
    });

    it('getStudy uses Appliance.Control.Presence.Study', async () => {
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        const presence = createPresenceSensorAbility({
            _presenceSensorStateByChannel: new Map(),
            publishMessage
        });

        await presence.getStudy();

        assert.strictEqual(calls[0].namespace, 'Appliance.Control.Presence.Study');
    });

    it('push-shaped LatestX payload updates presence cache and emits stateChange', () => {
        const emitter = createDeviceEmitter();
        const events = [];
        emitter.on('stateChange', (e) => events.push(e));
        const device = {
            _presenceSensorStateByChannel: new Map(),
            emit: emitter.emit.bind(emitter)
        };

        pushLatestX(
            device,
            {
                channel: 0,
                data: {
                    presence: [{ value: PresenceState.PRESENCE, distance: 10, timestamp: 1, times: 0 }],
                    light: [{ value: 50, timestamp: 2 }]
                }
            },
            'push'
        );

        assert.strictEqual(device._presenceSensorStateByChannel.get(0).isPresent, true);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'presence');
        assert.strictEqual(events[0].source, 'push');
    });
});
