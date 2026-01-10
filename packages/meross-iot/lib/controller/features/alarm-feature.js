'use strict';

const { normalizeChannel } = require('../../utilities/options');

const MAX_ALARM_EVENTS_MEMORY = 10;

/**
 * Alarm feature module.
 * Handles alarm status queries and maintains a buffer of recent alarm events.
 */
module.exports = {
    /**
     * Initializes alarm events storage.
     *
     * Called lazily when the first alarm event is received to avoid unnecessary initialization.
     *
     * @private
     */
    _initializeAlarmEvents() {
        if (!this._lastAlarmEvents) {
            this._lastAlarmEvents = [];
        }
    },

    /**
     * Gets the current alarm status from the device.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get alarm status for (default: 0)
     * @returns {Promise<Object>} Alarm status response with `alarm` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getAlarmStatus(options = {}) {
        const channel = normalizeChannel(options);
        const payload = { 'alarm': [{ channel }] };
        return await this.publishMessage('GET', 'Appliance.Control.Alarm', payload);
    },

    /**
     * Gets a copy of the most recent alarm events.
     *
     * Alarm events are automatically stored when push notifications are received.
     * The library maintains up to MAX_ALARM_EVENTS_MEMORY most recent events.
     *
     * @returns {Array<Object>} Copy of the alarm events array (most recent first)
     */
    getLastAlarmEvents() {
        this._initializeAlarmEvents();
        return [...this._lastAlarmEvents];
    },

    /**
     * Updates the alarm events buffer from push notification data.
     *
     * Called automatically when alarm push notifications are received. Maintains a rolling
     * buffer of the most recent events, discarding older ones when the limit is exceeded.
     *
     * @param {Object|Array} alarmData - Alarm data (single object or array)
     * @private
     */
    _updateAlarmEvents(alarmData, source = 'push') {
        if (!alarmData) {return;}

        this._initializeAlarmEvents();

        const alarmArray = Array.isArray(alarmData) ? alarmData : [alarmData];

        for (const alarmEvent of alarmArray) {
            const oldEvents = [...this._lastAlarmEvents];
            this._lastAlarmEvents.unshift(alarmEvent);

            if (this._lastAlarmEvents.length > MAX_ALARM_EVENTS_MEMORY) {
                this._lastAlarmEvents = this._lastAlarmEvents.slice(0, MAX_ALARM_EVENTS_MEMORY);
            }

            const channel = alarmEvent.channel !== undefined ? alarmEvent.channel : 0;
            this.emit('stateChange', {
                type: 'alarm',
                channel,
                value: alarmEvent,
                oldValue: oldEvents.length > 0 ? oldEvents[0] : undefined,
                source,
                timestamp: Date.now()
            });
        }
    }
};

