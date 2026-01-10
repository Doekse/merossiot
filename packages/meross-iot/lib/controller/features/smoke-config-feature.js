'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Smoke sensor configuration feature module.
 * Provides control over smoke sensor settings including detection and do-not-disturb modes.
 */
module.exports = {
    /**
     * Gets the smoke sensor configuration from the device.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get config for (default: 0)
     * @param {string} [options.subId=null] - Optional subdevice ID
     * @returns {Promise<Object>} Response containing smoke sensor configuration with `config` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSmokeConfig(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            config: [{
                channel
            }]
        };
        if (options.subId) {
            payload.config[0].subId = options.subId;
        }
        return await this.publishMessage('GET', 'Appliance.Control.Smoke.Config', payload);
    },

    /**
     * Controls the smoke sensor configuration.
     *
     * @param {Object|Array<Object>} configData - Config data object or array of config items
     * @param {number} [configData.channel] - Channel to configure
     * @param {string} [configData.subId] - Optional subdevice ID
     * @param {boolean} [configData.dnd] - Do not disturb mode
     * @param {boolean} [configData.detect] - Detection enabled
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setSmokeConfig(configData) {
        const payload = { config: Array.isArray(configData) ? configData : [configData] };
        return await this.publishMessage('SET', 'Appliance.Control.Smoke.Config', payload);
    }
};

