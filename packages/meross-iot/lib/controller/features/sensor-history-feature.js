'use strict';

const { normalizeChannel, validateRequired } = require('../../utilities/options');

/**
 * Sensor history feature module.
 * Provides access to historical sensor data and the ability to delete stored history.
 */
module.exports = {
    /**
     * Gets sensor history data from the device.
     *
     * @param {Object} options - Get options
     * @param {number} [options.channel=0] - Channel to get history for (default: 0)
     * @param {number} options.capacity - Data collection type (see API docs for capacity values)
     * @returns {Promise<Object>} Response containing sensor history data with `history` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSensorHistory(options = {}) {
        const channel = normalizeChannel(options);
        validateRequired(options, ['capacity']);
        const payload = {
            history: [{
                channel,
                capacity: options.capacity
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Sensor.History', payload);
    },

    /**
     * Deletes sensor history data from the device.
     *
     * @param {Object|Array<Object>} historyData - History data object or array of history items
     * @param {number} [historyData.channel] - Channel to delete history for
     * @param {number} [historyData.capacity] - Data collection type to delete
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async deleteSensorHistory(historyData) {
        const payload = { history: Array.isArray(historyData) ? historyData : [historyData] };
        return await this.publishMessage('DELETE', 'Appliance.Control.Sensor.History', payload);
    }
};

