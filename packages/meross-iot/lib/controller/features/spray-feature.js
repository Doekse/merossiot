'use strict';

const SprayState = require('../../model/states/spray-state');
const { SprayMode } = require('../../model/enums');
const { normalizeChannel } = require('../../utilities/options');
const { MerossErrorValidation } = require('../../model/exception');

/**
 * Creates a spray feature object for a device.
 *
 * Provides control over spray/mist functionality for devices that support it.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Spray feature object with set(), get(), and convenience methods
 */
function createSprayFeature(device) {
    return {
        /**
         * Sets the spray mode.
         *
         * @param {Object} options - Spray options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {number|import('../lib/enums').SprayMode} options.mode - Spray mode value or SprayMode enum
         * @returns {Promise<Object>} Response from the device
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         */
        async set(options = {}) {
            if (options.mode === undefined) {
                throw new MerossErrorValidation('mode is required', 'mode');
            }
            const channel = normalizeChannel(options);
            const modeValue = options.mode || 0;

            const payload = { 'spray': { channel, 'mode': modeValue } };
            const response = await device.publishMessage('SET', 'Appliance.Control.Spray', payload);

            if (response?.spray) {
                updateSprayState(device, response.spray, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            } else {
                updateSprayState(device, { channel, mode: modeValue }, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return response;
        },

        /**
         * Gets the current spray state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<SprayState|undefined>} Promise that resolves with spray state or undefined
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            // Use cache if fresh, otherwise fetch
            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                const cached = device._sprayStateByChannel.get(channel);
                if (cached) {
                    return cached;
                }
            }

            // Fetch fresh state
            const response = await device.publishMessage('GET', 'Appliance.Control.Spray', {});
            if (response?.spray) {
                updateSprayState(device, response.spray, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return device._sprayStateByChannel.get(channel);
        },

        /**
         * Gets the current spray mode for the specified channel (cached).
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get mode for (default: 0)
         * @returns {import('../lib/enums').SprayMode|undefined} SprayMode enum object or undefined if not available
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
 * Updates the cached spray state from spray data.
 *
 * Called automatically when spray push notifications are received or System.All
 * digest is processed. Handles both single objects and arrays of spray data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} sprayData - Spray data (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateSprayState(device, sprayData, source = 'response') {
    if (!sprayData) {return;}

    const sprayArray = Array.isArray(sprayData) ? sprayData : [sprayData];

    for (const sprayItem of sprayArray) {
        const channelIndex = sprayItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._sprayStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            mode: oldState.mode
        } : undefined;

        let state = device._sprayStateByChannel.get(channelIndex);
        if (!state) {
            state = new SprayState(sprayItem);
            device._sprayStateByChannel.set(channelIndex, state);
        } else {
            state.update(sprayItem);
        }

        const newValue = { mode: state.mode };
        if (oldValue === undefined || oldValue.mode !== state.mode) {
            device.emit('state', {
                type: 'spray',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

module.exports = createSprayFeature;
module.exports._updateSprayState = updateSprayState;
