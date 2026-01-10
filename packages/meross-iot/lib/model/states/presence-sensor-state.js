'use strict';

const { PresenceState } = require('../enums');

/**
 * Represents the presence sensor state of a device channel.
 *
 * Encapsulates state information for presence sensor devices, including presence
 * detection status, distance, and light/illuminance readings. State instances are
 * managed by device controllers and updated automatically when device responses or
 * push notifications are received.
 *
 * @class
 * @example
 * const presenceState = device.getCachedPresenceSensorState(0);
 * if (presenceState) {
 *     console.log('Is present:', presenceState.isPresent);
 *     console.log('Distance:', presenceState.distanceMeters, 'm');
 *     console.log('Light:', presenceState.lightLux, 'lux');
 * }
 */
class PresenceSensorState {
    /**
     * Creates a new PresenceSensorState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {Object} [state.presence] - Presence detection data
     * @param {number} [state.presence.value] - Presence value (from PresenceState enum)
     * @param {number} [state.presence.distance] - Distance in millimeters
     * @param {number} [state.presence.timestamp] - Timestamp in seconds
     * @param {number} [state.presence.times] - Times value
     * @param {Object} [state.light] - Light/illuminance data
     * @param {number} [state.light.value] - Light value in lux
     * @param {number} [state.light.timestamp] - Timestamp in seconds
     * @param {number} [state.channel] - Channel number
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * Updates the state with new data.
     *
     * Merges new state data into the existing state. Presence and light objects are
     * deep-merged using spread operators to preserve existing nested properties that
     * aren't included in the update. Called automatically by device controllers when
     * state updates are received from device responses or push notifications.
     *
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            if (state.presence) {
                this._state.presence = { ...(this._state.presence || {}), ...state.presence };
            }
            if (state.light) {
                this._state.light = { ...(this._state.light || {}), ...state.light };
            }
            const { presence: _presence, light: _light, ...otherProps } = state;
            Object.assign(this._state, otherProps);
        }
    }

    /**
     * Gets whether presence is currently detected.
     *
     * Converts the device's presence state enum value to a boolean for easier
     * conditional logic in application code.
     *
     * @returns {boolean|undefined} True if presence detected, false if absence detected, undefined if no data
     */
    get isPresent() {
        const { presence } = this._state;
        if (!presence || presence.value === undefined || presence.value === null) {
            return undefined;
        }
        return presence.value === PresenceState.PRESENCE;
    }

    /**
     * Gets the presence state value.
     *
     * Returns the raw presence state value from the PresenceState enum. Use this
     * when you need the exact enum value rather than a boolean conversion.
     *
     * @returns {number|undefined} PresenceState.PRESENCE (2) or PresenceState.ABSENCE (1), undefined if no data
     */
    get presenceValue() {
        const { presence } = this._state;
        if (!presence || presence.value === undefined || presence.value === null) {
            return undefined;
        }
        return presence.value;
    }

    /**
     * Gets the presence state as a string.
     *
     * Converts the boolean presence state to a human-readable string. Useful for
     * logging and display purposes.
     *
     * @returns {string|undefined} 'presence' or 'absence', undefined if no data
     */
    get presenceState() {
        const { isPresent } = this;
        if (isPresent === undefined) {return undefined;}
        return isPresent ? 'presence' : 'absence';
    }

    /**
     * Gets the detected distance in meters.
     *
     * The device reports distance in millimeters. This getter converts to meters
     * for more convenient use in applications that work with metric units.
     *
     * @returns {number|undefined} Distance in meters, undefined if no data
     */
    get distanceMeters() {
        const { presence } = this._state;
        if (!presence || presence.distance === undefined || presence.distance === null) {
            return undefined;
        }
        return presence.distance / 1000;
    }

    /**
     * Gets the detected distance in millimeters.
     *
     * Returns the raw distance value as reported by the device. Use this when
     * you need the exact format used in device communication protocols.
     *
     * @returns {number|undefined} Distance in millimeters, undefined if no data
     */
    get distanceRaw() {
        const { presence } = this._state;
        if (!presence || presence.distance === undefined || presence.distance === null) {
            return undefined;
        }
        return presence.distance;
    }

    /**
     * Gets the timestamp when presence was detected.
     *
     * The device provides timestamps as Unix seconds. This getter converts to a
     * JavaScript Date object for easier date manipulation and formatting.
     *
     * @returns {Date|undefined} Date object, undefined if no data
     */
    get presenceTimestamp() {
        const { presence } = this._state;
        if (!presence || presence.timestamp === undefined || presence.timestamp === null) {
            return undefined;
        }
        return new Date(presence.timestamp * 1000);
    }

    /**
     * Gets the times value from presence data.
     *
     * @returns {number|undefined} Times value, undefined if no data
     */
    get presenceTimes() {
        const { presence } = this._state;
        if (!presence || presence.times === undefined || presence.times === null) {
            return undefined;
        }
        return presence.times;
    }

    /**
     * Gets the light/illuminance value in lux.
     *
     * @returns {number|undefined} Light value in lux, undefined if no data
     */
    get lightLux() {
        const { light } = this._state;
        if (!light || light.value === undefined || light.value === null) {
            return undefined;
        }
        return light.value;
    }

    /**
     * Gets the timestamp when light was measured.
     *
     * The device provides timestamps as Unix seconds. This getter converts to a
     * JavaScript Date object for easier date manipulation and formatting.
     *
     * @returns {Date|undefined} Date object, undefined if no data
     */
    get lightTimestamp() {
        const { light } = this._state;
        if (!light || light.timestamp === undefined || light.timestamp === null) {
            return undefined;
        }
        return new Date(light.timestamp * 1000);
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
     * Gets the raw presence data object.
     *
     * Returns the complete presence data object as received from the device. Use
     * this when you need access to all presence properties, including those not
     * exposed by individual getters.
     *
     * @returns {Object|undefined} Raw presence data object, undefined if no data
     */
    get rawPresence() {
        return this._state.presence;
    }

    /**
     * Gets the raw light data object.
     *
     * Returns the complete light data object as received from the device. Use
     * this when you need access to all light properties, including those not
     * exposed by individual getters.
     *
     * @returns {Object|undefined} Raw light data object, undefined if no data
     */
    get rawLight() {
        return this._state.light;
    }
}

module.exports = PresenceSensorState;

