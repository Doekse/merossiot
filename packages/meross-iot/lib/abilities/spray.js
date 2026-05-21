'use strict';

const SprayState = require('../states/spray-state');
const { SprayMode } = require('../enums');
const { getCachedOrFetch } = require('../utilities/cache');
const { normalizeChannel } = require('../utilities/options');
const { MerossDeviceError } = require('../exception');
const { registerNamespaceDescriptor } = require('../dispatcher');

/**
 * Creates a spray feature object for a device.
 *
 * Provides control over spray/mist functionality for devices that support it.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Spray feature object with set(), get(), and convenience methods
 */
function createSprayAbility(device) {
    return {
        /**
         * Sets the spray mode.
         *
         * @param {Object} options - Spray options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {number|import('../enums').SprayMode} options.mode - Spray mode value or SprayMode enum
         * @returns {Promise<Object>} Response from the device
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async set(options = {}) {
            if (options.mode === undefined) {
                throw new MerossDeviceError('mode is required', 'VALIDATION_ERROR', { field: 'mode' });
            }
            const channel = normalizeChannel(options);
            const modeValue = options.mode || 0;

            const payload = { 'spray': { channel, 'mode': modeValue } };
            const { payload: responsePayload } = await device.publishMessage('SET', 'Appliance.Control.Spray', payload);
            return responsePayload;
        },

        /**
         * Gets the current spray state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<SprayState|undefined>} Promise that resolves with spray state or undefined
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            return getCachedOrFetch(
                device,
                '_sprayStateByChannel',
                channel,
                () => device.publishMessage('GET', 'Appliance.Control.Spray', {})
            );
        },

        /**
         * Gets the current spray mode for the specified channel (cached).
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get mode for (default: 0)
         * @returns {import('../enums').SprayMode|undefined} SprayMode enum object or undefined if not available
         */
        getMode(options = {}) {
            const channel = normalizeChannel(options);
            const sprayState = device._sprayStateByChannel.get(channel);
            if (sprayState && sprayState.mode !== undefined && sprayState.mode !== null) {
                const enumKey = Object.keys(SprayMode).find(key => SprayMode[key] === sprayState.mode);
                return enumKey ? SprayMode[enumKey] : undefined;
            }
            return undefined;
        },

        /**
         * Gets the raw numeric spray mode value for the specified channel (cached).
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get mode for (default: 0)
         * @returns {number|undefined} Raw numeric mode value or undefined if not available
         */
        getRawMode(options = {}) {
            const channel = normalizeChannel(options);
            const sprayState = device._sprayStateByChannel.get(channel);
            if (sprayState) {
                return sprayState.mode;
            }
            return undefined;
        }
    };
}

/**
 * Gets spray capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Spray capability object or null if not supported
 */
function getSprayCapabilities(device, channelIds) {
    return {
        supported: true,
        channels: channelIds
    };
}

registerNamespaceDescriptor('Appliance.Control.Spray', {
    namespace: 'Appliance.Control.Spray',
    payloadKey: 'spray',
    stateMap: '_sprayStateByChannel',
    StateClass: SprayState,
    eventType: 'spray',
    snapshot: (s) => ({ mode: s.mode })
});

module.exports = createSprayAbility;
module.exports.getCapabilities = getSprayCapabilities;
module.exports.ability = {
    key: 'spray',
    namespaces: ['Appliance.Control.Spray'],
    caches: ['_sprayStateByChannel'],
    create: createSprayAbility,
    getCapabilities: getSprayCapabilities
};
