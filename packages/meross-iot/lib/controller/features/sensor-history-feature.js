'use strict';

const { normalizeChannel, validateRequired } = require('../../utilities/options');

/**
 * Creates a sensor history feature object for a device.
 *
 * Provides access to historical sensor data and the ability to delete stored history.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Sensor history feature object with get() and delete() methods
 */
function createSensorHistoryFeature(device) {
    return {
        /**
         * Gets sensor history data from the device.
         *
         * @param {Object} options - Get options
         * @param {number} [options.channel=0] - Channel to get history for (default: 0)
         * @param {number} options.capacity - Data collection type (see API docs for capacity values)
         * @returns {Promise<Object>} Response containing sensor history data with `history` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            validateRequired(options, ['capacity']);
            const payload = {
                history: [{
                    channel,
                    capacity: options.capacity
                }]
            };
            return await device.publishMessage('GET', 'Appliance.Control.Sensor.History', payload);
        },

        /**
         * Deletes sensor history data from the device.
         *
         * @param {Object} options - Delete options
         * @param {Object|Array<Object>} [options.historyData] - History data object or array (if provided, used directly)
         * @param {number} [options.channel] - Channel to delete history for
         * @param {number} [options.capacity] - Data collection type to delete
         * @returns {Promise<Object>} Response from the device
         */
        async delete(options = {}) {
            let historyData;
            if (options.historyData) {
                historyData = Array.isArray(options.historyData) ? options.historyData : [options.historyData];
            } else {
                historyData = [{
                    channel: options.channel,
                    capacity: options.capacity
                }];
            }
            const payload = { history: historyData };
            return await device.publishMessage('DELETE', 'Appliance.Control.Sensor.History', payload);
        }
    };
}

module.exports = createSensorHistoryFeature;
