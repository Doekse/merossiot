'use strict';

/**
 * Mocked-device tests for {@link module:device/factory}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const { buildDevice, getCachedDeviceClass, getTypeKey, HUB_DISCRIMINATING_ABILITY } = require('../lib/device/factory');
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
    it('getTypeKey formats type, hardware, and firmware', () => {
        assert.strictEqual(getTypeKey('mss310', '1.0.0', '2.0.0'), 'mss310:1.0.0:2.0.0');
        assert.strictEqual(getTypeKey('x'), 'x:unknown:unknown');
    });

    it('buildDevice + _updateAbilities exposes toggle when ToggleX is present', () => {
        const info = baseDeviceInfo('00000001');
        const abilities = { 'Appliance.Control.ToggleX': { version: 1 } };
        const device = buildDevice(info, abilities, createStubManager());
        device._updateAbilities(abilities);
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
        device._updateAbilities(abilities);
        assert.ok(device instanceof MerossHubDevice);
        assert.ok(device.hub);
    });

    it('caches dynamic class per type key', () => {
        const info = baseDeviceInfo('00000003');
        const abilities = { 'Appliance.Control.ToggleX': {} };
        const d1 = buildDevice(info, abilities, createStubManager());
        const Ctor = getCachedDeviceClass(info.deviceType, info.hdwareVersion, info.fmwareVersion);
        assert.strictEqual(d1.constructor, Ctor);
        const d2 = buildDevice(info, abilities, createStubManager());
        assert.strictEqual(d1.constructor, d2.constructor);
    });

    it('prefers ToggleX over Toggle when both abilities exist (non-X suppressed in matrix)', () => {
        const info = baseDeviceInfo('00000004');
        const abilities = {
            'Appliance.Control.Toggle': {},
            'Appliance.Control.ToggleX': {}
        };
        const device = buildDevice(info, abilities, createStubManager());
        device._updateAbilities(abilities);
        assert.ok(device.abilities['Appliance.Control.ToggleX']);
        assert.ok(device.toggle);
    });
});
