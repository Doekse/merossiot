'use strict';

const { normalizeChannel } = require('../../utilities/options');

const MAX_ALARM_EVENTS_MEMORY = 10;

/**
 * Creates an alarm feature object for a device.
 *
 * Handles alarm status queries and maintains a buffer of recent alarm events.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Alarm feature object with get() and getLastEvents() methods
 */
function createAlarmFeature(device) {
    /**
     * Initializes alarm events storage.
     *
     * @private
     */
    function initializeAlarmEvents() {
        if (!device._lastAlarmEvents) {
            device._lastAlarmEvents = [];
        }
    }

    return {
        /**
         * Gets the current alarm status from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get alarm status for (default: 0)
         * @returns {Promise<Object>} Alarm status response with `alarm` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { 'alarm': [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Alarm', payload);
        },

        /**
         * Gets a copy of the most recent alarm events.
         *
         * @returns {Array<Object>} Copy of the alarm events array (most recent first)
         */
        getLastEvents() {
            initializeAlarmEvents();
            return [...device._lastAlarmEvents];
        }
    };
}

/**
 * Updates the alarm events buffer from push notification data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} alarmData - Alarm data (single object or array)
 * @param {string} [source='push'] - Source of the update
 */
function updateAlarmEvents(device, alarmData, source = 'push') {
    if (!alarmData) {return;}

    if (!device._lastAlarmEvents) {
        device._lastAlarmEvents = [];
    }

    const alarmArray = Array.isArray(alarmData) ? alarmData : [alarmData];

    for (const alarmEvent of alarmArray) {
        device._lastAlarmEvents.unshift(alarmEvent);

        if (device._lastAlarmEvents.length > MAX_ALARM_EVENTS_MEMORY) {
            device._lastAlarmEvents = device._lastAlarmEvents.slice(0, MAX_ALARM_EVENTS_MEMORY);
        }

        const channel = alarmEvent.channel !== undefined ? alarmEvent.channel : 0;
        device.emit('state', {
            type: 'alarm',
            channel,
            value: alarmEvent,
            source,
            timestamp: Date.now()
        });
    }
}

/**
 * Gets alarm capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Alarm capability object or null if not supported
 */
function getAlarmCapabilities(device, channelIds) {
    if (!device.abilities || !device.abilities['Appliance.Control.Alarm']) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createAlarmFeature;
module.exports._updateAlarmEvents = updateAlarmEvents;
module.exports.getCapabilities = getAlarmCapabilities;
