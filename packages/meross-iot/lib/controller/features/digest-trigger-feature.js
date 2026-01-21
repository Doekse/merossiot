'use strict';

/**
 * Creates a trigger digest feature object for a device.
 *
 * Provides access to trigger summary information without fetching individual trigger details.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Trigger digest feature object with get() method
 */
function createDigestTriggerFeature(device) {
    return {
        /**
         * Gets trigger digest (summary) information.
         *
         * @returns {Promise<Object>} Response containing trigger digest data
         */
        async get() {
            return await device.publishMessage('GET', 'Appliance.Digest.TriggerX', {});
        }
    };
}

/**
 * Gets digest trigger capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Digest trigger capability object or null if not supported
 */
function getDigestTriggerCapabilities(device, channelIds) {
    if (!device.abilities) {return null;}

    const hasDigestTriggerX = !!device.abilities['Appliance.Digest.TriggerX'];
    const hasDigestTrigger = !!device.abilities['Appliance.Digest.Trigger'];

    if (!hasDigestTriggerX && !hasDigestTrigger) {return null;}

    return {
        supported: true
    };
}

module.exports = createDigestTriggerFeature;
module.exports.getCapabilities = getDigestTriggerCapabilities;
