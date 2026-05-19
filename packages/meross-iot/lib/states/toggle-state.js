'use strict';

/**
 * Represents the toggle (on/off) state of a device channel.
 *
 * Encapsulates state information for toggle devices (smart plugs, switches, etc.).
 * State instances are managed by device controllers and updated automatically when
 * device responses or push notifications are received.
 *
 * @class
 * @example
 * const toggleState = await device.toggle.get({ channel: 0 });
 * if (toggleState && toggleState.isOn) {
 *     console.log('Device is on');
 * }
 */
class ToggleState {
    /**
     * Creates a new ToggleState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {number} [state.onoff] - On/off state (0=off, 1=on)
     * @param {number} [state.channel] - Channel number
     * @param {number} [state.lmTime] - Last modified timestamp
     * @param {number} [state.entity] - Entity identifier
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * Updates the state with new data
     *
     * Merges new state data into the existing state. Called automatically by the device
     * when state updates are received.
     *
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            Object.assign(this._state, state);
        }
    }

    /**
     * Gets whether the device is on (as boolean)
     *
     * @returns {boolean|undefined} True if on, false if off, undefined if state not available
     */
    get isOn() {
        const { onoff } = this._state;
        if (onoff === undefined || onoff === null) {return undefined;}
        return onoff === 1;
    }

    /**
     * Gets the raw on/off state value.
     *
     * Returns the numeric on/off state as stored by the device. Use this when you
     * need the exact format used in device communication protocols.
     *
     * @returns {number|undefined} 0 if off, 1 if on, undefined if not available
     */
    get onoff() {
        const { onoff } = this._state;
        if (onoff === undefined || onoff === null) {return undefined;}
        return onoff;
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

    /**
     * Gets the last modified timestamp.
     *
     * @returns {number|undefined} Timestamp or undefined if not available
     */
    get lmTime() {
        const { lmTime } = this._state;
        if (lmTime === undefined || lmTime === null) {return undefined;}
        return lmTime;
    }

    /**
     * Gets the entity identifier.
     *
     * @returns {number|undefined} Entity ID or undefined if not available
     */
    get entity() {
        const { entity } = this._state;
        if (entity === undefined || entity === null) {return undefined;}
        return entity;
    }
}

module.exports = ToggleState;

