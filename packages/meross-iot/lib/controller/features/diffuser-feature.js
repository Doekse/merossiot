'use strict';

const DiffuserLightState = require('../../model/states/diffuser-light-state');
const DiffuserSprayState = require('../../model/states/diffuser-spray-state');
const { buildStateChanges } = require('../../utilities/state-changes');
const { normalizeChannel } = require('../../utilities/options');
const { MerossErrorValidation } = require('../../model/exception');

/**
 * Creates a diffuser feature object for a device.
 *
 * Provides control over diffuser light and spray functionality for essential oil diffusers.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Diffuser feature object with set(), get(), and sensor methods
 */
function createDiffuserFeature(device) {
    return {
        /**
         * Sets the diffuser light or spray settings.
         *
         * @param {Object} options - Diffuser options
         * @param {Object} [options.light] - Light configuration object
         * @param {number} [options.light.channel] - Channel to control (default: 0)
         * @param {number} [options.light.onoff] - Turn light on (1) or off (0)
         * @param {number} [options.light.mode] - Light mode (use DiffuserLightMode enum)
         * @param {number} [options.light.luminance] - Brightness value
         * @param {number} [options.light.rgb] - RGB color value
         * @param {number} [options.mode] - Spray mode value (for spray control)
         * @param {number} [options.channel=0] - Channel to control (default: 0, for spray)
         * @returns {Promise<Object>} Response from the device
         * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
         * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
         */
        async set(options = {}) {
            // Handle light
            if (options.light !== undefined) {
                const light = { ...options.light };
                light.uuid = device.uuid;
                const payload = { 'light': [light] };
                const response = await device.publishMessage('SET', 'Appliance.Control.Diffuser.Light', payload);

                if (response?.light) {
                    updateDiffuserLightState(device, response.light);
                    device.lastFullUpdateTimestamp = Date.now();
                } else if (light) {
                    updateDiffuserLightState(device, [light]);
                    device.lastFullUpdateTimestamp = Date.now();
                }

                return response;
            }

            // Handle spray
            if (options.mode !== undefined) {
                const channel = normalizeChannel(options);
                const payload = { 'spray': [{ channel, 'mode': options.mode || 0, 'uuid': device.uuid }] };
                const response = await device.publishMessage('SET', 'Appliance.Control.Diffuser.Spray', payload);

                if (response?.spray) {
                    updateDiffuserSprayState(device, response.spray, 'response');
                    device.lastFullUpdateTimestamp = Date.now();
                } else {
                    updateDiffuserSprayState(device, [{ channel, mode: options.mode || 0 }], 'response');
                    device.lastFullUpdateTimestamp = Date.now();
                }

                return response;
            }

            throw new MerossErrorValidation('Either light or mode is required', 'light|mode');
        },

        /**
         * Gets the current diffuser light or spray state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {string} [options.type='light'] - Type to get: 'light' or 'spray' (default: 'light')
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<DiffuserLightState|DiffuserSprayState|undefined>} Promise that resolves with state or undefined
         * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
         * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
         */
        async get(options = {}) {
            const type = options.type || 'light';
            const channel = normalizeChannel(options);
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            if (type === 'light') {
                // Use cache if fresh, otherwise fetch
                if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                    const cached = device._diffuserLightStateByChannel.get(channel);
                    if (cached) {
                        return cached;
                    }
                }

                // Fetch fresh state
                const response = await device.publishMessage('GET', 'Appliance.Control.Diffuser.Light', {});
                if (response?.light) {
                    updateDiffuserLightState(device, response.light, 'response');
                    device.lastFullUpdateTimestamp = Date.now();
                }

                return device._diffuserLightStateByChannel.get(channel);
            } else if (type === 'spray') {
                // Use cache if fresh, otherwise fetch
                if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                    const cached = device._diffuserSprayStateByChannel.get(channel);
                    if (cached) {
                        return cached;
                    }
                }

                // Fetch fresh state
                const response = await device.publishMessage('GET', 'Appliance.Control.Diffuser.Spray', {});
                if (response?.spray) {
                    updateDiffuserSprayState(device, response.spray, 'response');
                    device.lastFullUpdateTimestamp = Date.now();
                }

                return device._diffuserSprayStateByChannel.get(channel);
            }

            throw new MerossErrorValidation('type must be "light" or "spray"', 'type');
        },

        /**
         * Gets the diffuser sensor data (humidity and temperature) from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing sensor data with humidity and temperature
         */
        async getSensor(_options = {}) {
            return await device.publishMessage('GET', 'Appliance.Control.Diffuser.Sensor', {});
        },

        /**
         * Sets the diffuser sensor configuration.
         *
         * @param {Object} options - Sensor options
         * @param {Object} options.sensorData - Sensor data object
         * @returns {Promise<Object>} Response from the device
         */
        async setSensor(options = {}) {
            if (!options.sensorData) {
                throw new MerossErrorValidation('sensorData is required', 'sensorData');
            }
            const sensorData = options.sensorData;
            const payload = sensorData;
            return await device.publishMessage('SET', 'Appliance.Control.Diffuser.Sensor', payload);
        }
    };
}

/**
 * Updates the cached diffuser light state from light data.
 *
 * Called automatically when diffuser light push notifications are received or System.All
 * digest is processed. Handles both single objects and arrays of light data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} lightData - Light data (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateDiffuserLightState(device, lightData, source = 'response') {
    if (!lightData) {return;}

    const lightArray = Array.isArray(lightData) ? lightData : [lightData];

    for (const lightItem of lightArray) {
        const channelIndex = lightItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._diffuserLightStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            isOn: oldState.isOn,
            brightness: oldState.luminance,
            rgb: oldState.rgbTuple,
            mode: oldState.mode
        } : undefined;

        let state = device._diffuserLightStateByChannel.get(channelIndex);
        if (!state) {
            state = new DiffuserLightState(lightItem);
            device._diffuserLightStateByChannel.set(channelIndex, state);
        } else {
            state.update(lightItem);
        }

        const newValue = buildStateChanges(oldValue, {
            isOn: state.isOn,
            brightness: state.luminance,
            rgb: state.rgbTuple,
            mode: state.mode
        }, ['rgb']);

        if (Object.keys(newValue).length > 0) {
            device.emit('state', {
                type: 'diffuserLight',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

/**
 * Updates the cached diffuser spray state from spray data.
 *
 * Called automatically when diffuser spray push notifications are received or System.All
 * digest is processed. Handles both single objects and arrays of spray data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} sprayData - Spray data (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateDiffuserSprayState(device, sprayData, source = 'response') {
    if (!sprayData) {return;}

    const sprayArray = Array.isArray(sprayData) ? sprayData : [sprayData];

    for (const sprayItem of sprayArray) {
        const channelIndex = sprayItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._diffuserSprayStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            mode: oldState.mode
        } : undefined;

        let state = device._diffuserSprayStateByChannel.get(channelIndex);
        if (!state) {
            state = new DiffuserSprayState(sprayItem);
            device._diffuserSprayStateByChannel.set(channelIndex, state);
        } else {
            state.update(sprayItem);
        }

        const newValue = buildStateChanges(oldValue, {
            mode: state.mode
        });

        if (Object.keys(newValue).length > 0) {
            device.emit('state', {
                type: 'diffuserSpray',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

module.exports = createDiffuserFeature;
module.exports._updateDiffuserLightState = updateDiffuserLightState;
module.exports._updateDiffuserSprayState = updateDiffuserSprayState;
