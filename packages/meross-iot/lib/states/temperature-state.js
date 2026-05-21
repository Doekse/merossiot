'use strict';

/**
 * Scales a raw hub temperature reading to degrees Celsius for subscriptions.
 *
 * @param {number|string|null|undefined} raw
 * @returns {number|null}
 */
function scaleTemperature(raw) {
    if (raw === undefined || raw === null) {
        return null;
    }
    const tempValue = parseFloat(raw);
    if (Number.isNaN(tempValue)) {
        return null;
    }
    return tempValue > 1000 ? tempValue / 100.0 : tempValue / 10.0;
}

/**
 * Hub temperature sensor channel state (MS100 family, MTS100 room temp, etc.).
 *
 * Stores firmware-scale values internally; exposes scaled readings via getters and
 * {@link TemperatureState#toSnapshot}.
 *
 * @class
 */
class TemperatureState {
    /**
     * @param {Object} [state]
     * @param {number|string|null} [state.latest]
     * @param {number|string|null} [state.min]
     * @param {number|string|null} [state.max]
     * @param {number|null} [state.latestSampleTime]
     * @param {number|string|null} [state.currentSet]
     * @param {number|string|null} [state.room]
     * @param {number|null} [state.heating]
     * @param {number|null} [state.openWindow]
     */
    constructor(state = null) {
        this._state = state ? { ...state } : {};
    }

    /**
     * @param {Object} data - Partial temperature object from hub payloads
     */
    update(data) {
        if (data) {
            Object.assign(this._state, data);
        }
    }

    /** @returns {number|null} Latest sampled temperature in °C */
    get latest() {
        return scaleTemperature(this._state.latest);
    }

    /** @returns {number|null} Configured minimum in °C */
    get min() {
        const raw = this._state.min;
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 10;
    }

    /** @returns {number|null} Configured maximum in °C */
    get max() {
        const raw = this._state.max;
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 10;
    }

    /** @returns {number|null|undefined} Hub sample timestamp */
    get latestSampleTime() {
        const { latestSampleTime } = this._state;
        return latestSampleTime === undefined ? null : latestSampleTime;
    }

    /** @returns {number|null} MTS100 target setpoint in °C */
    get currentSet() {
        const raw = this._state.currentSet;
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 10;
    }

    /** @returns {number|null} MTS100 measured room temperature in °C */
    get room() {
        return scaleTemperature(this._state.room);
    }

    /** @returns {boolean|undefined} Whether the valve is actively heating */
    get heating() {
        const { heating } = this._state;
        if (heating === undefined || heating === null) {
            return undefined;
        }
        return heating === 1;
    }

    /** @returns {boolean|undefined} Whether open-window mode is active */
    get openWindow() {
        const { openWindow } = this._state;
        if (openWindow === undefined || openWindow === null) {
            return undefined;
        }
        return openWindow === 1;
    }

    /**
     * Whether this slice should appear in `getState().temperature`.
     *
     * @returns {boolean}
     */
    hasSnapshotData() {
        return this.latest !== null ||
            this._state.latestSampleTime != null ||
            this._state.min != null;
    }

    /**
     * Temp/hum sensor subscription slice (not MTS100 thermostat fields).
     *
     * @returns {Object|null}
     */
    toSnapshot() {
        if (!this.hasSnapshotData()) {
            return null;
        }
        return {
            latest: this.latest,
            latestSampleTime: this.latestSampleTime ?? null,
            min: this.min,
            max: this.max
        };
    }
}

module.exports = TemperatureState;
module.exports.scaleTemperature = scaleTemperature;
