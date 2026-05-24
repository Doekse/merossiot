'use strict';

/**
 * Hub MTS100 mode codec selection (legacy vs v3 wire maps).
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createMts100Ability = require('../lib/abilities/hub-mts100');
const { getMts100ModeCodec } = require('../lib/abilities/hub-mts100');
const { Mts100ModeCodec, Mts100V3ModeCodec } = require('../lib/enums');
const HubThermostatState = require('../lib/states/hub-thermostat-state');
const { MerossSubDevice } = require('../lib/device/subdevice');
const { createPublishRecorder } = require('./helpers/mock-ability-device');

/**
 * @param {string} type
 * @returns {object}
 */
function createValveStub(type) {
    const device = Object.create(MerossSubDevice.prototype);
    device._subdeviceId = 'valve-1';
    device._type = type;
    device._hubThermostatStateByChannel = new Map();
    Object.defineProperty(device, 'subdeviceId', {
        get() {
            return this._subdeviceId;
        }
    });
    return device;
}

describe('hub MTS100 mode codecs', () => {
    it('getMts100ModeCodec picks legacy map for mts100', () => {
        const valve = createValveStub('mts100');
        assert.strictEqual(getMts100ModeCodec(valve), Mts100ModeCodec);
    });

    it('getMts100ModeCodec picks v3 map for mts100v3 and mts150', () => {
        assert.strictEqual(getMts100ModeCodec(createValveStub('mts100v3')), Mts100V3ModeCodec);
        assert.strictEqual(getMts100ModeCodec(createValveStub('mts150')), Mts100V3ModeCodec);
        assert.strictEqual(getMts100ModeCodec(createValveStub('mts150p')), Mts100V3ModeCodec);
    });

    it('mts100.setMode on legacy valve sends comfort wire code', async () => {
        const valve = createValveStub('mts100');
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        valve.publishMessage = publishMessage;
        const mts100 = createMts100Ability(valve);

        await mts100.setMode({ mode: 'comfort' });

        assert.strictEqual(calls[0].payload.mode[0].state, 1);
    });

    it('mts100.setMode on v3 valve sends heat wire code', async () => {
        const valve = createValveStub('mts100v3');
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        valve.publishMessage = publishMessage;
        const mts100 = createMts100Ability(valve);

        await mts100.setMode({ mode: 'heat' });

        assert.strictEqual(calls[0].payload.mode[0].state, 1);
    });

    it('mts100.setMode on v3 valve maps economy to wire 4', async () => {
        const valve = createValveStub('mts100v3');
        const { calls, publishMessage } = createPublishRecorder({ responseFor: () => ({}) });
        valve.publishMessage = publishMessage;
        const mts100 = createMts100Ability(valve);

        await mts100.setMode({ mode: 'economy' });

        assert.strictEqual(calls[0].payload.mode[0].state, 4);
    });

    it('mts100.getMode decodes cached state with valve-specific codec', () => {
        const legacy = createValveStub('mts100');
        const v3 = createValveStub('mts100v3');
        const legacyAbility = createMts100Ability(legacy);
        const v3Ability = createMts100Ability(v3);

        const legacyState = new HubThermostatState();
        legacyState.updateModeState(2);
        legacy._hubThermostatStateByChannel.set(0, legacyState);

        const v3State = new HubThermostatState();
        v3State.updateModeState(2);
        v3._hubThermostatStateByChannel.set(0, v3State);

        assert.strictEqual(legacyAbility.getMode(), 'economy');
        assert.strictEqual(v3Ability.getMode(), 'cool');
    });
});
