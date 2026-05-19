'use strict';

const DiffuserLightState = require('../states/diffuser-light-state');
const DiffuserSprayState = require('../states/diffuser-spray-state');
const { getCachedOrFetch } = require('../utilities/cache');
const { buildStateChanges } = require('../utilities/state-changes');
const { normalizeChannel } = require('../utilities/options');
const { MerossDeviceError } = require('../exception');
const { registerNamespaceDescriptor } = require('../dispatcher');

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

            if (type === 'light') {
                return getCachedOrFetch(
                    device,
                    '_diffuserLightStateByChannel',
                    channel,
                    () => device.publishMessage('GET', 'Appliance.Control.Diffuser.Light', {})
                );
            }
            if (type === 'spray') {
                return getCachedOrFetch(
                    device,
                    '_diffuserSprayStateByChannel',
                    channel,
                    () => device.publishMessage('GET', 'Appliance.Control.Diffuser.Spray', {})
                );
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
module.exports.getCapabilities = getDiffuserCapabilities;
