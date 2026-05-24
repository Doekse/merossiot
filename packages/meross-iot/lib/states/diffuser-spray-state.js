'use strict';

const { DiffuserSprayModeCodec } = require('../enums');

/**
 * Represents the spray state of a diffuser device channel.
 *
 * @class
 * @example
 * const diffuserSprayState = device.getCachedDiffuserSprayState(0);
 * if (diffuserSprayState) {
 *     console.log('Spray mode:', diffuserSprayState.mode);
 * }
 */
class DiffuserSprayState {
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
     * @returns {'light'|'strong'|'off'|undefined}
     */
    get mode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        return DiffuserSprayModeCodec.fromWire(mode);
    }
}

module.exports = DiffuserSprayState;
