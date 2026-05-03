'use strict';

const LightState = require('../../model/states/light-state');
const { LightMode } = require('../../model/enums');
const { getCachedOrFetch } = require('../../utilities/cache');
const { rgbToInt } = require('../../utilities/conversion');
const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');
const { registerNamespaceDescriptor } = require('../state-dispatcher');

/**
 * Mapping of mutable light attributes to the capacity bit required to send them.
 *
 * Centralizing this table means {@link createLightAbility~set} stays flat rather
 * than repeating the same "is value present AND mode supported?" pattern three times.
 *
 * @type {Array<{option: string, payloadKey: string, mode: number, transform?: Function}>}
 */
const LIGHT_ATTRIBUTES = [
    { option: 'rgb',         payloadKey: 'rgb',         mode: LightMode.MODE_RGB,         transform: rgbToInt },
    { option: 'luminance',   payloadKey: 'luminance',   mode: LightMode.MODE_LUMINANCE },
    { option: 'temperature', payloadKey: 'temperature', mode: LightMode.MODE_TEMPERATURE }
];

/**
 * Resolves the on/off portion of the light payload and, where applicable, fires
 * the toggle command as a side-effect.
 *
 * Toggle/ToggleX devices carry on/off out-of-band so the light payload must omit
 * it; legacy devices need it inlined, falling back to cached state to avoid
 * clobbering the current value on a partial update.
 *
 * @param {Object} device - The device instance
 * @param {number} channel - Target channel index
 * @param {boolean|undefined} on - Desired on/off state, or undefined if not changing
 * @returns {Promise<{ onoff?: number }>} Partial payload fragment
 */
async function resolveOnOff(device, channel, on) {
    const hasToggleSupport = Boolean(
        device.abilities?.['Appliance.Control.ToggleX'] ||
        device.abilities?.['Appliance.Control.Toggle']
    );

    if (hasToggleSupport) {
        if (on !== undefined && device.toggle) {
            await device.toggle.set({ channel, on });
        }
        return {};
    }

    if (on !== undefined) {
        return { onoff: on ? 1 : 0 };
    }

    const current = device._lightStateByChannel.get(channel);
    return current?.isOn !== undefined ? { onoff: current.isOn ? 1 : 0 } : {};
}

/**
 * Builds the capability-gated portion of the light payload by iterating
 * {@link LIGHT_ATTRIBUTES}.
 *
 * Attributes unsupported by the channel's capacity mask are silently skipped so
 * the device never receives a field it cannot honor.
 *
 * @param {Function} supportsMode - Function(mode, channel) → boolean
 * @param {number} channel - Target channel index
 * @param {Object} options - Raw options from the caller
 * @returns {{ rgb?: number, luminance?: number, temperature?: number, capacity?: number }}
 */
function buildAttributePayload(supportsMode, channel, options) {
    const payload = {};
    let capacity = 0;

    for (const { option, payloadKey, mode, transform } of LIGHT_ATTRIBUTES) {
        const value = options[option];
        if (value === undefined || !supportsMode(mode, channel)) {continue;}
        payload[payloadKey] = transform ? transform(value) : value;
        capacity |= mode;
    }

    if (capacity !== 0) {payload.capacity = capacity;}
    return payload;
}

/**
 * Normalizes the `gradual` option to the 0/1 integer the Meross firmware expects.
 *
 * When not specified, gradual defaults to enabled only for RGB changes — matching
 * the original behavior.
 *
 * @param {boolean|number|undefined} gradual - Raw gradual value from options
 * @param {boolean} hasRgb - Whether an RGB change is present in this update
 * @returns {0|1}
 */
function resolveGradual(gradual, hasRgb) {
    if (gradual === undefined) {return hasRgb ? 1 : 0;}
    if (typeof gradual === 'boolean') {return gradual ? 1 : 0;}
    return gradual;
}

/**
 * Creates a light feature object for a device.
 *
 * Provides control over light settings including color, brightness, temperature, and on/off state.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Light feature object with set(), get(), and convenience methods
 */
function createLightAbility(device) {
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
         * @throws {MerossDeviceError} If device is not connected (DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async set(options = {}) {
            const channel = normalizeChannel(options);

            const lightPayload = {
                ...(await resolveOnOff(device, channel, options.on)),
                ...buildAttributePayload(supportsLightMode, channel, options)
            };

            if (Object.keys(lightPayload).length === 0) {return null;}

            lightPayload.channel = channel;
            lightPayload.gradual = resolveGradual(options.gradual, options.rgb !== undefined);

            const { payload: lightResponsePayload } = await device.publishMessage(
                'SET',
                'Appliance.Control.Light',
                { light: lightPayload },
                null
            );
            return lightResponsePayload;
        },

        /**
         * Gets the current light state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<LightState|undefined>} Promise that resolves with light state or undefined
         * @throws {MerossDeviceError} If device is not connected (DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            return getCachedOrFetch(
                device,
                '_lightStateByChannel',
                channel,
                () => device.publishMessage('GET', 'Appliance.Control.Light', {}, null)
            );
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
 * Gets light capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Light capability object or null if not supported
 */
function getLightCapabilities(device, channelIds) {
    if (!device.abilities || !device.abilities['Appliance.Control.Light']) {return null;}

    const lightFeature = device.light;
    if (!lightFeature) {return null;}

    return {
        supported: true,
        channels: channelIds,
        rgb: lightFeature.supportsRgb ? lightFeature.supportsRgb({ channel: 0 }) : false,
        luminance: lightFeature.supportsLuminance ? lightFeature.supportsLuminance({ channel: 0 }) : false,
        temperature: lightFeature.supportsTemperature ? lightFeature.supportsTemperature({ channel: 0 }) : false
    };
}

registerNamespaceDescriptor('Appliance.Control.Light', {
    namespace: 'Appliance.Control.Light',
    payloadKey: 'light',
    stateMap: '_lightStateByChannel',
    StateClass: LightState,
    eventType: 'light',
    snapshot: (s) => ({
        isOn: s.isOn,
        brightness: s.luminance,
        rgb: s.rgbTuple,
        temperature: s.temperature
    }),
    emitValue: (o, n) => buildStateChanges(o, n, ['rgb'])
});

module.exports = createLightAbility;
module.exports.getCapabilities = getLightCapabilities;
