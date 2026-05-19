'use strict';

const { ThermostatMode, ThermostatWorkingMode, ThermostatModeBState } = require('../enums');

/**
 * Represents the thermostat state of a device channel.
 *
 * Encapsulates state information for thermostat devices, including mode, target
 * temperature, current temperature, and working mode. State instances are managed
 * by device controllers and updated automatically when device responses or push
 * notifications are received.
 *
 * @class
 * @example
 * const thermostatState = device.getCachedThermostatState(0);
 * if (thermostatState) {
 *     console.log('Mode:', thermostatState.mode);
 *     console.log('Target temp:', thermostatState.targetTemp);
 *     console.log('Current temp:', thermostatState.currentTemp);
 * }
 */
class ThermostatState {
    /**
     * Creates a new ThermostatState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {number} [state.onoff] - On/off state (0=off, 1=on)
     * @param {number} [state.channel] - Channel number
     * @param {number} [state.mode] - Thermostat mode (from ThermostatMode enum)
     * @param {number} [state.targetTemp] - Target temperature
     * @param {number} [state.currentTemp] - Current temperature
     * @param {number} [state.working] - Working mode (from ThermostatWorkingMode enum)
     * @param {number} [state.state] - Mode B state (from ThermostatModeBState enum)
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * Updates the state with new data.
     *
     * Merges new state data into the existing state using Object.assign to preserve
     * properties not included in the update. Called automatically by device controllers
     * when state updates are received from device responses or push notifications.
     *
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            Object.assign(this._state, state);
        }
    }

    /**
     * Gets whether the thermostat is on.
     *
     * Converts the device's numeric on/off state (0 or 1) to a boolean for easier
     * conditional logic in application code.
     *
     * @returns {boolean|undefined} True if on, false if off, undefined if state not available
     */
    get isOn() {
        const { onoff } = this._state;
        if (onoff === undefined || onoff === null) {return undefined;}
        return onoff === 1;
    }

    /**
     * Gets the thermostat mode.
     *
     * Normalizes the mode value against the ThermostatMode enum. Returns the enum value
     * if found, or the raw value if it's in the valid range (0-4) but not in the enum.
     * This normalization allows handling of future enum values without breaking existing
     * code while still providing enum constants when available.
     *
     * @returns {number|undefined} ThermostatMode enum value, raw value if valid but not in enum, or undefined if invalid
     * @see {@link module:lib/enums.ThermostatMode} for mode constants
     */
    get mode() {
        const { mode } = this._state;
        if (mode === undefined || mode === null) {return undefined;}
        if (mode >= 0 && mode <= 4) {
            const enumKey = Object.keys(ThermostatMode).find(key => ThermostatMode[key] === mode);
            if (enumKey) {
                return ThermostatMode[enumKey];
            }
            return mode;
        }
        return undefined;
    }

    /**
     * Gets the raw thermostat mode value.
     *
     * Returns the unvalidated mode value directly from state. Use this when you need
     * the exact value without enum normalization, such as when debugging or working
     * with device protocols directly.
     *
     * @returns {number|undefined} Raw mode value or undefined if not available
     */
    get rawMode() {
        return this._state.mode;
    }

    /**
     * Gets the working mode.
     *
     * Normalizes the working mode value against the ThermostatWorkingMode enum.
     * Returns undefined if the value doesn't match any enum constant.
     *
     * @returns {number|undefined} ThermostatWorkingMode enum value or undefined if not available
     * @see {@link module:lib/enums.ThermostatWorkingMode} for mode constants
     */
    get workingMode() {
        const { working } = this._state;
        if (working === undefined || working === null) {return undefined;}
        const enumKey = Object.keys(ThermostatWorkingMode).find(key => ThermostatWorkingMode[key] === working);
        return enumKey ? ThermostatWorkingMode[enumKey] : undefined;
    }

    /**
     * Gets the raw working mode value.
     *
     * Returns the unvalidated working mode value directly from state. Use this when
     * you need the exact value without enum normalization.
     *
     * @returns {number|undefined} Raw working mode value or undefined if not available
     */
    get rawWorkingMode() {
        return this._state.working;
    }

    /**
     * Gets the mode B state.
     *
     * Normalizes the mode B state value against the ThermostatModeBState enum.
     * Returns undefined if the value doesn't match any enum constant.
     *
     * @returns {number|undefined} ThermostatModeBState enum value or undefined if not available
     * @see {@link module:lib/enums.ThermostatModeBState} for state constants
     */
    get state() {
        const { state } = this._state;
        if (state === undefined || state === null) {return undefined;}
        const enumKey = Object.keys(ThermostatModeBState).find(key => ThermostatModeBState[key] === state);
        return enumKey ? ThermostatModeBState[enumKey] : undefined;
    }

