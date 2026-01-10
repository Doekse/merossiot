'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub sensor complete state updates.
 *
 * Emitted when a hub sensor subdevice sends a complete state update (all sensor parameters).
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotification', (notification) => {
 *     if (notification instanceof HubSensorAllPushNotification) {
 *         const allData = notification.allData;
 *         allData.forEach(sensor => {
 *             console.log('Sensor complete update:', sensor.id);
 *         });
 *     }
 * });
 */
class HubSensorAllPushNotification extends GenericPushNotification {
    /**
     * Creates a new HubSensorAllPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.all] - Complete sensor state data (single object or array)
     * @param {string|number} [rawData.all.id] - Subdevice ID
     * @param {*} [rawData.all.*] - Various sensor-specific data fields
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Sensor.All', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const allRaw = rawData?.all;
        const all = GenericPushNotification.normalizeToArray(allRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && allRaw !== all) {
            rawData.all = all;
        }

        this._allData = all;
    }

    /**
     * Gets the complete sensor state data array.
     *
     * @returns {Array} Array of sensor state objects (empty array if no data)
     */
    get allData() {
        return this._allData;
    }
}

module.exports = HubSensorAllPushNotification;

