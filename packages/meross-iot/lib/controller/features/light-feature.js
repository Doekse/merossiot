'use strict';

const LightState = require('../../model/states/light-state');
const { LightMode } = require('../../model/enums');
const { rgbToInt } = require('../../utilities/conversion');
const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');

/**
 * Light feature module.
 * Provides control over light settings including color, brightness, temperature, and on/off state.
 */
module.exports = {
    /**
     * Controls the light settings.
     *
     * @param {Object} options - Light options
     * @param {Object} options.light - Light configuration object
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setLight(options = {}) {
        if (!options.light) {
            throw new Error('light configuration object is required');
        }
        const payload = { light: options.light };
        const response = await this.publishMessage('SET', 'Appliance.Control.Light', payload, null);

        if (response && response.light) {
            this._updateLightState(response.light, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        } else if (options.light) {
            this._updateLightState(options.light, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }

        return response;
    },

    /**
     * Gets the current light state from the device.
     *
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing light state
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getLightState(_options = {}) {
        const response = await this.publishMessage('GET', 'Appliance.Control.Light', {}, null);
        if (response && response.light) {
            this._updateLightState(response.light, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the cached light state for the specified channel.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {Object|undefined} Cached light state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedLightState(channel = 0) {
        this.validateState();
        return this._lightStateByChannel.get(channel);
    },

    /**
     * Checks if the light is on for the specified channel.
     *
     * For devices that support ToggleX and Toggle abilities, the onoff state is not exposed
     * in the light status. In that case, we return the toggle state.
     *
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean|undefined} True if on, false if off, undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getLightIsOn(channel = 0) {
        this.validateState();
        if (this.abilities) {
            const hasToggleX = this.abilities['Appliance.Control.ToggleX'];
            const hasToggle = this.abilities['Appliance.Control.Toggle'];
            if (hasToggleX || hasToggle) {
                if (typeof this.isOn === 'function') {
                    return this.isOn(channel);
                }
            }
        }
        const lightState = this._lightStateByChannel.get(channel);
        if (lightState) {
            return lightState.isOn;
        }
        return undefined;
    },

    /**
     * Gets the light RGB color for the specified channel.
     *
     * @param {number} [channel=0] - Channel to get color for (default: 0)
     * @returns {Array<number>|undefined} RGB tuple [r, g, b] or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getLightRgbColor(channel = 0) {
        this.validateState();
        const lightState = this._lightStateByChannel.get(channel);
        if (lightState) {
            return lightState.rgbTuple;
        }
        return undefined;
    },

    /**
     * Gets the light brightness for the specified channel.
     *
     * @param {number} [channel=0] - Channel to get brightness for (default: 0)
     * @returns {number|undefined} Brightness value or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getLightBrightness(channel = 0) {
        this.validateState();
        const lightState = this._lightStateByChannel.get(channel);
        if (lightState) {
            return lightState.luminance;
        }
        return undefined;
    },

    /**
     * Gets the light temperature for the specified channel.
     *
     * @param {number} [channel=0] - Channel to get temperature for (default: 0)
     * @returns {number|undefined} Temperature value or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getLightTemperature(channel = 0) {
        this.validateState();
        const lightState = this._lightStateByChannel.get(channel);
        if (lightState) {
            return lightState.temperature;
        }
        return undefined;
    },

    /**
     * Gets the light mode (capacity) for the specified channel.
     *
     * @param {number} [channel=0] - Channel to get mode for (default: 0)
     * @returns {number|undefined} Light mode/capacity or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getLightMode(channel = 0) {
        this.validateState();
        const lightState = this._lightStateByChannel.get(channel);
        if (lightState) {
            return lightState.capacity;
        }
        return undefined;
    },

    /**
     * Checks if the light supports RGB mode for the specified channel.
     *
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean} True if RGB is supported
     */
    getSupportsRgb(channel = 0) {
        return this._supportsLightMode(LightMode.MODE_RGB, channel);
    },

    /**
     * Checks if the light supports luminance mode for the specified channel.
     *
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean} True if luminance is supported
     */
    getSupportsLuminance(channel = 0) {
        return this._supportsLightMode(LightMode.MODE_LUMINANCE, channel);
    },

    /**
     * Checks if the light supports temperature mode for the specified channel.
     *
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean} True if temperature is supported
     */
    getSupportsTemperature(channel = 0) {
        return this._supportsLightMode(LightMode.MODE_TEMPERATURE, channel);
    },

    /**
     * Turns on the light for the specified channel.
     *
     * Automatically selects the appropriate control method (ToggleX/Toggle or Light) based on
     * device capabilities.
     *
     * @param {Object} [options={}] - Turn on options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async turnOn(options = {}) {
        if (this.abilities) {
            const hasToggleX = this.abilities['Appliance.Control.ToggleX'];
            const hasToggle = this.abilities['Appliance.Control.Toggle'];

            if (hasToggleX && typeof this.setToggleX === 'function') {
                return await this.setToggleX({ ...options, onoff: true });
            } else if (hasToggle && typeof this.setToggle === 'function') {
                return await this.setToggle({ onoff: true });
            }
        }

        return await this.setLightColor({ ...options, onoff: true });
    },

    /**
     * Turns off the light for the specified channel.
     *
     * Automatically selects the appropriate control method (ToggleX/Toggle or Light) based on
     * device capabilities.
     *
     * @param {Object} [options={}] - Turn off options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async turnOff(options = {}) {
        if (this.abilities) {
            const hasToggleX = this.abilities['Appliance.Control.ToggleX'];
            const hasToggle = this.abilities['Appliance.Control.Toggle'];

            if (hasToggleX && typeof this.setToggleX === 'function') {
                return await this.setToggleX({ ...options, onoff: false });
            } else if (hasToggle && typeof this.setToggle === 'function') {
                return await this.setToggle({ onoff: false });
            }
        }

        return await this.setLightColor({ ...options, onoff: false });
    },

    /**
     * Controls the light color, brightness, and temperature.
     *
     * Allows setting multiple light properties in a single call. If ToggleX or Toggle is
     * supported, uses those for on/off control; otherwise includes onoff in the light payload.
     *
     * @param {Object} [options={}] - Light control options
     * @param {number} [options.channel] - Channel to control (default: 0)
     * @param {boolean} [options.onoff] - Turn on/off
     * @param {Array<number>|number} [options.rgb] - RGB color [r, g, b] or integer
     * @param {number} [options.luminance] - Brightness value
     * @param {number} [options.temperature] - Temperature value
     * @param {boolean|number} [options.gradual] - Enable gradual transition (default: true for RGB, false otherwise)
     * @returns {Promise<Object|null>} Response from the device or null if no changes needed
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setLightColor(options = {}) {
        const channel = normalizeChannel(options);
        const { onoff, rgb, luminance, temperature, gradual } = options;

        const currentIsOn = this.getLightIsOn(channel);
        const hasToggleX = this.abilities && this.abilities['Appliance.Control.ToggleX'];
        const hasToggle = this.abilities && this.abilities['Appliance.Control.Toggle'];
        const hasToggleSupport = hasToggleX || hasToggle;

        if (hasToggleSupport && onoff === false && currentIsOn !== false) {
            if (hasToggleX && typeof this.setToggleX === 'function') {
                await this.setToggleX({ channel, onoff: false });
            } else if (hasToggle && typeof this.setToggle === 'function') {
                await this.setToggle({ onoff: false });
            }
        }

        const lightPayload = {};

        if (!hasToggleSupport) {
            if (onoff !== undefined) {
                lightPayload.onoff = onoff ? 1 : 0;
            } else if (currentIsOn !== undefined) {
                lightPayload.onoff = currentIsOn ? 1 : 0;
            }
        }

        if (rgb !== undefined && this._supportsLightMode(LightMode.MODE_RGB, channel)) {
            lightPayload.rgb = rgbToInt(rgb);
            lightPayload.capacity = (lightPayload.capacity || 0) | LightMode.MODE_RGB;
        }

        if (luminance !== undefined && this._supportsLightMode(LightMode.MODE_LUMINANCE, channel)) {
            lightPayload.luminance = luminance;
            lightPayload.capacity = (lightPayload.capacity || 0) | LightMode.MODE_LUMINANCE;
        }

        if (temperature !== undefined && this._supportsLightMode(LightMode.MODE_TEMPERATURE, channel)) {
            lightPayload.temperature = temperature;
            lightPayload.capacity = (lightPayload.capacity || 0) | LightMode.MODE_TEMPERATURE;
        }

        if (Object.keys(lightPayload).length === 0) {
            return null;
        }

        lightPayload.channel = channel;

        // Handle gradual transition parameter
        if (gradual !== undefined) {
            // Allow both boolean and number (0/1) for convenience
            lightPayload.gradual = typeof gradual === 'boolean' ? (gradual ? 1 : 0) : gradual;
        } else if (rgb !== undefined) {
            // Default to gradual for RGB changes (matches app behavior)
            lightPayload.gradual = 1;
        } else {
            // Default to instant for non-RGB changes
            lightPayload.gradual = 0;
        }

        const payload = { light: lightPayload };
        const response = await this.publishMessage('SET', 'Appliance.Control.Light', payload, null);

        if (response && response.light) {
            this._updateLightState(response.light, 'response');
        } else {
            this._updateLightState(lightPayload, 'response');
        }

        return response;
    },

    /**
     * Checks if the device supports a specific light mode for the given channel.
     *
     * @param {number} mode - Light mode to check (from LightMode enum)
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean} True if the mode is supported
     * @private
     */
    _supportsLightMode(mode) {
        if (!this.abilities) {return false;}

        const lightAbility = this.abilities['Appliance.Control.Light'];
        if (!lightAbility || !lightAbility.capacity) {return false;}

        const { capacity } = lightAbility;
        return (capacity & mode) === mode;
    },

    /**
     * Updates the cached light state from light data.
     *
     * Called automatically when light push notifications are received or commands complete.
     * Handles both single objects and arrays of light data.
     *
     * @param {Object|Array} lightData - Light data (single object or array)
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateLightState(lightData, source = 'response') {
        if (!lightData) {return;}

        const lightArray = Array.isArray(lightData) ? lightData : [lightData];

        for (const lightItem of lightArray) {
            const channelIndex = lightItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            const oldState = this._lightStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                isOn: oldState.isOn,
                brightness: oldState.luminance,
                rgb: oldState.rgbTuple,
                temperature: oldState.temperature
            } : undefined;

            let state = this._lightStateByChannel.get(channelIndex);
            if (!state) {
                state = new LightState(lightItem);
                this._lightStateByChannel.set(channelIndex, state);
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
                this.emit('stateChange', {
                    type: 'light',
                    channel: channelIndex,
                    value: newValue,
                    oldValue,
                    source,
                    timestamp: Date.now()
                });
            }
        }
    }
};

