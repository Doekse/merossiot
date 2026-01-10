'use strict';

/**
 * Control feature module.
 * Provides advanced control capabilities including batch commands, event acknowledgments, and firmware upgrades.
 */
module.exports = {
    /**
     * Executes multiple commands simultaneously.
     *
     * Allows sending multiple commands in a single request to reduce network overhead and improve
     * efficiency when controlling multiple aspects of a device at once.
     *
     * @param {Array<Object>} commands - Array of command objects
     * @param {string} commands[].namespace - Namespace for the command (e.g., "Appliance.Control.ToggleX")
     * @param {string} commands[].method - Method for the command (e.g., "SET", "GET")
     * @param {Object} commands[].payload - Payload for the command
     * @returns {Promise<Object>} Response containing results for each command
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setMultiple(commands) {
        const payload = {
            multiple: commands.map(cmd => ({
                header: {
                    namespace: cmd.namespace,
                    method: cmd.method
                },
                payload: cmd.payload
            }))
        };
        return await this.publishMessage('SET', 'Appliance.Control.Multiple', payload);
    },

    /**
     * Acknowledges an over-temperature event.
     *
     * Over-temperature events are typically initiated by the device via SET. This method sends
     * a SETACK response to acknowledge receipt of the event.
     *
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async acknowledgeControlOverTemp() {
        return await this.publishMessage('SETACK', 'Appliance.Control.OverTemp', {});
    },

    /**
     * Initiates a device firmware upgrade.
     *
     * @param {Object} upgradeData - Upgrade data object containing upgrade parameters
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setUpgrade(upgradeData) {
        const payload = { upgrade: upgradeData };
        return await this.publishMessage('SET', 'Appliance.Control.Upgrade', payload);
    }
};

