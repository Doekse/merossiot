'use strict';

const SprayState = require('../states/spray-state');
const { SprayModeCodec } = require('../enums');
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
         * @param {'off'|'continuous'|'intermittent'} options.mode - Spray mode
         * @returns {Promise<Object>} Response from the device
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async set(options = {}) {
            if (options.mode === undefined) {
                throw new MerossDeviceError('mode is required', 'VALIDATION_ERROR', { field: 'mode' });
            }
            const channel = normalizeChannel(options);
            const modeValue = SprayModeCodec.toWire(options.mode);
            if (modeValue === undefined) {
                throw new MerossDeviceError(
                    'Invalid spray mode. Expected off, continuous, or intermittent.',
                    'VALIDATION_ERROR',
                    { field: 'mode', mode: options.mode, deviceUuid: device.uuid }
                );
            }

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
         * @returns {'off'|'continuous'|'intermittent'|undefined} Spray mode or undefined if not available
         */
        getMode(options = {}) {
            const channel = normalizeChannel(options);
            const sprayState = device._sprayStateByChannel.get(channel);
            return sprayState?.mode;
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
