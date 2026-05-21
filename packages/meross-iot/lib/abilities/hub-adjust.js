'use strict';

const { registerNamespaceDescriptor, mutateChannelState } = require('../dispatcher');
const { publishHubGet, publishHubSet } = require('./hub');
const SensorAdjustState = require('../states/sensor-adjust-state');
const { MerossDeviceError } = require('../exception');
const { subdeviceIs } = require('./hub');

/**
 * Dispatcher descriptors for hub temperature/humidity calibration offsets.
 *
 * @module abilities/hub-adjust
 */

const sensorAdjustDescriptor = {
    namespace: 'Appliance.Hub.Sensor.Adjust',
    stateMap: '_sensorAdjustStateByChannel',
    StateClass: SensorAdjustState,
    eventType: 'adjust',
    gateKey: '_handleAdjust',
    snapshot: (s) => s.toSnapshot()
};

registerNamespaceDescriptor('Appliance.Hub.Sensor.Adjust', {
    ...sensorAdjustDescriptor,
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'tempHum')) {
            return;
        }
        mutateChannelState(device, sensorAdjustDescriptor, (state) => {
            state.update(payload);
        }, source);
    }
});

/**
 * @param {object} device
 * @returns {SensorAdjustState|undefined}
 */
function getSensorAdjustState(device) {
    return device._sensorAdjustStateByChannel?.get(0);
}

/**
 * Creates a sensor adjust feature object for a hub or temp/hum subdevice.
 *
 * @param {Object} device - Hub or temp/hum subdevice instance
 * @returns {Object} Sensor adjust feature with get/set and cached read methods
 */
function createSensorAdjustAbility(device) {
    return {
        /**
         * Fetches calibration offsets and updates local state.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.sensorIds=[]] - Subdevice ID(s); empty on hub gets all
         * @returns {Promise<Object>} Response containing `adjust` array
         */
        async get(options = {}) {
            const { sensorIds = [] } = options;
            const ids = Array.isArray(sensorIds) && sensorIds.length > 0 ? sensorIds : undefined;
            return publishHubGet(device, {
                namespace: 'Appliance.Hub.Sensor.Adjust',
                payloadKey: 'adjust',
                ids,
                transport: device.subdeviceId ? null : undefined
            });
        },

        /**
         * Sets calibration offsets on one or more sensors.
         *
         * On subdevices, `temperature` / `humidity` are firmware offset units (°C×10, RH×10).
         * By default the issued values are treated as **deltas** added to the cached offset
         * (same behaviour as meross_lan). Pass `delta: false` to send absolute offsets.
         *
         * @param {Object} [options={}] - Set options
         * @param {Object|Array<Object>} [options.adjustData] - Raw `adjust[]` entries (hub)
         * @param {number} [options.temperature] - Subdevice temperature offset or delta
         * @param {number} [options.humidity] - Subdevice humidity offset or delta
         * @param {boolean} [options.delta=true] - When true, subdevice values are added to cached offsets
         * @returns {Promise<Object>} SETACK payload
         */
        async set(options = {}) {
            /** @type {Array<Object>} */
            let wireEntries;
            /** @type {Object|undefined} */
            let cacheUpdate;

            if (options.adjustData !== undefined) {
                wireEntries = Array.isArray(options.adjustData)
                    ? options.adjustData
                    : [options.adjustData];
            } else if (device.subdeviceId) {
                const cached = getSensorAdjustState(device);
                const useDelta = options.delta !== false;
                const wire = { id: device.subdeviceId };
                const applied = { id: device.subdeviceId };

                if (options.temperature !== undefined) {
                    wire.temperature = options.temperature;
                    applied.temperature = useDelta
                        ? (cached?.temperature ?? 0) + options.temperature
                        : options.temperature;
                }
                if (options.humidity !== undefined) {
                    wire.humidity = options.humidity;
                    applied.humidity = useDelta
                        ? (cached?.humidity ?? 0) + options.humidity
                        : options.humidity;
                }

                if (wire.temperature === undefined && wire.humidity === undefined) {
                    throw new MerossDeviceError(
                        'sensorAdjust.set() requires temperature and/or humidity, or adjustData',
                        'VALIDATION_ERROR'
                    );
                }

                wireEntries = [wire];
                cacheUpdate = applied;
            } else {
                throw new MerossDeviceError(
                    'sensorAdjust.set() on a hub requires options.adjustData',
                    'VALIDATION_ERROR'
                );
            }

            const response = await publishHubSet(device, {
                namespace: 'Appliance.Hub.Sensor.Adjust',
                payloadKey: 'adjust',
                entries: wireEntries,
                transport: null
            });

            if (device.subdeviceId && response) {
                const item = cacheUpdate ||
                    wireEntries.find((e) => e.id === device.subdeviceId) ||
                    wireEntries[0];
                mutateChannelState(device, sensorAdjustDescriptor, (state) => {
                    state.update(item);
                }, 'response');
            }

            return response;
        },

        /**
         * Temperature/humidity calibration offsets from cached state (firmware ×10 units).
         *
         * @returns {Object}
         */
        getAdjust() {
            const snap = getSensorAdjustState(device)?.toSnapshot();
            return snap ? { ...snap } : {};
        }
    };
}

/**
 * Gets sensor adjust capability information for a hub temp/hum subdevice.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Sensor adjust capability object or null if not supported
 */
function getCapabilities(device, channelIds) {
    if (!subdeviceIs(device, 'tempHum')) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds,
        sensorAdjust: true
    };
}

module.exports = createSensorAdjustAbility;
module.exports.getCapabilities = getCapabilities;
module.exports.ability = {
    key: 'sensorAdjust',
    namespaces: ['Appliance.Hub.Sensor.Adjust'],
    family: 'tempHum',
    caches: ['_sensorAdjustStateByChannel'],
    create: createSensorAdjustAbility,
    getCapabilities
};
