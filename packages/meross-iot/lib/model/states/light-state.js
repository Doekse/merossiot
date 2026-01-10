'use strict';

const { intToRgb } = require('../../utilities/conversion');

/**
 * Represents the light state of a device channel.
 *
 * Encapsulates state information for light devices, including color, brightness,
 * temperature, and on/off state. State instances are managed by device controllers
 * and updated automatically when device responses or push notifications are received.
 *
 * @class
 * @example
 * const lightState = device.getCachedLightState(0);
 * if (lightState) {
 *     console.log('Light is on:', lightState.isOn);
 *     console.log('RGB color:', lightState.rgbTuple);
 *     console.log('Brightness:', lightState.luminance);
 * }
 */
class LightState {
    /**
     * Creates a new LightState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {number} [state.onoff] - On/off state (0=off, 1=on)
     * @param {number} [state.channel] - Channel number
     * @param {number} [state.rgb] - RGB color as integer
     * @param {number} [state.luminance] - Brightness value (0-100)
     * @param {number} [state.temperature] - Color temperature value
     * @param {number} [state.capacity] - Light mode/capacity flags
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * Updates the state with new data.
     *
     * Merges new state data into the existing state using Object.assign to preserve
     * properties not included in the update. Called automatically by device controllers
     * when state updates are received from device responses or push notifications.
     *
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            Object.assign(this._state, state);
        }
    }

    /**
     * Gets whether the light is on.
     *
     * Converts the device's numeric on/off state (0 or 1) to a boolean for easier
     * conditional logic in application code.
     *
     * @returns {boolean|undefined} True if on, false if off, undefined if state not available
     */
    get isOn() {
        const { onoff } = this._state;
        if (onoff === undefined || onoff === null) {return undefined;}
        return onoff === 1;
    }

    /**
     * Gets the RGB color as a tuple [r, g, b].
     *
     * The device stores RGB as a single integer value. This getter converts it to
     * a tuple format for easier color manipulation and integration with graphics
     * libraries that expect separate R, G, B components.
     *
     * @returns {Array<number>|undefined} RGB tuple [r, g, b] where each value is 0-255, or undefined if not available
     */
    get rgbTuple() {
        const { rgb } = this._state;
        if (rgb === undefined || rgb === null) {return undefined;}
        return intToRgb(rgb);
    }

    /**
     * Gets the RGB color as an integer.
     *
     * Returns the raw RGB value as stored by the device. Use this when you need
     * the exact format used in device communication protocols.
     *
     * @returns {number|undefined} RGB color as integer or undefined if not available
     */
    get rgbInt() {
        const { rgb } = this._state;
        if (rgb === undefined || rgb === null) {return undefined;}
        return rgb;
    }

    /**
     * Gets the brightness/luminance value.
     *
     * @returns {number|undefined} Brightness value (0-100) or undefined if not available
     */
    get luminance() {
        const { luminance } = this._state;
        if (luminance === undefined || luminance === null) {return undefined;}
        return luminance;
    }

    /**
     * Gets the color temperature value.
     *
     * @returns {number|undefined} Temperature value or undefined if not available
     */
    get temperature() {
        const { temperature } = this._state;
        if (temperature === undefined || temperature === null) {return undefined;}
        return temperature;
    }

    /**
     * Gets the light mode/capacity flags.
     *
     * Capacity is a bitmask indicating which light modes the device supports
     * (RGB, luminance, temperature). Use bitwise operations to check for specific
     * capabilities.
     *
     * @returns {number|undefined} Capacity flags or undefined if not available
     */
    get capacity() {
        const { capacity } = this._state;
        if (capacity === undefined || capacity === null) {return undefined;}
        return capacity;
    }
}

module.exports = LightState;