    /**
     * Gets the raw mode B state value.
     *
     * Returns the unvalidated mode B state value directly from state. Use this when
     * you need the exact value without enum normalization.
     *
     * @returns {number|undefined} Raw mode B state value or undefined if not available
     */
    get rawState() {
        return this._state.state;
    }

    /**
     * Gets whether a warning condition is active.
     *
     * Converts the device's numeric warning state (0 or 1) to a boolean for easier
     * conditional logic in application code.
     *
     * @returns {boolean|undefined} True if warning is active, false otherwise, undefined if state not available
     */
    get warning() {
        const { warning } = this._state;
        if (warning === undefined || warning === null) {return undefined;}
        return warning === 1;
    }

    /**
     * Gets the target temperature in Celsius.
     *
     * The device stores temperature values as integers in tenths of a degree (e.g., 250 = 25.0°C).
     * This getter converts to decimal Celsius for easier use in applications that work
     * with standard temperature units.
     *
     * @returns {number|undefined} Target temperature in Celsius or undefined if not available
     */
    get targetTemperatureCelsius() {
        const temp = this._state.targetTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * Gets the current temperature in Celsius.
     *
     * The device stores temperature values as integers in tenths of a degree (e.g., 250 = 25.0°C).
     * This getter converts to decimal Celsius for easier use in applications that work
     * with standard temperature units.
     *
     * @returns {number|undefined} Current temperature in Celsius or undefined if not available
     */
    get currentTemperatureCelsius() {
        const temp = this._state.currentTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * Gets the minimum temperature setting in Celsius.
     *
     * The device stores temperature values as integers in tenths of a degree (e.g., 250 = 25.0°C).
     * This getter converts to decimal Celsius for easier use in applications that work
     * with standard temperature units.
     *
     * @returns {number|undefined} Minimum temperature in Celsius or undefined if not available
     */
    get minTemperatureCelsius() {
        const temp = this._state.min;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * Gets the maximum temperature setting in Celsius.
     *
     * The device stores temperature values as integers in tenths of a degree (e.g., 250 = 25.0°C).
     * This getter converts to decimal Celsius for easier use in applications that work
     * with standard temperature units.
     *
     * @returns {number|undefined} Maximum temperature in Celsius or undefined if not available
     */
    get maxTemperatureCelsius() {
        const temp = this._state.max;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * Gets the heat mode temperature setting in Celsius.
     *
     * The device stores temperature values as integers in tenths of a degree (e.g., 250 = 25.0°C).
     * This getter converts to decimal Celsius for easier use in applications that work
     * with standard temperature units.
     *
     * @returns {number|undefined} Heat mode temperature in Celsius or undefined if not available
     */
    get heatTemperatureCelsius() {
        const temp = this._state.heatTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * Gets the cool mode temperature setting in Celsius.
     *
     * The device stores temperature values as integers in tenths of a degree (e.g., 250 = 25.0°C).
     * This getter converts to decimal Celsius for easier use in applications that work
     * with standard temperature units.
     *
     * @returns {number|undefined} Cool mode temperature in Celsius or undefined if not available
     */
    get coolTemperatureCelsius() {
        const temp = this._state.coolTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * Gets the eco mode temperature setting in Celsius.
     *
     * The device stores temperature values as integers in tenths of a degree (e.g., 250 = 25.0°C).
     * This getter converts to decimal Celsius for easier use in applications that work
     * with standard temperature units.
     *
     * @returns {number|undefined} Eco mode temperature in Celsius or undefined if not available
     */
    get ecoTemperatureCelsius() {
        const temp = this._state.ecoTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }

    /**
     * Gets the manual mode temperature setting in Celsius.
     *
     * The device stores temperature values as integers in tenths of a degree (e.g., 250 = 25.0°C).
     * This getter converts to decimal Celsius for easier use in applications that work
     * with standard temperature units.
     *
     * @returns {number|undefined} Manual mode temperature in Celsius or undefined if not available
     */
    get manualTemperatureCelsius() {
        const temp = this._state.manualTemp;
        if (temp === undefined || temp === null) {return undefined;}
        return temp / 10.0;
    }
}

module.exports = ThermostatState;

