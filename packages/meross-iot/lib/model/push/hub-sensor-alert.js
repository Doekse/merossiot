'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub sensor alert events.
 *
 * Emitted when a hub sensor subdevice triggers an alert (e.g., temperature threshold exceeded,
 * humidity alert, etc.). Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof HubSensorAlertPushNotification) {
 *         const alertData = notification.alertData;
 *         alertData.forEach(alert => {
 *             console.log('Sensor alert from subdevice:', alert.id);
 *             console.log('Alert type:', alert.type);
 *             console.log('Alert value:', alert.value);
 *         });
 *     }
 * });
 */
class HubSensorAlertPushNotification extends GenericPushNotification {
    /**
     * Creates a new HubSensorAlertPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.alert] - Alert data (single object or array)
     * @param {string|number} [rawData.alert.id] - Subdevice ID
     * @param {*} [rawData.alert.*] - Alert-specific data fields
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Sensor.Alert', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const alertRaw = rawData?.alert;
        const alert = GenericPushNotification.normalizeToArray(alertRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && alertRaw !== alert) {
            rawData.alert = alert;
        }

        this._alertData = alert;
    }

    /**
     * Gets the alert data array.
     *
     * @returns {Array} Array of alert objects (empty array if no data)
     */
    get alertData() {
        return this._alertData;
    }
}

module.exports = HubSensorAlertPushNotification;

