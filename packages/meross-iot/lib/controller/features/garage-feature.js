'use strict';

const GarageDoorState = require('../../model/states/garage-door-state');
const { normalizeChannel } = require('../../utilities/options');
const { MerossErrorValidation } = require('../../model/exception');

/**
 * Creates a garage door feature object for a device.
 *
 * Provides control over garage door open/close state and configuration settings.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Garage door feature object with set(), get(), and convenience methods
 */
function createGarageFeature(device) {
    return {
        /**
         * Sets the garage door state (open/close).
         *
         * @param {Object} options - Garage door options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {boolean} options.open - True to open, false to close
         * @returns {Promise<Object>} Response from the device
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         */
        async set(options = {}) {
            if (options.open === undefined) {
                throw new MerossErrorValidation('open is required', 'open');
            }
            const channel = normalizeChannel(options);
            const payload = { 'state': { channel, 'open': options.open ? 1 : 0, 'uuid': device.uuid } };
            const response = await device.publishMessage('SET', 'Appliance.GarageDoor.State', payload);

            if (response?.state) {
                updateGarageDoorState(device, response.state, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            } else {
                updateGarageDoorState(device, [{ channel, open: options.open ? 1 : 0 }], 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return response;
        },

        /**
         * Gets the current garage door state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<GarageDoorState|undefined>} Promise that resolves with garage door state or undefined
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            // Use cache if fresh, otherwise fetch
            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                const cached = device._garageDoorStateByChannel.get(channel);
                if (cached) {
                    return cached;
                }
            }

            // Fetch fresh state
            const payload = { 'state': { channel } };
            const response = await device.publishMessage('GET', 'Appliance.GarageDoor.State', payload);
            if (response?.state) {
                updateGarageDoorState(device, response.state, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return device._garageDoorStateByChannel.get(channel);
        },

        /**
         * Checks if the garage door is open for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to check (default: 0)
         * @returns {boolean|undefined} True if open, false if closed, undefined if not available
         */
        isOpen(options = {}) {
            const channel = normalizeChannel(options);
            const state = device._garageDoorStateByChannel.get(channel);
            if (state) {
                return state.isOpen;
            }
            return undefined;
        },

        /**
         * Checks if the garage door is closed for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to check (default: 0)
         * @returns {boolean|undefined} True if closed, false if open, undefined if not available
         */
        isClosed(options = {}) {
            const isOpen = this.isOpen(options);
            if (isOpen === undefined) {
                return undefined;
            }
            return !isOpen;
        },

        /**
         * Opens the garage door for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async open(options = {}) {
            return await this.set({ ...options, open: true });
        },

        /**
         * Closes the garage door for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async close(options = {}) {
            return await this.set({ ...options, open: false });
        },

        /**
         * Toggles the garage door state for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async toggle(options = {}) {
            const channel = normalizeChannel(options);
            const isOpen = this.isOpen({ channel });
            const newState = isOpen === true ? false : true;
            return await this.set({ channel, open: newState });
        },

        /**
         * Gets the garage door multiple configuration state.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing garage door config with `config` array
         */
        async getMultipleConfig(_options = {}) {
            const response = await device.publishMessage('GET', 'Appliance.GarageDoor.MultipleConfig', {});
            if (response?.config) {
                updateGarageDoorConfig(device, response.config);
                device.lastFullUpdateTimestamp = Date.now();
            }
            return response;
        },

        /**
         * Gets the garage door configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing garage door configuration
         */
        async getConfig(_options = {}) {
            return await device.publishMessage('GET', 'Appliance.GarageDoor.Config', {});
        },

        /**
         * Sets the garage door configuration.
         *
         * @param {Object} options - Garage door config options
         * @param {Object} [options.configData] - Configuration data object (if provided, used directly)
         * @param {number} [options.signalDuration] - Signal duration in milliseconds
         * @param {boolean} [options.buzzerEnable] - Enable/disable buzzer
         * @param {number} [options.doorOpenDuration] - Door open duration in milliseconds
         * @param {number} [options.doorCloseDuration] - Door close duration in milliseconds
         * @returns {Promise<Object>} Response from the device
         */
        async setConfig(options = {}) {
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
                Object.keys(configData).forEach(key => {
                    if (configData[key] === undefined) {
                        delete configData[key];
                    }
                });
            }
            const payload = { config: configData };
            return await device.publishMessage('SET', 'Appliance.GarageDoor.Config', payload);
        }
    };
}

/**
 * Updates the cached garage door state from state data.
 *
 * Called automatically when garage door push notifications are received or System.All
 * digest is processed. Handles both single objects and arrays of state data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} stateData - State data (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateGarageDoorState(device, stateData, source = 'response') {
    if (!stateData) {return;}

    const stateArray = Array.isArray(stateData) ? stateData : [stateData];

    for (const stateItem of stateArray) {
        const channelIndex = stateItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._garageDoorStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            isOpen: oldState.isOpen
        } : undefined;

        let state = device._garageDoorStateByChannel.get(channelIndex);
        if (!state) {
            state = new GarageDoorState(stateItem);
            device._garageDoorStateByChannel.set(channelIndex, state);
        } else {
            state.update(stateItem);
        }

        const newValue = { isOpen: state.isOpen };
        if (oldValue === undefined || oldValue.isOpen !== state.isOpen) {
            device.emit('state', {
                type: 'garageDoor',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

/**
 * Updates the cached garage door configuration from config data.
 *
 * Called automatically when garage door configuration responses are received.
 * Handles both single objects and arrays of config data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} configData - Config data (single object or array)
 */
function updateGarageDoorConfig(device, configData) {
    if (!configData) {return;}

    const configArray = Array.isArray(configData) ? configData : [configData];

    for (const configItem of configArray) {
        const channelIndex = configItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        device._garageDoorConfigByChannel.set(channelIndex, configItem);
    }
}

/**
 * Gets garage door capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Garage door capability object or null if not supported
 */
function getGarageCapabilities(device, channelIds) {
    if (!device.abilities) {return null;}

    const hasGarageDoorState = !!device.abilities['Appliance.GarageDoor.State'];
    const hasGarageDoorConfig = !!device.abilities['Appliance.GarageDoor.Config'];
    const hasGarageDoorMultipleConfig = !!device.abilities['Appliance.GarageDoor.MultipleConfig'];

    if (!hasGarageDoorState && !hasGarageDoorConfig && !hasGarageDoorMultipleConfig) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createGarageFeature;
module.exports._updateGarageDoorState = updateGarageDoorState;
module.exports.getCapabilities = getGarageCapabilities;
