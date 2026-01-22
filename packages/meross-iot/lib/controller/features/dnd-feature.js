'use strict';

const { DNDMode } = require('../../model/enums');

/**
 * Creates a do-not-disturb feature object for a device.
 *
 * Controls the device's do-not-disturb mode, which disables the ambient LED when enabled.
 *
 * @param {Object} device - The device instance
 * @returns {Object} DND feature object with set() and get() methods
 */
function createDNDFeature(device) {
    return {
        /**
         * Gets the do-not-disturb mode from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<import('../lib/enums').DNDMode>} DNDMode enum object
         */
        async get(_options = {}) {
            const result = await device.publishMessage('GET', 'Appliance.System.DNDMode', {});
            if (result && result.DNDMode && result.DNDMode.mode !== undefined) {
                const modeValue = result.DNDMode.mode;
                const enumKey = Object.keys(DNDMode).find(key => DNDMode[key] === modeValue);
                device.lastFullUpdateTimestamp = Date.now();
                return enumKey ? DNDMode[enumKey] : DNDMode.DND_DISABLED;
            }
            device.lastFullUpdateTimestamp = Date.now();
            return DNDMode.DND_DISABLED;
        },

        /**
         * Gets the raw numeric DND mode value from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<number>} Raw numeric DND mode value (0 = disabled, 1 = enabled)
         */
        async getRaw(_options = {}) {
            const result = await device.publishMessage('GET', 'Appliance.System.DNDMode', {});
            if (result && result.DNDMode && result.DNDMode.mode !== undefined) {
                return result.DNDMode.mode;
            }
            return DNDMode.DND_DISABLED;
        },

        /**
         * Sets the do-not-disturb mode setting.
         *
         * @param {Object} options - DND mode options
         * @param {boolean|import('../lib/enums').DNDMode} options.mode - DNDMode enum value or boolean
         * @returns {Promise<void>}
         */
        async set(options = {}) {
            if (options.mode === undefined) {
                const { MerossErrorCommand } = require('../../model/exception');
                throw new MerossErrorCommand('mode is required', { options }, device.uuid);
            }
            let modeValue;
            if (typeof options.mode === 'boolean') {
                modeValue = options.mode ? DNDMode.DND_ENABLED : DNDMode.DND_DISABLED;
            } else if (options.mode === DNDMode.DND_ENABLED || options.mode === DNDMode.DND_DISABLED) {
                modeValue = options.mode;
            } else {
                const { MerossErrorCommand } = require('../../model/exception');
                throw new MerossErrorCommand('Invalid DND mode. Expected boolean or DNDMode enum value.', { mode: options.mode }, device.uuid);
            }

            const payload = { 'DNDMode': { 'mode': modeValue } };
            await device.publishMessage('SET', 'Appliance.System.DNDMode', payload);
        }
    };
}

/**
 * Gets DND capability information for a device.
 *
 * Determines if the device supports do-not-disturb mode based on device abilities.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} DND capability object or null if not supported
 */
function getDNDCapabilities(device, channelIds) {
    if (!device.abilities || !device.abilities['Appliance.System.DNDMode']) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createDNDFeature;
module.exports.getCapabilities = getDNDCapabilities;
