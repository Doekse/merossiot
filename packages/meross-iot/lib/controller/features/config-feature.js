'use strict';

const { MerossErrorValidation } = require('../../model/exception');

/**
 * Creates a configuration feature object for a device.
 *
 * Provides access to device configuration settings such as over-temperature protection.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Config feature object with get() and set() methods
 */
function createConfigFeature(device) {
    return {
        /**
         * Gets the over-temperature protection configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing over-temperature protection config
         */
        async get(_options = {}) {
            return await device.publishMessage('GET', 'Appliance.Config.OverTemp', {});
        },

        /**
         * Sets the over-temperature protection configuration.
         *
         * @param {Object} options - Over-temperature config options
         * @param {boolean} options.enable - Enable state (true = on, false = off)
         * @param {number} [options.type] - Protection type (1 = early warning, 2 = early warning and shutdown)
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            if (options.enable === undefined) {
                throw new MerossErrorValidation('enable is required', 'enable');
            }

            const enableValue = options.enable ? 1 : 2;
            let overTempData;

            if (options.type !== undefined) {
                overTempData = { enable: enableValue, type: options.type };
            } else {
                try {
                    const currentConfig = await this.get();
                    const currentType = currentConfig?.overTemp?.type;
                    overTempData = { enable: enableValue, type: currentType !== undefined ? currentType : 1 };
                } catch (e) {
                    overTempData = { enable: enableValue, type: 1 };
                }
            }

            const payload = { overTemp: overTempData };
            return await device.publishMessage('SET', 'Appliance.Config.OverTemp', payload);
        }
    };
}

/**
 * Gets config capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Config capability object or null if not supported
 */
function getConfigCapabilities(device, channelIds) {
    if (!device.abilities || !device.abilities['Appliance.Config.OverTemp']) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createConfigFeature;
module.exports.getCapabilities = getConfigCapabilities;
