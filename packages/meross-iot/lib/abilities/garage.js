'use strict';

const GarageDoorState = require('../states/garage-door-state');
const { getCachedOrFetch } = require('../utilities/cache');
const { normalizeChannel } = require('../utilities/options');
const { MerossDeviceError } = require('../exception');
const { registerNamespaceDescriptor } = require('../dispatcher');

/**
 * Creates a garage door feature object for a device.
 *
 * Provides control over garage door open/close state and configuration settings.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Garage door feature object with set(), get(), and convenience methods
 */
function createGarageAbility(device) {
    return {
        /**
         * Sets the garage door state (open/close).
         *
         * @param {Object} options - Garage door options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {boolean} options.open - True to open, false to close
         * @returns {Promise<Object>} Response from the device
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async set(options = {}) {
            if (options.open === undefined) {
                throw new MerossDeviceError('open is required', 'VALIDATION_ERROR', { field: 'open' });
            }
            const channel = normalizeChannel(options);
            const payload = { 'state': { channel, 'open': options.open ? 1 : 0, 'uuid': device.uuid } };
            const { payload: responsePayload } = await device.publishMessage('SET', 'Appliance.GarageDoor.State', payload);
            return responsePayload;
        },

        /**
         * Gets the current garage door state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<GarageDoorState|undefined>} Promise that resolves with garage door state or undefined
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            return getCachedOrFetch(
                device,
                '_garageDoorStateByChannel',
                channel,
                () => device.publishMessage('GET', 'Appliance.GarageDoor.State', { state: { channel } })
            );
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
            const { payload } = await device.publishMessage('GET', 'Appliance.GarageDoor.MultipleConfig', {});
            return payload;
        },

        /**
         * Gets the garage door configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing garage door configuration
         */
        async getConfig(_options = {}) {
            const { payload } = await device.publishMessage('GET', 'Appliance.GarageDoor.Config', {});
            return payload;
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
            const { payload: out } = await device.publishMessage('SET', 'Appliance.GarageDoor.Config', payload);
            return out;
        }
    };
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
    const hasGarageDoorState = !!device.abilities['Appliance.GarageDoor.State'];
    const hasGarageDoorConfig = !!device.abilities['Appliance.GarageDoor.Config'];
    const hasGarageDoorMultipleConfig = !!device.abilities['Appliance.GarageDoor.MultipleConfig'];

    if (!hasGarageDoorState && !hasGarageDoorConfig && !hasGarageDoorMultipleConfig) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

registerNamespaceDescriptor('Appliance.GarageDoor.State', {
    namespace: 'Appliance.GarageDoor.State',
    payloadKey: 'state',
    stateMap: '_garageDoorStateByChannel',
    StateClass: GarageDoorState,
    eventType: 'garageDoor',
    snapshot: (s) => ({ isOpen: s.isOpen }),
    emitValue: (o, n) => (o?.isOpen !== n.isOpen ? { isOpen: n.isOpen } : undefined)
});

/**
 * MultipleConfig writes a per-channel config cache without emitting stateChange; the
 * per-item dispatcher form gives each channel its own ordering key so stale pushes for
 * one door can't overwrite a newer config write on another.
 */
registerNamespaceDescriptor('Appliance.GarageDoor.MultipleConfig', {
    namespace: 'Appliance.GarageDoor.MultipleConfig',
    payloadKey: 'config',
    customApplyItem: (device, item) => {
        updateGarageDoorConfig(device, item);
    }
});

module.exports = createGarageAbility;
module.exports.getCapabilities = getGarageCapabilities;
module.exports.ability = {
    key: 'garage',
    namespaces: ['Appliance.GarageDoor.State'],
    caches: ['_garageDoorStateByChannel', '_garageDoorConfigByChannel'],
    create: createGarageAbility,
    getCapabilities: getGarageCapabilities
};
