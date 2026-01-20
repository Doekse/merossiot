'use strict';

/**
 * Creates a control feature object for a device.
 *
 * Provides advanced control capabilities including batch commands, event acknowledgments, and firmware upgrades.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Control feature object with setMultiple(), acknowledgeOverTemp(), and setUpgrade() methods
 */
function createControlFeature(device) {
    return {
        /**
         * Executes multiple commands simultaneously.
         *
         * @param {Object} options - Control options
         * @param {Array<Object>} options.commands - Array of command objects
         * @param {string} options.commands[].namespace - Namespace for the command
         * @param {string} options.commands[].method - Method for the command
         * @param {Object} options.commands[].payload - Payload for the command
         * @returns {Promise<Object>} Response containing results for each command
         */
        async setMultiple(options) {
            const { commands } = options;
            const payload = {
                multiple: commands.map(cmd => ({
                    header: {
                        namespace: cmd.namespace,
                        method: cmd.method
                    },
                    payload: cmd.payload
                }))
            };
            return await device.publishMessage('SET', 'Appliance.Control.Multiple', payload);
        },

        /**
         * Acknowledges an over-temperature event.
         *
         * @returns {Promise<Object>} Response from the device
         */
        async acknowledgeOverTemp() {
            return await device.publishMessage('SETACK', 'Appliance.Control.OverTemp', {});
        },

        /**
         * Initiates a device firmware upgrade.
         *
         * @param {Object} options - Upgrade options
         * @param {Object} options.upgradeData - Upgrade data object containing upgrade parameters
         * @returns {Promise<Object>} Response from the device
         */
        async setUpgrade(options) {
            const { upgradeData } = options;
            const payload = { upgrade: upgradeData };
            return await device.publishMessage('SET', 'Appliance.Control.Upgrade', payload);
        }
    };
}

module.exports = createControlFeature;
