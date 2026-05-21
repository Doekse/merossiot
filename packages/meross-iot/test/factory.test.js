'use strict';

/**
 * Mocked-device tests for {@link module:device/factory}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const { buildDevice, HUB_DISCRIMINATING_ABILITY } = require('../lib/device/factory');
const { MerossDevice } = require('../lib/device/device');
const { MerossHubDevice } = require('../lib/device/hubdevice');

function createStubManager() {
    return { options: {} };
}

function baseDeviceInfo(suffix) {
    return {
        uuid: `00000000-0000-4000-8000-${suffix}`,
        devName: 'Test',
        deviceType: `mss${suffix}`,
        hdwareVersion: '1.0.0',
        fmwareVersion: '4.0.0',
        channels: [{ channel: 0, devName: 'ch0' }],
        onlineStatus: 1
    };
}

describe('factory', () => {
    it('buildDevice wires toggle when ToggleX is present', () => {
        const info = baseDeviceInfo('00000001');
        const abilities = { 'Appliance.Control.ToggleX': { version: 1 } };
        const device = buildDevice(info, abilities, createStubManager());
        assert.ok(device instanceof MerossDevice);
        assert.ok(device.toggle);
        assert.strictEqual(typeof device.toggle.set, 'function');
        assert.strictEqual(typeof device.toggle.get, 'function');
    });

    it('buildDevice uses MerossHubDevice when hub discriminating ability is present', () => {
        const info = baseDeviceInfo('00000002');
        const abilities = {
            [HUB_DISCRIMINATING_ABILITY]: {},
            'Appliance.Hub.Online': {}
        };
        const device = buildDevice(info, abilities, createStubManager(), []);
        assert.ok(device instanceof MerossHubDevice);
        assert.ok(device.hub);
    });

    it('buildDevice returns MerossDevice instances (no dynamic class cache)', () => {
        const info = baseDeviceInfo('00000003');
        const abilities = { 'Appliance.Control.ToggleX': {} };
        const d1 = buildDevice(info, abilities, createStubManager());
        const d2 = buildDevice(info, abilities, createStubManager());
        assert.strictEqual(d1.constructor, MerossDevice);
        assert.strictEqual(d2.constructor, MerossDevice);
        assert.notStrictEqual(d1, d2);
    });

    it('wires toggle when both Toggle and ToggleX abilities exist', () => {
        const info = baseDeviceInfo('00000004');
        const abilities = {
            'Appliance.Control.Toggle': {},
            'Appliance.Control.ToggleX': {}
        };
        const device = buildDevice(info, abilities, createStubManager());
        assert.ok(device.abilities['Appliance.Control.ToggleX']);
        assert.ok(device.toggle);
    });
});
