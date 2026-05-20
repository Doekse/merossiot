'use strict';

const { hasAbility } = require('./utils');

/**
 * Device status registry mirroring {@link meross-iot/lib/device/device} ABILITIES.
 * Order places electricity before toggle so channel labels reflect power metering.
 *
 * @type {ReadonlyArray<{key: string, always?: boolean, namespaces?: string[], handlers: Object}>}
 */
const ABILITIES = [
    {
        key: 'system',
        always: true,
        namespaces: ['Appliance.System.All'],
        handlers: require('./system')
    },
    {
        key: 'electricity',
        namespaces: ['Appliance.Control.Electricity'],
        handlers: require('./electricity')
    },
    {
        key: 'toggle',
        namespaces: ['Appliance.Control.ToggleX', 'Appliance.Control.Toggle'],
        handlers: require('./toggle')
    },
    {
        key: 'presence',
        namespaces: [
            'Appliance.Control.Sensor.LatestX',
            'Appliance.Control.Presence.Config',
            'Appliance.Control.Presence.Study'
        ],
        handlers: require('./presence')
    },
    {
        key: 'light',
        namespaces: ['Appliance.Control.Light'],
        handlers: require('./light')
    },
    {
        key: 'thermostat',
        namespaces: [
            'Appliance.Control.Thermostat.Mode',
            'Appliance.Control.Thermostat.ModeB'
        ],
        handlers: require('./thermostat')
    },
    {
        key: 'consumption',
        namespaces: [
            'Appliance.Control.ConsumptionH',
            'Appliance.Control.ConsumptionX',
            'Appliance.Control.Consumption'
        ],
        handlers: require('./consumption')
    },
    {
        key: 'timer',
        namespaces: ['Appliance.Control.TimerX', 'Appliance.Control.Timer'],
        handlers: require('./timer')
    },
    {
        key: 'trigger',
        namespaces: ['Appliance.Control.TriggerX', 'Appliance.Control.Trigger'],
        handlers: require('./trigger')
    },
    {
        key: 'garage',
        namespaces: ['Appliance.GarageDoor.State'],
        handlers: require('./garage')
    },
    {
        key: 'rollerShutter',
        namespaces: ['Appliance.RollerShutter.State', 'Appliance.RollerShutter.Position'],
        handlers: require('./roller-shutter')
    },
    {
        key: 'diffuser',
        namespaces: [
            'Appliance.Control.Diffuser.Light',
            'Appliance.Control.Diffuser.Spray'
        ],
        handlers: require('./diffuser')
    },
    {
        key: 'spray',
        namespaces: ['Appliance.Control.Spray'],
        handlers: require('./spray')
    }
];

/**
 * Hub subdevice status registry mirroring meross-iot hub ability modules and
 * {@link meross-iot/lib/device/factory} SUBDEVICE_ABILITY_MAPPING discriminators.
 *
 * @type {ReadonlyArray<{namespace: string, handlers: Object}>}
 */
const SUBDEVICE_ABILITIES = [
    {
        namespace: 'Appliance.Hub.Mts100.All',
        handlers: require('./hub-mts100')
    },
    {
        namespace: 'Appliance.Hub.Sensor.TempHum',
        handlers: require('./hub-temp-hum')
    },
    {
        namespace: 'Appliance.Hub.Sensor.WaterLeak',
        handlers: require('./hub-water-leak')
    },
    {
        namespace: 'Appliance.Hub.Sensor.Smoke',
        handlers: require('./hub-smoke')
    },
    {
        namespace: 'Appliance.Hub.Sensor.DoorWindow',
        handlers: require('./hub-door-window')
    }
];

/**
 * @param {Object} device - Device instance
 * @param {Object} entry - Ability registry entry
 * @param {Object} ctx - Status context
 * @returns {boolean}
 */
function isAbilityActive(device, entry, ctx) {
    if (!device[entry.key]) {
        return false;
    }
    if (!entry.namespaces || entry.namespaces.length === 0) {
        return true;
    }
    return hasAbility(ctx.abilities, entry.namespaces);
}

/**
 * @param {Object} subdevice - Subdevice instance
 * @param {Object} entry - Subdevice ability registry entry
 * @returns {boolean}
 */
function isSubdeviceAbilityActive(subdevice, entry) {
    const abilities = subdevice.abilities || {};
    return abilities[entry.namespace] !== undefined;
}

/**
 * Creates the shared context passed through ability status handlers.
 *
 * @param {Object} device - Device instance
 * @param {Object} options - Context options
 * @param {Object} options.abilities - Device abilities dictionary
 * @param {number} options.primaryChannel - Primary channel index
 * @param {boolean} options.isMqttConnected - Whether MQTT looks ready
 * @returns {Object} Status context
 */
function createStatusContext(device, { abilities, primaryChannel, isMqttConnected }) {
    return {
        abilities,
        primaryChannel,
        isMqttConnected,
        fetchPromises: [],
        sensorLines: [],
        configItems: [],
        hasReadings: false,
        hasElectricity: false,
        powerInfo: null,
        thermostatState: null,
        thermostatResponses: {},
        consumptionData: null,
        consumptionConfigResponse: null,
        shutterState: null,
        timerCount: null,
        triggerCount: null
    };
}

function collectFetchPromises(device, ctx) {
    for (const entry of ABILITIES) {
        if (isAbilityActive(device, entry, ctx) && entry.handlers.fetch) {
            entry.handlers.fetch(device, ctx);
        }
    }
}

function displayStatus(device, ctx) {
    for (const entry of ABILITIES) {
        if (isAbilityActive(device, entry, ctx) && entry.handlers.display) {
            entry.handlers.display(device, ctx);
        }
    }
}

function displayConfig(device, ctx) {
    for (const entry of ABILITIES) {
        if (isAbilityActive(device, entry, ctx) && entry.handlers.displayConfig) {
            entry.handlers.displayConfig(device, ctx);
        }
    }
}

/**
 * Displays status for a hub subdevice based on its ability namespaces.
 *
 * @param {Object} subdevice - Subdevice instance
 * @returns {boolean} True if any readings were displayed
 */
function displaySubdeviceStatus(subdevice) {
    for (const entry of SUBDEVICE_ABILITIES) {
        if (isSubdeviceAbilityActive(subdevice, entry)) {
            return entry.handlers.display(subdevice);
        }
    }
    return false;
}

module.exports = {
    ABILITIES,
    SUBDEVICE_ABILITIES,
    createStatusContext,
    collectFetchPromises,
    displayStatus,
    displayConfig,
    displaySubdeviceStatus
};
