'use strict';

/**
 * Represents the spray state of a diffuser device channel.
 *
 * Encapsulates state information for diffuser spray/mist functionality. State instances
 * are managed by device controllers and updated automatically when device responses or
 * push notifications are received.
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
     * Creates a new DiffuserSprayState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {number} [state.mode] - Spray mode (from DiffuserSprayMode enum: LIGHT=0, STRONG=1, OFF=2)
     * @param {number} [state.channel] - Channel number
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
     * Gets the spray mode.
     *
     * @returns {number|undefined} Spray mode value (0=light, 1=strong, 2=off) or undefined if not available
     * @see {@link module:lib/enums.DiffuserSprayMode} for mode constants
     */
    get mode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        return mode;
    }
}

module.exports = DiffuserSprayState;

