'use strict';

const DiffuserLightState = require('../../model/states/diffuser-light-state');
const DiffuserSprayState = require('../../model/states/diffuser-spray-state');
const { DiffuserLightMode, DiffuserSprayMode } = require('../../model/enums');
const { buildStateChanges } = require('../../utilities/state-changes');
const { MerossErrorValidation } = require('../../model/exception');

/**
 * Diffuser feature module.
 * Provides control over diffuser light and spray functionality for essential oil diffusers.
 */
module.exports = {
    /**
     * Controls the diffuser light settings.
     *
     * Automatically includes the device UUID in the light configuration object.
     *
     * @param {Object} options - Diffuser light options
     * @param {Object} options.light - Light configuration object
     * @param {number} [options.light.channel] - Channel to control (default: 0)
     * @param {number} [options.light.onoff] - Turn light on (1) or off (0)
     * @param {number} [options.light.mode] - Light mode (use DiffuserLightMode enum)
     * @param {number} [options.light.luminance] - Brightness value
     * @param {number} [options.light.rgb] - RGB color value
     * @returns {Promise<Object>} Response from the device containing the updated light state
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setDiffuserLight(options = {}) {
        if (!options.light) {
            throw new MerossErrorValidation('light is required', 'light');
        }
        const light = { ...options.light };
        light.uuid = this.uuid;
        const payload = { 'light': [light] };
        const response = await this.publishMessage('SET', 'Appliance.Control.Diffuser.Light', payload);

        if (response && response.light) {
            this._updateDiffuserLightState(response.light);
            this.lastFullUpdateTimestamp = Date.now();
        } else if (light) {
            this._updateDiffuserLightState([light]);
            this.lastFullUpdateTimestamp = Date.now();
        }

        return response;
    },

    /**
     * Controls the diffuser spray mode.
     *
     * Automatically includes the device UUID in the spray configuration.
     *
     * @param {Object} options - Diffuser spray options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @param {number|import('../lib/enums').DiffuserSprayMode} options.mode - Spray mode value or DiffuserSprayMode enum
     * @returns {Promise<Object>} Response from the device containing the updated spray state
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setDiffuserSpray(options = {}) {
        const { normalizeChannel } = require('../../utilities/options');
        if (options.mode === undefined) {
            throw new MerossErrorValidation('mode is required', 'mode');
        }
        const channel = normalizeChannel(options);
        const payload = { 'spray': [{ channel, 'mode': options.mode || 0, 'uuid': this.uuid }] };
        const response = await this.publishMessage('SET', 'Appliance.Control.Diffuser.Spray', payload);

        if (response && response.spray) {
            this._updateDiffuserSprayState(response.spray, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        } else {
            this._updateDiffuserSprayState([{ channel, mode: options.mode || 0 }], 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }

        return response;
    },

    /**
     * Gets the current diffuser light state from the device.
     *
     * Use {@link getCachedDiffuserLightState} to get cached state without making a request.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing light state with `light` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getDiffuserLightState(_options = {}) {
        const response = await this.publishMessage('GET', 'Appliance.Control.Diffuser.Light', {});
        if (response && response.light) {
            this._updateDiffuserLightState(response.light, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the current diffuser spray state from the device.
     *
     * Use {@link getCachedDiffuserSprayState} to get cached state without making a request.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing spray state with `spray` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getDiffuserSprayState(_options = {}) {
        const response = await this.publishMessage('GET', 'Appliance.Control.Diffuser.Spray', {});
        if (response && response.spray) {
            this._updateDiffuserSprayState(response.spray, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the cached diffuser light state for the specified channel.
     *
     * Returns cached state without making a request. Use {@link getDiffuserLightState} to fetch
     * fresh state from the device. State is automatically updated when commands are sent or
     * push notifications are received.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/model/states/diffuser-light-state').DiffuserLightState|undefined} Cached light state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedDiffuserLightState(channel = 0) {
        this.validateState();
        return this._diffuserLightStateByChannel.get(channel);
    },

    /**
     * Gets the diffuser light mode for the specified channel (cached).
     *
     * Returns the light mode enum from cached state. Use {@link getRawDiffuserLightMode} to get
     * the raw numeric value.
     *
     * @param {number} [channel=0] - Channel to get mode for (default: 0)
     * @returns {import('../lib/enums').DiffuserLightMode|undefined} DiffuserLightMode enum object (e.g., DiffuserLightMode.FIXED_RGB) or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see getRawDiffuserLightMode
     */
    getDiffuserLightMode(channel = 0) {
        this.validateState();
        const lightState = this._diffuserLightStateByChannel.get(channel);
        if (lightState && lightState.mode !== undefined && lightState.mode !== null) {
            const enumKey = Object.keys(DiffuserLightMode).find(key => DiffuserLightMode[key] === lightState.mode);
            return enumKey ? DiffuserLightMode[enumKey] : undefined;
        }
        return undefined;
    },

    /**
     * Gets the raw numeric diffuser light mode value for the specified channel (cached).
     *
     * Returns the raw numeric mode value. For enum object, use {@link getDiffuserLightMode} instead.
     *
     * @param {number} [channel=0] - Channel to get mode for (default: 0)
     * @returns {number|undefined} Raw numeric mode value or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see getDiffuserLightMode
     */
    getRawDiffuserLightMode(channel = 0) {
        this.validateState();
        const lightState = this._diffuserLightStateByChannel.get(channel);
        if (lightState) {
            return lightState.mode;
        }
        return undefined;
    },

    /**
     * Gets the diffuser light brightness for the specified channel (cached).
     *
     * @param {number} [channel=0] - Channel to get brightness for (default: 0)
     * @returns {number|undefined} Brightness value (0-100) or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getDiffuserLightBrightness(channel = 0) {
        this.validateState();
        const lightState = this._diffuserLightStateByChannel.get(channel);
        if (lightState) {
            return lightState.luminance;
        }
        return undefined;
    },

    /**
     * Gets the diffuser light RGB color for the specified channel (cached).
     *
     * @param {number} [channel=0] - Channel to get color for (default: 0)
     * @returns {Array<number>|undefined} RGB tuple [r, g, b] where each value is 0-255, or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getDiffuserLightRgbColor(channel = 0) {
        this.validateState();
        const lightState = this._diffuserLightStateByChannel.get(channel);
        if (lightState) {
            return lightState.rgbTuple;
        }
        return undefined;
    },

    /**
     * Checks if the diffuser light is on for the specified channel (cached).
     *
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean|undefined} True if on, false if off, undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getDiffuserLightIsOn(channel = 0) {
        this.validateState();
        const lightState = this._diffuserLightStateByChannel.get(channel);
        if (lightState) {
            return lightState.isOn;
        }
        return undefined;
    },

    /**
     * Gets the cached diffuser spray state for the specified channel.
     *
     * Returns cached state without making a request. Use {@link getDiffuserSprayState} to fetch
     * fresh state from the device. State is automatically updated when commands are sent or
     * push notifications are received.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/model/states/diffuser-spray-state').DiffuserSprayState|undefined} Cached spray state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedDiffuserSprayState(channel = 0) {
        this.validateState();
        return this._diffuserSprayStateByChannel.get(channel);
    },

    /**
     * Gets the diffuser spray mode for the specified channel (cached).
     *
     * Returns the spray mode enum from cached state. Use {@link getRawDiffuserSprayMode} to get
     * the raw numeric value.
     *
     * @param {number} [channel=0] - Channel to get mode for (default: 0)
     * @returns {import('../lib/enums').DiffuserSprayMode|undefined} DiffuserSprayMode enum object (e.g., DiffuserSprayMode.LIGHT) or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see getRawDiffuserSprayMode
     */
    getDiffuserSprayMode(channel = 0) {
        this.validateState();
        const sprayState = this._diffuserSprayStateByChannel.get(channel);
        if (sprayState && sprayState.mode !== undefined && sprayState.mode !== null) {
            const enumKey = Object.keys(DiffuserSprayMode).find(key => DiffuserSprayMode[key] === sprayState.mode);
            return enumKey ? DiffuserSprayMode[enumKey] : undefined;
        }
        return undefined;
    },

    /**
     * Gets the raw numeric diffuser spray mode value for the specified channel (cached).
     *
     * Returns the raw numeric mode value. For enum object, use {@link getDiffuserSprayMode} instead.
     *
     * @param {number} [channel=0] - Channel to get mode for (default: 0)
     * @returns {number|undefined} Raw numeric mode value or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see getDiffuserSprayMode
     */
    getRawDiffuserSprayMode(channel = 0) {
        this.validateState();
        const sprayState = this._diffuserSprayStateByChannel.get(channel);
        if (sprayState) {
            return sprayState.mode;
        }
        return undefined;
    },

    /**
     * Updates the cached diffuser light state from light data.
     *
     * Called automatically when diffuser light push notifications are received or commands complete.
     * Handles both single objects and arrays of light data.
     *
     * @param {Object|Array} lightData - Light data (single object or array)
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateDiffuserLightState(lightData, source = 'response') {
        if (!lightData) {return;}

        const lightArray = Array.isArray(lightData) ? lightData : [lightData];

        for (const lightItem of lightArray) {
            const channelIndex = lightItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            const oldState = this._diffuserLightStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                isOn: oldState.isOn,
                brightness: oldState.luminance,
                rgb: oldState.rgbTuple,
                mode: oldState.mode
            } : undefined;

            let state = this._diffuserLightStateByChannel.get(channelIndex);
            if (!state) {
                state = new DiffuserLightState(lightItem);
                this._diffuserLightStateByChannel.set(channelIndex, state);
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
                this.emit('stateChange', {
                    type: 'diffuserLight',
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
     * Updates the cached diffuser spray state from spray data.
     *
     * Called automatically when diffuser spray push notifications are received or commands complete.
     * Handles both single objects and arrays of spray data.
     *
     * @param {Object|Array} sprayData - Spray data (single object or array)
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateDiffuserSprayState(sprayData, source = 'response') {
        if (!sprayData) {return;}

        const sprayArray = Array.isArray(sprayData) ? sprayData : [sprayData];

        for (const sprayItem of sprayArray) {
            const channelIndex = sprayItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            const oldState = this._diffuserSprayStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                mode: oldState.mode
            } : undefined;

            let state = this._diffuserSprayStateByChannel.get(channelIndex);
            if (!state) {
                state = new DiffuserSprayState(sprayItem);
                this._diffuserSprayStateByChannel.set(channelIndex, state);
            } else {
                state.update(sprayItem);
            }

            const newValue = buildStateChanges(oldValue, {
                mode: state.mode
            });

            if (Object.keys(newValue).length > 0) {
                this.emit('stateChange', {
                    type: 'diffuserSpray',
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
     * Gets the diffuser sensor data (humidity and temperature) from the device.
     *
     * @returns {Promise<Object>} Response containing sensor data with humidity and temperature
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getDiffuserSensor(_options = {}) {
        return await this.publishMessage('GET', 'Appliance.Control.Diffuser.Sensor', {});
    },

    /**
     * Controls the diffuser sensor configuration.
     *
     * Note: This namespace primarily supports GET and PUSH. SET may not be available for all devices.
     *
     * @param {Object} sensorData - Sensor data object
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setDiffuserSensor(options = {}) {
        if (!options.sensorData) {
            throw new MerossErrorValidation('sensorData is required', 'sensorData');
        }
        const sensorData = options.sensorData;
        const payload = sensorData;
        return await this.publishMessage('SET', 'Appliance.Control.Diffuser.Sensor', payload);
    }
};

