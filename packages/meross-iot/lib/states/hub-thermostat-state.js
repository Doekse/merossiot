'use strict';

/**
 * Hub MTS100 thermostat valve channel state.
 *
 * Consolidates togglex, mode, temperature, adjust, and schedule payloads into one
 * subscription slice matching `getState().thermostat[0]`.
 *
 * @class
 */
class HubThermostatState {
    constructor() {
        this._togglex = {};
        this._mode = {};
        this._temperature = {};
        this._adjust = {};
        this._scheduleBMode = null;
        this._scheduleB = null;
        this._superCtl = null;
        this._config = null;
    }

    /**
     * Merges a partial MTS100 update from any hub namespace handler.
     *
     * @param {Object} patch
     * @param {Object} [patch.togglex]
     * @param {Object} [patch.mode]
     * @param {Object} [patch.temperature]
     * @param {Object} [patch.adjust]
     * @param {number|null} [patch.scheduleBMode]
     * @param {Object|null} [patch.scheduleB]
     * @param {Object|null} [patch.superCtl]
     * @param {Object|null} [patch.config]
     * @param {boolean} [patch.touchTemperatureSampleTime=false] - Sets `latestSampleTime` on temperature merge
     * @param {boolean} [patch.touchAdjustSampleTime=false] - Sets `latestSampleTime` on adjust merge
     */
    update(patch) {
        if (!patch) {
            return;
        }

        if (patch.togglex) {
            Object.assign(this._togglex, patch.togglex);
        }
        if (patch.mode) {
            Object.assign(this._mode, patch.mode);
        }
        if (patch.temperature) {
            Object.assign(this._temperature, patch.temperature);
            if (patch.touchTemperatureSampleTime) {
                this._temperature.latestSampleTime = Date.now();
            }
        }
        if (patch.adjust) {
            Object.assign(this._adjust, patch.adjust);
            if (patch.touchAdjustSampleTime) {
                this._adjust.latestSampleTime = Date.now();
            }
        }
        if (patch.scheduleBMode !== undefined) {
            this._scheduleBMode = patch.scheduleBMode;
        }
        if (patch.scheduleB !== undefined) {
            this._scheduleB = patch.scheduleB;
        }
        if (patch.superCtl !== undefined) {
            this._superCtl = patch.superCtl;
        }
        if (patch.config !== undefined) {
            this._config = patch.config;
        }
    }

    /**
     * Applies a ToggleX onoff-only push.
     *
     * @param {number} onoff
     */
    updateToggleOnoff(onoff) {
        if (onoff !== undefined) {
            this._togglex.onoff = onoff;
        }
    }

    /**
     * Applies an Mts100.Mode state push.
     *
     * @param {number} state
     */
    updateModeState(state) {
        if (state !== undefined) {
            this._mode.state = state;
        }
    }

    /** @returns {boolean} Whether the valve output is on */
    get isOn() {
        return this._togglex.onoff === 1;
    }

    /** @returns {number|undefined} MTS100 mode state code */
    get mode() {
        return this._mode.state;
    }

    /**
     * @param {string} preset
     * @returns {number|null}
     */
    getPresetTemperature(preset) {
        const raw = this._temperature[preset];
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 10.0;
    }

    /** @returns {number|null} Configured minimum in °C */
    get minSupportedTemperature() {
        const raw = this._temperature.min;
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 10.0;
    }

    /** @returns {number|null} Configured maximum in °C */
    get maxSupportedTemperature() {
        const raw = this._temperature.max;
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 10.0;
    }

    /** @returns {number|null} Target setpoint in °C */
    get targetTemp() {
        const raw = this._temperature.currentSet;
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 10.0;
    }

    /** @returns {number|null} Measured room temperature in °C */
    get roomTemp() {
        const raw = this._temperature.room;
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 10.0;
    }

    /** @returns {boolean} Whether the valve is actively heating */
    get heating() {
        return this._temperature.heating === 1;
    }

    /** @returns {boolean} Whether open-window mode is active */
    get windowOpen() {
        return this._temperature.openWindow === 1;
    }

    /** @returns {number|null} Temperature calibration offset */
    get adjust() {
        const raw = this._adjust.temperature;
        if (raw === undefined || raw === null) {
            return null;
        }
        const value = parseFloat(raw);
        return Number.isNaN(value) ? null : value / 100.0;
    }

    /** @returns {number|null|undefined} Active schedule B mode */
    get scheduleBMode() {
        return this._scheduleBMode;
    }

    /** @returns {Object|null} Super-control payload copy */
    get superCtl() {
        return this._superCtl ? { ...this._superCtl } : null;
    }

    /** @returns {Object|null} Schedule B payload copy */
    get scheduleB() {
        return this._scheduleB ? { ...this._scheduleB } : null;
    }

    /** @returns {Object|null} MTS100 config payload copy */
    get config() {
        return this._config ? { ...this._config } : null;
    }

    /**
     * @returns {Object}
     */
    toSnapshot() {
        return {
            isOn: this.isOn,
            mode: this.mode,
            targetTemp: this.targetTemp,
            roomTemp: this.roomTemp,
            heating: this.heating,
            windowOpen: this.windowOpen,
            adjust: this.adjust,
            scheduleBMode: this._scheduleBMode,
            superCtl: this.superCtl,
            scheduleB: this.scheduleB,
            config: this.config
        };
    }
}

module.exports = HubThermostatState;
