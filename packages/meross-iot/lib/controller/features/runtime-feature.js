'use strict';

/**
 * Creates a runtime feature object for a device.
 *
 * Provides access to device runtime information such as uptime and system statistics.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Runtime feature object with get() and refreshState() methods
 */
function createRuntimeFeature(device) {
    /**
     * Initializes runtime info storage.
     *
     * @private
     */
    function initializeRuntimeInfo() {
        if (device._runtimeInfo === undefined) {
            device._runtimeInfo = {};
        }
    }

    return {
        /**
         * Gets the latest runtime information from the device.
         *
         * @returns {Promise<Object>} Runtime information object
         */
        async get() {
            initializeRuntimeInfo();
            const result = await device.publishMessage('GET', 'Appliance.System.Runtime', {});
            const data = result && result.runtime ? result.runtime : {};
            device._runtimeInfo = data;
            return data;
        },

        /**
         * Gets the cached runtime information.
         *
         * @returns {Object|null} Cached runtime info or null if not yet fetched
         */
        getCached() {
            initializeRuntimeInfo();
            return device._runtimeInfo;
        },

        /**
         * Refreshes device state including runtime information.
         *
         * @returns {Promise<void>}
         */
        async refreshState() {
            if (typeof device.system?.getAllData === 'function') {
                await device.system.getAllData();
            } else {
                const { MerossErrorUnknownDeviceType } = require('../../model/exception');
                throw new MerossErrorUnknownDeviceType('Device does not support refreshState()', device.deviceType);
            }
            await this.get();
        }
    };
}

/**
 * Gets runtime capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Runtime capability object or null if not supported
 */
function getRuntimeCapabilities(device, channelIds) {
    if (!device.abilities || !device.abilities['Appliance.Control.Runtime']) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createRuntimeFeature;
module.exports.getCapabilities = getRuntimeCapabilities;
