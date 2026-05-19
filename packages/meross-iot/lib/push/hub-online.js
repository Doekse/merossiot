'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub subdevice online status changes.
 *
 * Emitted when a hub subdevice's online status changes.
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof HubOnlinePushNotification) {
 *         const onlineData = notification.onlineData;
 *         onlineData.forEach(device => {
 *             console.log('Subdevice online status:', device.id, device.status);
 *         });
 *     }
 * });
 */
class HubOnlinePushNotification extends GenericPushNotification {
    /**
     * Creates a new HubOnlinePushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.online] - Online status data (single object or array)
     * @param {string|number} [rawData.online.id] - Subdevice ID
     * @param {number} [rawData.online.status] - Online status value
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Online', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const onlineRaw = rawData?.online;
        const online = GenericPushNotification.normalizeToArray(onlineRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && onlineRaw !== online) {
            rawData.online = online;
        }

        this._onlineData = online;
    }

    /**
     * Gets the online status data array.
     *
     * @returns {Array} Array of online status objects (empty array if no data)
     */
    get onlineData() {
        return this._onlineData;
    }
}

module.exports = HubOnlinePushNotification;

