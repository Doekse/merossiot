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

module.exports = createDigestTriggerFeature;
