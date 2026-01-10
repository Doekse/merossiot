'use strict';

const { intToRgb } = require('../../utilities/conversion');

/**
 * Represents the light state of a diffuser device channel.
 *
 * Encapsulates state information for diffuser light devices, including color, brightness,
 * mode, and on/off state. State instances are managed by device controllers and updated
 * automatically when device responses or push notifications are received.
 *
 * @class
 * @example
 * const diffuserLightState = device.getCachedDiffuserLightState(0);
 * if (diffuserLightState) {
 *     console.log('Light is on:', diffuserLightState.isOn);
 *     console.log('Mode:', diffuserLightState.mode);
 *     console.log('RGB color:', diffuserLightState.rgbTuple);
 *     console.log('Brightness:', diffuserLightState.luminance);
 * }
 */
class DiffuserLightState {
    /**
     * Creates a new DiffuserLightState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {number} [state.onoff] - On/off state (0=off, 1=on)
     * @param {number} [state.mode] - Light mode (from DiffuserLightMode enum: ROTATING_COLORS=0, FIXED_RGB=1, FIXED_LUMINANCE=2)
     * @param {number} [state.rgb] - RGB color as integer
     * @param {number} [state.luminance] - Brightness value (0-100)
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
     * Gets the light mode.
     *
     * @returns {number|undefined} Light mode value (0=rotating colors, 1=fixed RGB, 2=fixed luminance) or undefined if not available
     * @see {@link module:lib/enums.DiffuserLightMode} for mode constants
     */
    get mode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        return mode;
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
}

module.exports = DiffuserLightState;

