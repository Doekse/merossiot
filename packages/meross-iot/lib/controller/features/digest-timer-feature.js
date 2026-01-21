'use strict';

/**
 * Creates a timer digest feature object for a device.
 *
 * Provides access to timer summary information without fetching individual timer details.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Timer digest feature object with get() method
 */
function createDigestTimerFeature(device) {
    return {
        /**
         * Gets timer digest (summary) information.
         *
         * @returns {Promise<Object>} Response containing timer digest data
         */
        async get() {
            return await device.publishMessage('GET', 'Appliance.Digest.TimerX', {});
        }
    };
}

/**
 * Gets digest timer capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Digest timer capability object or null if not supported
 */
function getDigestTimerCapabilities(device, channelIds) {
    if (!device.abilities) {return null;}

    const hasDigestTimerX = !!device.abilities['Appliance.Digest.TimerX'];
    const hasDigestTimer = !!device.abilities['Appliance.Digest.Timer'];

    if (!hasDigestTimerX && !hasDigestTimer) {return null;}

    return {
        supported: true
    };
}

module.exports = createDigestTimerFeature;
module.exports.getCapabilities = getDigestTimerCapabilities;
