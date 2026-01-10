'use strict';

/**
 * Represents the spray state of a spray/humidifier device channel.
 *
 * Encapsulates state information for spray/humidifier devices. State instances are
 * managed by device controllers and updated automatically when device responses or
 * push notifications are received.
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
     * Creates a new SprayState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {number} [state.mode] - Spray mode (from SprayMode enum: OFF=0, CONTINUOUS=1, INTERMITTENT=2)
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
     * @returns {number|undefined} Spray mode value (0=off, 1=continuous, 2=intermittent) or undefined if not available
     * @see {@link module:lib/enums.SprayMode} for mode constants
     */
    get mode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        return mode;
    }
}

module.exports = SprayState;

