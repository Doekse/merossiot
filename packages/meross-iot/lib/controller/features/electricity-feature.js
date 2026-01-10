'use strict';

const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');

/**
 * Electricity feature module.
 * Provides access to real-time power consumption metrics including voltage, current, and power.
 */
module.exports = {
    /**
     * Initializes electricity metrics cache.
     *
     * Called lazily when electricity data is first accessed to avoid unnecessary initialization.
     *
     * @private
     */
    _initializeElectricityCache() {
        if (this._channelCachedSamples === undefined) {
            this._channelCachedSamples = new Map();
        }
    },

    /**
     * Gets instant power consumption metrics from the device.
     *
     * Note that voltage and current values reported by most Meross devices may not be accurate.
     * The power (wattage) value is typically more reliable. Use the power attribute directly
     * rather than calculating it as voltage * current.
     *
     * To avoid excessive device polling, prefer using {@link getCachedElectricity} and only
     * call this method when the cached value is null or the sampleTimestamp indicates stale data.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to read metrics from (default: 0)
     * @returns {Promise<{amperage: number, voltage: number, wattage: number, sampleTimestamp: Date}>} PowerInfo object with converted units
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getElectricity(options = {}) {
        const channel = normalizeChannel(options);
        this._initializeElectricityCache();

        const result = await this.publishMessage('GET', 'Appliance.Control.Electricity', { channel });
        const data = result && result.electricity ? result.electricity : {};

        this._updateElectricityState({ channel, ...data }, 'response');

        return this._channelCachedSamples.get(channel) || null;
    },

    /**
     * Gets the cached power consumption metrics.
     *
     * Returns the most recently fetched power info without making a request. Use {@link getElectricity}
     * to fetch fresh data from the device.
     *
     * @param {number} [channel=0] - Channel to get metrics for (default: 0)
     * @returns {{amperage: number, voltage: number, wattage: number, sampleTimestamp: Date}|null} Cached PowerInfo object or null if not available
     */
    getCachedElectricity(channel = 0) {
        this._initializeElectricityCache();
        return this._channelCachedSamples.get(channel) || null;
    },

    /**
     * Gets the raw electricity metrics response without parsing or unit conversion.
     *
     * Returns the raw API response with device-native units. For parsed data with standard
     * unit conversions, use {@link getElectricity} instead.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to read metrics from (default: 0)
     * @returns {Promise<Object>} Raw API response containing electricity data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getRawElectricity(options = {}) {
        const channel = normalizeChannel(options);
        return await this.publishMessage('GET', 'Appliance.Control.Electricity', { channel });
    },

    /**
     * Updates the cached electricity state from electricity data.
     *
     * Called automatically when electricity data is received. Parses raw device data,
     * converts units, and emits stateChange events when values change.
     *
     * @param {Object} electricityData - Raw electricity data from device
     * @param {number} electricityData.channel - Channel index
     * @param {number} [electricityData.current] - Current in device units (milliamps)
     * @param {number} [electricityData.voltage] - Voltage in device units (tenths of volts)
     * @param {number} [electricityData.power] - Power in device units (milliwatts)
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateElectricityState(electricityData, source = 'response') {
        if (!electricityData) {return;}

        this._initializeElectricityCache();

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

        const oldPowerInfo = this._channelCachedSamples.get(channelIndex);
        const oldValue = oldPowerInfo ? {
            amperage: oldPowerInfo.amperage,
            voltage: oldPowerInfo.voltage,
            wattage: oldPowerInfo.wattage
        } : undefined;

        this._channelCachedSamples.set(channelIndex, powerInfo);

        const newValue = buildStateChanges(oldValue, {
            amperage: powerInfo.amperage,
            voltage: powerInfo.voltage,
            wattage: powerInfo.wattage
        });

        if (Object.keys(newValue).length > 0) {
            const valueToEmit = oldValue === undefined ? powerInfo : { ...newValue, sampleTimestamp: powerInfo.sampleTimestamp };

            this.emit('stateChange', {
                type: 'electricity',
                channel: channelIndex,
                value: valueToEmit,
                oldValue,
                source,
                timestamp: Date.now()
            });
        }
    }
};
