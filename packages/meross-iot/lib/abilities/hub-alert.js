'use strict';

const { registerNamespaceDescriptor, mutateChannelState } = require('../dispatcher');
const { publishHubGet, publishHubSet, subdeviceIs } = require('./hub');
const SensorAlertState = require('../states/sensor-alert-state');

/**
 * Dispatcher descriptors for hub temperature/humidity alert thresholds.
 *
 * @module abilities/hub-alert
 */

const sensorAlertDescriptor = {
    namespace: 'Appliance.Hub.Sensor.Alert',
    stateMap: '_sensorAlertStateByChannel',
    StateClass: SensorAlertState,
    eventType: 'alert',
    gateKey: '_handleAlert',
    snapshot: (s) => s.toSnapshot()
};

registerNamespaceDescriptor('Appliance.Hub.Sensor.Alert', {
    ...sensorAlertDescriptor,
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'tempHum')) {
            return;
        }
        mutateChannelState(device, sensorAlertDescriptor, (state) => {
            state.update(payload);
        }, source);
    }
});

/**
 * @param {object} device
 * @returns {SensorAlertState|undefined}
 */
function getSensorAlertState(device) {
    return device._sensorAlertStateByChannel?.get(0);
}

/**
 * Creates a sensor alert feature object for a hub or temp/hum subdevice.
 *
 * @param {Object} device - Hub or temp/hum subdevice instance
 * @returns {Object} Sensor alert feature with get/set and cached read methods
 */
function createSensorAlertAbility(device) {
    return {
        /**
         * Fetches alert threshold config and updates local state.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.sensorIds] - Hub only: temp/hum subdevice ID(s)
         * @returns {Promise<Object>} Response containing `alert` array
         */
        async get(options = {}) {
            return publishHubGet(device, {
                namespace: 'Appliance.Hub.Sensor.Alert',
                payloadKey: 'alert',
                ids: options.sensorIds,
                transport: null
            });
        },

        /**
         * Sets temperature/humidity alert threshold segments.
         *
         * Firmware expects `alert[]` entries with `id` and optional `temperature` /
         * `humidity` segment arrays (`[enable, low, high]` tuples, values in °C×10 / RH×10).
         *
         * @param {Object} [options={}] - Set options
         * @param {Object|Array<Object>} [options.alertData] - Raw alert payload entries (hub multi-sensor)
         * @param {Array<Array<number>>} [options.temperature] - Subdevice: temperature segments
         * @param {Array<Array<number>>} [options.humidity] - Subdevice: humidity segments
         * @returns {Promise<Object>} SETACK payload
         */
        async set(options = {}) {
            let alertEntries;

            if (options.alertData !== undefined) {
                alertEntries = Array.isArray(options.alertData)
                    ? options.alertData
                    : [options.alertData];
            } else if (device.subdeviceId) {
                const entry = { id: device.subdeviceId };
                if (options.temperature !== undefined) {
                    entry.temperature = options.temperature;
                }
                if (options.humidity !== undefined) {
                    entry.humidity = options.humidity;
                }
                if (entry.temperature === undefined && entry.humidity === undefined) {
                    throw new Error('sensorAlert.set() requires temperature and/or humidity segments, or alertData');
                }
                alertEntries = [entry];
            } else {
                throw new Error('sensorAlert.set() on a hub requires options.alertData');
            }

            const response = await publishHubSet(device, {
                namespace: 'Appliance.Hub.Sensor.Alert',
                payloadKey: 'alert',
                entries: alertEntries,
                transport: null
            });

            if (device.subdeviceId && response) {
                const item = alertEntries.find((e) => e.id === device.subdeviceId) || alertEntries[0];
                mutateChannelState(device, sensorAlertDescriptor, (state) => {
                    state.update(item);
                }, 'response');
            }

            return response;
        },

        /**
         * Alert threshold config from cached state.
         *
         * @returns {Object} `temperature` / `humidity` segment arrays
         */
        getAlert() {
            const snap = getSensorAlertState(device)?.toSnapshot();
            return snap ? { ...snap } : {};
        }
    };
}

/**
 * Gets sensor alert capability information for a hub temp/hum subdevice.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Sensor alert capability object or null if not supported
 */
function getCapabilities(device, channelIds) {
    if (!subdeviceIs(device, 'tempHum')) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds,
        sensorAlert: true
    };
}

module.exports = createSensorAlertAbility;
module.exports.getCapabilities = getCapabilities;
module.exports.ability = {
    key: 'sensorAlert',
    namespaces: ['Appliance.Hub.Sensor.Alert'],
    family: 'tempHum',
    caches: ['_sensorAlertStateByChannel'],
    create: createSensorAlertAbility,
    getCapabilities
};
