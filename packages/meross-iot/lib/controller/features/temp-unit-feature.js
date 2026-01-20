'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Creates a temperature unit feature object for a device.
 *
 * Provides control over the temperature unit display preference (Celsius or Fahrenheit).
 *
 * @param {Object} device - The device instance
 * @returns {Object} Temperature unit feature object with set() and get() methods
 */
function createTempUnitFeature(device) {
    return {
        /**
         * Gets the temperature unit configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get temperature unit for (default: 0)
         * @returns {Promise<Object>} Response containing temperature unit configuration with `tempUnit` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const payload = {
                tempUnit: [{
                    channel
                }]
            };
            return await device.publishMessage('GET', 'Appliance.Control.TempUnit', payload);
        },

        /**
         * Sets the temperature unit configuration.
         *
         * @param {Object} options - Temperature unit options
         * @param {Object|Array<Object>} [options.tempUnitData] - Temperature unit data object or array (if provided, used directly)
         * @param {number} [options.channel] - Channel to configure
         * @param {number} [options.tempUnit] - Temperature unit (1 = Celsius, 2 = Fahrenheit)
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
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
            return await device.publishMessage('SET', 'Appliance.Control.TempUnit', payload);
        }
    };
}

module.exports = createTempUnitFeature;
