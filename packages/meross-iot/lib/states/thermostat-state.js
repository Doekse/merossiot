'use strict';

const {
    ThermostatModeCodec,
    ThermostatActivityCodec,
    ThermostatModeBModeCodec,
    ThermostatModeBStateCodec,
    ThermostatModeBWorkingCodec,
    ThermostatModeBOnOffCodec,
    ThermostatModeWarningCodec,
    ThermostatSensorStatusCodec
} = require('../enums');

/**
 * Represents the thermostat state of a device channel.
 *
 * Encapsulates state information for thermostat devices, including mode, target
 * temperature, current temperature, and working mode. State instances are managed
 * by device controllers and updated automatically when device responses or push
 * notifications are received.
 *
 * `state` and `mode` keys are shared between {@link ThermostatModeCodec} and ModeB
 * codecs when both namespaces update the same channel; use {@link ThermostatState#activity}
 * vs {@link ThermostatState#state} and {@link ThermostatState#mode} vs
 * {@link ThermostatState#modeBMode} for the intended namespace semantics.
 *
 * @class
 * @example
 * const thermostatState = device.getCachedThermostatState(0);
 * if (thermostatState) {
 *     console.log('Mode:', thermostatState.mode);
 *     console.log('Target temp:', thermostatState.targetTemperatureCelsius);
 *     console.log('Current temp:', thermostatState.currentTemperatureCelsius);
 * }
 */
class ThermostatState {
    /**
     * Creates a new ThermostatState instance.
     *
     * @param {Object} [state=null] - Initial state object (wire-format numbers)
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * Merges new state data into the existing state.
     *
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            Object.assign(this._state, state);
        }
    }

    /**
     * @returns {boolean|undefined} True if on, false if off, undefined if state not available
     */
    get isOn() {
        const { onoff } = this._state;
        if (onoff === undefined || onoff === null) {return undefined;}
        return onoff === 1;
    }

    /**
     * Appliance.Control.Thermostat.Mode preset (`mode` field).
     *
     * @returns {'heat'|'cool'|'economy'|'auto'|'manual'|undefined}
     */
    get mode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        return ThermostatModeCodec.fromWire(mode);
    }

    /**
     * Appliance.Control.Thermostat.ModeB control mode (`mode` field).
     *
     * @returns {'manual'|'schedule'|'timer'|undefined}
     */
    get modeBMode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        return ThermostatModeBModeCodec.fromWire(mode);
    }

    /**
     * Appliance.Control.Thermostat.Mode heating activity (`state` field).
     *
     * @returns {'idle'|'heating'|undefined}
     */
    get activity() {
        const { state } = this._state;
        if (state === undefined || state === null) {return undefined;}
        return ThermostatActivityCodec.fromWire(state);
    }

    /**
     * Appliance.Control.Thermostat.ModeB heat/cool activity (`working` field).
     *
     * @returns {'heating'|'cooling'|undefined}
     */
    get workingMode() {
        const { working } = this._state;
        if (working === undefined || working === null) {return undefined;}
        return ThermostatModeBWorkingCodec.fromWire(working);
    }

    /**
     * Appliance.Control.Thermostat.ModeB operational state (`state` field).
     *
     * @returns {'working'|'standby'|'off'|undefined}
     */
    get state() {
        const { state } = this._state;
        if (state === undefined || state === null) {return undefined;}
        return ThermostatModeBStateCodec.fromWire(state);
    }

    /**
     * Appliance.Control.Thermostat.ModeB valve position (`onoff` field).
     *
     * @returns {'open'|'closed'|undefined}
     */
    get valveState() {
        const { onoff } = this._state;
        if (onoff === undefined || onoff === null) {return undefined;}
        return ThermostatModeBOnOffCodec.fromWire(onoff);
    }

    /**
     * Appliance.Control.Thermostat.ModeB external sensor validity.
     *
     * @returns {'valid'|'invalid'|undefined}
     */
    get sensorStatus() {
        const { sensorStatus } = this._state;
        if (sensorStatus === undefined || sensorStatus === null) {return undefined;}
        return ThermostatSensorStatusCodec.fromWire(sensorStatus);
    }

    /**
     * @returns {boolean|undefined} True if warning is active, false otherwise, undefined if state not available
     */
    get warning() {
        const { warning } = this._state;
        if (warning === undefined || warning === null) {return undefined;}
        return warning === 1;
    }

    /**
     * Appliance.Control.Thermostat.Mode sensor/warning status (`warning` field).
     *
     * @returns {'valid'|'failed'|undefined}
     */
    get warningStatus() {
        const { warning } = this._state;
        if (warning === undefined || warning === null) {return undefined;}
        return ThermostatModeWarningCodec.fromWire(warning);
    }

    /**
     * @returns {number|undefined} Target temperature in Celsius or undefined if not available
     */
    get targetTemperatureCelsius() {
        const temp = this._state.targetTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * @returns {number|undefined} Current temperature in Celsius or undefined if not available
     */
    get currentTemperatureCelsius() {
        const temp = this._state.currentTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * @returns {number|undefined} Minimum temperature in Celsius or undefined if not available
     */
    get minTemperatureCelsius() {
        const temp = this._state.min;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * @returns {number|undefined} Maximum temperature in Celsius or undefined if not available
     */
    get maxTemperatureCelsius() {
        const temp = this._state.max;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * @returns {number|undefined} Heat mode temperature in Celsius or undefined if not available
     */
    get heatTemperatureCelsius() {
        const temp = this._state.heatTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * @returns {number|undefined} Cool mode temperature in Celsius or undefined if not available
     */
    get coolTemperatureCelsius() {
        const temp = this._state.coolTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * @returns {number|undefined} Eco mode temperature in Celsius or undefined if not available
     */
    get ecoTemperatureCelsius() {
        const temp = this._state.ecoTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * @returns {number|undefined} Manual mode temperature in Celsius or undefined if not available
     */
    get manualTemperatureCelsius() {
        const temp = this._state.manualTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }
}

module.exports = ThermostatState;
