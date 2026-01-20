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

module.exports = createDigestTimerFeature;
