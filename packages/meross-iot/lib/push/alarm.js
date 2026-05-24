'use strict';

const GenericPushNotification = require('./generic');
const { decodeAlarmEventField } = require('../utilities/normalize-payload');

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
 *         console.log('Alarm action:', notification.action);
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
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Alarm', originatingDeviceUuid, rawData);

        const alarmRaw = rawData?.alarm;
        const alarm = GenericPushNotification.normalizeToArray(alarmRaw);

        if (rawData && alarmRaw !== alarm) {
            rawData.alarm = alarm;
        }

        if (alarm && alarm.length > 0) {
            const alarmEvent = alarm[0];
            this._channel = alarmEvent?.channel;

            const event = alarmEvent?.event;
            const interConn = event?.interConn;
            const security = event?.security;
            const maSecurity = event?.maSecurity;
            const primary = interConn || security || maSecurity;

            if (primary) {
                const decoded = decodeAlarmEventField(primary);
                this._action = decoded.action;
                this._scope = decoded.scope;
                this._timestamp = primary.timestamp ?? decoded.timestamp;
            }

            if (interConn) {
                const { source } = interConn;
                const sourceArray = GenericPushNotification.normalizeToArray(source);
                if (sourceArray && sourceArray.length > 0) {
                    this._subDeviceId = sourceArray[0]?.subId;
                }
            }
        }
    }

    /**
     * Gets the decoded alarm action.
     *
     * @returns {'execute'|'normal'|undefined}
     */
    get action() {
        return this._action;
    }

    /**
     * Gets the decoded interconnection scope when present.
     *
     * @returns {'local'|'all-except-source'|'all-including-source'|undefined}
     */
    get scope() {
        return this._scope;
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
     * @returns {string|number|undefined} Subdevice ID or undefined if not from a subdevice
     */
    get subdeviceId() {
        return this._subDeviceId;
    }
}

module.exports = AlarmPushNotification;
