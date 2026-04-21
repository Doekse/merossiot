'use strict';

/**
 * Creates a trigger digest feature object for a device.
 *
 * Provides access to trigger summary information without fetching individual trigger details.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Trigger digest feature object with get() method
 */
function createDigestTriggerAbility(device) {
    return {
        /**
         * Gets trigger digest (summary) information.
         *
         * @returns {Promise<Object>} Response containing trigger digest data
         */
        async get() {
            const { payload } = await device.publishMessage('GET', 'Appliance.Digest.TriggerX', {});
            return payload;
        }
    };
}

/**
 * Gets digest trigger capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} _channelIds - Array of channel IDs (unused; consistent with `getCapabilities` signature)
 * @returns {Object|null} Digest trigger capability object or null if not supported
 */
function getDigestTriggerCapabilities(device, _channelIds) {
    if (!device.abilities) {return null;}

    const hasDigestTriggerX = !!device.abilities['Appliance.Digest.TriggerX'];
    const hasDigestTrigger = !!device.abilities['Appliance.Digest.Trigger'];

    if (!hasDigestTriggerX && !hasDigestTrigger) {return null;}

    return {
        supported: true
    };
}

module.exports = createDigestTriggerAbility;
module.exports.getCapabilities = getDigestTriggerCapabilities;
