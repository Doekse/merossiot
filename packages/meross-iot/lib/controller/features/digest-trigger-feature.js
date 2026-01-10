'use strict';

/**
 * Trigger digest feature module.
 * Provides access to trigger summary information without fetching individual trigger details.
 */
module.exports = {
    /**
     * Gets trigger digest (summary) information.
     *
     * Returns a summary of all triggers across all channels. Use this to check trigger status
     * without fetching detailed trigger information. For detailed trigger data, use {@link getTriggerX}.
     *
     * @returns {Promise<Object>} Response containing trigger digest data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getTriggerXDigest() {
        return await this.publishMessage('GET', 'Appliance.Digest.TriggerX', {});
    }
};

