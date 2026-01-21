'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Creates a consumption feature object for a device.
 *
 * Provides access to historical power consumption data and consumption configuration settings.
 * Auto-detects ConsumptionH, ConsumptionX, or Consumption capabilities internally.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Consumption feature object with get() and other methods
 */
function createConsumptionFeature(device) {
    /**
     * Initializes consumption cache.
     *
     * @private
     */
    function initializeConsumptionCache() {
        if (device._channelCachedConsumption === undefined) {
            device._channelCachedConsumption = new Map();
        }
    }

    return {
        /**
         * Gets daily power consumption data for a channel.
         *
         * Auto-detects whether to use ConsumptionH, ConsumptionX, or Consumption based on device capabilities.
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to read data from (default: 0)
         * @returns {Promise<Array<{date: Date, totalConsumptionKwh: number}>|null>} Historical consumption data or null
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);

            const cached = this._getConsumptionFromCache(channel);
            if (cached) {
                return cached;
            }

            const hasConsumptionH = device.abilities?.['Appliance.Control.ConsumptionH'];
            const hasConsumptionX = device.abilities?.['Appliance.Control.ConsumptionX'];
            const hasConsumption = device.abilities?.['Appliance.Control.Consumption'];

            if (hasConsumptionH) {
                return await this._getConsumptionH(channel);
            } else if (hasConsumptionX) {
                return await this._getConsumptionX(channel);
            } else if (hasConsumption) {
                return await this._getConsumption(channel);
            } else {
                return await this._getConsumptionWithFallback(channel);
            }
        },

        /**
         * Gets consumption from cache if fresh.
         *
         * @param {number} channel - Channel number
         * @returns {Array<{date: Date, totalConsumptionKwh: number}>|null} Cached consumption data or null
         * @private
         */
        _getConsumptionFromCache(channel) {
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                initializeConsumptionCache();
                const cached = device._channelCachedConsumption.get(channel);
                if (cached) {
                    return cached;
                }
            }
            return null;
        },

        /**
         * Gets consumption data using ConsumptionH namespace.
         *
         * @param {number} channel - Channel number
         * @returns {Promise<Array<{date: Date, totalConsumptionKwh: number}>|null>} Consumption data or null
         * @private
         */
        async _getConsumptionH(channel) {
            try {
                const result = await device.publishMessage('GET', 'Appliance.Control.ConsumptionH', {
                    consumptionH: [{ channel }]
                });

                const consumptionHData = result && result.consumptionH ? result.consumptionH : [];
                const channelData = consumptionHData.find(item => item.channel === channel);

                if (channelData && channelData.total !== undefined) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const data = [{
                        date: today.toISOString().split('T')[0],
                        value: channelData.total,
                        time: Math.floor(Date.now() / 1000)
                    }];

                    updateConsumptionState(device, { channel, consumption: data }, 'response');
                    return device._channelCachedConsumption.get(channel) || null;
                }
            } catch (error) {
                // Ignore errors, fall back to other methods
            }
            return null;
        },

        /**
         * Gets consumption data using ConsumptionX namespace.
         *
         * @param {number} channel - Channel number
         * @returns {Promise<Array<{date: Date, totalConsumptionKwh: number}>|null>} Consumption data or null
         * @private
         */
        async _getConsumptionX(channel) {
            try {
                const result = await device.publishMessage('GET', 'Appliance.Control.ConsumptionX', { channel });
                const data = result && result.consumptionx ? result.consumptionx : [];

                updateConsumptionState(device, { channel, consumption: data }, 'response');
                return device._channelCachedConsumption.get(channel) || null;
            } catch (error) {
                // Fall back to other methods if this one fails
            }
            return null;
        },

        /**
         * Gets consumption data using Consumption namespace.
         *
         * @param {number} channel - Channel number
         * @returns {Promise<Array<{date: Date, totalConsumptionKwh: number}>|null>} Consumption data or null
         * @private
         */
        async _getConsumption(channel) {
            try {
                const result = await device.publishMessage('GET', 'Appliance.Control.Consumption', { channel });
                const data = result && result.consumption ? result.consumption : [];

                updateConsumptionState(device, { channel, consumption: data }, 'response');
                return device._channelCachedConsumption.get(channel) || null;
            } catch (error) {
                // Consumption data is optional, continue without it
            }
            return null;
        },

        /**
         * Tries each consumption method in order as fallback.
         *
         * @param {number} channel - Channel number
         * @returns {Promise<Array<{date: Date, totalConsumptionKwh: number}>|null>} Consumption data or null
         * @private
         */
        async _getConsumptionWithFallback(channel) {
            const resultH = await this._getConsumptionH(channel);
            if (resultH) {
                return resultH;
            }

            const resultX = await this._getConsumptionX(channel);
            if (resultX) {
                return resultX;
            }

            return await this._getConsumption(channel);
        },

        /**
         * Gets the consumption configuration from the device.
         *
         * @returns {Promise<Object>} Response containing consumption configuration
         */
        async getConfig() {
            return await device.publishMessage('GET', 'Appliance.Control.ConsumptionConfig', {});
        }
    };
}

/**
 * Updates the cached consumption state from consumption data.
 *
 * Called automatically when consumption data is received. Parses raw device data,
 * converts dates and units, and emits stateChange events when data changes.
 *
 * @param {Object} device - The device instance
 * @param {Object} consumptionData - Raw consumption data from device
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateConsumptionState(device, consumptionData, source = 'response') {
    if (!consumptionData) {return;}

    if (device._channelCachedConsumption === undefined) {
        device._channelCachedConsumption = new Map();
    }

    const channelIndex = consumptionData.channel;
    if (channelIndex === undefined || channelIndex === null) {return;}

    const data = consumptionData.consumption || [];

    const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
    const parsedData = data.map(x => {
        const dateStr = x.date;
        let date;
        if (DATE_FORMAT.test(dateStr)) {
            const [, year, month, day] = dateStr.match(DATE_FORMAT);
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
            date = new Date(dateStr);
        }

        return {
            date,
            totalConsumptionKwh: parseFloat(x.value) / 1000
        };
    });

    const oldData = device._channelCachedConsumption.get(channelIndex);
    device._channelCachedConsumption.set(channelIndex, parsedData);

    let hasChanges = false;
    if (!oldData || oldData.length !== parsedData.length) {
        hasChanges = true;
    } else {
        for (let i = 0; i < parsedData.length; i++) {
            if (!oldData[i] ||
                oldData[i].totalConsumptionKwh !== parsedData[i].totalConsumptionKwh ||
                oldData[i].date.getTime() !== parsedData[i].date.getTime()) {
                hasChanges = true;
                break;
            }
        }
    }

    if (hasChanges) {
        device.emit('state', {
            type: 'consumption',
            channel: channelIndex,
            value: parsedData,
            source,
            timestamp: Date.now()
        });
    }
}

/**
 * Gets consumption capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Consumption capability object or null if not supported
 */
function getConsumptionCapabilities(device, channelIds) {
    if (!device.abilities) {return null;}

    const hasConsumptionH = !!device.abilities['Appliance.Control.ConsumptionH'];
    const hasConsumptionX = !!device.abilities['Appliance.Control.ConsumptionX'];
    const hasConsumption = !!device.abilities['Appliance.Control.Consumption'];

    if (!hasConsumptionH && !hasConsumptionX && !hasConsumption) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createConsumptionFeature;
module.exports._updateConsumptionState = updateConsumptionState;
module.exports.getCapabilities = getConsumptionCapabilities;
