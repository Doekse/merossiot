'use strict';

const SprayState = require('../../model/states/spray-state');
const { SprayMode } = require('../../model/enums');
const { normalizeChannel } = require('../../utilities/options');

/**
 * Spray feature module.
 * Provides control over spray/mist functionality for devices that support it.
 */
module.exports = {
    /**
     * Controls the spray mode.
     *
     * Supports both SprayMode enum objects and numeric values. If an enum object is provided,
     * extracts the numeric value automatically.
     *
     * @param {Object} options - Spray options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @param {number|import('../lib/enums').SprayMode} options.mode - Spray mode value or SprayMode enum
     * @returns {Promise<Object>} Response from the device containing the updated spray state
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setSpray(options = {}) {
        if (options.mode === undefined) {
            throw new Error('mode is required');
        }
        const channel = normalizeChannel(options);
        const modeValue = options.mode || 0;

        const payload = { 'spray': { channel, 'mode': modeValue } };
        const response = await this.publishMessage('SET', 'Appliance.Control.Spray', payload);

        if (response && response.spray) {
            this._updateSprayState(response.spray, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        } else {
            this._updateSprayState({ channel, mode: modeValue }, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }

        return response;
    },

    /**
     * Gets the current spray state from the device.
     *
     * Use {@link getCachedSprayState} to get cached state without making a request.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Response containing spray state with `spray` object
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSprayState(_options = {}) {
        const response = await this.publishMessage('GET', 'Appliance.Control.Spray', {});
        if (response && response.spray) {
            this._updateSprayState(response.spray, 'response');
            this.lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the cached spray state for the specified channel.
     *
     * Returns cached state without making a request. Use {@link getSprayState} to fetch
     * fresh state from the device. State is automatically updated when commands are sent or
     * push notifications are received.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/model/states/spray-state').SprayState|undefined} Cached spray state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedSprayState(channel = 0) {
        this.validateState();
        return this._sprayStateByChannel.get(channel);
    },

    /**
     * Gets the current spray mode for the specified channel (cached).
     *
     * Returns the spray mode enum from cached state. Use {@link getRawSprayMode} to get
     * the raw numeric value.
     *
     * @param {number} [channel=0] - Channel to get mode for (default: 0)
     * @returns {import('../lib/enums').SprayMode|undefined} SprayMode enum object (e.g., SprayMode.OFF) or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see getRawSprayMode
     */
    getCurrentSprayMode(channel = 0) {
        this.validateState();
        const sprayState = this._sprayStateByChannel.get(channel);
        if (sprayState && sprayState.mode !== undefined && sprayState.mode !== null) {
            const enumKey = Object.keys(SprayMode).find(key => SprayMode[key] === sprayState.mode);
            return enumKey ? SprayMode[enumKey] : undefined;
        }
        return undefined;
    },

    /**
     * Gets the raw numeric spray mode value for the specified channel (cached).
     *
     * Returns the raw numeric mode value. For enum object, use {@link getCurrentSprayMode} instead.
     *
     * @param {number} [channel=0] - Channel to get mode for (default: 0)
     * @returns {number|undefined} Raw numeric mode value or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     * @see getCurrentSprayMode
     */
    getRawSprayMode(channel = 0) {
        this.validateState();
        const sprayState = this._sprayStateByChannel.get(channel);
        if (sprayState) {
            return sprayState.mode;
        }
        return undefined;
    },

    /**
     * Updates the cached spray state from spray data.
     *
     * Called automatically when spray push notifications are received or commands complete.
     * Handles both single objects and arrays of spray data.
     *
     * @param {Object|Array} sprayData - Spray data (single object or array)
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateSprayState(sprayData, source = 'response') {
        if (!sprayData) {return;}

        const sprayArray = Array.isArray(sprayData) ? sprayData : [sprayData];

        for (const sprayItem of sprayArray) {
            const channelIndex = sprayItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            const oldState = this._sprayStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                mode: oldState.mode
            } : undefined;

            let state = this._sprayStateByChannel.get(channelIndex);
            if (!state) {
                state = new SprayState(sprayItem);
                this._sprayStateByChannel.set(channelIndex, state);
            } else {
                state.update(sprayItem);
            }

            const newValue = { mode: state.mode };
            if (oldValue === undefined || oldValue.mode !== state.mode) {
                this.emit('stateChange', {
                    type: 'spray',
                    channel: channelIndex,
                    value: newValue,
                    oldValue,
                    source,
                    timestamp: Date.now()
                });
            }
        }
    }
};

