'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Creates a child lock feature object for a device.
 *
 * Provides control over physical control lock functionality.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Child lock feature object with set() and get() methods
 */
function createChildLockFeature(device) {
    return {
        /**
         * Gets the child lock status from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get lock status for (default: 0)
         * @param {string} [options.subId=null] - Optional subdevice ID
         * @returns {Promise<Object>} Response containing lock status with `lock` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const payload = {
                lock: [{
                    channel
                }]
            };
            if (options.subId) {
                payload.lock[0].subId = options.subId;
            }
            return await device.publishMessage('GET', 'Appliance.Control.PhysicalLock', payload);
        },

        /**
         * Sets the child lock status.
         *
         * @param {Object} options - Child lock options
         * @param {Object|Array<Object>} [options.lockData] - Lock data object or array (if provided, used directly)
         * @param {number} [options.channel] - Channel to control
         * @param {string} [options.subId] - Optional subdevice ID
         * @param {number} [options.onoff] - Lock on (1) or off (0)
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            let lockData;
            if (options.lockData) {
                lockData = Array.isArray(options.lockData) ? options.lockData : [options.lockData];
            } else {
                const channel = normalizeChannel(options);
                lockData = [{
                    channel,
                    subId: options.subId,
                    onoff: options.onoff
                }];
            }
            const payload = { lock: lockData };
            return await device.publishMessage('SET', 'Appliance.Control.PhysicalLock', payload);
        }
    };
}

/**
 * Gets child lock capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Child lock capability object or null if not supported
 */
function getChildLockCapabilities(device, channelIds) {
    if (!device.abilities || !device.abilities['Appliance.Control.ChildLock']) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createChildLockFeature;
module.exports.getCapabilities = getChildLockCapabilities;
