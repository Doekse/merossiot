'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Creates a smoke sensor configuration feature object for a device.
 *
 * Provides control over smoke sensor settings including detection and do-not-disturb modes.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Smoke config feature object with set() and get() methods
 */
function createSmokeConfigFeature(device) {
    return {
        /**
         * Gets the smoke sensor configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get config for (default: 0)
         * @param {string} [options.subId=null] - Optional subdevice ID
         * @returns {Promise<Object>} Response containing smoke sensor configuration with `config` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const payload = {
                config: [{
                    channel
                }]
            };
            if (options.subId) {
                payload.config[0].subId = options.subId;
            }
            return await device.publishMessage('GET', 'Appliance.Control.Smoke.Config', payload);
        },

        /**
         * Sets the smoke sensor configuration.
         *
         * @param {Object} options - Smoke config options
         * @param {Object|Array<Object>} [options.configData] - Config data object or array (if provided, used directly)
         * @param {number} [options.channel] - Channel to configure
         * @param {string} [options.subId] - Optional subdevice ID
         * @param {boolean} [options.dnd] - Do not disturb mode
         * @param {boolean} [options.detect] - Detection enabled
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            let configData;
            if (options.configData) {
                configData = Array.isArray(options.configData) ? options.configData : [options.configData];
            } else {
                const channel = normalizeChannel(options);
                configData = [{
                    channel,
                    subId: options.subId,
                    dnd: options.dnd,
                    detect: options.detect
                }];
            }
            const payload = { config: configData };
            return await device.publishMessage('SET', 'Appliance.Control.Smoke.Config', payload);
        }
    };
}

module.exports = createSmokeConfigFeature;
