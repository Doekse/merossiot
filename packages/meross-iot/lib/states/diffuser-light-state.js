'use strict';

const { DiffuserLightModeCodec } = require('../enums');
const { intToRgb } = require('../utilities/conversion');

/**
 * Represents the light state of a diffuser device channel.
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
     * @param {Object} [state=null] - Initial state object (wire-format numbers)
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            Object.assign(this._state, state);
        }
    }

    /**
     * @returns {boolean|undefined} True if on, false if off, undefined if state not available
     */
    get isOn() {
        const { onoff } = this._state;
        if (onoff === undefined || onoff === null) {return undefined;}
        return onoff === 1;
    }

    /**
     * @returns {'rotating-colors'|'fixed-rgb'|'fixed-luminance'|undefined}
     */
    get mode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        return DiffuserLightModeCodec.fromWire(mode);
    }

    /**
     * @returns {Array<number>|undefined} RGB tuple [r, g, b] where each value is 0-255
     */
    get rgbTuple() {
        const { rgb } = this._state;
        if (rgb === undefined || rgb === null) {return undefined;}
        return intToRgb(rgb);
    }

    /**
     * @returns {number|undefined} Brightness value (0-100) or undefined if not available
     */
    get luminance() {
        const { luminance } = this._state;
        if (luminance === undefined || luminance === null) {return undefined;}
        return luminance;
    }
}

module.exports = DiffuserLightState;
