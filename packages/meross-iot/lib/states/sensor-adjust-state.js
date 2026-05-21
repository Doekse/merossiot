'use strict';

/**
 * Hub sensor calibration offsets (Appliance.Hub.Sensor.Adjust).
 *
 * @class
 */
class SensorAdjustState {
    /**
     * @param {Object} [state]
     * @param {number} [state.temperature]
     * @param {number} [state.humidity]
     */
    constructor(state = null) {
        this._state = state ? { ...state } : {};
    }

    /**
     * @param {Object} data
     */
    update(data) {
        if (!data) {
            return;
        }
        if (data.temperature !== undefined) {
            this._state.temperature = data.temperature;
        }
        if (data.humidity !== undefined) {
            this._state.humidity = data.humidity;
        }
    }

    /** @returns {number|undefined} Temperature offset */
    get temperature() {
        return this._state.temperature;
    }

    /** @returns {number|undefined} Humidity offset */
    get humidity() {
        return this._state.humidity;
    }

    /**
     * @returns {boolean}
     */
    hasSnapshotData() {
        return Object.keys(this._state).length > 0;
    }

    /**
     * @returns {Object|null}
     */
    toSnapshot() {
        if (!this.hasSnapshotData()) {
            return null;
        }
        return { ...this._state };
    }
}

module.exports = SensorAdjustState;
