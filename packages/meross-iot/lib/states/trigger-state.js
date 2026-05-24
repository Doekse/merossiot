'use strict';

const { TriggerTypeCodec } = require('../enums');

/**
 * Represents the state of a trigger configuration.
 *
 * @class
 * @example
 * const triggerState = device.getCachedTriggerState(triggerId);
 * if (triggerState) {
 *     console.log('Trigger enabled:', triggerState.enable);
 *     console.log('Trigger type:', triggerState.type);
 *     console.log('Rule duration:', triggerState.ruleDuration);
 * }
 */
class TriggerState {
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
     * @returns {string|number|undefined} Trigger ID or undefined if not available
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
     * @returns {string|undefined} Trigger alias or undefined if not available
     */
    get alias() {
        return this._state.alias;
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
     * @returns {'single-point-weekly'|'single-point-single-shot'|'continuous-weekly'|'continuous-single-shot'|undefined}
     */
    get type() {
        const { type } = this._state;
        if (type === undefined || type === null) {return undefined;}
        return TriggerTypeCodec.fromWire(type);
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
     * @returns {Object|undefined} Rule configuration object or undefined if not available
     */
    get rule() {
        return this._state.rule;
    }

    /**
     * @returns {number|undefined} Rule duration or undefined if not available
     */
    get ruleDuration() {
        const { rule } = this._state;
        if (!rule) {return undefined;}
        return rule.duration;
    }

    /**
     * @returns {number|undefined} Weekday mask or undefined if not available
     */
    get ruleWeek() {
        const { rule } = this._state;
        if (!rule) {return undefined;}
        return rule.week;
    }
}

module.exports = TriggerState;
