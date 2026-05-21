'use strict';

/**
 * Hub sensor alert threshold configuration (Appliance.Hub.Sensor.Alert).
 *
 * @class
 */
class SensorAlertState {
    /**
     * @param {Object} [state]
     * @param {Array} [state.temperature]
     * @param {Array} [state.humidity]
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

    /** @returns {Array|undefined} Temperature threshold tuples */
    get temperature() {
        return this._state.temperature;
    }

    /** @returns {Array|undefined} Humidity threshold tuples */
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

module.exports = SensorAlertState;
