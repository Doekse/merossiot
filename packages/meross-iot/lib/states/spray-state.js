'use strict';

const { SprayModeCodec } = require('../enums');

/**
 * Represents the spray state of a spray/humidifier device channel.
 *
 * @class
 * @example
 * const sprayState = device.getCachedSprayState(0);
 * if (sprayState) {
 *     console.log('Spray mode:', sprayState.mode);
 * }
 */
class SprayState {
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
     * @returns {'off'|'continuous'|'intermittent'|undefined}
     */
    get mode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        return SprayModeCodec.fromWire(mode);
    }
}

module.exports = SprayState;
