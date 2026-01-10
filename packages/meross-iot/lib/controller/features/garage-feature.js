'use strict';

const GarageDoorState = require('../../model/states/garage-door-state');
const { normalizeChannel } = require('../../utilities/options');

/**
 * Garage door feature module.
 * Provides control over garage door open/close state and configuration settings.
 */
module.exports = {
    /**
     * Controls the garage door state (open/close).
     *
     * Automatically includes the device UUID in the payload.
     *
     * @param {Object} options - Garage door options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @param {boolean} options.open - True to open, false to close
     * @returns {Promise<Object>} Response from the device containing the updated state
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setGarageDoor(options = {}) {
        if (options.open === undefined) {
            throw new Error('open is required');
        }
        const channel = normalizeChannel(options);
        const payload = { 'state': { channel, 'open': options.open ? 1 : 0, 'uuid': this.uuid } };
        const response = await this.publishMessage('SET', 'Appliance.GarageDoor.State', payload);

        if (response && response.state) {
            this._updateGarageDoorState(response.state, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        } else {
            this._updateGarageDoorState([{ channel, open: options.open ? 1 : 0 }], 'response');
            this._lastFullUpdateTimestamp = Date.now();
        }

        return response;
    },

    /**
     * Gets the current garage door state from the device.
     *
     * Use {@link getCachedGarageDoorState} to get cached state without making a request.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get state for (default: 0, use 0xffff for all channels)
     * @returns {Promise<Object>} Response containing garage door state with `state` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getGarageDoorState(options = {}) {
        const channel = normalizeChannel(options);
        const payload = { 'state': { channel } };
        const response = await this.publishMessage('GET', 'Appliance.GarageDoor.State', payload);
        if (response && response.state) {
            this._updateGarageDoorState(response.state, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the garage door multiple configuration state.
     *
     * Retrieves configuration for all channels. Use {@link getGarageDoorConfig} (getter) to get
     * cached configuration for a specific channel.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing garage door config with `config` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getGarageDoorMultipleState(_options = {}) {
        const response = await this.publishMessage('GET', 'Appliance.GarageDoor.MultipleConfig', {});
        if (response && response.config) {
            this._updateGarageDoorConfig(response.config);
            this._lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the garage door multiple configuration (alias for getGarageDoorMultipleState).
     *
     * @param {Object} [options={}] - Get options
     * @see getGarageDoorMultipleState
     * @returns {Promise<Object>} Response containing garage door config with `config` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getGarageDoorMultipleConfig(_options = {}) {
        return await this.getGarageDoorMultipleState(_options);
    },

    /**
     * Gets the garage door configuration from the device.
     *
     * Note: This method name conflicts with the getter method {@link getGarageDoorConfig} that
     * returns cached config. Use {@link getGarageDoorMultipleState} to get config from device.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing garage door configuration
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getGarageDoorConfig(_options = {}) {
        return await this.publishMessage('GET', 'Appliance.GarageDoor.Config', {});
    },

    /**
     * Controls the garage door configuration.
     *
     * @param {Object} options - Garage door config options
     * @param {Object} [options.configData] - Configuration data object (if provided, used directly)
     * @param {number} [options.signalDuration] - Signal duration in milliseconds
     * @param {boolean} [options.buzzerEnable] - Enable/disable buzzer
     * @param {number} [options.doorOpenDuration] - Door open duration in milliseconds
     * @param {number} [options.doorCloseDuration] - Door close duration in milliseconds
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setGarageDoorConfig(options = {}) {
        let configData;
        if (options.configData) {
            configData = options.configData;
        } else {
            configData = {
                signalDuration: options.signalDuration,
                buzzerEnable: options.buzzerEnable,
                doorOpenDuration: options.doorOpenDuration,
                doorCloseDuration: options.doorCloseDuration
            };
            // Remove undefined values
            Object.keys(configData).forEach(key => {
                if (configData[key] === undefined) {
                    delete configData[key];
                }
            });
        }
        const payload = { config: configData };
        return await this.publishMessage('SET', 'Appliance.GarageDoor.Config', payload);
    },

    /**
     * Gets the cached garage door state for the specified channel.
     *
     * Returns cached state without making a request. Use {@link getGarageDoorState} to fetch
     * fresh state from the device. State is automatically updated when commands are sent or
     * push notifications are received.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/model/states/garage-door-state').GarageDoorState|undefined} Cached garage door state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedGarageDoorState(channel = 0) {
        this.validateState();
        return this._garageDoorStateByChannel.get(channel);
    },

    /**
     * Checks if the garage door is opened for the specified channel.
     *
     * Uses cached state. Ensure state is initialized with {@link refreshState} first.
     *
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean|undefined} True if open, false if closed, undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see isGarageDoorClosed
     */
    isGarageDoorOpened(channel = 0) {
        this.validateState();
        const state = this._garageDoorStateByChannel.get(channel);
        if (state) {
            return state.isOpen;
        }
        return undefined;
    },

    /**
     * Checks if the garage door is closed for the specified channel.
     *
     * Uses cached state. Ensure state is initialized with {@link refreshState} first.
     *
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean|undefined} True if closed, false if open, undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see isGarageDoorOpened
     */
    isGarageDoorClosed(channel = 0) {
        this.validateState();
        const isOpen = this.isGarageDoorOpened(channel);
        if (isOpen === undefined) {
            return undefined;
        }
        return !isOpen;
    },

    /**
     * Gets the garage door configuration for the specified channel (cached).
     *
     * Returns cached configuration without making a request. Use {@link getGarageDoorMultipleState}
     * to fetch fresh configuration from the device.
     *
     * @param {number} [channel=0] - Channel to get config for (default: 0)
     * @returns {Object|undefined} Garage door config or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getGarageDoorConfig(channel = 0) {
        this.validateState();
        return this._garageDoorConfigByChannel.get(channel);
    },

    /**
     * Opens the garage door for the specified channel.
     *
     * Convenience method that calls {@link setGarageDoor} with `open = true`.
     *
     * @param {Object} [options={}] - Open options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see closeGarageDoor
     * @see toggleGarageDoor
     */
    async openGarageDoor(options = {}) {
        return await this.setGarageDoor({ ...options, open: true });
    },

    /**
     * Closes the garage door for the specified channel.
     *
     * Convenience method that calls {@link setGarageDoor} with `open = false`.
     *
     * @param {Object} [options={}] - Close options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see openGarageDoor
     * @see toggleGarageDoor
     */
    async closeGarageDoor(options = {}) {
        return await this.setGarageDoor({ ...options, open: false });
    },

    /**
     * Toggles the garage door state for the specified channel.
     *
     * Opens if closed, closes if open. Uses cached state to determine current state.
     *
     * @param {Object} [options={}] - Toggle options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see openGarageDoor
     * @see closeGarageDoor
     */
    async toggleGarageDoor(options = {}) {
        const channel = normalizeChannel(options);
        const isOpen = this.isGarageDoorOpened(channel);
        const newState = isOpen === true ? false : true;
        return await this.setGarageDoor({ channel, open: newState });
    },

    /**
     * Updates the cached garage door state from state data.
     *
     * Called automatically when garage door push notifications are received or commands complete.
     * Handles both single objects and arrays of state data.
     *
     * @param {Object|Array} stateData - State data (single object or array)
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateGarageDoorState(stateData, source = 'response') {
        if (!stateData) {return;}

        const stateArray = Array.isArray(stateData) ? stateData : [stateData];

        for (const stateItem of stateArray) {
            const channelIndex = stateItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            const oldState = this._garageDoorStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                isOpen: oldState.isOpen
            } : undefined;

            let state = this._garageDoorStateByChannel.get(channelIndex);
            if (!state) {
                state = new GarageDoorState(stateItem);
                this._garageDoorStateByChannel.set(channelIndex, state);
            } else {
                state.update(stateItem);
            }

            const newValue = { isOpen: state.isOpen };
            if (oldValue === undefined || oldValue.isOpen !== state.isOpen) {
                this.emit('stateChange', {
                    type: 'garageDoor',
                    channel: channelIndex,
                    value: newValue,
                    oldValue,
                    source,
                    timestamp: Date.now()
                });
            }
        }
    },

    /**
     * Updates the cached garage door configuration from config data.
     *
     * Called automatically when garage door configuration responses are received.
     * Handles both single objects and arrays of config data.
     *
     * @param {Object|Array} configData - Config data (single object or array)
     * @private
     */
    _updateGarageDoorConfig(configData) {
        if (!configData) {return;}

        const configArray = Array.isArray(configData) ? configData : [configData];

        for (const configItem of configArray) {
            const channelIndex = configItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            this._garageDoorConfigByChannel.set(channelIndex, configItem);
        }
    }
};

