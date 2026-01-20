'use strict';

const ToggleState = require('../../model/states/toggle-state');
const { normalizeChannel, validateRequired } = require('../../utilities/options');

/**
 * Creates a toggle feature object for a device.
 *
 * Provides control over device on/off state for single-channel and multi-channel devices.
 * Auto-detects Toggle vs ToggleX capabilities internally.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Toggle feature object with set(), get(), and isOn() methods
 */
function createToggleFeature(device) {
    return {
        /**
         * Sets the toggle state (on/off) for a channel.
         *
         * Auto-detects whether to use Toggle or ToggleX based on device capabilities.
         *
         * @param {Object} options - Toggle options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {boolean} options.on - True to turn on, false to turn off
         * @returns {Promise<void>} Promise that resolves when state is set
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         * @throws {MerossErrorUnknownDeviceType} If device does not support Toggle or ToggleX
         */
        async set(options = {}) {
            validateRequired(options, ['on']);
            const channel = normalizeChannel(options);
            const onoff = options.on ? 1 : 0;

            // Auto-detect Toggle vs ToggleX
            const hasToggleX = device.abilities?.['Appliance.Control.ToggleX'];
            const hasToggle = device.abilities?.['Appliance.Control.Toggle'];

            let response;
            if (hasToggleX) {
                const payload = { 'togglex': { channel, onoff } };
                response = await device.publishMessage('SET', 'Appliance.Control.ToggleX', payload);

                if (response && response.togglex) {
                    device._updateToggleState(response.togglex, 'response');
                    device.lastFullUpdateTimestamp = Date.now();
                } else {
                    device._updateToggleState({ channel, onoff }, 'response');
                    device.lastFullUpdateTimestamp = Date.now();
                }
            } else if (hasToggle) {
                const payload = { 'toggle': { onoff } };
                response = await device.publishMessage('SET', 'Appliance.Control.Toggle', payload);

                if (response && response.toggle) {
                    device._updateToggleState(response.toggle, 'response');
                } else {
                    device._updateToggleState({ channel: 0, onoff }, 'response');
                }
            } else {
                const { MerossErrorUnknownDeviceType } = require('../../model/exception');
                throw new MerossErrorUnknownDeviceType('Device does not support Toggle or ToggleX', device.deviceType);
            }
        },

        /**
         * Gets the current toggle state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<ToggleState|undefined>} Promise that resolves with toggle state or undefined
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            // Use cache if fresh, otherwise fetch
            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                const cached = device._toggleStateByChannel.get(channel);
                if (cached) {
                    return cached;
                }
            }

            // Fetch fresh state
            const payload = { 'togglex': { channel } };
            const response = await device.publishMessage('GET', 'Appliance.Control.ToggleX', payload);

            if (response?.togglex) {
                device._updateToggleState(response.togglex, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return device._toggleStateByChannel.get(channel);
        },

        /**
         * Checks if the device is on for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to check (default: 0)
         * @returns {boolean|undefined} True if on, false if off, undefined if not available
         */
        isOn(options = {}) {
            const channel = normalizeChannel(options);
            const toggleState = device._toggleStateByChannel.get(channel);
            if (toggleState) {
                return toggleState.isOn;
            }
            return undefined;
        }
    };
}

/**
 * Updates the cached toggle state from toggle data.
 *
 * Called automatically when ToggleX push notifications are received or System.All
 * digest is processed. Handles both single objects and arrays of toggle data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} toggleData - Toggle data (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateToggleState(device, toggleData, source = 'response') {
    if (!toggleData) {return;}

    const toggleArray = Array.isArray(toggleData) ? toggleData : [toggleData];

    for (const toggleItem of toggleArray) {
        const channelIndex = toggleItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._toggleStateByChannel.get(channelIndex);
        const oldValue = oldState ? oldState.isOn : undefined;

        let state = device._toggleStateByChannel.get(channelIndex);
        if (!state) {
            state = new ToggleState(toggleItem);
            device._toggleStateByChannel.set(channelIndex, state);
        } else {
            state.update(toggleItem);
        }

        const newValue = state.isOn;
        if (oldValue !== newValue) {
            device.emit('state', {
                type: 'toggle',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

module.exports = createToggleFeature;
module.exports._updateToggleState = updateToggleState;

