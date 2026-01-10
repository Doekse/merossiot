'use strict';

const ToggleState = require('../../model/states/toggle-state');
const { normalizeChannel, validateRequired } = require('../../utilities/options');

/**
 * Toggle feature module.
 * Provides control over device on/off state for single-channel and multi-channel devices.
 */
module.exports = {
    /**
     * Controls the toggle state (on/off) for single-channel devices.
     *
     * @param {Object} options - Toggle options
     * @param {boolean} options.onoff - True to turn on, false to turn off
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setToggle(options = {}) {
        validateRequired(options, ['onoff']);
        const payload = { 'toggle': { 'onoff': options.onoff ? 1 : 0 } };
        const response = await this.publishMessage('SET', 'Appliance.Control.Toggle', payload);

        if (response && response.toggle) {
            this._updateToggleState(response.toggle, 'response');
        } else {
            this._updateToggleState({ channel: 0, onoff: options.onoff ? 1 : 0 }, 'response');
        }

        return response;
    },

    /**
     * Controls the toggle state for a specific channel (on/off).
     *
     * @param {Object} options - Toggle options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @param {boolean} options.onoff - True to turn on, false to turn off
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setToggleX(options = {}) {
        validateRequired(options, ['onoff']);
        const channel = normalizeChannel(options);
        const payload = { 'togglex': { channel, 'onoff': options.onoff ? 1 : 0 } };
        const response = await this.publishMessage('SET', 'Appliance.Control.ToggleX', payload);

        if (response && response.togglex) {
            this._updateToggleState(response.togglex, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        } else {
            this._updateToggleState({ channel, onoff: options.onoff ? 1 : 0 }, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        }

        return response;
    },

    /**
     * Gets the current toggle state from the device.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get state for (default: 0, use 65535 or 0xffff for all channels)
     * @returns {Promise<Object>} Response containing toggle state
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getToggleState(options = {}) {
        const channel = normalizeChannel(options);
        const payload = { 'togglex': { channel } };
        const response = await this.publishMessage('GET', 'Appliance.Control.ToggleX', payload);
        if (response && response.togglex) {
            this._updateToggleState(response.togglex, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the cached toggle state for the specified channel.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {Object|undefined} Cached toggle state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedToggleState(channel = 0) {
        this.validateState();
        return this._toggleStateByChannel.get(channel);
    },

    /**
     * Gets all cached toggle states for all channels.
     *
     * Returns a read-only copy of the internal state map. Modifications to the returned
     * Map will not affect the internal state.
     *
     * @returns {Map<number, ToggleState>} Map of channel numbers to toggle states, or empty Map if no states cached
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getAllCachedToggleStates() {
        this.validateState();
        return new Map(this._toggleStateByChannel);
    },

    /**
     * Checks if the device is on for the specified channel.
     *
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean|undefined} True if on, false if off, undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    isOn(channel = 0) {
        this.validateState();
        const toggleState = this._toggleStateByChannel.get(channel);
        if (toggleState) {
            return toggleState.isOn;
        }
        return undefined;
    },

    /**
     * Turns on the device for the specified channel.
     *
     * Automatically selects the appropriate toggle method (ToggleX or Toggle) based on
     * device capabilities.
     *
     * @param {Object} [options={}] - Turn on options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnknownDeviceTypeError} If device does not support Toggle or ToggleX
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async turnOn(options = {}) {
        if (this._abilities) {
            const hasToggleX = this._abilities['Appliance.Control.ToggleX'];
            const hasToggle = this._abilities['Appliance.Control.Toggle'];

            if (hasToggleX) {
                return await this.setToggleX({ ...options, onoff: true });
            } else if (hasToggle) {
                return await this.setToggle({ onoff: true });
            }
        }
        const { UnknownDeviceTypeError } = require('../../model/exception');
        throw new UnknownDeviceTypeError('Device does not support Toggle or ToggleX', this.deviceType);
    },

    /**
     * Turns off the device for the specified channel.
     *
     * Automatically selects the appropriate toggle method (ToggleX or Toggle) based on
     * device capabilities.
     *
     * @param {Object} [options={}] - Turn off options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnknownDeviceTypeError} If device does not support Toggle or ToggleX
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async turnOff(options = {}) {
        if (this._abilities) {
            const hasToggleX = this._abilities['Appliance.Control.ToggleX'];
            const hasToggle = this._abilities['Appliance.Control.Toggle'];

            if (hasToggleX) {
                return await this.setToggleX({ ...options, onoff: false });
            } else if (hasToggle) {
                return await this.setToggle({ onoff: false });
            }
        }
        const { UnknownDeviceTypeError } = require('../../model/exception');
        throw new UnknownDeviceTypeError('Device does not support Toggle or ToggleX', this.deviceType);
    },

    /**
     * Updates the cached toggle state from toggle data.
     *
     * Called automatically when ToggleX push notifications are received or System.All
     * digest is processed. Handles both single objects and arrays of toggle data.
     *
     * @param {Object|Array} toggleData - Toggle data (single object or array)
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateToggleState(toggleData, source = 'response') {
        if (!toggleData) {return;}

        const toggleArray = Array.isArray(toggleData) ? toggleData : [toggleData];

        for (const toggleItem of toggleArray) {
            const channelIndex = toggleItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            const oldState = this._toggleStateByChannel.get(channelIndex);
            const oldValue = oldState ? oldState.isOn : undefined;

            let state = this._toggleStateByChannel.get(channelIndex);
            if (!state) {
                state = new ToggleState(toggleItem);
                this._toggleStateByChannel.set(channelIndex, state);
            } else {
                state.update(toggleItem);
            }

            const newValue = state.isOn;
            if (oldValue !== newValue) {
                this.emit('stateChange', {
                    type: 'toggle',
                    channel: channelIndex,
                    value: newValue,
                    oldValue,
                    source,
                    timestamp: Date.now()
                });
            }
        }
    }
};

