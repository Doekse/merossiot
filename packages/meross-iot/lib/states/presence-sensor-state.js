'use strict';

const { PresenceStateCodec } = require('../enums');

/**
 * Represents the presence sensor state of a device channel.
 *
 * @class
 * @example
 * const presenceState = device.getCachedPresenceSensorState(0);
 * if (presenceState) {
 *     console.log('Is present:', presenceState.isPresent);
 *     console.log('Presence:', presenceState.presence);
 *     console.log('Distance:', presenceState.distanceMeters, 'm');
 *     console.log('Light:', presenceState.lightLux, 'lux');
 * }
 */
class PresenceSensorState {
    /**
     * @param {Object} [state=null] - Initial state object (wire-format numbers in nested blocks)
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
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
     * @returns {'present'|'absent'|'unknown'|undefined}
     */
    get presence() {
        const wire = this._state.presence;
        if (!wire || wire.value === undefined || wire.value === null) {
            return undefined;
        }
        return PresenceStateCodec.fromWire(wire.value);
    }

    /**
     * @returns {boolean|undefined} True if presence detected, false if absent, undefined if unknown or no data
     */
    get isPresent() {
        const label = this.presence;
        if (label === undefined || label === 'unknown') {return undefined;}
        return label === 'present';
    }

    /**
     * @returns {number|undefined} Distance in meters, undefined if no data
     */
    get distanceMeters() {
        const wire = this._state.presence;
        if (!wire || wire.distance === undefined || wire.distance === null) {
            return undefined;
        }
        return wire.distance / 1000;
    }

    /**
     * @returns {Date|undefined} Date object, undefined if no data
     */
    get presenceTimestamp() {
        const wire = this._state.presence;
        if (!wire || wire.timestamp === undefined || wire.timestamp === null) {
            return undefined;
        }
        return new Date(wire.timestamp * 1000);
    }

    /**
     * @returns {number|undefined} Times value, undefined if no data
     */
    get presenceTimes() {
        const wire = this._state.presence;
        if (!wire || wire.times === undefined || wire.times === null) {
            return undefined;
        }
        return wire.times;
    }

    /**
     * @returns {number|undefined} Light value in lux, undefined if no data
     */
    get lightLux() {
        const wire = this._state.light;
        if (!wire || wire.value === undefined || wire.value === null) {
            return undefined;
        }
        return wire.value;
    }

    /**
     * @returns {Date|undefined} Date object, undefined if no data
     */
    get lightTimestamp() {
        const wire = this._state.light;
        if (!wire || wire.timestamp === undefined || wire.timestamp === null) {
            return undefined;
        }
        return new Date(wire.timestamp * 1000);
    }

    /**
     * @returns {number|undefined} Channel number or undefined if not available
     */
    get channel() {
        const { channel } = this._state;
        if (channel === undefined || channel === null) {return undefined;}
        return channel;
    }
}

module.exports = PresenceSensorState;
