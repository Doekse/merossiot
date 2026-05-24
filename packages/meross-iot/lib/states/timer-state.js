'use strict';

const { TimerTypeCodec } = require('../enums');

/**
 * Represents the state of a timer configuration.
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
     * @param {Object} [state=null] - Initial state object (wire-format numbers)
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            Object.assign(this._state, state);
        }
    }

    /**
     * @returns {string|number|undefined} Timer ID or undefined if not available
     */
    get id() {
        return this._state.id;
    }

    /**
     * @returns {number|undefined} Channel number or undefined if not available
     */
    get channel() {
        const { channel } = this._state;
        if (channel === undefined || channel === null) {return undefined;}
        return channel;
    }

    /**
     * @returns {number|undefined} Weekday mask or undefined if not available
     */
    get week() {
        const { week } = this._state;
        if (week === undefined || week === null) {return undefined;}
        return week;
    }

    /**
     * @returns {number|undefined} Time value (minutes since midnight or timestamp)
     */
    get time() {
        const { time } = this._state;
        if (time === undefined || time === null) {return undefined;}
        return time;
    }

    /**
     * @returns {boolean|undefined} True if enabled, false if disabled, undefined if state not available
     */
    get enable() {
        const { enable } = this._state;
        if (enable === undefined || enable === null) {return undefined;}
        return enable === 1;
    }

    /**
     * @returns {string|undefined} Timer alias or undefined if not available
     */
    get alias() {
        return this._state.alias;
    }

    /**
     * @returns {'single-point-weekly'|'single-point-single-shot'|'continuous-weekly'|'continuous-single-shot'|'auto-off'|'countdown'|undefined}
     */
    get type() {
        const { type } = this._state;
        if (type === undefined || type === null) {return undefined;}
        return TimerTypeCodec.fromWire(type);
    }

    /**
     * @returns {number|undefined} Duration value or undefined if not available
     */
    get duration() {
        const { duration } = this._state;
        if (duration === undefined || duration === null) {return undefined;}
        return duration;
    }

    /**
     * @returns {number|undefined} Sun offset value in minutes or undefined if not available
     */
    get sunOffset() {
        const { sunOffset } = this._state;
        if (sunOffset === undefined || sunOffset === null) {return undefined;}
        return sunOffset;
    }

    /**
     * @returns {number|undefined} Creation timestamp or undefined if not available
     */
    get createTime() {
        const { createTime } = this._state;
        if (createTime === undefined || createTime === null) {return undefined;}
        return createTime;
    }

    /**
     * @returns {Object|undefined} Extended configuration object or undefined if not available
     */
    get extend() {
        return this._state.extend;
    }
}

module.exports = TimerState;
