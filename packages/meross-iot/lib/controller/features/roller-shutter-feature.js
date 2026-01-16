'use strict';

const RollerShutterState = require('../../model/states/roller-shutter-state');
const { RollerShutterStatus } = require('../../model/enums');
const { normalizeChannel } = require('../../utilities/options');

/**
 * Roller shutter feature module.
 * Provides control over roller shutter/blind position and movement state.
 */
module.exports = {
    /**
     * Sets the roller shutter position.
     *
     * @param {Object} options - Roller shutter position options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @param {number} options.position - Position value (0-100 for open/close, -1 for stop)
     * @returns {Promise<Object>} Response from the device containing the updated position
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setRollerShutterPosition(options = {}) {
        if (options.position === undefined) {
            throw new Error('position is required');
        }
        const channel = normalizeChannel(options);
        const payload = { 'position': { position: options.position, channel } };
        const response = await this.publishMessage('SET', 'Appliance.RollerShutter.Position', payload);

        if (response && response.position) {
            this._updateRollerShutterPosition(response.position, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        } else {
            this._updateRollerShutterPosition([{ channel, position: options.position }], 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }

        return response;
    },

    /**
     * Opens the roller shutter (moves to position 100).
     *
     * Convenience method that calls {@link setRollerShutterPosition} with position 100.
     *
     * @param {Object} [options={}] - Open options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see closeRollerShutter
     * @see stopRollerShutter
     */
    async setRollerShutterUp(options = {}) {
        return await this.setRollerShutterPosition({ ...options, position: 100 });
    },

    /**
     * Closes the roller shutter (moves to position 0).
     *
     * Convenience method that calls {@link setRollerShutterPosition} with position 0.
     *
     * @param {Object} [options={}] - Close options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see openRollerShutter
     * @see stopRollerShutter
     */
    async setRollerShutterDown(options = {}) {
        return await this.setRollerShutterPosition({ ...options, position: 0 });
    },

    /**
     * Stops the roller shutter movement.
     *
     * Convenience method that calls {@link setRollerShutterPosition} with position -1.
     *
     * @param {Object} [options={}] - Stop options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see openRollerShutter
     * @see closeRollerShutter
     */
    async setRollerShutterStop(options = {}) {
        return await this.setRollerShutterPosition({ ...options, position: -1 });
    },

    /**
     * Opens the roller shutter (moves to position 100).
     *
     * Alias for {@link setRollerShutterUp}.
     *
     * @param {Object} [options={}] - Open options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see closeRollerShutter
     * @see stopRollerShutter
     */
    async openRollerShutter(options = {}) {
        return await this.setRollerShutterPosition({ ...options, position: 100 });
    },

    /**
     * Closes the roller shutter (moves to position 0).
     *
     * Alias for {@link setRollerShutterDown}.
     *
     * @param {Object} [options={}] - Close options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see openRollerShutter
     * @see stopRollerShutter
     */
    async closeRollerShutter(options = {}) {
        return await this.setRollerShutterPosition({ ...options, position: 0 });
    },

    /**
     * Stops the roller shutter movement.
     *
     * Alias for {@link setRollerShutterStop}.
     *
     * @param {Object} [options={}] - Stop options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see openRollerShutter
     * @see closeRollerShutter
     */
    async stopRollerShutter(options = {}) {
        return await this.setRollerShutterPosition({ ...options, position: -1 });
    },


    /**
     * Gets the current roller shutter state from the device.
     *
     * Use {@link getCachedRollerShutterState} to get cached state without making a request.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing roller shutter state with `state` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getRollerShutterState(_options = {}) {
        const response = await this.publishMessage('GET', 'Appliance.RollerShutter.State', {});
        if (response && response.state) {
            this._updateRollerShutterState(response.state, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the current roller shutter position from the device.
     *
     * Use {@link getRollerShutterPosition} (getter) to get cached position without making a request.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing roller shutter position with `position` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getRollerShutterPosition(_options = {}) {
        const response = await this.publishMessage('GET', 'Appliance.RollerShutter.Position', {});
        if (response && response.position) {
            this._updateRollerShutterPosition(response.position, 'response');
        }
        return response;
    },

    /**
     * Gets the roller shutter configuration from the device.
     *
     * Use {@link getRollerShutterConfig} (getter) to get cached config without making a request.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing roller shutter config with `config` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getRollerShutterConfig(_options = {}) {
        const response = await this.publishMessage('GET', 'Appliance.RollerShutter.Config', {});
        if (response && response.config) {
            this._updateRollerShutterConfig(response.config);
        }
        return response;
    },

    /**
     * Controls the roller shutter configuration.
     *
     * @param {Object} options - Roller shutter config options
     * @param {Object|Array} options.config - Configuration object or array of configuration objects
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setRollerShutterConfig(options = {}) {
        if (!options.config) {
            throw new Error('config is required');
        }
        const payload = { config: options.config };
        const response = await this.publishMessage('SET', 'Appliance.RollerShutter.Config', payload);
        if (response && response.config) {
            this._updateRollerShutterConfig(response.config);
        } else if (options.config) {
            const configArray = Array.isArray(options.config) ? options.config : [options.config];
            this._updateRollerShutterConfig(configArray);
        }
        return response;
    },

    /**
     * Gets the roller shutter adjustment settings from the device.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing roller shutter adjustment data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getRollerShutterAdjust(_options = {}) {
        return await this.publishMessage('GET', 'Appliance.RollerShutter.Adjust', {});
    },

    /**
     * Gets the cached roller shutter state for the specified channel.
     *
     * Returns cached state without making a request. Use {@link getRollerShutterState} to fetch
     * fresh state from the device. State is automatically updated when commands are sent or
     * push notifications are received.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/model/states/roller-shutter-state').RollerShutterState|undefined} Cached roller shutter state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedRollerShutterState(channel = 0) {
        this.validateState();
        return this._rollerShutterStateByChannel.get(channel);
    },

    /**
     * Gets the roller shutter state value for the specified channel (cached).
     *
     * Returns the status enum (IDLE, OPENING, CLOSING) from cached state. Use {@link getRawRollerShutterState}
     * to get the raw numeric value, or {@link getRollerShutterState} (async method) to fetch from device.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/enums').RollerShutterStatus|undefined} RollerShutterStatus enum object (e.g., RollerShutterStatus.IDLE) or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see getRawRollerShutterState
     */
    getRollerShutterState(channel = 0) {
        this.validateState();
        const state = this._rollerShutterStateByChannel.get(channel);
        if (state && state.state !== undefined && state.state !== null) {
            const enumKey = Object.keys(RollerShutterStatus).find(key => RollerShutterStatus[key] === state.state);
            return enumKey ? RollerShutterStatus[enumKey] : undefined;
        }
        return undefined;
    },

    /**
     * Gets the raw numeric roller shutter state value for the specified channel (cached).
     *
     * Returns the raw numeric status value. For enum object, use {@link getRollerShutterState} instead.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {number|undefined} Raw numeric state value or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see getRollerShutterState
     */
    getRawRollerShutterState(channel = 0) {
        this.validateState();
        const state = this._rollerShutterStateByChannel.get(channel);
        if (state) {
            return state.state;
        }
        return undefined;
    },

    /**
     * Gets the roller shutter position for the specified channel (cached).
     *
     * Returns position (0-100) from cached state. Use {@link getRollerShutterPosition} (async method)
     * to fetch fresh position from the device.
     *
     * @param {number} [channel=0] - Channel to get position for (default: 0)
     * @returns {number|undefined} Position value (0-100, where 0 is closed and 100 is fully open) or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getRollerShutterPosition(channel = 0) {
        this.validateState();
        const position = this._rollerShutterPositionByChannel.get(channel);
        if (position !== undefined && position !== null) {
            return position;
        }
        const state = this._rollerShutterStateByChannel.get(channel);
        if (state) {
            return state.position;
        }
        return undefined;
    },

    /**
     * Gets the roller shutter configuration for the specified channel (cached).
     *
     * Returns cached configuration without making a request. Use {@link getRollerShutterConfig} (async method)
     * to fetch fresh configuration from the device.
     *
     * @param {number} [channel=0] - Channel to get config for (default: 0)
     * @returns {Object|undefined} Roller shutter config or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getRollerShutterConfig(channel = 0) {
        this.validateState();
        return this._rollerShutterConfigByChannel.get(channel);
    },

    /**
     * Updates the cached roller shutter state from state data.
     *
     * Called automatically when roller shutter push notifications are received or commands complete.
     * Handles both single objects and arrays of state data.
     *
     * @param {Object|Array} stateData - State data (single object or array)
     * @private
     */
    _updateRollerShutterState(stateData, source = 'response') {
        if (!stateData) {return;}

        const stateArray = Array.isArray(stateData) ? stateData : [stateData];

        for (const stateItem of stateArray) {
            const channelIndex = stateItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            const oldState = this._rollerShutterStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                state: oldState.state,
                position: oldState.position
            } : undefined;

            let state = this._rollerShutterStateByChannel.get(channelIndex);
            if (!state) {
                state = new RollerShutterState(stateItem);
                this._rollerShutterStateByChannel.set(channelIndex, state);
            } else {
                state.update(stateItem);
            }

            const newValue = {};
            if (oldValue === undefined || oldValue.state !== state.state) {
                newValue.state = state.state;
            }
            if (oldValue === undefined || oldValue.position !== state.position) {
                newValue.position = state.position;
            }

            if (Object.keys(newValue).length > 0) {
                this.emit('stateChange', {
                    type: 'rollerShutter',
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
     * Updates the cached roller shutter position from position data.
     *
     * Called automatically when roller shutter position responses are received. Updates both
     * the position cache and the state cache.
     *
     * @param {Object|Array} positionData - Position data (single object or array)
     * @private
     */
    _updateRollerShutterPosition(positionData, source = 'response') {
        if (!positionData) {return;}

        const positionArray = Array.isArray(positionData) ? positionData : [positionData];

        for (const positionItem of positionArray) {
            const channelIndex = positionItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            const oldPosition = this._rollerShutterPositionByChannel.get(channelIndex);
            const oldState = this._rollerShutterStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                state: oldState.state,
                position: oldState.position
            } : (oldPosition !== undefined ? { position: oldPosition } : undefined);

            this._rollerShutterPositionByChannel.set(channelIndex, positionItem.position);

            let state = this._rollerShutterStateByChannel.get(channelIndex);
            if (!state) {
                state = new RollerShutterState(positionItem);
                this._rollerShutterStateByChannel.set(channelIndex, state);
            } else {
                state.update(positionItem);
            }

            const newValue = {};
            if (oldValue === undefined || oldValue.state !== state.state) {
                newValue.state = state.state;
            }
            if (oldValue === undefined || oldValue.position !== state.position) {
                newValue.position = state.position;
            }

            if (Object.keys(newValue).length > 0) {
                this.emit('stateChange', {
                    type: 'rollerShutter',
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
     * Updates the cached roller shutter configuration from config data.
     *
     * Called automatically when roller shutter configuration responses are received.
     * Handles both single objects and arrays of config data.
     *
     * @param {Object|Array} configData - Config data (single object or array)
     * @private
     */
    _updateRollerShutterConfig(configData) {
        if (!configData) {return;}

        const configArray = Array.isArray(configData) ? configData : [configData];

        for (const configItem of configArray) {
            const channelIndex = configItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            this._rollerShutterConfigByChannel.set(channelIndex, configItem);
        }
    }
};

