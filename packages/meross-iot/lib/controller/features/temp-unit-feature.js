'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Temperature unit feature module.
 * Provides control over the temperature unit display preference (Celsius or Fahrenheit).
 */
module.exports = {
    /**
     * Gets the temperature unit configuration from the device.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get temperature unit for (default: 0)
     * @returns {Promise<Object>} Response containing temperature unit configuration with `tempUnit` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getTempUnit(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            tempUnit: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.TempUnit', payload);
    },

    /**
     * Controls the temperature unit configuration.
     *
     * @param {Object} options - Temperature unit options
     * @param {Object|Array<Object>} [options.tempUnitData] - Temperature unit data object or array of tempUnit items (if provided, used directly)
     * @param {number} [options.channel] - Channel to configure
     * @param {number} [options.tempUnit] - Temperature unit (1 = Celsius, 2 = Fahrenheit)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setTempUnit(options = {}) {
        let tempUnitData;
        if (options.tempUnitData) {
            tempUnitData = Array.isArray(options.tempUnitData) ? options.tempUnitData : [options.tempUnitData];
        } else {
            const channel = normalizeChannel(options);
            tempUnitData = [{
                channel,
                tempUnit: options.tempUnit
            }];
        }
        const payload = { tempUnit: tempUnitData };
        return await this.publishMessage('SET', 'Appliance.Control.TempUnit', payload);
    }
};

