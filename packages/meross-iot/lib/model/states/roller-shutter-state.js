'use strict';

/**
 * Represents the state of a roller shutter device channel.
 *
 * Encapsulates state information for roller shutter devices, including position
 * and movement status. State instances are managed by device controllers and
 * updated automatically when device responses or push notifications are received.
 *
 * @class
 * @example
 * const rollerShutterState = device.getCachedRollerShutterState(0);
 * if (rollerShutterState) {
 *     console.log('Position:', rollerShutterState.position);
 *     console.log('Status:', rollerShutterState.state);
 * }
 */
class RollerShutterState {
    /**
     * Creates a new RollerShutterState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {number} [state.state] - Movement status (from RollerShutterStatus enum: IDLE=0, OPENING=1, CLOSING=2, UNKNOWN=-1)
     * @param {number} [state.position] - Position value (0-100, where 0=closed, 100=open)
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
     * Gets the movement status.
     *
     * @returns {number|undefined} Status value (0=idle, 1=opening, 2=closing, -1=unknown) or undefined if not available
     * @see {@link module:lib/enums.RollerShutterStatus} for status constants
     */
    get state() {
        const { state } = this._state;
        if (state === undefined || state === null) {return undefined;}
        return state;
    }

    /**
     * Gets the current position.
     *
     * @returns {number|undefined} Position value (0-100, where 0=fully closed, 100=fully open) or undefined if not available
     */
    get position() {
        const { position } = this._state;
        if (position === undefined || position === null) {return undefined;}
        return position;
    }

    /**
     * Gets the channel number.
     *
     * @returns {number|undefined} Channel number or undefined if not available
     */
    get channel() {
        const { channel } = this._state;
        if (channel === undefined || channel === null) {return undefined;}
        return channel;
    }
}

module.exports = RollerShutterState;

