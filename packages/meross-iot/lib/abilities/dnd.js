'use strict';

const { MerossDeviceError } = require('../exception');
const { DndModeCodec } = require('../enums');

/**
 * Creates a do-not-disturb feature object for a device.
 *
 * Controls the device's do-not-disturb mode, which disables the ambient LED when enabled.
 *
 * @param {Object} device - The device instance
 * @returns {Object} DND feature object with set() and get() methods
 */
function createDNDAbility(device) {
    return {
        /**
         * Gets whether do-not-disturb is enabled on the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<boolean>} True when DND is enabled (LED off)
         */
        async get(_options = {}) {
            const { payload: result } = await device.publishMessage('GET', 'Appliance.System.DNDMode', {});
            device.lastFullUpdateTimestamp = Date.now();
            if (result?.DNDMode?.mode !== undefined) {
                device._dndModeWire = result.DNDMode.mode;
                return DndModeCodec.fromWire(result.DNDMode.mode) === 'on';
            }
            return false;
        },

        /**
         * Semantic DND mode from the last {@link #get} response or cached wire value.
         *
         * @returns {'off'|'on'|null}
         */
        getMode() {
            const wire = device._dndModeWire;
            if (wire === undefined || wire === null) {
                return null;
            }
            return DndModeCodec.fromWire(wire);
        },

        /**
         * Sets whether do-not-disturb is enabled.
         *
         * @param {Object} options - DND options
         * @param {boolean} [options.enabled] - True to enable DND (LED off), false to disable
         * @param {'off'|'on'} [options.mode] - Semantic mode (alternative to `enabled`)
         * @returns {Promise<void>}
         */
        async set(options = {}) {
            const { enabled, mode } = options;
            let modeWire;
            if (mode !== undefined && mode !== null) {
                modeWire = DndModeCodec.toWire(mode);
                if (modeWire === undefined) {
                    throw new MerossDeviceError(
                        'Invalid DND mode. Expected "off" or "on".',
                        'VALIDATION_ERROR',
                        { field: 'mode', mode, deviceUuid: device.uuid }
                    );
                }
            } else if (enabled !== undefined) {
                if (typeof enabled !== 'boolean') {
                    throw new MerossDeviceError(
                        'Invalid DND value. Expected boolean enabled.',
                        'VALIDATION_ERROR',
                        { field: 'enabled', enabled, deviceUuid: device.uuid }
                    );
                }
                modeWire = DndModeCodec.toWire(enabled ? 'on' : 'off');
            } else {
                throw new MerossDeviceError('enabled or mode is required', 'VALIDATION_ERROR', { options, deviceUuid: device.uuid });
            }

            const payload = { 'DNDMode': { 'mode': modeWire } };
            await device.publishMessage('SET', 'Appliance.System.DNDMode', payload);
            device._dndModeWire = modeWire;
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
    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createDNDAbility;
module.exports.getCapabilities = getDNDCapabilities;
module.exports.ability = {
    key: 'dnd',
    namespaces: ['Appliance.System.DNDMode'],
    caches: [],
    create: createDNDAbility,
    getCapabilities: getDNDCapabilities
};
