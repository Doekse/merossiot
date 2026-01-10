'use strict';

/**
 * Timer digest feature module.
 * Provides access to timer summary information without fetching individual timer details.
 */
module.exports = {
    /**
     * Gets timer digest (summary) information.
     *
     * Returns a summary of all timers across all channels. Use this to check timer status
     * without fetching detailed timer information. For detailed timer data, use {@link getTimerX}.
     *
     * @returns {Promise<Object>} Response containing timer digest data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getTimerXDigest() {
        return await this.publishMessage('GET', 'Appliance.Digest.TimerX', {});
    }
};

