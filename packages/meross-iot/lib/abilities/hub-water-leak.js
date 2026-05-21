'use strict';

const { registerNamespaceDescriptor, mutateChannelState } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');
const { applySubdeviceOnline, publishHubGet } = require('./hub');
const WaterLeakState = require('../states/water-leak-state');
const { subdeviceIs } = require('./hub');

/**
 * Dispatcher descriptors for hub water leak subdevices (MS400, MS405, etc.).
 *
 * @module abilities/hub-water-leak
 */

const waterLeakDescriptor = {
    namespace: 'Appliance.Hub.Sensor.WaterLeak',
    stateMap: '_waterLeakStateByChannel',
    StateClass: WaterLeakState,
    eventType: 'waterLeak',
    gateKey: '_handleWaterLeak',
    snapshot: (s) => s.toSnapshot()
};

/**
 * @param {object} device
 * @returns {WaterLeakState|undefined}
 */
function getWaterLeakState(device) {
    return device._waterLeakStateByChannel?.get(0);
}

/**
 * @param {object} device
 * @param {Object} data
 * @param {string} source
 * @returns {void}
 */
function applyWaterLeakPayload(device, data, source) {
    const { latestWaterLeak, latestSampleTime } = data;
    if (latestSampleTime === undefined || latestSampleTime === null) {
        return;
    }

    mutateChannelState(device, waterLeakDescriptor, (state) => {
        state.update(latestWaterLeak === 1, latestSampleTime);
    }, source);
}

registerNamespaceDescriptor('Appliance.Hub.Sensor.WaterLeak', {
    ...waterLeakDescriptor,
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'waterLeak')) {
            return;
        }
        applyWaterLeakPayload(device, payload, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Sensor.All', {
    namespace: 'Appliance.Hub.Sensor.All',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, source, header) => {
        if (!subdeviceIs(device, 'waterLeak')) {
            return;
        }
        const messageTs = getMessageTimestamp(header);
        applySubdeviceOnline(device, payload, messageTs, source);
        if (payload.waterLeak) {
            applyWaterLeakPayload(device, payload.waterLeak, source);
        }
    }
});

/**
 * Creates a water leak feature object for a hub or water leak subdevice.
 *
 * @param {Object} device - Hub or water leak subdevice instance
 * @returns {Object} Water leak feature with get and cached read methods
 */
function createWaterLeakAbility(device) {
    return {
        /**
         * Fetches water leak sensor data and updates local state.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.sensorIds] - Hub only: water leak subdevice ID(s)
         * @returns {Promise<Object>} Response containing `waterleak` array
         */
        async get(options = {}) {
            return publishHubGet(device, {
                namespace: 'Appliance.Hub.Sensor.WaterLeak',
                payloadKey: 'waterleak',
                routeKey: 'waterleak',
                responseKeys: ['waterleak', 'waterLeak'],
                ids: options.sensorIds,
                transport: device.subdeviceId ? null : undefined
            });
        },

        /**
         * Whether water leak is currently detected from cached state.
         *
         * @returns {boolean|null}
         */
        isLeaking() {
            return getWaterLeakState(device)?.isLeaking ?? null;
        },

        /**
         * Timestamp of the latest sample from cached state.
         *
         * @returns {number|null}
         */
        getLatestSampleTime() {
            return getWaterLeakState(device)?.latestSampleTime ?? null;
        },

        /**
         * Timestamp of the latest detected water leak event from cached state.
         *
         * @returns {number|null}
         */
        getLatestDetectedWaterLeakTs() {
            return getWaterLeakState(device)?.latestDetectedTs ?? null;
        },

        /**
         * Cached leak event history (no namespace GET equivalent).
         *
         * @returns {Array<{ leaking: boolean, timestamp: number }>}
         */
        getLastEvents() {
            return getWaterLeakState(device)?.getEvents() ?? [];
        }
    };
}

/**
 * Gets water leak capability information for a hub water leak subdevice.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Water leak capability object or null if not supported
 */
function getCapabilities(device, channelIds) {
    if (!subdeviceIs(device, 'waterLeak')) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds,
        waterLeak: true
    };
}

module.exports = createWaterLeakAbility;
module.exports.getCapabilities = getCapabilities;
module.exports.ability = {
    key: 'waterLeak',
    namespaces: ['Appliance.Hub.Sensor.WaterLeak'],
    family: 'waterLeak',
    caches: ['_waterLeakStateByChannel'],
    create: createWaterLeakAbility,
    getCapabilities
};
