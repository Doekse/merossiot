'use strict';

const DiffuserLightState = require('../../model/states/diffuser-light-state');
const DiffuserSprayState = require('../../model/states/diffuser-spray-state');
const { buildStateChanges } = require('../../utilities/state-changes');
const { normalizeChannel } = require('../../utilities/options');
const { MerossDeviceError } = require('../../model/exception');
const { registerNamespaceDescriptor } = require('../state-dispatcher');

/**
 * Creates a diffuser feature object for a device.
 *
 * Provides control over diffuser light and spray functionality for essential oil diffusers.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Diffuser feature object with set(), get(), and sensor methods
 */
function createDiffuserAbility(device) {
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
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async set(options = {}) {
            // Handle light
            if (options.light !== undefined) {
                const light = { ...options.light };
                light.uuid = device.uuid;
                const payload = { 'light': [light] };
                const { payload: responsePayload } = await device.publishMessage('SET', 'Appliance.Control.Diffuser.Light', payload);
                return responsePayload;
            }

            // Handle spray
            if (options.mode !== undefined) {
                const channel = normalizeChannel(options);
                const payload = { 'spray': [{ channel, 'mode': options.mode || 0, 'uuid': device.uuid }] };
                const { payload: responsePayload } = await device.publishMessage('SET', 'Appliance.Control.Diffuser.Spray', payload);
                return responsePayload;
            }

            throw new MerossDeviceError('Either light or mode is required', 'VALIDATION_ERROR', { field: 'light|mode' });
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
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
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
                await device.publishMessage('GET', 'Appliance.Control.Diffuser.Light', {});

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
                await device.publishMessage('GET', 'Appliance.Control.Diffuser.Spray', {});

                return device._diffuserSprayStateByChannel.get(channel);
            }

            throw new MerossDeviceError('type must be "light" or "spray"', 'VALIDATION_ERROR', { field: 'type' });
        },

        /**
         * Gets the diffuser sensor data (humidity and temperature) from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing sensor data with humidity and temperature
         */
        async getSensor(_options = {}) {
            const { payload } = await device.publishMessage('GET', 'Appliance.Control.Diffuser.Sensor', {});
            return payload;
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
                throw new MerossDeviceError('sensorData is required', 'VALIDATION_ERROR', { field: 'sensorData' });
            }
            const sensorData = options.sensorData;
            const payload = sensorData;
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Control.Diffuser.Sensor', payload);
            return out;
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
    if (!device._diffuserLightStateByChannel) {return;}
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
            device.emit('stateChange', {
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
    if (!device._diffuserSprayStateByChannel) {return;}
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
            device.emit('stateChange', {
                type: 'diffuserSpray',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

/**
 * Gets diffuser capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Diffuser capability object or null if not supported
 */
function getDiffuserCapabilities(device, channelIds) {
    if (!device.abilities) {return null;}

    const hasLight = !!device.abilities['Appliance.Control.Diffuser.Light'];
    const hasSpray = !!device.abilities['Appliance.Control.Diffuser.Spray'];

    if (!hasLight && !hasSpray) {return null;}

    return {
        supported: true,
        channels: channelIds,
        light: hasLight,
        spray: hasSpray
    };
}

registerNamespaceDescriptor('Appliance.Control.Diffuser.Light', {
    namespace: 'Appliance.Control.Diffuser.Light',
    payloadKey: 'light',
    stateMap: '_diffuserLightStateByChannel',
    StateClass: DiffuserLightState,
    eventType: 'diffuserLight',
    snapshot: (s) => ({
        isOn: s.isOn,
        brightness: s.luminance,
        rgb: s.rgbTuple,
        mode: s.mode
    }),
    emitValue: (o, n) => buildStateChanges(o, n, ['rgb'])
});

registerNamespaceDescriptor('Appliance.Control.Diffuser.Spray', {
    namespace: 'Appliance.Control.Diffuser.Spray',
    payloadKey: 'spray',
    stateMap: '_diffuserSprayStateByChannel',
    StateClass: DiffuserSprayState,
    eventType: 'diffuserSpray',
    snapshot: (s) => ({ mode: s.mode })
});

module.exports = createDiffuserAbility;
module.exports._updateDiffuserLightState = updateDiffuserLightState;
module.exports._updateDiffuserSprayState = updateDiffuserSprayState;
module.exports.getCapabilities = getDiffuserCapabilities;
