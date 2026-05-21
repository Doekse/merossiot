'use strict';

/**
 * Creates a timer digest feature object for a device.
 *
 * Provides access to timer summary information without fetching individual timer details.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Timer digest feature object with get() method
 */
function createDigestTimerAbility(device) {
    return {
        /**
         * Gets timer digest (summary) information.
         *
         * @returns {Promise<Object>} Response containing timer digest data
         */
        async get() {
            const { payload } = await device.publishMessage('GET', 'Appliance.Digest.TimerX', {});
            return payload;
        }
    };
}

/**
 * Gets digest timer capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} _channelIds - Array of channel IDs (unused; consistent with `getCapabilities` signature)
 * @returns {Object|null} Digest timer capability object or null if not supported
 */
function getDigestTimerCapabilities(device, _channelIds) {
    const hasDigestTimerX = !!device.abilities['Appliance.Digest.TimerX'];
    const hasDigestTimer = !!device.abilities['Appliance.Digest.Timer'];

    if (!hasDigestTimerX && !hasDigestTimer) {return null;}

    return {
        supported: true
    };
}

module.exports = createDigestTimerAbility;
module.exports.getCapabilities = getDigestTimerCapabilities;
module.exports.ability = {
    key: 'digestTimer',
    namespaces: ['Appliance.Digest.TimerX', 'Appliance.Digest.Timer'],
    caches: [],
    create: createDigestTimerAbility,
    getCapabilities: getDigestTimerCapabilities
};
