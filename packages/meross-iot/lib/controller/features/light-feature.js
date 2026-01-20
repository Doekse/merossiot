'use strict';

const LightState = require('../../model/states/light-state');
const { LightMode } = require('../../model/enums');
const { rgbToInt } = require('../../utilities/conversion');
const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');

/**
 * Creates a light feature object for a device.
 *
 * Provides control over light settings including color, brightness, temperature, and on/off state.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Light feature object with set(), get(), and convenience methods
 */
function createLightFeature(device) {
    /**
     * Checks if the device supports a specific light mode for the given channel.
     *
     * @param {number} mode - Light mode to check (from LightMode enum)
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean} True if the mode is supported
     * @private
     */
    function supportsLightMode(mode, _channel = 0) {
        if (!device.abilities) {return false;}

        const lightAbility = device.abilities['Appliance.Control.Light'];
        if (!lightAbility || !lightAbility.capacity) {return false;}

        const { capacity } = lightAbility;
        return (capacity & mode) === mode;
    }

    return {
        /**
         * Sets the light color, brightness, temperature, and on/off state.
         *
         * @param {Object} [options={}] - Light control options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {boolean} [options.on] - Turn on/off (only used if device doesn't support Toggle/ToggleX)
         * @param {Array<number>|number|Object} [options.rgb] - RGB color [r, g, b], integer, or {r,g,b} object
         * @param {number} [options.luminance] - Brightness value (0-100)
         * @param {number} [options.temperature] - Temperature value (0-100)
         * @param {boolean|number} [options.gradual] - Enable gradual transition (default: true for RGB, false otherwise)
         * @returns {Promise<Object|null>} Response from the device or null if no changes needed
         * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
         * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
         */
        async set(options = {}) {
            const channel = normalizeChannel(options);
            const { on, rgb, luminance, temperature, gradual } = options;

            const hasToggleX = device.abilities?.['Appliance.Control.ToggleX'];
            const hasToggle = device.abilities?.['Appliance.Control.Toggle'];
            const hasToggleSupport = hasToggleX || hasToggle;

            // Handle on/off via toggle if supported
            if (hasToggleSupport && on !== undefined) {
                if (device.toggle) {
                    await device.toggle.set({ channel, on });
                }
            }

            const lightPayload = {};

            // Include onoff in light payload if toggle not supported
            if (!hasToggleSupport && on !== undefined) {
                lightPayload.onoff = on ? 1 : 0;
            } else if (!hasToggleSupport) {
                // Preserve current state if not specified
                const currentState = device._lightStateByChannel.get(channel);
                if (currentState && currentState.isOn !== undefined) {
                    lightPayload.onoff = currentState.isOn ? 1 : 0;
                }
            }

            if (rgb !== undefined && supportsLightMode(LightMode.MODE_RGB, channel)) {
                lightPayload.rgb = rgbToInt(rgb);
                lightPayload.capacity = (lightPayload.capacity || 0) | LightMode.MODE_RGB;
            }

            if (luminance !== undefined && supportsLightMode(LightMode.MODE_LUMINANCE, channel)) {
                lightPayload.luminance = luminance;
                lightPayload.capacity = (lightPayload.capacity || 0) | LightMode.MODE_LUMINANCE;
            }

            if (temperature !== undefined && supportsLightMode(LightMode.MODE_TEMPERATURE, channel)) {
                lightPayload.temperature = temperature;
                lightPayload.capacity = (lightPayload.capacity || 0) | LightMode.MODE_TEMPERATURE;
            }

            if (Object.keys(lightPayload).length === 0) {
                return null;
            }

            lightPayload.channel = channel;

            // Handle gradual transition parameter
            if (gradual !== undefined) {
                lightPayload.gradual = typeof gradual === 'boolean' ? (gradual ? 1 : 0) : gradual;
            } else if (rgb !== undefined) {
                lightPayload.gradual = 1;
            } else {
                lightPayload.gradual = 0;
            }

            const payload = { light: lightPayload };
            const response = await device.publishMessage('SET', 'Appliance.Control.Light', payload, null);

            if (response?.light) {
                updateLightState(device, response.light, 'response');
            } else {
                updateLightState(device, lightPayload, 'response');
            }

            return response;
        },

        /**
         * Gets the current light state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<LightState|undefined>} Promise that resolves with light state or undefined
         * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
         * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            // Use cache if fresh, otherwise fetch
            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                const cached = device._lightStateByChannel.get(channel);
                if (cached) {
                    return cached;
                }
            }

            // Fetch fresh state
            const response = await device.publishMessage('GET', 'Appliance.Control.Light', {}, null);

            if (response?.light) {
                updateLightState(device, response.light, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return device._lightStateByChannel.get(channel);
        },

        /**
         * Checks if the light is on for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to check (default: 0)
         * @returns {boolean|undefined} True if on, false if off, undefined if not available
         */
        isOn(options = {}) {
            const channel = normalizeChannel(options);
            const hasToggleX = device.abilities?.['Appliance.Control.ToggleX'];
            const hasToggle = device.abilities?.['Appliance.Control.Toggle'];

            // If toggle supported, use toggle state
            if ((hasToggleX || hasToggle) && device.toggle) {
                return device.toggle.isOn({ channel });
            }

            // Otherwise use light state
            const lightState = device._lightStateByChannel.get(channel);
            if (lightState) {
                return lightState.isOn;
            }
            return undefined;
        },

        /**
         * Gets the light RGB color for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get color for (default: 0)
         * @returns {Array<number>|undefined} RGB tuple [r, g, b] or undefined if not available
         */
        getRgbColor(options = {}) {
            const channel = normalizeChannel(options);
            const lightState = device._lightStateByChannel.get(channel);
            if (lightState) {
                return lightState.rgbTuple;
            }
            return undefined;
        },

        /**
         * Gets the light brightness for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get brightness for (default: 0)
         * @returns {number|undefined} Brightness value or undefined if not available
         */
        getBrightness(options = {}) {
            const channel = normalizeChannel(options);
            const lightState = device._lightStateByChannel.get(channel);
            if (lightState) {
                return lightState.luminance;
            }
            return undefined;
        },

        /**
         * Gets the light temperature for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get temperature for (default: 0)
         * @returns {number|undefined} Temperature value or undefined if not available
         */
        getTemperature(options = {}) {
            const channel = normalizeChannel(options);
            const lightState = device._lightStateByChannel.get(channel);
            if (lightState) {
                return lightState.temperature;
            }
            return undefined;
        },

        /**
         * Checks if the light supports RGB mode for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to check (default: 0)
         * @returns {boolean} True if RGB is supported
         */
        supportsRgb(options = {}) {
            return supportsLightMode(LightMode.MODE_RGB, normalizeChannel(options));
        },

        /**
         * Checks if the light supports luminance mode for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to check (default: 0)
         * @returns {boolean} True if luminance is supported
         */
        supportsLuminance(options = {}) {
            return supportsLightMode(LightMode.MODE_LUMINANCE, normalizeChannel(options));
        },

        /**
         * Checks if the light supports temperature mode for the specified channel.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to check (default: 0)
         * @returns {boolean} True if temperature is supported
         */
        supportsTemperature(options = {}) {
            return supportsLightMode(LightMode.MODE_TEMPERATURE, normalizeChannel(options));
        }
    };
}

/**
 * Updates the cached light state from light data.
 *
 * Called automatically when light push notifications are received or System.All
 * digest is processed. Handles both single objects and arrays of light data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} lightData - Light data (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateLightState(device, lightData, source = 'response') {
    if (!lightData) {return;}

    const lightArray = Array.isArray(lightData) ? lightData : [lightData];

    for (const lightItem of lightArray) {
        const channelIndex = lightItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._lightStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            isOn: oldState.isOn,
            brightness: oldState.luminance,
            rgb: oldState.rgbTuple,
            temperature: oldState.temperature
        } : undefined;

        let state = device._lightStateByChannel.get(channelIndex);
        if (!state) {
            state = new LightState(lightItem);
            device._lightStateByChannel.set(channelIndex, state);
        } else {
            state.update(lightItem);
        }

        const newValue = buildStateChanges(oldValue, {
            isOn: state.isOn,
            brightness: state.luminance,
            rgb: state.rgbTuple,
            temperature: state.temperature
        }, ['rgb']);

        if (Object.keys(newValue).length > 0) {
            device.emit('state', {
                type: 'light',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

module.exports = createLightFeature;
module.exports._updateLightState = updateLightState;
