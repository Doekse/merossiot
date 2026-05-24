'use strict';

const { MerossDeviceError } = require('../exception');
const { normalizeChannel, validateRequired } = require('../utilities/options');
const { registerNamespaceDescriptor } = require('../dispatcher');
const { AlarmActionCodec } = require('../enums');
const { normalizeAlarmItem } = require('../utilities/normalize-payload');

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
function createAlarmAbility(device) {
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
         * @param {Object} options - Alarm control options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {boolean} [options.on] - True to turn alarm on, false to turn off
         * @param {'execute'|'normal'} [options.action] - Explicit alarm action (overrides `on`)
         * @param {number} [options.duration] - Optional duration in seconds
         * @returns {Promise<Object>} Promise that resolves with the response
         * @throws {MerossDeviceError} If required options are missing, device is not connected, or command times out
         */
        async set(options = {}) {
            if (options.action === undefined && options.on === undefined) {
                throw new MerossDeviceError('on or action is required', 'VALIDATION_ERROR', { field: 'on' });
            }
            const channel = normalizeChannel(options);
            const actionStr = options.action !== undefined
                ? options.action
                : (options.on ? 'execute' : 'normal');
            const value = AlarmActionCodec.toWire(actionStr);
            if (value === undefined) {
                throw new MerossDeviceError('Invalid alarm action', 'VALIDATION_ERROR', { field: 'action', value: actionStr });
            }

            const securityEvent = { value };

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

            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Alarm', payload);

            if (response && response.alarm) {
                updateAlarmEvents(device, response.alarm, 'response');
            }

            return response;
        },

        /**
         * Sets alarm configuration (volume, tone, enable) for a channel.
         *
         * @param {Object} options - Alarm configuration options
         * @param {number} [options.channel=0] - Channel to configure (default: 0)
         * @param {number} options.enable - Enable state (typically 1 for enabled)
         * @param {number} options.volume - Volume level (0-100)
         * @param {number} options.song - Ringtone/song selection (typically 1-7)
         * @returns {Promise<Object>} Promise that resolves with the response
         */
        async setConfig(options = {}) {
            if (!device.abilities || !device.abilities['Appliance.Config.Alarm']) {
                throw new MerossDeviceError('Device does not support Appliance.Config.Alarm', 'UNKNOWN_DEVICE_TYPE', { deviceType: device.deviceType });
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

            const { payload: out } = await device.publishMessage('SET', 'Appliance.Config.Alarm', payload);
            return out;
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
            const payload = { alarm: [{ channel }] };
            const { payload: out } = await device.publishMessage('GET', 'Appliance.Control.Alarm', payload);
            return out;
        },

        /**
         * Gets a copy of the most recent alarm events with decoded `event` fields.
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

    for (const raw of alarmArray) {
        const alarmEvent = normalizeAlarmItem(raw);
        device._lastAlarmEvents.unshift(alarmEvent);

        if (device._lastAlarmEvents.length > MAX_ALARM_EVENTS_MEMORY) {
            device._lastAlarmEvents = device._lastAlarmEvents.slice(0, MAX_ALARM_EVENTS_MEMORY);
        }

        const channel = alarmEvent.channel !== undefined ? alarmEvent.channel : 0;
        device.emit('stateChange', {
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
    return {
        supported: true,
        channels: channelIds
    };
}

registerNamespaceDescriptor('Appliance.Control.Alarm', {
    namespace: 'Appliance.Control.Alarm',
    payloadKey: 'alarm',
    customApplyItem: (device, item, source) => {
        updateAlarmEvents(device, item, source);
    }
});

module.exports = createAlarmAbility;
module.exports.updateAlarmEvents = updateAlarmEvents;
module.exports.getCapabilities = getAlarmCapabilities;
module.exports.ability = {
    key: 'alarm',
    namespaces: ['Appliance.Control.Alarm'],
    caches: [],
    create: createAlarmAbility,
    getCapabilities: getAlarmCapabilities
};
