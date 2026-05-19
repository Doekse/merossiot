'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for device alarm events.
 *
 * Handles alarm notifications from both standalone devices and hub subdevices.
 * The alarm data structure varies: standalone devices send alarm data directly,
 * while hub sensors include interconnection data with source subdevice information.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof AlarmPushNotification) {
 *         console.log('Alarm triggered on channel:', notification.channel);
 *         console.log('Alarm value:', notification.value);
 *         console.log('Timestamp:', notification.timestamp);
 *         if (notification.subdeviceId) {
 *             console.log('From subdevice:', notification.subdeviceId);
 *         }
 *     }
 * });
 */
class AlarmPushNotification extends GenericPushNotification {
    /**
     * Creates a new AlarmPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.alarm] - Alarm event data (single object or array)
     * @param {number} [rawData.alarm.channel] - Channel number where alarm occurred
     * @param {Object} [rawData.alarm.event] - Alarm event details
     * @param {Object} [rawData.alarm.event.interConn] - Interconnection data
     * @param {*} [rawData.alarm.event.interConn.value] - Alarm value
     * @param {number} [rawData.alarm.event.interConn.timestamp] - Alarm timestamp
     * @param {Object|Array} [rawData.alarm.event.interConn.source] - Source device data
     * @param {string|number} [rawData.alarm.event.interConn.source.subId] - Subdevice ID if from hub sensor
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Alarm', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const alarmRaw = rawData?.alarm;
        const alarm = GenericPushNotification.normalizeToArray(alarmRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && alarmRaw !== alarm) {
            rawData.alarm = alarm;
        }

        if (alarm && alarm.length > 0) {
            const alarmEvent = alarm[0];
            this._channel = alarmEvent?.channel;

            const interConn = alarmEvent?.event?.interConn;
            if (interConn) {
                this._value = interConn.value;
                this._timestamp = interConn.timestamp;

                const { source } = interConn;
                const sourceArray = GenericPushNotification.normalizeToArray(source);
                if (sourceArray && sourceArray.length > 0) {
                    this._subDeviceId = sourceArray[0]?.subId;
                }
            }
        }
    }

    /**
     * Gets the alarm value.
     *
     * @returns {*} Alarm value or undefined if not available
     */
    get value() {
        return this._value;
    }

    /**
     * Gets the alarm timestamp.
     *
     * @returns {number|undefined} Timestamp when alarm occurred or undefined if not available
     */
    get timestamp() {
        return this._timestamp;
    }

    /**
     * Gets the channel number where the alarm occurred.
     *
     * @returns {number|undefined} Channel number or undefined if not available
     */
    get channel() {
        return this._channel;
    }

    /**
     * Gets the subdevice ID if alarm originated from a hub subdevice.
     *
     * Only present when the alarm comes from a hub sensor subdevice, not standalone devices.
     *
     * @returns {string|number|undefined} Subdevice ID or undefined if not from a subdevice
     */
    get subdeviceId() {
        return this._subDeviceId;
    }
}

module.exports = AlarmPushNotification;

