'use strict';

/**
 * Represents the state of a garage door device channel.
 *
 * Encapsulates state information for garage door opener devices. State instances are
 * managed by device controllers and updated automatically when device responses or
 * push notifications are received.
 *
 * @class
 * @example
 * const garageDoorState = device.getCachedGarageDoorState(0);
 * if (garageDoorState) {
 *     console.log('Garage door is open:', garageDoorState.isOpen);
 * }
 */
class GarageDoorState {
    /**
     * Creates a new GarageDoorState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {number} [state.open] - Open/closed state (0=closed, 1=open)
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
     * Gets whether the garage door is open.
     *
     * Converts the device's numeric open/closed state (0 or 1) to a boolean for easier
     * conditional logic in application code.
     *
     * @returns {boolean|undefined} True if open, false if closed, undefined if state not available
     */
    get isOpen() {
        const { open } = this._state;
        if (open === undefined || open === null) {return undefined;}
        return open === 1;
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

module.exports = GarageDoorState;

