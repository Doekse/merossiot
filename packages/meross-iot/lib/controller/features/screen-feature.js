'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Screen feature module.
 * Provides control over device screen brightness settings for different operational states.
 */
module.exports = {
    /**
     * Gets the screen brightness configuration from the device.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get brightness for (default: 0)
     * @param {string} [options.subId=null] - Optional subdevice ID
     * @returns {Promise<Object>} Response containing brightness configuration with `brightness` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getScreenBrightness(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            brightness: [{
                channel
            }]
        };
        if (options.subId) {
            payload.brightness[0].subId = options.subId;
        }
        return await this.publishMessage('GET', 'Appliance.Control.Screen.Brightness', payload);
    },

    /**
     * Controls the screen brightness configuration.
     *
     * Allows setting different brightness levels for standby, operation, and standby view modes.
     *
     * @param {Object} options - Screen brightness options
     * @param {Object|Array<Object>} [options.brightnessData] - Brightness data object or array of brightness items (if provided, used directly)
     * @param {number} [options.channel] - Channel to configure
     * @param {string} [options.subId] - Optional subdevice ID
     * @param {number} [options.standby] - Standby brightness level
     * @param {number} [options.operation] - Operation brightness level
     * @param {number} [options.standbyView] - Standby view brightness level
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setScreenBrightness(options = {}) {
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
        return await this.publishMessage('SET', 'Appliance.Control.Screen.Brightness', payload);
    }
};

