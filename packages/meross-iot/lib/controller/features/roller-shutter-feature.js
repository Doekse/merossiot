'use strict';

const RollerShutterState = require('../../model/states/roller-shutter-state');
const { normalizeChannel } = require('../../utilities/options');
const { MerossErrorValidation } = require('../../model/exception');

/**
 * Creates a roller shutter feature object for a device.
 *
 * Provides control over roller shutter/blind position and movement state.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Roller shutter feature object with set(), get(), and convenience methods
 */
function createRollerShutterFeature(device) {
    return {
        /**
         * Sets the roller shutter position.
         *
         * @param {Object} options - Roller shutter position options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {number} options.position - Position value (0-100 for open/close, -1 for stop)
         * @returns {Promise<Object>} Response from the device
         * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
         * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
         */
        async set(options = {}) {
            if (options.position === undefined) {
                throw new MerossErrorValidation('position is required', 'position');
            }
            const channel = normalizeChannel(options);
            const payload = { 'position': { position: options.position, channel } };
            const response = await device.publishMessage('SET', 'Appliance.RollerShutter.Position', payload);

            if (response?.position) {
                updateRollerShutterPosition(device, response.position, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            } else {
                updateRollerShutterPosition(device, [{ channel, position: options.position }], 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return response;
        },

        /**
         * Gets the current roller shutter state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<RollerShutterState|undefined>} Promise that resolves with roller shutter state or undefined
         * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
         * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            // Use cache if fresh, otherwise fetch
            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                const cached = device._rollerShutterStateByChannel.get(channel);
                if (cached) {
                    return cached;
                }
            }

            // Fetch fresh state
            const response = await device.publishMessage('GET', 'Appliance.RollerShutter.State', {});
            if (response?.state) {
                updateRollerShutterState(device, response.state, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return device._rollerShutterStateByChannel.get(channel);
        },

        /**
         * Opens the roller shutter (moves to position 100).
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async open(options = {}) {
            return await this.set({ ...options, position: 100 });
        },

        /**
         * Closes the roller shutter (moves to position 0).
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async close(options = {}) {
            return await this.set({ ...options, position: 0 });
        },

        /**
         * Stops the roller shutter movement.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async stop(options = {}) {
            return await this.set({ ...options, position: -1 });
        },

        /**
         * Gets the roller shutter position from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing roller shutter position with `position` array
         */
        async getPosition(_options = {}) {
            const response = await device.publishMessage('GET', 'Appliance.RollerShutter.Position', {});
            if (response?.position) {
                updateRollerShutterPosition(device, response.position, 'response');
            }
            return response;
        },

        /**
         * Gets the roller shutter configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing roller shutter config with `config` array
         */
        async getConfig(_options = {}) {
            const response = await device.publishMessage('GET', 'Appliance.RollerShutter.Config', {});
            if (response?.config) {
                updateRollerShutterConfig(device, response.config);
            }
            return response;
        },

        /**
         * Sets the roller shutter configuration.
         *
         * @param {Object} options - Roller shutter config options
         * @param {Object|Array} options.config - Configuration object or array of configuration objects
         * @returns {Promise<Object>} Response from the device
         */
        async setConfig(options = {}) {
            if (!options.config) {
                throw new MerossErrorValidation('config is required', 'config');
            }
            const payload = { config: options.config };
            const response = await device.publishMessage('SET', 'Appliance.RollerShutter.Config', payload);
            if (response?.config) {
                updateRollerShutterConfig(device, response.config);
            } else if (options.config) {
                const configArray = Array.isArray(options.config) ? options.config : [options.config];
                updateRollerShutterConfig(device, configArray);
            }
            return response;
        },

        /**
         * Gets the roller shutter adjustment settings from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing roller shutter adjustment data
         */
        async getAdjust(_options = {}) {
            return await device.publishMessage('GET', 'Appliance.RollerShutter.Adjust', {});
        }
    };
}

/**
 * Updates the cached roller shutter state from state data.
 *
 * Called automatically when roller shutter push notifications are received or System.All
 * digest is processed. Handles both single objects and arrays of state data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} stateData - State data (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateRollerShutterState(device, stateData, source = 'response') {
    if (!stateData) {return;}

    const stateArray = Array.isArray(stateData) ? stateData : [stateData];

    for (const stateItem of stateArray) {
        const channelIndex = stateItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._rollerShutterStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            state: oldState.state,
            position: oldState.position
        } : undefined;

        let state = device._rollerShutterStateByChannel.get(channelIndex);
        if (!state) {
            state = new RollerShutterState(stateItem);
            device._rollerShutterStateByChannel.set(channelIndex, state);
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
            device.emit('state', {
                type: 'rollerShutter',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

/**
 * Updates the cached roller shutter position from position data.
 *
 * Called automatically when roller shutter position responses are received. Updates both
 * the position cache and the state cache.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} positionData - Position data (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateRollerShutterPosition(device, positionData, source = 'response') {
    if (!positionData) {return;}

    const positionArray = Array.isArray(positionData) ? positionData : [positionData];

    for (const positionItem of positionArray) {
        const channelIndex = positionItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldPosition = device._rollerShutterPositionByChannel.get(channelIndex);
        const oldState = device._rollerShutterStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            state: oldState.state,
            position: oldState.position
        } : (oldPosition !== undefined ? { position: oldPosition } : undefined);

        device._rollerShutterPositionByChannel.set(channelIndex, positionItem.position);

        let state = device._rollerShutterStateByChannel.get(channelIndex);
        if (!state) {
            state = new RollerShutterState(positionItem);
            device._rollerShutterStateByChannel.set(channelIndex, state);
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
            device.emit('state', {
                type: 'rollerShutter',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

/**
 * Updates the cached roller shutter configuration from config data.
 *
 * Called automatically when roller shutter configuration responses are received.
 * Handles both single objects and arrays of config data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} configData - Config data (single object or array)
 */
function updateRollerShutterConfig(device, configData) {
    if (!configData) {return;}

    const configArray = Array.isArray(configData) ? configData : [configData];

    for (const configItem of configArray) {
        const channelIndex = configItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        device._rollerShutterConfigByChannel.set(channelIndex, configItem);
    }
}

module.exports = createRollerShutterFeature;
module.exports._updateRollerShutterState = updateRollerShutterState;
module.exports._updateRollerShutterPosition = updateRollerShutterPosition;
