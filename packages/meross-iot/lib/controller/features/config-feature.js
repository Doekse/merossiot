'use strict';

/**
 * Configuration feature module.
 * Provides access to device configuration settings such as over-temperature protection.
 */
module.exports = {
    /**
     * Gets the over-temperature protection configuration from the device.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing over-temperature protection config
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getConfigOverTemp(_options = {}) {
        return await this.publishMessage('GET', 'Appliance.Config.OverTemp', {});
    },

    /**
     * Controls the over-temperature protection configuration.
     *
     * @param {Object} options - Over-temperature config options
     * @param {boolean} options.enable - Enable state (true = on, false = off)
     * @param {number} [options.type] - Protection type (1 = early warning, 2 = early warning and shutdown). If not provided, preserves current type
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setConfigOverTemp(options = {}) {
        if (options.enable === undefined) {
            const { CommandError } = require('../../model/exception');
            throw new CommandError('enable is required', { options }, this.uuid);
        }

        const enableValue = options.enable ? 1 : 2;
        let overTempData;

        if (options.type !== undefined) {
            overTempData = { enable: enableValue, type: options.type };
        } else {
            try {
                const currentConfig = await this.getConfigOverTemp();
                const currentType = currentConfig?.overTemp?.type;
                overTempData = { enable: enableValue, type: currentType !== undefined ? currentType : 1 };
            } catch (e) {
                overTempData = { enable: enableValue, type: 1 };
            }
        }

        const payload = { overTemp: overTempData };
        return await this.publishMessage('SET', 'Appliance.Config.OverTemp', payload);
    }
};

