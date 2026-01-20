'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub smoke detector alarm events.
 *
 * Emitted when a hub smoke detector subdevice triggers an alarm or sends status updates.
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof HubSensorSmokePushNotification) {
 *         console.log('Smoke alarm from subdevice:', notification.subdeviceId);
 *         console.log('Status:', notification.status);
 *         console.log('Timestamp:', notification.timestamp);
 *         if (notification.testEvent) {
 *             console.log('This is a test event');
 *         }
 *     }
 * });
 */
class HubSensorSmokePushNotification extends GenericPushNotification {
    /**
     * Creates a new HubSensorSmokePushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.smokeAlarm] - Smoke alarm data (single object or array)
     * @param {string|number} [rawData.smokeAlarm.id] - Subdevice ID
     * @param {number} [rawData.smokeAlarm.status] - Alarm status (from SmokeAlarmStatus enum)
     * @param {Object} [rawData.smokeAlarm.interConn] - Interconnection data
     * @param {number} [rawData.smokeAlarm.timestamp] - Alarm timestamp
     * @param {Object} [rawData.smokeAlarm.event] - Event details
     * @param {boolean} [rawData.smokeAlarm.event.test] - Whether this is a test event
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Sensor.Smoke', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const smokeAlarmRaw = rawData?.smokeAlarm;
        const smokeAlarm = GenericPushNotification.normalizeToArray(smokeAlarmRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && smokeAlarmRaw !== smokeAlarm) {
            rawData.smokeAlarm = smokeAlarm;
        }

        if (smokeAlarm && smokeAlarm.length > 0) {
            const event = smokeAlarm[0];
            this._subDeviceId = event?.id;
            this._status = event?.status;
            this._interConn = event?.interConn;
            this._timestamp = event?.timestamp;
            this._testEvent = event?.event?.test;
        }
    }

    /**
     * Gets the subdevice ID of the smoke detector.
     *
     * @returns {string|number|undefined} Subdevice ID or undefined if not available
     */
    get subdeviceId() {
        return this._subDeviceId;
    }

    /**
     * Gets the alarm status.
     *
     * @returns {number|undefined} Status value (from SmokeAlarmStatus enum) or undefined if not available
     * @see {@link module:lib/enums.SmokeAlarmStatus} for status constants
     */
    get status() {
        return this._status;
    }

    /**
     * Gets the interconnection data.
     *
     * @returns {Object|undefined} Interconnection data object or undefined if not available
     */
    get interConn() {
        return this._interConn;
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
     * Gets whether this is a test event.
     *
     * @returns {boolean|undefined} True if test event, false if real alarm, undefined if not available
     */
    get testEvent() {
        return this._testEvent;
    }
}

module.exports = HubSensorSmokePushNotification;

