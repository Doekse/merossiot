'use strict';

const { normalizeChannel } = require('../utilities/options');

/**
 * Creates a screen feature object for a device.
 *
 * Provides control over device screen brightness settings for different operational states.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Screen feature object with set() and get() methods
 */
function createScreenAbility(device) {
    return {
        /**
         * Gets the screen brightness configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get brightness for (default: 0)
         * @param {string} [options.subId=null] - Optional subdevice ID
         * @returns {Promise<Object>} Response containing brightness configuration with `brightness` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const payload = {
                brightness: [{
                    channel
                }]
            };
            if (options.subId) {
                payload.brightness[0].subId = options.subId;
            }
            const { payload: out } = await device.publishMessage('GET', 'Appliance.Control.Screen.Brightness', payload);
            return out;
        },

        /**
         * Sets the screen brightness configuration.
         *
         * @param {Object} options - Screen brightness options
         * @param {Object|Array<Object>} [options.brightnessData] - Brightness data object or array (if provided, used directly)
         * @param {number} [options.channel] - Channel to configure
         * @param {string} [options.subId] - Optional subdevice ID
         * @param {number} [options.standby] - Standby brightness level
         * @param {number} [options.operation] - Operation brightness level
         * @param {number} [options.standbyView] - Standby view brightness level
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            let brightnessData;
            if (options.brightnessData) {
                brightnessData = Array.isArray(options.brightnessData) ? options.brightnessData : [options.brightnessData];
            } else {
                const channel = normalizeChannel(options);
                brightnessData = [{
                    channel,
                    subId: options.subId,
                    standby: options.standby,
                    operation: options.operation,
                    standbyView: options.standbyView
                }];
            }
            const payload = { brightness: brightnessData };
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Control.Screen.Brightness', payload);
            return out;
        }
    };
}

/**
 * Gets screen capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Screen capability object or null if not supported
 */
function getScreenCapabilities(device, channelIds) {
    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createScreenAbility;
module.exports.getCapabilities = getScreenCapabilities;
module.exports.ability = {
    key: 'screen',
    namespaces: ['Appliance.Control.Screen.Brightness'],
    caches: [],
    create: createScreenAbility,
    getCapabilities: getScreenCapabilities
};
