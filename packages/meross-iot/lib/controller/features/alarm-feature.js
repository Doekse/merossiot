'use strict';

const { normalizeChannel, validateRequired } = require('../../utilities/options');

const MAX_ALARM_EVENTS_MEMORY = 10;

/**
 * Creates an alarm feature object for a device.
 *
 * Handles alarm status queries, alarm control (on/off), alarm configuration (volume/tone),
 * and maintains a buffer of recent alarm events.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Alarm feature object with set(), setConfig(), get(), and getLastEvents() methods
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
         * Sets the alarm state (on/off) for a channel.
         *
         * Controls alarm devices like MSH450 Internal Siren using the security field.
         * Value 1 = Execute (ON), Value 2 = Normal (OFF).
         *
         * @param {Object} options - Alarm control options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {boolean} options.on - True to turn alarm on, false to turn off
         * @param {number} [options.duration] - Optional duration in seconds
         * @returns {Promise<Object>} Promise that resolves with the response
         * @throws {MerossErrorValidation} If required options are missing
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         */
        async set(options = {}) {
            validateRequired(options, ['on']);
            const channel = normalizeChannel(options);
            const value = options.on ? 1 : 2;

            const securityEvent = {
                value
            };

            if (options.duration !== undefined) {
                securityEvent.time = options.duration;
            }

            const payload = {
                alarm: [{
                    channel,
                    event: {
                        security: securityEvent
                    }
                }]
            };

            const response = await device.publishMessage('SET', 'Appliance.Control.Alarm', payload);

            if (response && response.alarm) {
                updateAlarmEvents(device, response.alarm, 'response');
            }

            return response;
        },

        /**
         * Sets alarm configuration (volume, tone, enable) for a channel.
         *
         * Requires Appliance.Config.Alarm capability. Used for configuring alarm devices
         * like MSH450 Internal Siren with volume and ringtone settings.
         *
         * @param {Object} options - Alarm configuration options
         * @param {number} [options.channel=0] - Channel to configure (default: 0)
         * @param {number} options.enable - Enable state (typically 1 for enabled)
         * @param {number} options.volume - Volume level (0-100)
         * @param {number} options.song - Ringtone/song selection (typically 1-7)
         * @returns {Promise<Object>} Promise that resolves with the response
         * @throws {MerossErrorValidation} If required options are missing
         * @throws {MerossErrorUnknownDeviceType} If device does not support Appliance.Config.Alarm
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         */
        async setConfig(options = {}) {
            if (!device.abilities || !device.abilities['Appliance.Config.Alarm']) {
                const { MerossErrorUnknownDeviceType } = require('../../model/exception');
                throw new MerossErrorUnknownDeviceType('Device does not support Appliance.Config.Alarm', device.deviceType);
            }

            validateRequired(options, ['enable', 'volume', 'song']);
            const channel = normalizeChannel(options);

            const payload = {
                config: [{
                    channel,
                    enable: options.enable,
                    volume: options.volume,
                    song: options.song
                }]
            };

            return await device.publishMessage('SET', 'Appliance.Config.Alarm', payload);
        },

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
 * Updates the alarm events buffer from push notification or response data.
 *
 * Maintains a rolling buffer of recent alarm events for querying without
 * requiring device communication.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} alarmData - Alarm data (single object or array)
 * @param {string} [source='push'] - Source of the update ('push', 'response', etc.)
 */
function updateAlarmEvents(device, alarmData, source = 'push') {
    if (!alarmData) {
        return;
    }

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
 * Determines which channels support alarm functionality based on device abilities.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Alarm capability object or null if not supported
 */
function getAlarmCapabilities(device, channelIds) {
    if (!device.abilities || !device.abilities['Appliance.Control.Alarm']) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createAlarmFeature;
module.exports._updateAlarmEvents = updateAlarmEvents;
module.exports.getCapabilities = getAlarmCapabilities;
