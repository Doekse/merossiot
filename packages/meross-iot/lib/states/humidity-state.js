'use strict';

/**
 * Scales a raw hub humidity reading to percent for subscriptions.
 *
 * @param {number|string|null|undefined} raw
 * @returns {number|null}
 */
function scaleHumidity(raw) {
    if (raw === undefined || raw === null) {
        return null;
    }
    const value = parseFloat(raw);
    return Number.isNaN(value) ? null : value / 10.0;
}

/**
 * Hub humidity sensor channel state.
 *
 * @class
 */
class HumidityState {
    /**
     * @param {Object} [state]
     * @param {number|string|null} [state.latest]
     * @param {number|null} [state.latestSampleTime]
     */
    constructor(state = null) {
        this._state = state ? { ...state } : {};
    }

    /**
     * @param {Object} data
     */
    update(data) {
        if (data) {
            Object.assign(this._state, data);
        }
    }

    /** @returns {number|null} Latest humidity in % */
    get latest() {
        return scaleHumidity(this._state.latest);
    }

    /** @returns {number|null|undefined} Hub sample timestamp */
    get latestSampleTime() {
        const { latestSampleTime } = this._state;
        return latestSampleTime === undefined ? null : latestSampleTime;
    }

    /**
     * @returns {boolean}
     */
    hasSnapshotData() {
        return this.latest !== null || this._state.latestSampleTime != null;
    }

    /**
     * @returns {Object|null}
     */
    toSnapshot() {
        if (!this.hasSnapshotData()) {
            return null;
        }
        return {
            latest: this.latest,
            latestSampleTime: this.latestSampleTime ?? null
        };
    }
}

module.exports = HumidityState;
module.exports.scaleHumidity = scaleHumidity;
