'use strict';

/**
 * Represents the state of a timer configuration.
 *
 * Encapsulates state information for device timer configurations. Timers can be used
 * to schedule device actions at specific times or intervals. State instances are
 * managed by device controllers and updated automatically when device responses or
 * push notifications are received.
 *
 * @class
 * @example
 * const timerState = device.getCachedTimerState(timerId);
 * if (timerState) {
 *     console.log('Timer enabled:', timerState.enable);
 *     console.log('Timer type:', timerState.type);
 *     console.log('Scheduled time:', timerState.time);
 * }
 */
class TimerState {
    /**
     * Creates a new TimerState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {string|number} [state.id] - Timer identifier
     * @param {number} [state.channel] - Channel number
     * @param {number} [state.week] - Weekday mask (bitmask for days of week)
     * @param {number} [state.time] - Time value (minutes since midnight or timestamp)
     * @param {number} [state.enable] - Enabled state (0=disabled, 1=enabled)
     * @param {string} [state.alias] - Timer alias/name
     * @param {number} [state.type] - Timer type (from TimerType enum)
     * @param {number} [state.duration] - Duration value (for countdown timers)
     * @param {number} [state.sunOffset] - Sunrise/sunset offset (for sun-based timers)
     * @param {number} [state.createTime] - Creation timestamp
     * @param {Object} [state.extend] - Extended configuration data
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
     * Gets the timer identifier.
     *
     * @returns {string|number|undefined} Timer ID or undefined if not available
     */
    get id() {
        return this._state.id;
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
     * Gets the weekday mask.
     *
     * Bitmask representing which days of the week the timer is active. Use bitwise
     * operations to check for specific days.
     *
     * @returns {number|undefined} Weekday mask or undefined if not available
     */
    get week() {
        const { week } = this._state;
        if (week === undefined || week === null) {return undefined;}
        return week;
    }

    /**
     * Gets the time value.
     *
     * Interpretation depends on timer type: for daily timers it's minutes since
     * midnight, for other types it may be a Unix timestamp.
     *
     * @returns {number|undefined} Time value (minutes since midnight or timestamp) or undefined if not available
     */
    get time() {
        const { time } = this._state;
        if (time === undefined || time === null) {return undefined;}
        return time;
    }

    /**
     * Gets whether the timer is enabled.
     *
     * Converts the device's numeric enabled state (0 or 1) to a boolean for easier
     * conditional logic in application code.
     *
     * @returns {boolean|undefined} True if enabled, false if disabled, undefined if state not available
     */
    get enable() {
        const { enable } = this._state;
        if (enable === undefined || enable === null) {return undefined;}
        return enable === 1;
    }

    /**
     * Gets the timer alias/name.
     *
     * @returns {string|undefined} Timer alias or undefined if not available
     */
    get alias() {
        return this._state.alias;
    }

    /**
     * Gets the timer type.
     *
     * @returns {number|undefined} Timer type value or undefined if not available
     * @see {@link module:lib/enums.TimerType} for type constants
     */
    get type() {
        const { type } = this._state;
        if (type === undefined || type === null) {return undefined;}
        return type;
    }

    /**
     * Gets the duration value.
     *
     * Specifies how long a countdown timer should run. Only relevant for countdown
     * timer types.
     *
     * @returns {number|undefined} Duration value or undefined if not available
     */
    get duration() {
        const { duration } = this._state;
        if (duration === undefined || duration === null) {return undefined;}
        return duration;
    }

    /**
     * Gets the sunrise/sunset offset.
     *
     * Specifies the offset in minutes from sunrise or sunset for sun-based timers.
     * Only relevant for timer types that use solar calculations.
     *
     * @returns {number|undefined} Sun offset value in minutes or undefined if not available
     */
    get sunOffset() {
        const { sunOffset } = this._state;
        if (sunOffset === undefined || sunOffset === null) {return undefined;}
        return sunOffset;
    }

    /**
     * Gets the creation timestamp.
     *
     * @returns {number|undefined} Creation timestamp or undefined if not available
     */
    get createTime() {
        const { createTime } = this._state;
        if (createTime === undefined || createTime === null) {return undefined;}
        return createTime;
    }

    /**
     * Gets the extended configuration data.
     *
     * Returns additional timer configuration that may not be covered by standard
     * properties. Structure varies by device and timer type.
     *
     * @returns {Object|undefined} Extended configuration object or undefined if not available
     */
    get extend() {
        return this._state.extend;
    }
}

module.exports = TimerState;

