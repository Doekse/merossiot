'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub subdevice battery status updates.
 *
 * Emitted when a hub subdevice's battery status changes or is updated.
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotification', (notification) => {
 *     if (notification instanceof HubBatteryPushNotification) {
 *         const batteryData = notification.batteryData;
 *         batteryData.forEach(device => {
 *             console.log('Subdevice battery:', device.id, device.battery, '%');
 *         });
 *     }
 * });
 */
class HubBatteryPushNotification extends GenericPushNotification {
    /**
     * Creates a new HubBatteryPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.battery] - Battery status data (single object or array)
     * @param {string|number} [rawData.battery.id] - Subdevice ID
     * @param {number} [rawData.battery.battery] - Battery level (typically 0-100)
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Battery', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const batteryRaw = rawData?.battery;
        const battery = GenericPushNotification.normalizeToArray(batteryRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && batteryRaw !== battery) {
            rawData.battery = battery;
        }

        this._batteryData = battery;
    }

    /**
     * Gets the battery status data array.
     *
     * @returns {Array} Array of battery status objects (empty array if no data)
     */
    get batteryData() {
        return this._batteryData;
    }
}

module.exports = HubBatteryPushNotification;

