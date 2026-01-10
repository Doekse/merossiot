'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Consumption feature module.
 * Provides access to historical power consumption data and consumption configuration settings.
 */
module.exports = {
    /**
     * Initializes consumption cache.
     *
     * Called lazily when consumption data is first accessed to avoid unnecessary initialization.
     *
     * @private
     */
    _initializeConsumptionCache() {
        if (this._channelCachedConsumption === undefined) {
            this._channelCachedConsumption = new Map();
        }
    },

    /**
     * Gets daily power consumption data from the device.
     *
     * Returns parsed consumption data with Date objects and converted units (kWh). Date strings
     * are parsed from YYYY-MM-DD format or standard Date string format. Use {@link getRawPowerConsumption}
     * to get the raw API response without parsing.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to read data from (default: 0)
     * @returns {Promise<Array<{date: Date, totalConsumptionKwh: number}>>} Historical consumption data with date and totalConsumptionKwh
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getPowerConsumption(options = {}) {
        const channel = normalizeChannel(options);
        this._initializeConsumptionCache();

        const result = await this.publishMessage('GET', 'Appliance.Control.Consumption', { channel });
        const data = result && result.consumption ? result.consumption : [];

        this._updateConsumptionState({ channel, consumption: data }, 'response');

        return this._channelCachedConsumption.get(channel) || null;
    },

    /**
     * Gets daily power consumption data from the device (X version).
     *
     * Returns parsed consumption data with Date objects and converted units (kWh). This is an
     * alternative consumption endpoint that may provide different data or formatting. Use
     * {@link getRawPowerConsumptionX} to get the raw API response without parsing.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to read data from (default: 0)
     * @returns {Promise<Array<{date: Date, totalConsumptionKwh: number}>>} Historical consumption data with date and totalConsumptionKwh
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getPowerConsumptionX(options = {}) {
        const channel = normalizeChannel(options);
        const result = await this.publishMessage('GET', 'Appliance.Control.ConsumptionX', { channel });
        const data = result && result.consumptionx ? result.consumptionx : [];

        const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
        return data.map(x => {
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
    },

    /**
     * Gets cached consumption data
     *
     * Returns the most recently fetched consumption data without making a request.
     * Use {@link getPowerConsumption} to fetch fresh data from the device.
     *
     * @param {number} [channel=0] - Channel to get data for (default: 0)
     * @returns {Array<{date: Date, totalConsumptionKwh: number}>|null} Cached consumption data or null if not available
     */
    getCachedConsumption(channel = 0) {
        this._initializeConsumptionCache();
        return this._channelCachedConsumption.get(channel) || null;
    },

    /**
     * Gets the raw power consumption response from the device without parsing or unit conversion.
     *
     * For parsed data with Date objects and converted units, use {@link getPowerConsumption} instead.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to read data from (default: 0)
     * @returns {Promise<Object>} Raw API response containing consumption data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getRawPowerConsumption(options = {}) {
        const channel = normalizeChannel(options);
        return await this.publishMessage('GET', 'Appliance.Control.Consumption', { channel });
    },

    /**
     * Gets the raw power consumption X response from the device without parsing or unit conversion.
     *
     * For parsed data with Date objects and converted units, use {@link getPowerConsumptionX} instead.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to read data from (default: 0)
     * @returns {Promise<Object>} Raw API response containing consumption X data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getRawPowerConsumptionX(options = {}) {
        const channel = normalizeChannel(options);
        return await this.publishMessage('GET', 'Appliance.Control.ConsumptionX', { channel });
    },

    /**
     * Gets the consumption configuration from the device.
     *
     * Returns voltage and current calibration coefficients used for power consumption calculations.
     *
     * @returns {Promise<Object>} Response containing consumption configuration
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getConsumptionConfig() {
        return await this.publishMessage('GET', 'Appliance.Control.ConsumptionConfig', {});
    },

    /**
     * Updates the cached consumption state from consumption data.
     *
     * Called automatically when consumption data is received. Parses raw device data,
     * converts dates and units, and emits stateChange events when data changes.
     *
     * @param {Object} consumptionData - Raw consumption data from device
     * @param {number} consumptionData.channel - Channel index
     * @param {Array} consumptionData.consumption - Array of consumption entries with date and value
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateConsumptionState(consumptionData, source = 'response') {
        if (!consumptionData) {return;}

        this._initializeConsumptionCache();

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

        const oldData = this._channelCachedConsumption.get(channelIndex);
        this._channelCachedConsumption.set(channelIndex, parsedData);

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
            this.emit('stateChange', {
                type: 'consumption',
                channel: channelIndex,
                value: parsedData,
                oldValue: oldData || undefined,
                source,
                timestamp: Date.now()
            });
        }
    }
};
