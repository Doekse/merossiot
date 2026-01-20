'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub MTS100 thermostat valve mode changes.
 *
 * Emitted when a hub MTS100 thermostat valve's mode changes.
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof HubMts100ModePushNotification) {
 *         const modeData = notification.modeData;
 *         modeData.forEach(thermostat => {
 *             console.log('MTS100 mode changed:', thermostat.id, thermostat.mode);
 *         });
 *     }
 * });
 */
class HubMts100ModePushNotification extends GenericPushNotification {
    /**
     * Creates a new HubMts100ModePushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.mode] - Thermostat mode data (single object or array)
     * @param {string|number} [rawData.mode.id] - Subdevice ID
     * @param {number} [rawData.mode.mode] - Thermostat mode value
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Mts100.Mode', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const modeRaw = rawData?.mode;
        const mode = GenericPushNotification.normalizeToArray(modeRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && modeRaw !== mode) {
            rawData.mode = mode;
        }

        this._modeData = mode;
    }

    /**
     * Gets the thermostat mode data array.
     *
     * @returns {Array} Array of mode objects (empty array if no data)
     */
    get modeData() {
        return this._modeData;
    }
}

module.exports = HubMts100ModePushNotification;

