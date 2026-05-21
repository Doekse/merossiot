'use strict';

/**
 * Creates a control feature object for a device.
 *
 * Provides advanced control capabilities including batch commands, event acknowledgments, and firmware upgrades.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Control feature object with setMultiple(), acknowledgeOverTemp(), and setUpgrade() methods
 */
function createControlAbility(device) {
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
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Control.Multiple', payload);
            return out;
        },

        /**
         * Acknowledges an over-temperature event.
         *
         * @returns {Promise<Object>} Response from the device
         */
        async acknowledgeOverTemp() {
            const { payload } = await device.publishMessage('SETACK', 'Appliance.Control.OverTemp', {});
            return payload;
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
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Control.Upgrade', payload);
            return out;
        }
    };
}

/**
 * Gets control capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} _channelIds - Array of channel IDs (unused; consistent with `getCapabilities` signature)
 * @returns {Object|null} Control capability object or null if not supported
 */
function getControlCapabilities(device, _channelIds) {
    const hasMultiple = !!device.abilities['Appliance.Control.Multiple'];
    const hasUpgrade = !!device.abilities['Appliance.Control.Upgrade'];

    if (!hasMultiple && !hasUpgrade) {return null;}

    return {
        supported: true,
        multiple: hasMultiple,
        upgrade: hasUpgrade
    };
}

module.exports = createControlAbility;
module.exports.getCapabilities = getControlCapabilities;
module.exports.ability = {
    key: 'control',
    namespaces: ['Appliance.Control.Multiple', 'Appliance.Control.Upgrade'],
    caches: [],
    create: createControlAbility,
    getCapabilities: getControlCapabilities
};
