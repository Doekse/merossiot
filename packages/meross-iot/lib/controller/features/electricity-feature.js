'use strict';

const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');

/**
 * Creates an electricity feature object for a device.
 *
 * Provides access to real-time power consumption metrics including voltage, current, and power.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Electricity feature object with get() and other methods
 */
function createElectricityFeature(device) {
    /**
     * Initializes electricity metrics cache.
     *
     * @private
     */
    function initializeElectricityCache() {
        if (device._channelCachedSamples === undefined) {
            device._channelCachedSamples = new Map();
        }
    }

    return {
        /**
         * Gets instant power consumption metrics for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to read metrics from (default: 0)
         * @returns {Promise<{amperage: number, voltage: number, wattage: number, sampleTimestamp: Date}|null>} PowerInfo object or null
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            // Use cache if fresh, otherwise fetch
            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                initializeElectricityCache();
                const cached = device._channelCachedSamples.get(channel);
                if (cached) {
                    return cached;
                }
            }

            // Fetch fresh state
            const result = await device.publishMessage('GET', 'Appliance.Control.Electricity', { channel });
            const data = result && result.electricity ? result.electricity : {};

            updateElectricityState(device, { channel, ...data }, 'response');

            return device._channelCachedSamples.get(channel) || null;
        },

        /**
         * Gets the raw electricity metrics response without parsing or unit conversion.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to read metrics from (default: 0)
         * @returns {Promise<Object>} Raw API response containing electricity data
         */
        async getRaw(options = {}) {
            const channel = normalizeChannel(options);
            return await device.publishMessage('GET', 'Appliance.Control.Electricity', { channel });
        }
    };
}

/**
 * Updates the cached electricity state from electricity data.
 *
 * Called automatically when electricity data is received. Parses raw device data,
 * converts units, and emits stateChange events when values change.
 *
 * @param {Object} device - The device instance
 * @param {Object} electricityData - Raw electricity data from device
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateElectricityState(device, electricityData, source = 'response') {
    if (!electricityData) {return;}

    if (device._channelCachedSamples === undefined) {
        device._channelCachedSamples = new Map();
    }

    const channelIndex = electricityData.channel;
    if (channelIndex === undefined || channelIndex === null) {return;}

    const current = parseFloat(electricityData.current || 0) / 1000;
    const voltage = parseFloat(electricityData.voltage || 0) / 10;
    const power = parseFloat(electricityData.power || 0) / 1000;

    const powerInfo = {
        amperage: current,
        voltage,
        wattage: power,
        sampleTimestamp: new Date()
    };

    const oldPowerInfo = device._channelCachedSamples.get(channelIndex);
    const oldValue = oldPowerInfo ? {
        amperage: oldPowerInfo.amperage,
        voltage: oldPowerInfo.voltage,
        wattage: oldPowerInfo.wattage
    } : undefined;

    device._channelCachedSamples.set(channelIndex, powerInfo);

    const newValue = buildStateChanges(oldValue, {
        amperage: powerInfo.amperage,
        voltage: powerInfo.voltage,
        wattage: powerInfo.wattage
    });

    if (Object.keys(newValue).length > 0) {
        const valueToEmit = oldValue === undefined ? powerInfo : { ...newValue, sampleTimestamp: powerInfo.sampleTimestamp };

        device.emit('state', {
            type: 'electricity',
            channel: channelIndex,
            value: valueToEmit,
            oldValue,
            source,
            timestamp: Date.now()
        });
    }
}

/**
 * Gets electricity capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Electricity capability object or null if not supported
 */
function getElectricityCapabilities(device, channelIds) {
    if (!device.abilities || !device.abilities['Appliance.Control.Electricity']) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createElectricityFeature;
module.exports._updateElectricityState = updateElectricityState;
module.exports.getCapabilities = getElectricityCapabilities;
