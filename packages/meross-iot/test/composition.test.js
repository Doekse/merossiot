'use strict';

const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
    SUBDEVICE_FAMILIES,
    getSubdeviceCapability,
    subdeviceIs
} = require('../lib/abilities/hub');
const {
    SUBDEVICE_ABILITY_MAPPING,
    SUBDEVICE_REFRESH_ABILITIES,
    abilitiesInFamily
} = require('../lib/device/device');
const { SUBDEVICE_ABILITY_MAPPING: factoryMapping } = require('../lib/device/factory');

/** Reference literals from the former subdevice-types.js (pre-PR 8). */
const REFERENCE_ABILITY_NAMESPACES = {
    tempHum: [
        'Appliance.Hub.Sensor.TempHum',
        'Appliance.Hub.Sensor.All',
        'Appliance.Hub.Sensor.Alert',
        'Appliance.Hub.Sensor.Adjust'
    ],
    doorWindow: [
        'Appliance.Hub.Sensor.DoorWindow',
        'Appliance.Hub.Sensor.All'
    ],
    waterLeak: [
        'Appliance.Hub.Sensor.WaterLeak',
        'Appliance.Hub.Sensor.All'
    ],
    smoke: [
        'Appliance.Hub.Sensor.Smoke',
        'Appliance.Hub.Sensor.All'
    ],
    mts100: [
        'Appliance.Hub.Mts100.All',
        'Appliance.Hub.Mts100.Temperature',
        'Appliance.Hub.Mts100.Mode',
        'Appliance.Hub.Mts100.Adjust',
        'Appliance.Hub.Mts100.SuperCtl',
        'Appliance.Hub.Mts100.ScheduleB',
        'Appliance.Hub.Mts100.Config'
    ]
};

const REFERENCE_REFRESH_ABILITIES = {
    tempHum: ['tempHum', 'sensorAlert', 'sensorAdjust'],
    doorWindow: ['doorWindow'],
    waterLeak: ['waterLeak'],
    smoke: ['smokeAlarm'],
    mts100: ['mts100']
};

/** Ability modules that export a composition registry row (PR 9). */
const ABILITY_MODULES = [
    '../lib/abilities/toggle',
    '../lib/abilities/light',
    '../lib/abilities/thermostat',
    '../lib/abilities/roller-shutter',
    '../lib/abilities/garage',
    '../lib/abilities/diffuser',
    '../lib/abilities/spray',
    '../lib/abilities/consumption',
    '../lib/abilities/electricity',
    '../lib/abilities/timer',
    '../lib/abilities/trigger',
    '../lib/abilities/presence',
    '../lib/abilities/alarm',
    '../lib/abilities/child-lock',
    '../lib/abilities/screen',
    '../lib/abilities/runtime',
    '../lib/abilities/config',
    '../lib/abilities/dnd',
    '../lib/abilities/temp-unit',
    '../lib/abilities/smoke-config',
    '../lib/abilities/hub-smoke',
    '../lib/abilities/hub-temp-hum',
    '../lib/abilities/hub-alert',
    '../lib/abilities/hub-adjust',
    '../lib/abilities/hub-water-leak',
    '../lib/abilities/hub-door-window',
    '../lib/abilities/hub-mts100',
    '../lib/abilities/sensor-history',
    '../lib/abilities/digest-timer',
    '../lib/abilities/digest-trigger',
    '../lib/abilities/control',
    '../lib/abilities/hub'
];

describe('composition', () => {
    it('each ability module exports ability.key for composition wiring', () => {
        for (const modulePath of ABILITY_MODULES) {
            const mod = require(modulePath);
            assert.ok(mod.ability?.key, `${modulePath} must export ability.key`);
        }
    });

    it('SUBDEVICE_ABILITY_MAPPING matches former subdevice-types namespaces', () => {
        for (const [family, namespaces] of Object.entries(REFERENCE_ABILITY_NAMESPACES)) {
            const { models } = SUBDEVICE_FAMILIES[family];
            for (const model of models) {
                assert.deepStrictEqual(SUBDEVICE_ABILITY_MAPPING[model], namespaces);
            }
        }
    });

    it('SUBDEVICE_REFRESH_ABILITIES matches former subdevice-types refresh keys', () => {
        assert.deepStrictEqual(SUBDEVICE_REFRESH_ABILITIES, REFERENCE_REFRESH_ABILITIES);
    });

    it('abilitiesInFamily derives the same namespace list as the mapping', () => {
        for (const family of Object.keys(SUBDEVICE_FAMILIES)) {
            const derived = abilitiesInFamily(family).flatMap((a) => a.namespaces || []);
            assert.deepStrictEqual(derived, REFERENCE_ABILITY_NAMESPACES[family]);
        }
    });

    it('factory re-exports the same ability mapping', () => {
        assert.deepStrictEqual(factoryMapping, SUBDEVICE_ABILITY_MAPPING);
    });

    it('subdeviceIs matches by _type and requires subdeviceId', () => {
        const tempHum = { subdeviceId: 'a', _type: 'ms130' };
        const door = { subdeviceId: 'b', _type: 'ms200' };
        const hub = { _type: 'ms100' };

        assert.strictEqual(subdeviceIs(tempHum, 'tempHum'), true);
        assert.strictEqual(subdeviceIs(tempHum, 'doorWindow'), false);
        assert.strictEqual(subdeviceIs(door, 'doorWindow'), true);
        assert.strictEqual(subdeviceIs(hub, 'tempHum'), false);
    });

    it('getSubdeviceCapability resolves family from model _type', () => {
        assert.strictEqual(getSubdeviceCapability({ subdeviceId: 'a', _type: 'ms130' }), 'tempHum');
        assert.strictEqual(getSubdeviceCapability({ subdeviceId: 'b', _type: 'mts100v3' }), 'mts100');
        assert.strictEqual(getSubdeviceCapability({ _type: 'ms100' }), undefined);
    });
});
