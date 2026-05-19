'use strict';

/**
 * Represents the state of a trigger configuration.
 *
 * Encapsulates state information for device trigger configurations. Triggers can be
 * used to create automation rules that respond to device events. State instances are
 * managed by device controllers and updated automatically when device responses or
 * push notifications are received.
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
     * Creates a new TriggerState instance.
     *
     * @param {Object} [state=null] - Initial state object
     * @param {string|number} [state.id] - Trigger identifier
     * @param {number} [state.channel] - Channel number
     * @param {string} [state.alias] - Trigger alias/name
     * @param {number} [state.enable] - Enabled state (0=disabled, 1=enabled)
     * @param {number} [state.type] - Trigger type (from TriggerType enum)
     * @param {number} [state.createTime] - Creation timestamp
     * @param {Object} [state.rule] - Rule configuration object
     * @param {number} [state.rule.duration] - Rule duration value
     * @param {number} [state.rule.week] - Rule weekday mask
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * Updates the state with new data
     *
     * Merges new state data into the existing state. Called automatically by the device
     * when state updates are received.
     *
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            Object.assign(this._state, state);
        }
    }

    /**
     * Gets the trigger identifier.
     *
     * @returns {string|number|undefined} Trigger ID or undefined if not available
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
     * Gets the trigger alias/name.
     *
     * @returns {string|undefined} Trigger alias or undefined if not available
     */
    get alias() {
        return this._state.alias;
    }

    /**
     * Gets whether the trigger is enabled.
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
     * Gets the trigger type.
     *
     * @returns {number|undefined} Trigger type value or undefined if not available
     * @see {@link module:lib/enums.TriggerType} for type constants
     */
    get type() {
        const { type } = this._state;
        if (type === undefined || type === null) {return undefined;}
        return type;
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
     * Gets the rule configuration object
     *
     * @returns {Object|undefined} Rule configuration object or undefined if not available
     */
    get rule() {
        return this._state.rule;
    }

    /**
     * Gets the rule duration value.
     *
     * @returns {number|undefined} Rule duration or undefined if not available
     */
    get ruleDuration() {
        const { rule } = this._state;
        if (!rule) {return undefined;}
        return rule.duration;
    }

    /**
     * Gets the rule weekday mask.
     *
     * Bitmask representing which days of the week the trigger rule is active. Use
     * bitwise operations to check for specific days.
     *
     * @returns {number|undefined} Weekday mask or undefined if not available
     */
    get ruleWeek() {
        const { rule } = this._state;
        if (!rule) {return undefined;}
        return rule.week;
    }
}

module.exports = TriggerState;

