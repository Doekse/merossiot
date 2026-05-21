'use strict';

/**
 * Hub illuminance (lux) channel state from LatestX light readings.
 *
 * @class
 */
class LuxState {
    /**
     * @param {number|null} [value]
     */
    constructor(value = null) {
        this._value = value;
    }

    /**
     * @param {number|null|undefined} value
     */
    update(value) {
        if (value !== undefined) {
            this._value = value;
        }
    }

    /** @returns {number|null} Latest lux reading */
    get value() {
        return this._value === undefined ? null : this._value;
    }

    /**
     * @returns {boolean}
     */
    hasSnapshotData() {
        return this._value !== null && this._value !== undefined;
    }

    /**
     * Scalar lux value for `getState().lux[0]`.
     *
     * @returns {number|null}
     */
    toSnapshot() {
        if (!this.hasSnapshotData()) {
            return null;
        }
        return this._value;
    }
}

module.exports = LuxState;
